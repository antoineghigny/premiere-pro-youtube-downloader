import os
import logging
import psutil

from settings import APP_NAME

logger = logging.getLogger(__name__)


def is_premiere_running():
    for process in psutil.process_iter(['pid', 'name']):
        try:
            if process.info['name'] and 'Adobe Premiere Pro' in process.info['name']:
                return True
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            pass
    return False


def get_current_project_path():
    if not is_premiere_running():
        return None
    try:
        import pymiere
        proj = pymiere.objects.app.project
        if proj and proj.path:
            project_dir = os.path.dirname(proj.path)
            logger.info(f"Project directory: {project_dir}")
            return project_dir
        return None
    except Exception:
        # pymiere can't connect (CEP panel not loaded, etc.) - that's fine
        logger.info('Could not connect to Premiere Pro project (CEP panel not loaded?)')
        return None


def get_default_download_path():
    """If Premiere is open, use project folder. Otherwise ~/Downloads/YT2Premiere/.
    Adds a date subfolder (YYYY-MM-DD)."""
    from datetime import datetime
    date_str = datetime.now().strftime('%Y-%m-%d')

    project_dir = get_current_project_path()
    if project_dir:
        dl_path = os.path.join(project_dir, APP_NAME, date_str)
    else:
        dl_path = os.path.join(os.path.expanduser('~'), 'Downloads', APP_NAME, date_str)

    os.makedirs(dl_path, exist_ok=True)
    return dl_path


def import_video_to_premiere(video_path):
    """Import file into Premiere Pro. Silently skips if Premiere is not running."""
    if not os.path.exists(video_path):
        logger.error(f'File does not exist: {video_path}')
        return False

    if not is_premiere_running():
        logger.info('Premiere Pro not running, skipping import')
        return False

    try:
        import pymiere
        logger.info('Importing video to Premiere...')
        proj = pymiere.objects.app.project
        root_bin = proj.rootItem
        proj.importFiles([video_path], suppressUI=True, targetBin=root_bin, importAsNumberedStills=False)
        logger.info(f'Imported: {video_path}')

        pymiere.objects.app.sourceMonitor.openFilePath(video_path)
        logger.info('Opened in source monitor')
        return True
    except Exception as e:
        logger.warning(f'Import to Premiere failed: {e}')
        return False
