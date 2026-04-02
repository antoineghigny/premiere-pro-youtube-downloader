import os
import sys
import logging
import re
import threading
from uuid import uuid4

from settings import APP_VERSION, LOG_FILE, load_settings, normalize_settings, save_settings

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - [%(filename)s:%(lineno)d] - %(funcName)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(LOG_FILE, encoding='utf-8'),
    ],
)
logger = logging.getLogger(__name__)

import pygame.mixer
from flask import Flask, request, jsonify
from flask_socketio import SocketIO, join_room, leave_room

from downloader import (
    set_socketio,
    download_video,
    download_audio,
    download_clip,
    _emit_download_stage,
    DOWNLOAD_STAGE_PREPARING,
    DOWNLOAD_STAGE_IMPORTING,
    DOWNLOAD_STAGE_COMPLETE,
    DOWNLOAD_STAGE_FAILED,
)
from premiere import is_premiere_running, import_video_to_premiere, get_default_download_path

app = Flask(__name__)

TRUSTED_EXTENSION_ORIGINS = (
    'chrome-extension://noloogahcbofnjjkpbeandcgoldejcic',
    'chrome-extension://aidffebbdmdjibggcfkeihnljgambjjd',
)
# Chrome may attribute extension-initiated localhost traffic to the active tab
# origin, especially for Socket.IO/WebSocket requests triggered from YouTube.
TRUSTED_WEB_ORIGINS = (
    'https://www.youtube.com',
)
TRUSTED_WEB_ORIGIN_PATHS = {
    '/handle-video-url',
}
TRUSTED_ORIGIN_PATTERNS = (
    *(re.compile(rf'^{re.escape(origin)}$') for origin in TRUSTED_EXTENSION_ORIGINS),
    *(re.compile(rf'^{re.escape(origin)}$') for origin in TRUSTED_WEB_ORIGINS),
)


def is_allowed_origin(origin):
    if not origin:
        return False
    normalized_origin = origin.strip()
    return any(pattern.fullmatch(normalized_origin) for pattern in TRUSTED_ORIGIN_PATTERNS)


def is_allowed_request_origin(origin, path):
    if not origin:
        return False
    normalized_origin = origin.strip()
    if normalized_origin in TRUSTED_EXTENSION_ORIGINS:
        return True
    return path in TRUSTED_WEB_ORIGIN_PATHS and normalized_origin in TRUSTED_WEB_ORIGINS


socketio = SocketIO(
    app,
    cors_allowed_origins=is_allowed_origin,
    cors_credentials=False,
    async_mode='threading',
)

# Wire socketio into downloader module
set_socketio(socketio)


@app.after_request
def add_security_headers(response):
    origin = request.headers.get('Origin')
    if origin and is_allowed_request_origin(origin, request.path):
        response.headers['Access-Control-Allow-Origin'] = origin
        response.headers['Vary'] = 'Origin'
    response.headers['Access-Control-Allow-Methods'] = 'GET,POST,OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = (
        request.headers.get('Access-Control-Request-Headers') or 'Content-Type'
    )
    response.headers['Access-Control-Max-Age'] = '600'
    return response


@app.before_request
def validate_request_origin():
    origin = request.headers.get('Origin')
    if request.method == 'OPTIONS':
        if origin and not is_allowed_request_origin(origin, request.path):
            logger.warning('Blocked preflight request from origin %s to %s', origin, request.path)
            return jsonify(error='Origin not allowed'), 403
        return '', 204

    if request.method == 'POST' and not origin:
        logger.warning('Blocked state-changing request without origin to %s', request.path)
        return jsonify(error='Origin required'), 403

    if origin and not is_allowed_request_origin(origin, request.path):
        logger.warning('Blocked request from origin %s to %s', origin, request.path)
        return jsonify(error='Origin not allowed'), 403
    return None


@app.errorhandler(404)
def page_not_found(e):
    return jsonify(error=str(e)), 404


@app.errorhandler(500)
def internal_server_error(e):
    return jsonify(error=str(e)), 500


@app.route('/get-version', methods=['GET'])
def get_version():
    return jsonify(version=APP_VERSION)


@app.route('/', methods=['GET', 'POST'])
def root():
    if request.method == 'GET':
        return "YT2Premiere is alive", 200
    elif request.method == 'POST':
        return jsonify(success=True), 200
    return "Method not allowed", 405


@app.route('/settings', methods=['POST'])
def update_settings():
    saved_settings = save_settings(request.get_json(silent=True) or {})
    return jsonify(success=True, settings=saved_settings), 200


