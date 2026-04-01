import os
import sys
import re
import time
import string
import logging
import subprocess
import platform
import glob

logger = logging.getLogger(__name__)

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
        if os.path.isfile(c):
            return c
    return candidates[-1] if candidates else ''


if platform.system() == 'Windows':
    ffmpeg_path = _find_tool(
        os.path.join(script_dir, 'ffmpeg_win', 'bin', 'ffmpeg.exe'),      # frozen exe layout
        os.path.join(base_path, 'tools', 'ffmpeg_win', 'bin', 'ffmpeg.exe'),  # dev layout
        'ffmpeg',  # system PATH fallback
    )
    yt_dlp_path = _find_tool(
        os.path.join(script_dir, '_include', 'yt-dlp.exe'),               # frozen exe layout
        os.path.join(base_path, 'tools', 'yt-dlp.exe'),                   # dev layout
        'yt-dlp',
    )
    aria2c_path = _find_tool(
        os.path.join(script_dir, 'aria2c', 'aria2c.exe'),
        os.path.join(base_path, 'tools', 'aria2c', 'aria2c.exe'),
    )
elif platform.system() == 'Darwin':
    ffmpeg_path = _find_tool(
        os.path.join(script_dir, '_internal', 'ffmpeg', 'bin', 'ffmpeg'),
        'ffmpeg',
    )
    yt_dlp_path = _find_tool(os.path.join(script_dir, 'yt-dlp'), 'yt-dlp')
    aria2c_path = None
else:
    ffmpeg_path = 'ffmpeg'
    yt_dlp_path = 'yt-dlp'
    aria2c_path = None

# Add ffmpeg directory to PATH so yt-dlp's static FFmpegFD.available() check
# can find ffmpeg (it only checks system PATH, not ffmpeg_location param).
if os.path.isfile(ffmpeg_path):
    ffmpeg_dir = str(os.path.dirname(ffmpeg_path))
    if ffmpeg_dir not in os.environ.get('PATH', ''):
        os.environ['PATH'] = ffmpeg_dir + os.pathsep + os.environ.get('PATH', '')
        logger.info(f"Added ffmpeg dir to PATH: {ffmpeg_dir}")

logger.info(f"Tool paths - ffmpeg: {ffmpeg_path}, yt-dlp: {yt_dlp_path}, aria2c: {aria2c_path}")

# Import yt_dlp AFTER modifying PATH so its internal cache detects ffmpeg
import yt_dlp as youtube_dl

# socketio instance set by server.py at startup
socketio = None


def set_socketio(sio):
    global socketio
    socketio = sio


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


def _emit_progress(request_id, pct_display):
    if not socketio or not request_id:
        return
    socketio.emit('download-progress', {'requestId': request_id, 'percentage': pct_display}, to=request_id)


def _make_progress_hook(request_id, phase_count, video_weight=0.85):
    """Return a progress_hook closure that maps multi-phase downloads to a
    single 0-100% range.

    For 2-phase downloads (video+audio with bestvideo+bestaudio):
      - Phase 1 (video): raw 0-100% → emitted 0-85%
      - Phase 2 (audio): raw 0-100% → emitted 85-100%

    For 1-phase downloads (single stream / audio-only):
      - Straight 0-100%, no rescaling.

    Phase transitions are detected when d['filename'] changes.
    When aria2c is used as external downloader, progress_hook may not fire
    during downloading (only 'finished' status), so we handle that gracefully.
    """
    state = {
        'current_phase': 0,
        'last_filename': None,
    }

    def hook(d):
        if not socketio or not request_id:
            return

        filename = d.get('filename', '')

        # Detect phase transition: new filename means new stream
        if filename and filename != state['last_filename']:
            if state['last_filename'] is not None:
                state['current_phase'] += 1
            state['last_filename'] = filename

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
            _emit_progress(request_id, pct_display)

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
            _emit_progress(request_id, pct_display)

    return hook


def _get_aria2c_opts():
    if aria2c_path and os.path.isfile(aria2c_path):
        return {
            'external_downloader': aria2c_path,
            'external_downloader_args': {'default': ['-x', '16', '-s', '16', '-k', '1M']},
        }
    return {}


