import os
import sys
import copy
import re
import time
import string
import logging
import subprocess
import platform
import glob
import shutil
import threading
import importlib.util

logger = logging.getLogger(__name__)

ARIA2_MAX_CONNECTIONS = 16
ARIA2_MIN_SPLIT_SIZE = '1M'
YTDLP_CONCURRENT_FRAGMENTS = 8
INFO_CACHE_TTL_SECONDS = 300
LOCAL_MEDIA_CACHE_TTL_SECONDS = 1800
YTDLP_DEFAULT_JS_RUNTIMES = ('deno', 'node')
DOWNLOAD_STAGE_PREPARING = 'preparing'
DOWNLOAD_STAGE_RESOLVING = 'resolving'
DOWNLOAD_STAGE_DOWNLOADING = 'downloading'
DOWNLOAD_STAGE_CLIPPING = 'clipping'
DOWNLOAD_STAGE_IMPORTING = 'importing'
DOWNLOAD_STAGE_COMPLETE = 'complete'
DOWNLOAD_STAGE_FAILED = 'failed'

# Resolve paths for bundled exe vs dev
if getattr(sys, 'frozen', False):
    # PyInstaller exe: tools are next to the exe
    script_dir = os.path.dirname(sys.executable)
    base_path = getattr(sys, '_MEIPASS', script_dir)
else:
    # Dev mode: backend/ folder, tools are in ../tools/
    script_dir = os.path.dirname(os.path.abspath(__file__))
    base_path = os.path.dirname(script_dir)  # project root


def _find_tool(*candidates):
    """Return first existing path, or the last candidate as fallback."""
    for c in candidates:
        if os.path.isfile(c) or shutil.which(c):
            return c
    return candidates[-1] if candidates else ''


def _tool_exists(tool_path):
    return bool(tool_path) and (os.path.isfile(tool_path) or bool(shutil.which(tool_path)))


if platform.system() == 'Windows':
    ffmpeg_path = _find_tool(
        os.path.join(script_dir, 'ffmpeg_win', 'bin', 'ffmpeg.exe'),  # frozen exe layout
        os.path.join(base_path, 'tools', 'ffmpeg_win', 'bin', 'ffmpeg.exe'),  # dev layout
        'ffmpeg',  # system PATH fallback
    )
    yt_dlp_path = _find_tool(
        os.path.join(script_dir, '_include', 'yt-dlp.exe'),  # frozen exe layout
        os.path.join(base_path, 'tools', 'yt-dlp.exe'),  # dev layout
        'yt-dlp',
    )
    aria2c_path = _find_tool(
        os.path.join(script_dir, 'aria2c', 'aria2c.exe'),
        os.path.join(base_path, 'tools', 'aria2c', 'aria2c.exe'),
    )
    deno_path = _find_tool(
        os.path.join(script_dir, 'deno', 'deno.exe'),
        os.path.join(base_path, 'tools', 'deno', 'deno.exe'),
        'deno',
    )
    node_path = _find_tool(
        os.path.join(script_dir, 'nodejs', 'node.exe'),
        os.path.join(base_path, 'tools', 'nodejs', 'node.exe'),
        'node',
    )
elif platform.system() == 'Darwin':
    ffmpeg_path = _find_tool(
        os.path.join(script_dir, '_internal', 'ffmpeg', 'bin', 'ffmpeg'),
        'ffmpeg',
    )
    yt_dlp_path = _find_tool(os.path.join(script_dir, 'yt-dlp'), 'yt-dlp')
    aria2c_path = None
    deno_path = _find_tool(os.path.join(script_dir, 'deno', 'deno'), 'deno')
    node_path = _find_tool('node')
else:
    ffmpeg_path = 'ffmpeg'
    yt_dlp_path = 'yt-dlp'
    aria2c_path = None
    deno_path = 'deno'
    node_path = 'node'

# Add ffmpeg directory to PATH so yt-dlp's static FFmpegFD.available() check
# can find ffmpeg (it only checks system PATH, not ffmpeg_location param).
if os.path.isfile(ffmpeg_path):
    ffmpeg_dir = str(os.path.dirname(ffmpeg_path))
    if ffmpeg_dir not in os.environ.get('PATH', ''):
        os.environ['PATH'] = ffmpeg_dir + os.pathsep + os.environ.get('PATH', '')
        logger.info(f"Added ffmpeg dir to PATH: {ffmpeg_dir}")

logger.info(
    'Tool paths - ffmpeg: %s, yt-dlp: %s, aria2c: %s, deno: %s, node: %s',
    ffmpeg_path,
    yt_dlp_path,
    aria2c_path,
    deno_path,
    node_path,
)

# Import yt_dlp AFTER modifying PATH so its internal cache detects ffmpeg
import yt_dlp as youtube_dl

# socketio instance set by server.py at startup
socketio = None
_info_cache = {}
_info_cache_lock = threading.Lock()
_info_cache_inflight = {}
_local_media_cache = {}
_local_media_cache_lock = threading.Lock()

MAX_CACHE_SIZE = 100


def set_socketio(sio):
    global socketio
    socketio = sio


def _yt_dlp_ejs_available():
    return importlib.util.find_spec('yt_dlp_ejs') is not None