@app.route('/handle-video-url', methods=['POST'])
def handle_video_url():
    data = request.get_json()
    logger.info(f"Received data: {data}")

    if not data:
        return jsonify(error="No data provided"), 400

    video_url = data.get('videoUrl')
    download_type = data.get('downloadType')
    request_id = str(data.get('requestId') or uuid4())

    if not video_url:
        return jsonify(error="No video URL"), 400

    if download_type not in ('clip', 'full', 'audio'):
        return jsonify(error="Invalid download type"), 400

    settings = normalize_settings(data, base_settings=load_settings())
    resolution = settings['resolution']
    download_mp3 = settings['audioOnly']
    video_only = settings['videoOnly']
    user_path = settings['downloadPath']
    download_path = user_path if user_path else get_default_download_path()
    clip_start = None
    clip_end = None

    if download_type == 'clip':
        raw_clip_start = data.get('clipIn')
        raw_clip_end = data.get('clipOut')
        if raw_clip_start is None or raw_clip_end is None:
            return jsonify(error='clipIn and clipOut are required'), 400
        try:
            clip_start = float(raw_clip_start)
            clip_end = float(raw_clip_end)
        except (TypeError, ValueError):
            return jsonify(error='clipIn and clipOut must be numbers'), 400
        if clip_end <= clip_start:
            return jsonify(error='clipOut must be greater than clipIn'), 400

    os.makedirs(download_path, exist_ok=True)

    def process():
        file_path = None
        try:
            _emit_download_stage(request_id, DOWNLOAD_STAGE_PREPARING, detail='Queueing download')
            if download_type == 'full':
                if download_mp3:
                    file_path = download_audio(video_url, download_path, request_id=request_id)
                else:
                    file_path = download_video(
                        video_url,
                        resolution,
                        download_path,
                        download_mp3,
                        video_only,
                        request_id=request_id,
                    )
            elif download_type == 'audio':
                file_path = download_audio(video_url, download_path, request_id=request_id)
            elif download_type == 'clip':
                file_path = download_clip(
                    video_url,
                    resolution,
                    download_path,
                    clip_start,
                    clip_end,
                    download_mp3,
                    video_only,
                    request_id=request_id,
                )

            if not file_path:
                raise RuntimeError('Download completed but no output file was produced')

            _emit_download_stage(request_id, DOWNLOAD_STAGE_IMPORTING, detail='Importing into Premiere')
            import_video_to_premiere(file_path)
            play_notification_sound()
            socketio.emit(
                'download-complete',
                {
                    'requestId': request_id,
                    'stage': DOWNLOAD_STAGE_COMPLETE,
                    'path': file_path,
                    'percentage': '100.0%',
                    'indeterminate': False,
                },
                to=request_id,
            )
        except Exception as e:
            logger.error(f"Processing error: {e}", exc_info=True)
            socketio.emit(
                'download-failed',
                {
                    'requestId': request_id,
                    'stage': DOWNLOAD_STAGE_FAILED,
                    'message': str(e),
                    'indeterminate': True,
                },
                to=request_id,
            )

    thread = threading.Thread(target=process, daemon=True)
    thread.start()

    return jsonify(success=True, requestId=request_id), 200


@socketio.on('connect')
def handle_socket_connect(auth):
    origin = request.headers.get('Origin')
    if not origin or not is_allowed_origin(origin):
        logger.warning('Rejected socket connection from origin %s', origin or '<missing>')
        return False
    return True


@socketio.on('subscribe-download')
def handle_subscribe_download(data):
    request_id = str((data or {}).get('requestId') or '').strip()
    if not request_id:
        return {'success': False, 'message': 'Missing requestId'}
    join_room(request_id)
    logger.info('Socket %s subscribed to download %s', request.sid, request_id)
    return {'success': True}


@socketio.on('unsubscribe-download')
def handle_unsubscribe_download(data):
    request_id = str((data or {}).get('requestId') or '').strip()
    if not request_id:
        return {'success': False, 'message': 'Missing requestId'}
    leave_room(request_id)
    logger.info('Socket %s unsubscribed from download %s', request.sid, request_id)
    return {'success': True}


def play_notification_sound(volume=0.4):
    try:
        pygame.mixer.init()
        if getattr(sys, 'frozen', False):
            base_path = sys._MEIPASS
        else:
            base_path = os.path.dirname(os.path.abspath(__file__))
        sound_path = os.path.join(base_path, 'notification_sound.mp3')
        if os.path.exists(sound_path):
            pygame.mixer.music.load(sound_path)
            pygame.mixer.music.set_volume(volume)
            pygame.mixer.music.play()
            while pygame.mixer.music.get_busy():
                pygame.time.Clock().tick(10)
    except Exception as e:
        logger.warning(f"Could not play notification: {e}")


def main():
    settings = load_settings()
    logger.info(f'Settings loaded: {settings}')
    logger.info(f'Process info: pid={os.getpid()} executable={sys.executable}')
    logger.info('Starting YT2Premiere backend on port 3001...')
    socketio.run(app, host='127.0.0.1', port=3001, allow_unsafe_werkzeug=True)


if __name__ == "__main__":
    main()