def _get_base_ydl_opts(hook=None):
    """Build base yt-dlp options. If hook is provided, use it; otherwise no
    progress hook is attached."""
    opts = {
        'quiet': True,
        'writesubtitles': False,
        'writeautomaticsub': False,
        'writethumbnail': False,
        'nooverwrites': False,
    }
    if hook is not None:
        opts['progress_hooks'] = [hook]
    if os.path.isfile(ffmpeg_path):
        opts['ffmpeg_location'] = ffmpeg_path
    opts.update(_get_aria2c_opts())
    return opts


def download_video(video_url, resolution, download_path, download_mp3=False, video_only=False, request_id=None):
    logger.info(f"Starting download: {video_url} (video_only={video_only})")
    download_path = os.path.abspath(download_path)
    info_opts = {'quiet': True}
    if os.path.isfile(ffmpeg_path):
        info_opts['ffmpeg_location'] = ffmpeg_path
    info = youtube_dl.YoutubeDL(info_opts).extract_info(video_url, download=False)
    title = sanitize_title(info['title'])
    ext = 'mp4'

    if download_mp3:
        fmt = 'bestaudio[ext=m4a]/best'
        hook = _make_progress_hook(request_id, phase_count=1)
    elif video_only:
        # Strictly best video only, no audio merge (+)
        fmt = (
            f'bestvideo[ext=mp4][vcodec^=avc1][height<={resolution}]'
            f'/bestvideo[ext=mp4][height<={resolution}]'
            f'/bestvideo[height<={resolution}]'
            f'/bestvideo'
        )
        hook = _make_progress_hook(request_id, phase_count=1)
    else:
        fmt = (
            f'bestvideo[ext=mp4][vcodec^=avc1][height<={resolution}]+bestaudio[ext=m4a]'
            f'/bestvideo[ext=mp4][height<={resolution}]+bestaudio[ext=m4a]'
            f'/bestvideo[height<={resolution}]+bestaudio'
            f'/best[ext=mp4]'
            f'/best'
        )
        hook = _make_progress_hook(request_id, phase_count=2)
    filename = generate_new_filename(download_path, title, ext)
    output_path = os.path.abspath(os.path.join(download_path, filename))
    existing_outputs = _list_related_outputs(output_path)
    ydl_opts = _get_base_ydl_opts(hook=hook)
    ydl_opts['outtmpl'] = output_path
    ydl_opts['format'] = fmt
    if not download_mp3 and not video_only:
        ydl_opts['merge_output_format'] = 'mp4'
    try:
        with youtube_dl.YoutubeDL(ydl_opts) as ydl:
            result = ydl.download([video_url])
    except Exception:
        _cleanup_failed_output(output_path, existing_outputs)
        raise
    final_path = _resolve_output_path(output_path, existing_outputs)
    if result == 0 and final_path:
        logger.info(f"Downloaded: {final_path}")
        return final_path
    _cleanup_failed_output(output_path, existing_outputs)
    raise RuntimeError(f"Video download failed (exit code {result}, expected output: {output_path})")


def download_audio(video_url, download_path, request_id=None):
    logger.info(f"Starting audio download: {video_url}")
    download_path = os.path.abspath(download_path)
    info_opts = {'quiet': True}
    if os.path.isfile(ffmpeg_path):
        info_opts['ffmpeg_location'] = ffmpeg_path
    info = youtube_dl.YoutubeDL(info_opts).extract_info(video_url, download=False)
    title = sanitize_title(info['title'])
    m4a_filename = generate_new_filename(download_path, title, 'm4a')
    m4a_path = os.path.abspath(os.path.join(download_path, m4a_filename))
    # Audio is single-stream → 1 phase
    existing_audio_outputs = _list_related_outputs(m4a_path)
    hook = _make_progress_hook(request_id, phase_count=1)
    ydl_opts = _get_base_ydl_opts(hook=hook)
    ydl_opts['outtmpl'] = m4a_path
    ydl_opts['format'] = 'bestaudio[ext=m4a]/best'
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
    ffmpeg_cmd = [ffmpeg_path, '-y', '-i', source_audio_path, '-vn',
                  '-acodec', 'pcm_s16le', '-ar', '44100', '-ac', '2', wav_path]
    try:
        subprocess.run(ffmpeg_cmd, check=True, capture_output=True)
        os.remove(source_audio_path)
        logger.info(f"Audio converted: {wav_path}")
        return wav_path
    except subprocess.CalledProcessError as e:
        logger.error(f'WAV conversion error: {e}')
        return source_audio_path
    except FileNotFoundError as e:
        raise RuntimeError(f'FFmpeg not found for audio conversion: {e}') from e