def _get_js_runtimes_config():
    runtimes = {}
    for runtime_name, runtime_path in (
        ('deno', deno_path),
        ('node', node_path),
    ):
        if runtime_name not in YTDLP_DEFAULT_JS_RUNTIMES:
            continue
        if not _tool_exists(runtime_path):
            continue
        runtime_config = {}
        if os.path.isfile(runtime_path):
            runtime_config['path'] = runtime_path
        elif runtime_path not in {runtime_name}:
            runtime_config['path'] = runtime_path
        runtimes[runtime_name] = runtime_config
    return runtimes


def _build_base_ydl_opts():
    opts = {
        'quiet': True,
        'writesubtitles': False,
        'writeautomaticsub': False,
        'writethumbnail': False,
        'nooverwrites': False,
        'concurrent_fragment_downloads': YTDLP_CONCURRENT_FRAGMENTS,
    }
    if _tool_exists(ffmpeg_path):
        opts['ffmpeg_location'] = ffmpeg_path
    js_runtimes = _get_js_runtimes_config()
    if js_runtimes:
        opts['js_runtimes'] = js_runtimes
    if not _yt_dlp_ejs_available():
        logger.warning('yt_dlp_ejs is not installed; YouTube format availability may be degraded')
    return opts


def _get_resolution_ceiling(resolution):
    try:
        return max(1, int(resolution))
    except (TypeError, ValueError):
        return 1080


def _make_info_cache_key(video_url, format_spec=None):
    return (str(video_url or '').strip(), str(format_spec or '').strip())


def _parse_resolution_value(resolution):
    try:
        return int(str(resolution or '').strip())
    except (TypeError, ValueError):
        return None


def _get_cached_info(cache_key):
    with _info_cache_lock:
        cached_entry = _info_cache.get(cache_key)
        if not cached_entry:
            return None
        if cached_entry['expires_at'] < time.time():
            _info_cache.pop(cache_key, None)
            return None
        return copy.deepcopy(cached_entry['value'])


def _store_cached_info(cache_key, value):
    with _info_cache_lock:
        # LRU eviction if cache is full
        if len(_info_cache) >= MAX_CACHE_SIZE:
            oldest_key = next(iter(_info_cache))
            _info_cache.pop(oldest_key, None)
        _info_cache[cache_key] = {
            'expires_at': time.time() + INFO_CACHE_TTL_SECONDS,
            'value': copy.deepcopy(value),
        }


def _resolve_inflight_info(cache_key):
    # Check cache under lock to avoid TOCTOU race
    with _info_cache_lock:
        cached_entry = _info_cache.get(cache_key)
        if cached_entry and cached_entry['expires_at'] >= time.time():
            return copy.deepcopy(cached_entry['value']), None

        inflight_event = _info_cache_inflight.get(cache_key)
        if inflight_event is None:
            inflight_event = threading.Event()
            _info_cache_inflight[cache_key] = inflight_event
            return None, inflight_event

    # Wait outside the lock for the inflight request to complete
    inflight_event.wait(timeout=15)
    # After waiting, loop back to check cache again (caller handles this)
    return None, None


def _complete_inflight_info(cache_key):
    with _info_cache_lock:
        inflight_event = _info_cache_inflight.pop(cache_key, None)
        if inflight_event:
            inflight_event.set()


def _emit_download_state(request_id, stage, percentage=None, detail=None, indeterminate=None):
    if not socketio or not request_id:
        return

    payload = {
        'requestId': request_id,
        'stage': stage,
        'indeterminate': bool(indeterminate if indeterminate is not None else percentage is None),
    }
    if percentage is not None:
        payload['percentage'] = str(percentage).strip()
    if detail:
        payload['detail'] = str(detail).strip()
    socketio.emit('download-progress', payload, to=request_id)


def _emit_download_stage(request_id, stage, detail=None):
    _emit_download_state(request_id, stage, detail=detail, indeterminate=True)


def _emit_progress(request_id, pct_display, stage=DOWNLOAD_STAGE_DOWNLOADING, detail=None):
    _emit_download_state(
        request_id,
        stage,
        percentage=pct_display,
        detail=detail,
        indeterminate=False,
    )


def _register_local_media_cache(video_url, media_kind, resolution, file_path):
    normalized_path = os.path.abspath(file_path)
    if not os.path.isfile(normalized_path):
        return

    cache_key = (str(video_url or '').strip(), str(media_kind or '').strip(), str(resolution or '').strip())
    with _local_media_cache_lock:
        _local_media_cache[cache_key] = {
            'path': normalized_path,
            'expires_at': time.time() + LOCAL_MEDIA_CACHE_TTL_SECONDS,
        }


