import os
import sys
import logging
import threading

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
from flask_cors import CORS
from flask import Flask, request, jsonify
from flask_socketio import SocketIO

from downloader import set_socketio, download_video, download_audio, download_clip
from premiere import is_premiere_running, import_video_to_premiere, get_default_download_path

app = Flask(__name__)
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading')

# Wire socketio into downloader module
set_socketio(socketio)


@app.after_request
def add_security_headers(response):
    origin = request.headers.get('Origin')
    if origin:
        response.headers['Access-Control-Allow-Origin'] = origin
    response.headers['Access-Control-Allow-Methods'] = 'GET,POST,OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization'
    response.headers['Access-Control-Allow-Credentials'] = 'true'
    return response


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

    os.makedirs(download_path, exist_ok=True)

    def process():
        file_path = None
        try:
            if download_type == 'full':
                file_path = download_video(video_url, resolution, download_path, download_mp3, video_only)
            elif download_type == 'audio':
                file_path = download_audio(video_url, download_path)
            elif download_type == 'clip':
                clip_start = data.get('clipIn')
                clip_end = data.get('clipOut')
                if clip_start is not None and clip_end is not None:
                    clip_start = float(clip_start)
                    clip_end = float(clip_end)
                else:
                    current_time = float(data.get('currentTime', 0))
                    seconds_before = int(settings['secondsBefore'])
                    seconds_after = int(settings['secondsAfter'])
                    clip_start = max(0, current_time - seconds_before)
                    clip_end = current_time + seconds_after
                file_path = download_clip(video_url, resolution, download_path, clip_start, clip_end, download_mp3, video_only)

            if not file_path:
                raise RuntimeError('Download completed but no output file was produced')

            import_video_to_premiere(file_path)
            play_notification_sound()
            socketio.emit('download-complete', {'path': file_path})
        except Exception as e:
            logger.error(f"Processing error: {e}", exc_info=True)
            socketio.emit('download-failed', {'message': str(e)})

    thread = threading.Thread(target=process, daemon=True)
    thread.start()

    return jsonify(success=True), 200


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