def download_clip(video_url, resolution, download_path, clip_start, clip_end, download_mp3=False, video_only=False, request_id=None):
    logger.info(f"Starting clip download: {video_url} [{clip_start}-{clip_end}] (video_only={video_only})")
    download_path = os.path.abspath(download_path)
    info_opts = {'quiet': True}
    if os.path.isfile(ffmpeg_path):
        info_opts['ffmpeg_location'] = ffmpeg_path
    info = youtube_dl.YoutubeDL(info_opts).extract_info(video_url, download=False)
    title = sanitize_title(info['title'])
    clip_suffix = "_clip"
    if download_mp3:
        # ... (rest of audio logic)
        clip_duration = clip_end - clip_start
        m4a_filename = generate_new_filename(download_path, title, 'm4a', clip_suffix)
        m4a_path = os.path.abspath(os.path.join(download_path, m4a_filename))
        existing_audio_outputs = _list_related_outputs(m4a_path)
        hook = _make_progress_hook(request_id, phase_count=1)
        ydl_opts = _get_base_ydl_opts(hook=hook)
        ydl_opts['outtmpl'] = m4a_path
        ydl_opts['format'] = 'bestaudio[ext=m4a]/best'
        try:
            with youtube_dl.YoutubeDL(ydl_opts) as ydl:
                result = ydl.download([video_url])
        except Exception:
            _cleanup_failed_output(m4a_path, existing_audio_outputs)
            raise
        source_audio_path = _resolve_output_path(m4a_path, existing_audio_outputs)
        if result != 0 or not source_audio_path:
            _cleanup_failed_output(m4a_path, existing_audio_outputs)
            raise RuntimeError(f"Audio clip download failed (exit code {result}, expected output: {m4a_path})")
        wav_filename = generate_new_filename(download_path, title, 'wav', clip_suffix)
        wav_path = os.path.abspath(os.path.join(download_path, wav_filename))
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

        if video_only:
            # Strictly best video only, no audio merge (+)
            fmt = (
                f'bestvideo[ext=mp4][vcodec^=avc1][height<={resolution}]'
                f'/bestvideo[ext=mp4][height<={resolution}]'
                f'/bestvideo[height<={resolution}]'
                f'/bestvideo'
            )
            phase_count = 1
        else:
            fmt = (
                f'bestvideo[ext=mp4][vcodec^=avc1][height<={resolution}]+bestaudio[ext=m4a]'
                f'/bestvideo[ext=mp4][height<={resolution}]+bestaudio[ext=m4a]'
                f'/bestvideo[height<={resolution}]+bestaudio'
                f'/best[ext=mp4]'
                f'/best'
            )
            phase_count = 2

        # Use yt-dlp Python API with download_ranges for proper progress support
        try:
            from yt_dlp.utils import download_range_func
            hook = _make_progress_hook(request_id, phase_count=phase_count)
            ydl_opts = _get_base_ydl_opts(hook=hook)
            ydl_opts.pop('external_downloader', None)
            ydl_opts.pop('external_downloader_args', None)
            ydl_opts['outtmpl'] = video_path
            ydl_opts['format'] = fmt
            ydl_opts['download_ranges'] = download_range_func(None, [(clip_start, clip_end)])
            ydl_opts['force_keyframes_at_cuts'] = True
            if not video_only:
                ydl_opts['merge_output_format'] = 'mp4'

            with youtube_dl.YoutubeDL(ydl_opts) as ydl:
                result = ydl.download([video_url])

            final_path = _resolve_output_path(video_path, existing_video_outputs)
            if result == 0 and final_path:
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
            '--postprocessor-args', 'ffmpeg:-c:v copy -c:a copy',
            '--no-check-certificate',
        ]
        if os.path.isfile(ffmpeg_path):
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
            logger.info(f"Clip downloaded (CLI fallback): {final_path}")
            return final_path
        logger.error(f"yt-dlp clip fallback failed with exit code {exit_code} (expected output: {video_path})")
        _cleanup_failed_output(video_path, existing_video_outputs)
        return None