def _get_local_media_cache(video_url, requested_media_kind, resolution):
    requested_resolution = str(resolution or '').strip()
    requested_resolution_value = _parse_resolution_value(requested_resolution)
    candidate_kinds = []
    if requested_media_kind == 'audio':
        candidate_kinds = ['audio']
    elif requested_media_kind == 'video_only':
        candidate_kinds = ['video_only', 'muxed']
    else:
        candidate_kinds = ['muxed']

    with _local_media_cache_lock:
        items = list(_local_media_cache.items())
        for media_kind in candidate_kinds:
            resolution_keys = [requested_resolution]
            if media_kind == 'audio':
                resolution_keys = [requested_resolution, '', 'audio']

            for resolution_key in resolution_keys:
                cache_key = (str(video_url or '').strip(), media_kind, resolution_key)
                cached_entry = _local_media_cache.get(cache_key)
                if not cached_entry:
                    continue
                if cached_entry['expires_at'] < time.time() or not os.path.isfile(cached_entry['path']):
                    _local_media_cache.pop(cache_key, None)
                    continue
                return cached_entry['path']

        if requested_media_kind != 'audio' and requested_resolution_value is not None:
            fallback_candidates = []
            for cache_key, cached_entry in items:
                cached_url, cached_kind, cached_resolution = cache_key
                if cached_url != str(video_url or '').strip() or cached_kind not in candidate_kinds:
                    continue
                if cached_entry['expires_at'] < time.time() or not os.path.isfile(cached_entry['path']):
                    _local_media_cache.pop(cache_key, None)
                    continue
                cached_resolution_value = _parse_resolution_value(cached_resolution)
                if cached_resolution_value is None or cached_resolution_value < requested_resolution_value:
                    continue
                fallback_candidates.append((cached_resolution_value, cached_entry['path']))

            if fallback_candidates:
                fallback_candidates.sort(key=lambda item: item[0])
                return fallback_candidates[0][1]
    return None


def sanitize_title(title):
    valid_chars = "-_.() %s%s" % (string.ascii_letters, string.digits)
    return ''.join(c for c in title if c in valid_chars).strip()


def generate_new_filename(base_path, original_name, extension, suffix=""):
    base_filename = f"{original_name}{suffix}.{extension}"
    if not os.path.exists(os.path.join(base_path, base_filename)):
        return base_filename
    counter = 1
    new_name = f"{original_name}{suffix}_{counter}.{extension}"
    while os.path.exists(os.path.join(base_path, new_name)):
        counter += 1
        new_name = f"{original_name}{suffix}_{counter}.{extension}"
    return new_name


def _list_related_outputs(output_path):
    root, _ = os.path.splitext(output_path)
    pattern = f"{glob.escape(root)}.*"
    return {
        candidate
        for candidate in glob.glob(pattern)
        if os.path.isfile(candidate)
    }


def _cleanup_failed_output(output_path, existing_candidates=None):
    """Best-effort cleanup for new partial yt-dlp/ffmpeg artifacts."""
    candidates = _list_related_outputs(output_path)
    if existing_candidates is not None:
        candidates = {candidate for candidate in candidates if candidate not in existing_candidates}
    candidates.add(f"{output_path}.part")

    for candidate in candidates:
        if not os.path.isfile(candidate):
            continue
        try:
            os.remove(candidate)
        except OSError:
            logger.warning(f"Could not remove partial artifact: {candidate}")


def _resolve_output_path(expected_path, existing_candidates=None):
    """Return the final output path even if yt-dlp changed the extension."""
    if os.path.isfile(expected_path):
        return expected_path

    candidates = {
        candidate
        for candidate in _list_related_outputs(expected_path)
        if not candidate.endswith('.part')
    }
    if existing_candidates is not None:
        candidates = {candidate for candidate in candidates if candidate not in existing_candidates}
    if not candidates:
        return None
    return max(candidates, key=os.path.getmtime)


def _run_yt_dlp_cli(cli_args):
    """Run yt-dlp's CLI entrypoint from the bundled Python module."""
    try:
        result = youtube_dl.main(cli_args)
        return int(result or 0)
    except SystemExit as exc:
        code = exc.code
        return code if isinstance(code, int) else 1


def _make_progress_hook(request_id, phase_count, video_weight=0.85, stage=DOWNLOAD_STAGE_DOWNLOADING, detail=None):
    """Return a progress_hook closure that maps multi-phase downloads to a
    single 0-100% range.

    For 2-phase downloads (video+audio with bestvideo+bestaudio):
    - Phase 1 (video): raw 0-100% → emitted 0-85%
    - Phase 2 (audio): raw 0-100% → emitted 85-100%

    For 1-phase downloads (single stream / audio-only):
    - Straight 0-100%, no rescaling.

    Phase transitions are detected from the active format id when available,
    otherwise we fall back to the filename.
    """
    state = {
        'current_phase': 0,
        'last_phase_key': None,
    }

    def hook(d):
        if not socketio or not request_id:
            return

        info_dict = d.get('info_dict') or {}
        filename = d.get('filename', '')
        phase_key = info_dict.get('format_id') or filename

        # Detect phase transitions across requested formats.
        if phase_key and phase_key != state['last_phase_key']:
            if state['last_phase_key'] is not None:
                state['current_phase'] += 1
            state['last_phase_key'] = phase_key

        phase = state['current_phase']

        if d['status'] == 'downloading':
            raw_pct = None

            # Try _percent_str first
            raw_pct_str = d.get('_percent_str', '')
            raw_pct_str = re.sub(r'\x1B\[[0-?]*[ -/]*[@-~]', '', raw_pct_str).strip()
            try:
                raw_pct = float(raw_pct_str.replace('%', ''))
            except (ValueError, AttributeError):
                pass

            # Fallback: calculate from downloaded_bytes / total_bytes
            if raw_pct is None:
                total = d.get('total_bytes') or d.get('total_bytes_estimate')
                downloaded = d.get('downloaded_bytes', 0)
                if total and total > 0:
                    raw_pct = (downloaded / total) * 100.0

            if raw_pct is None:
                return

            if phase_count == 1:
                # Single phase: straight mapping
                mapped_pct = raw_pct
            else:
                # Multi-phase mapping
                if phase == 0:
                    # Video phase: 0-100% → 0-video_weight
                    mapped_pct = raw_pct * video_weight
                else:
                    # Audio phase: 0-100% → video_weight-100%
                    audio_weight = 1.0 - video_weight
                    mapped_pct = video_weight * 100 + raw_pct * audio_weight

            pct_display = f"{mapped_pct:.1f}%"
            logger.info(f'Progress: {pct_display} (phase {phase + 1}/{phase_count})')
            _emit_progress(request_id, pct_display, stage=stage, detail=detail)

        elif d['status'] == 'finished':
            # When aria2c is used, we may only get 'finished' events.
            # Emit the end-of-phase percentage.
            if phase_count == 1:
                pct_display = "100.0%"
            elif phase == 0:
                pct_display = f"{video_weight * 100:.1f}%"
            else:
                pct_display = "100.0%"
            logger.info(f'Phase {phase + 1}/{phase_count} finished → {pct_display}')
            _emit_progress(request_id, pct_display, stage=stage, detail=detail)

    return hook


