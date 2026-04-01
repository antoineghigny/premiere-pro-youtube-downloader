import json
import logging
import os
import platform

logger = logging.getLogger(__name__)

APP_NAME = 'YT2Premiere'
APP_VERSION = '3.0.0'
LEGACY_SETTINGS_DIR_NAME = 'YoutubetoPremiere'
ALLOWED_RESOLUTIONS = {'2160', '1440', '1080', '720'}


def _resolve_appdata_path():
    if platform.system() == 'Windows':
        return os.environ.get('APPDATA', os.path.expanduser(r'~\AppData\Roaming'))
    if platform.system() == 'Darwin':
        return os.path.expanduser('~/Library/Application Support')
    return os.environ.get('XDG_CONFIG_HOME', os.path.expanduser('~/.config'))


appdata_path = _resolve_appdata_path()
SETTINGS_DIR = os.path.join(appdata_path, APP_NAME)
LEGACY_SETTINGS_DIR = os.path.join(appdata_path, LEGACY_SETTINGS_DIR_NAME)
SETTINGS_FILE = os.path.join(SETTINGS_DIR, 'settings.json')
LEGACY_SETTINGS_FILE = os.path.join(LEGACY_SETTINGS_DIR, 'settings.json')
LOG_FILE = os.path.join(SETTINGS_DIR, 'yt2premiere.log')

DEFAULT_SETTINGS = {
    'resolution': '1080',
    'downloadPath': '',
    'audioOnly': False,
    'videoOnly': False,
    'secondsBefore': '15',
    'secondsAfter': '15',
}

os.makedirs(SETTINGS_DIR, exist_ok=True)


def _coerce_bool(value, default=False):
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in {'1', 'true', 'yes', 'on'}:
            return True
        if normalized in {'0', 'false', 'no', 'off', ''}:
            return False
    if isinstance(value, (int, float)):
        return bool(value)
    return default


def _coerce_non_negative_int(value, default):
    try:
        return max(0, int(value))
    except (TypeError, ValueError):
        return default


def normalize_settings(raw_settings, base_settings=None):
    settings = DEFAULT_SETTINGS.copy()
    if isinstance(base_settings, dict):
        settings.update(normalize_settings(base_settings))

    if not isinstance(raw_settings, dict):
        raw_settings = {}

    resolution = str(raw_settings.get('resolution', settings['resolution'])).strip()
    if resolution not in ALLOWED_RESOLUTIONS:
        resolution = settings['resolution']

    download_path = raw_settings.get('downloadPath', settings['downloadPath'])
    if not isinstance(download_path, str):
        download_path = ''

    audio_only = _coerce_bool(
        raw_settings.get('audioOnly', raw_settings.get('downloadMP3', settings['audioOnly'])),
        settings['audioOnly'],
    )
    video_only = _coerce_bool(raw_settings.get('videoOnly', settings['videoOnly']), settings['videoOnly'])
    if audio_only:
        video_only = False

    seconds_before = _coerce_non_negative_int(raw_settings.get('secondsBefore', settings['secondsBefore']), 15)
    seconds_after = _coerce_non_negative_int(raw_settings.get('secondsAfter', settings['secondsAfter']), 15)

    return {
        'resolution': resolution,
        'downloadPath': download_path.strip(),
        'audioOnly': audio_only,
        'videoOnly': video_only,
        'secondsBefore': str(seconds_before),
        'secondsAfter': str(seconds_after),
    }


def _read_settings_file(file_path):
    with open(file_path, 'r', encoding='utf-8') as handle:
        return json.load(handle)


def load_settings():
    source_path = None
    raw_settings = {}

    if os.path.exists(SETTINGS_FILE):
        source_path = SETTINGS_FILE
    elif os.path.exists(LEGACY_SETTINGS_FILE):
        source_path = LEGACY_SETTINGS_FILE

    if source_path:
        try:
            raw_settings = _read_settings_file(source_path)
        except (OSError, json.JSONDecodeError) as exc:
            logger.warning('Could not read settings from %s: %s', source_path, exc)

    settings = normalize_settings(raw_settings)
    if source_path != SETTINGS_FILE or not os.path.exists(SETTINGS_FILE):
        save_settings(settings)

    logger.info('Loaded settings: %s', settings)
    return settings


def save_settings(settings):
    normalized_settings = normalize_settings(settings)
    os.makedirs(SETTINGS_DIR, exist_ok=True)
    with open(SETTINGS_FILE, 'w', encoding='utf-8') as handle:
        json.dump(normalized_settings, handle, indent=4)
    logger.info('Saved settings: %s', normalized_settings)
    return normalized_settings