def _get_aria2c_opts():
    if aria2c_path and _tool_exists(aria2c_path):
        return {
            'external_downloader': {
                'default': aria2c_path,
                'dash': 'native',
                'm3u8': 'native',
            },
            'external_downloader_args': {
                'default': [
                    '-x', str(ARIA2_MAX_CONNECTIONS),
                    '-s', str(ARIA2_MAX_CONNECTIONS),
                    '-k', ARIA2_MIN_SPLIT_SIZE,
                    '--file-allocation=none',
                    '--summary-interval=0',
                ],
            },
        }
    return {}


def _get_base_ydl_opts(hook=None, allow_external_downloader=None):
    """Build base yt-dlp options. If hook is provided, use it; otherwise no
    progress hook is attached."""
    opts = _build_base_ydl_opts()
    if hook is not None:
        opts['progress_hooks'] = [hook]
        opts['format_sort'] = ['lang', 'quality', 'res', 'fps', 'hdr:12', 'vcodec:avc1', 'acodec:m4a', 'ext:mp4']
        opts['extractor_args'] = {
            'youtube': {
                'player_client': ['default'],
            },
        }
    if allow_external_downloader is None:
        # yt-dlp disables granular aria2 RPC progress upstream, so tracked
        # downloads need the native downloader to avoid coarse jumps.
        allow_external_downloader = hook is None
    if allow_external_downloader:
        opts.update(_get_aria2c_opts())
    return opts


def _get_selected_video_height(selected_info, fallback_resolution=''):
    requested_formats = selected_info.get('requested_formats') or []
    for item in requested_formats:
        vcodec = str(item.get('vcodec') or '').strip().lower()
        if vcodec in {'', 'none'}:
            continue
        height = _parse_resolution_value(item.get('height'))
        if height is not None:
            return str(height)

    height = _parse_resolution_value(selected_info.get('height'))
    if height is not None:
        return str(height)
    return str(fallback_resolution or '').strip()


def _build_format_selector(resolution, download_mp3=False, video_only=False):
    resolution_ceiling = _get_resolution_ceiling(resolution)
    if download_mp3:
        return 'bestaudio[ext=m4a]/bestaudio/best'
    if video_only:
        return (
            f'bv*[height<={resolution_ceiling}][vcodec^=avc1][ext=mp4]'
            f'/bv*[height<={resolution_ceiling}][ext=mp4]'
            f'/bv*[height<={resolution_ceiling}]'
            f'/bv*[vcodec^=avc1]'
            f'/bv*[ext=mp4]'
            f'/bv*'
            f'/best[height<={resolution_ceiling}][ext=mp4]'
            f'/best[height<={resolution_ceiling}]'
            f'/best'
        )
    return (
        f'bestvideo[height<={resolution_ceiling}][vcodec^=avc1][ext=mp4]+bestaudio[ext=m4a]'
        f'/bestvideo[height<={resolution_ceiling}][ext=mp4]+bestaudio[ext=m4a]'
        f'/bestvideo[height<={resolution_ceiling}]+bestaudio'
        f'/best[height<={resolution_ceiling}][ext=mp4]'
        f'/best[height<={resolution_ceiling}]'
        f'/best'
    )


def _build_format_sort(video_only=False):
    if video_only:
        return ['lang', 'quality', 'res', 'fps', 'vcodec:avc1', 'ext:mp4', 'proto:https', 'size', 'br']
    return ['lang', 'quality', 'res', 'fps', 'vcodec:avc1', 'acodec:m4a', 'ext:mp4', 'proto:https', 'size', 'br']


def _extract_info(video_url, format_spec=None):
    cache_key = _make_info_cache_key(video_url, format_spec)

    # Loop to handle inflight wait-and-retry
    max_attempts = 3
    for _ in range(max_attempts):
        cached_value, inflight_event = _resolve_inflight_info(cache_key)
        if cached_value is not None:
            return cached_value

        if inflight_event is None:
            # No inflight event means we should make the request
            break

        # Wait for inflight request to complete, then retry cache lookup
        inflight_event.wait(timeout=15)

    info_opts = _get_base_ydl_opts()
    if format_spec:
        info_opts['format'] = format_spec

    try:
        with youtube_dl.YoutubeDL(info_opts) as ydl:
            info = ydl.extract_info(video_url, download=False)
            if format_spec:
                processed_info = ydl.process_ie_result(info, download=False)
                if processed_info:
                    info = processed_info
            _store_cached_info(cache_key, info)
            return copy.deepcopy(info)
    finally:
        _complete_inflight_info(cache_key)


def _is_direct_http_input(format_info):
    protocol = str(format_info.get('protocol') or '').strip().lower()
    return (
        bool(format_info.get('url'))
        and protocol in {'http', 'https'}
        and not format_info.get('fragments')
    )


def _build_ffmpeg_headers(headers):
    if not headers:
        return []
    return ['-headers', ''.join(f'{key}: {value}\r\n' for key, value in headers.items())]


def _parse_ffmpeg_out_time(raw_value):
    try:
        hours, minutes, seconds = raw_value.strip().split(':')
        return int(hours) * 3600 + int(minutes) * 60 + float(seconds)
    except (TypeError, ValueError):
        return None


def _run_ffmpeg_with_progress(ffmpeg_cmd, duration_seconds, request_id, stage=DOWNLOAD_STAGE_CLIPPING, detail=None):
    last_reported_pct = -1.0
    if duration_seconds > 0:
        _emit_progress(request_id, '0.0%', stage=stage, detail=detail)
    process = subprocess.Popen(
        ffmpeg_cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        encoding='utf-8',
        errors='replace',
    )

    try:
        while True:
            line = process.stdout.readline() if process.stdout else ''
            if not line:
                if process.poll() is not None:
                    break
                continue

            line = line.strip()
            if line.startswith('out_time=') and duration_seconds > 0:
                current_seconds = _parse_ffmpeg_out_time(line.split('=', 1)[1])
                if current_seconds is None:
                    continue
                pct = min(99.5, max(0.0, (current_seconds / duration_seconds) * 100.0))
                if pct - last_reported_pct >= 0.5:
                    _emit_progress(request_id, f'{pct:.1f}%', stage=stage, detail=detail)
                    last_reported_pct = pct
            elif line == 'progress=end':
                break
    finally:
        return_code = process.wait()
        stderr = process.stderr.read() if process.stderr else ''

        if return_code != 0:
            raise RuntimeError(stderr.strip() or f'ffmpeg failed with exit code {return_code}')

        _emit_progress(request_id, '100.0%', stage=stage, detail=detail)


def _run_local_ffmpeg_trim(source_path, output_path, clip_start, clip_end, request_id=None, download_mp3=False, video_only=False):
    if not _tool_exists(ffmpeg_path):
        raise RuntimeError('FFmpeg is required for local clip generation')

    clip_duration = max(0.0, float(clip_end) - float(clip_start))
    if clip_duration <= 0:
        raise RuntimeError('Clip duration must be positive')

    cmd = [
        ffmpeg_path,
        '-y',
        '-hide_banner',
        '-loglevel',
        'error',
        '-progress',
        'pipe:1',
        '-nostats',
        '-ss',
        str(clip_start),
        '-t',
        str(clip_duration),
        '-i',
        source_path,
    ]

    if download_mp3:
        cmd += ['-map', '0:a:0', '-vn', '-acodec', 'pcm_s16le', '-ar', '44100', '-ac', '2', output_path]
    elif video_only:
        cmd += ['-map', '0:v:0', '-an', '-c', 'copy', output_path]
    else:
        cmd += ['-c', 'copy', output_path]

    logger.info('Generating clip from local media cache: %s', source_path)
    _run_ffmpeg_with_progress(cmd, clip_duration, request_id, stage=DOWNLOAD_STAGE_CLIPPING, detail='Using local cache')
    return output_path if os.path.isfile(output_path) else None


def _strip_audio_track(video_path):
    if not _tool_exists(ffmpeg_path):
        return video_path

    root, ext = os.path.splitext(video_path)
    stripped_path = f'{root}.video-only{ext}'
    cmd = [
        ffmpeg_path,
        '-y',
        '-hide_banner',
        '-loglevel',
        'error',
        '-i',
        video_path,
        '-map',
        '0:v:0',
        '-an',
        '-c',
        'copy',
        stripped_path,
    ]
    subprocess.run(cmd, check=True, capture_output=True)
    os.replace(stripped_path, video_path)
    return video_path


def _selected_info_needs_audio_strip(selected_info, video_only=False):
    if not video_only:
        return False
    requested_formats = selected_info.get('requested_formats') or []
    if requested_formats:
        return False
    acodec = str(selected_info.get('acodec') or '').strip().lower()
    return acodec not in {'', 'none'}


def _download_clip_with_direct_ffmpeg(
    selected_info,
    output_path,
    clip_start,
    clip_end,
    request_id=None,
    download_mp3=False,
    video_only=False,
):
    if not _tool_exists(ffmpeg_path):
        raise RuntimeError('FFmpeg is required for direct clip downloads')

    clip_duration = max(0.0, float(clip_end) - float(clip_start))
    if clip_duration <= 0:
        raise RuntimeError('Clip duration must be positive')

    inputs = selected_info.get('requested_formats') or [selected_info]
    if not inputs or not all(_is_direct_http_input(item) for item in inputs):
        raise RuntimeError('Selected formats are not direct HTTP inputs')

    cmd = [
        ffmpeg_path,
        '-y',
        '-hide_banner',
        '-loglevel',
        'error',
        '-progress',
        'pipe:1',
        '-nostats',
    ]

    for item in inputs:
        cmd += _build_ffmpeg_headers(item.get('http_headers') or {})
        cmd += ['-ss', str(clip_start), '-t', str(clip_duration), '-i', item['url']]

    if download_mp3:
        cmd += ['-map', '0:a:0', '-vn', '-acodec', 'pcm_s16le', '-ar', '44100', '-ac', '2', output_path]
    elif video_only:
        cmd += ['-map', '0:v:0', '-an', '-c', 'copy', output_path]
    elif len(inputs) >= 2:
        cmd += ['-map', '0:v:0', '-map', '1:a:0', '-c', 'copy', output_path]
    else:
        cmd += ['-c', 'copy', output_path]

    logger.info('Downloading clip with direct ffmpeg path (%d input stream(s))', len(inputs))
    _run_ffmpeg_with_progress(cmd, clip_duration, request_id, stage=DOWNLOAD_STAGE_CLIPPING, detail='Downloading clip')
    return output_path if os.path.isfile(output_path) else None


def download_video(video_url, resolution, download_path, download_mp3=False, video_only=False, request_id=None):
    logger.info(f"Starting download: {video_url} (video_only={video_only})")
    download_path = os.path.abspath(download_path)
    _emit_download_stage(request_id, DOWNLOAD_STAGE_RESOLVING, detail='Fetching video formats')
    fmt = _build_format_selector(resolution, download_mp3=download_mp3, video_only=video_only)
    selected_info = _extract_info(video_url, fmt)
    title = sanitize_title(selected_info.get('title') or 'video')
    ext = 'mp4'
    phase_count = 1 if video_only or download_mp3 else 2
    hook = _make_progress_hook(
        request_id,
        phase_count=phase_count,
        stage=DOWNLOAD_STAGE_DOWNLOADING,
        detail='Downloading source',
    )
    filename = generate_new_filename(download_path, title, ext)
    output_path = os.path.abspath(os.path.join(download_path, filename))
    existing_outputs = _list_related_outputs(output_path)
    ydl_opts = _get_base_ydl_opts(hook=hook)
    ydl_opts['outtmpl'] = output_path
    ydl_opts['format'] = fmt
    ydl_opts['format_sort'] = _build_format_sort(video_only=video_only)
    if not download_mp3 and not video_only:
        ydl_opts['merge_output_format'] = 'mp4'
    _emit_download_stage(request_id, DOWNLOAD_STAGE_DOWNLOADING, detail='Downloading source')
    try:
        with youtube_dl.YoutubeDL(ydl_opts) as ydl:
            result = ydl.download([video_url])
    except Exception:
        _cleanup_failed_output(output_path, existing_outputs)
        raise
    final_path = _resolve_output_path(output_path, existing_outputs)
    if result == 0 and final_path:
        if _selected_info_needs_audio_strip(selected_info, video_only=video_only):
            _emit_download_stage(request_id, DOWNLOAD_STAGE_CLIPPING, detail='Removing audio track')
            final_path = _strip_audio_track(final_path)
        media_kind = 'audio' if download_mp3 else 'video_only' if video_only else 'muxed'
        cached_resolution = '' if download_mp3 else _get_selected_video_height(selected_info, resolution)
        _register_local_media_cache(video_url, media_kind, cached_resolution, final_path)
        logger.info(f"Downloaded: {final_path}")
        return final_path
    _cleanup_failed_output(output_path, existing_outputs)
    raise RuntimeError(f"Video download failed (exit code {result}, expected output: {output_path})")


def download_audio(video_url, download_path, request_id=None):
    logger.info(f"Starting audio download: {video_url}")
    download_path = os.path.abspath(download_path)
    _emit_download_stage(request_id, DOWNLOAD_STAGE_RESOLVING, detail='Fetching audio formats')
    selected_info = _extract_info(video_url, _build_format_selector(None, download_mp3=True))
    title = sanitize_title(selected_info.get('title') or 'audio')
    m4a_filename = generate_new_filename(download_path, title, 'm4a')
    m4a_path = os.path.abspath(os.path.join(download_path, m4a_filename))
    # Audio is single-stream → 1 phase
    existing_audio_outputs = _list_related_outputs(m4a_path)
    hook = _make_progress_hook(
        request_id,
        phase_count=1,
        stage=DOWNLOAD_STAGE_DOWNLOADING,
        detail='Downloading audio',
    )
    ydl_opts = _get_base_ydl_opts(hook=hook)
    ydl_opts['outtmpl'] = m4a_path
    ydl_opts['format'] = _build_format_selector(None, download_mp3=True)
    _emit_download_stage(request_id, DOWNLOAD_STAGE_DOWNLOADING, detail='Downloading audio')
    try:
        with youtube_dl.YoutubeDL(ydl_opts) as ydl:
            result = ydl.download([video_url])
    except Exception:
        _cleanup_failed_output(m4a_path, existing_audio_outputs)
        raise
    source_audio_path = _resolve_output_path(m4a_path, existing_audio_outputs)
    if result != 0 or not source_audio_path:
        _cleanup_failed_output(m4a_path, existing_audio_outputs)
        raise RuntimeError(f"Audio download failed (exit code {result}, expected output: {m4a_path})")
    wav_filename = generate_new_filename(download_path, title, 'wav')
    wav_path = os.path.abspath(os.path.join(download_path, wav_filename))
    _emit_download_stage(request_id, DOWNLOAD_STAGE_CLIPPING, detail='Converting audio')
    ffmpeg_cmd = [ffmpeg_path, '-y', '-i', source_audio_path, '-vn',
                  '-acodec', 'pcm_s16le', '-ar', '44100', '-ac', '2', wav_path]
    try:
        subprocess.run(ffmpeg_cmd, check=True, capture_output=True)
        os.remove(source_audio_path)
        _register_local_media_cache(video_url, 'audio', '', wav_path)
        logger.info(f"Audio converted: {wav_path}")
        return wav_path
    except subprocess.CalledProcessError as e:
        logger.error(f'WAV conversion error: {e}')
        _register_local_media_cache(video_url, 'audio', '', source_audio_path)
        return source_audio_path
    except FileNotFoundError as e:
        raise RuntimeError(f'FFmpeg not found for audio conversion: {e}') from e


def download_clip(video_url, resolution, download_path, clip_start, clip_end, download_mp3=False, video_only=False, request_id=None):
    logger.info(f"Starting clip download: {video_url} [{clip_start}-{clip_end}] (video_only={video_only})")
    download_path = os.path.abspath(download_path)
    _emit_download_stage(request_id, DOWNLOAD_STAGE_RESOLVING, detail='Preparing clip')
    info = _extract_info(video_url)
    title = sanitize_title(info['title'])
    clip_suffix = "_clip"
    cached_media_kind = 'audio' if download_mp3 else 'video_only' if video_only else 'muxed'
    cached_source_path = _get_local_media_cache(video_url, cached_media_kind, resolution)
    if download_mp3:
        clip_duration = clip_end - clip_start
        wav_filename = generate_new_filename(download_path, title, 'wav', clip_suffix)
        wav_path = os.path.abspath(os.path.join(download_path, wav_filename))
        existing_audio_outputs = _list_related_outputs(wav_path)

        if cached_source_path:
            try:
                final_path = _run_local_ffmpeg_trim(
                    cached_source_path,
                    wav_path,
                    clip_start,
                    clip_end,
                    request_id=request_id,
                    download_mp3=True,
                )
                if final_path:
                    logger.info(f"Audio clip saved (local cache): {final_path}")
                    return final_path
            except Exception as e:
                logger.warning(f"Local cached audio clip generation failed ({e}), falling back to remote source")
                _cleanup_failed_output(wav_path, existing_audio_outputs)

        try:
            selected_info = _extract_info(video_url, _build_format_selector(None, download_mp3=True))
            final_path = _download_clip_with_direct_ffmpeg(
                selected_info,
                wav_path,
                clip_start,
                clip_end,
                request_id=request_id,
                download_mp3=True,
            )
            if final_path:
                logger.info(f"Audio clip saved (direct ffmpeg): {final_path}")
                return final_path
        except Exception as e:
            logger.warning(f"Direct ffmpeg audio clip download failed ({e}), falling back to yt-dlp")
            _cleanup_failed_output(wav_path, existing_audio_outputs)

        m4a_filename = generate_new_filename(download_path, title, 'm4a', clip_suffix)
        m4a_path = os.path.abspath(os.path.join(download_path, m4a_filename))
        existing_m4a_outputs = _list_related_outputs(m4a_path)
        hook = _make_progress_hook(
            request_id,
            phase_count=1,
            stage=DOWNLOAD_STAGE_CLIPPING,
            detail='Downloading clip audio',
        )
        ydl_opts = _get_base_ydl_opts(hook=hook)
        ydl_opts['outtmpl'] = m4a_path
        ydl_opts['format'] = _build_format_selector(None, download_mp3=True)
        _emit_download_stage(request_id, DOWNLOAD_STAGE_CLIPPING, detail='Downloading clip audio')
        try:
            with youtube_dl.YoutubeDL(ydl_opts) as ydl:
                result = ydl.download([video_url])
        except Exception:
            _cleanup_failed_output(m4a_path, existing_m4a_outputs)
            raise
        source_audio_path = _resolve_output_path(m4a_path, existing_m4a_outputs)
        if result != 0 or not source_audio_path:
            _cleanup_failed_output(m4a_path, existing_m4a_outputs)
            raise RuntimeError(f"Audio clip download failed (exit code {result}, expected output: {m4a_path})")
        _emit_download_stage(request_id, DOWNLOAD_STAGE_CLIPPING, detail='Converting clip audio')
        ffmpeg_cmd = [ffmpeg_path, '-y', '-i', source_audio_path,
                      '-ss', str(clip_start), '-t', str(clip_duration),
                      '-acodec', 'pcm_s16le', '-ar', '44100', '-ac', '2', wav_path]
        try:
            subprocess.run(ffmpeg_cmd, check=True, capture_output=True)
            os.remove(source_audio_path)
            logger.info(f"Audio clip saved: {wav_path}")
            return wav_path
        except subprocess.CalledProcessError as e:
            logger.error(f'Audio clip error: {e}')
            return source_audio_path
        except FileNotFoundError as e:
            raise RuntimeError(f'FFmpeg not found for audio clip conversion: {e}') from e
    else:
        video_filename = generate_new_filename(download_path, title, 'mp4', clip_suffix)
        video_path = os.path.abspath(os.path.join(download_path, video_filename))
        existing_video_outputs = _list_related_outputs(video_path)
        fmt = _build_format_selector(resolution, video_only=video_only)
        phase_count = 1 if video_only else 2
        selected_info = None

        if cached_source_path:
            try:
                final_path = _run_local_ffmpeg_trim(
                    cached_source_path,
                    video_path,
                    clip_start,
                    clip_end,
                    request_id=request_id,
                    video_only=video_only,
                )
                if final_path:
                    logger.info(f"Clip downloaded (local cache): {final_path}")
                    return final_path
            except Exception as e:
                logger.warning(f"Local cached clip generation failed ({e}), falling back to remote source")
                _cleanup_failed_output(video_path, existing_video_outputs)

        try:
            selected_info = _extract_info(video_url, fmt)
            final_path = _download_clip_with_direct_ffmpeg(
                selected_info,
                video_path,
                clip_start,
                clip_end,
                request_id=request_id,
                video_only=video_only,
            )
            if final_path:
                logger.info(f"Clip downloaded (direct ffmpeg): {final_path}")
                return final_path
        except Exception as e:
            logger.warning(f"Direct ffmpeg clip download failed ({e}), falling back to yt-dlp")
            _cleanup_failed_output(video_path, existing_video_outputs)

        # Use yt-dlp Python API with download_ranges for proper progress support
        try:
            from yt_dlp.utils import download_range_func
            hook = _make_progress_hook(
                request_id,
                phase_count=phase_count,
                stage=DOWNLOAD_STAGE_CLIPPING,
                detail='Downloading clip',
            )
            ydl_opts = _get_base_ydl_opts(hook=hook)
            ydl_opts['outtmpl'] = video_path
            ydl_opts['format'] = fmt
            ydl_opts['format_sort'] = _build_format_sort(video_only=video_only)
            ydl_opts['download_ranges'] = download_range_func(None, [(clip_start, clip_end)])
            ydl_opts['force_keyframes_at_cuts'] = True
            if not video_only:
                ydl_opts['merge_output_format'] = 'mp4'
            _emit_download_stage(request_id, DOWNLOAD_STAGE_CLIPPING, detail='Downloading clip')

            with youtube_dl.YoutubeDL(ydl_opts) as ydl:
                result = ydl.download([video_url])

            final_path = _resolve_output_path(video_path, existing_video_outputs)
            if result == 0 and final_path:
                if _selected_info_needs_audio_strip(selected_info or {}, video_only=video_only):
                    _emit_download_stage(request_id, DOWNLOAD_STAGE_CLIPPING, detail='Removing audio track')
                    final_path = _strip_audio_track(final_path)
                logger.info(f"Clip downloaded (Python API): {final_path}")
                return final_path
            raise RuntimeError(f"Clip download failed (exit code {result}, expected output: {video_path})")
        except Exception as e:
            logger.warning(f"Python API clip download failed ({e}), falling back to subprocess")
            _cleanup_failed_output(video_path, existing_video_outputs)

        # Fallback: use yt-dlp's CLI entrypoint from the bundled Python module.
        clip_start_str = time.strftime('%H:%M:%S', time.gmtime(clip_start))
        clip_end_str = time.strftime('%H:%M:%S', time.gmtime(clip_end))
        cli_args = [
            '-f', fmt,
            '--download-sections', f'*{clip_start_str}-{clip_end_str}',
            '--output', video_path,
            '--postprocessor-args', 'ffmpeg:-c:v copy -an' if video_only else 'ffmpeg:-c:v copy -c:a copy',
            '--no-check-certificate',
        ]
        if _tool_exists(ffmpeg_path):
            cli_args.extend(['--ffmpeg-location', ffmpeg_path])
        cli_args.append(video_url)
        try:
            exit_code = _run_yt_dlp_cli(cli_args)
        except Exception as e:
            logger.error(f"yt-dlp clip fallback error: {e}", exc_info=True)
            _cleanup_failed_output(video_path, existing_video_outputs)
            return None

        final_path = _resolve_output_path(video_path, existing_video_outputs)
        if exit_code == 0 and final_path:
            if _selected_info_needs_audio_strip(selected_info or {}, video_only=video_only):
                _emit_download_stage(request_id, DOWNLOAD_STAGE_CLIPPING, detail='Removing audio track')
                final_path = _strip_audio_track(final_path)
            logger.info(f"Clip downloaded (CLI fallback): {final_path}")
            return final_path
        logger.error(f"yt-dlp clip fallback failed with exit code {exit_code} (expected output: {video_path})")
        _cleanup_failed_output(video_path, existing_video_outputs)
        return None
