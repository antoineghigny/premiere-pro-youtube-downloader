import logging
import os
import platform
import shutil
import subprocess

logger = logging.getLogger(__name__)


def _normalize_selected_path(selected_path):
    if not selected_path:
        return ''
    return os.path.abspath(str(selected_path).strip())


def _picker_success(selected_path):
    normalized_path = _normalize_selected_path(selected_path)
    if not normalized_path:
        return {'success': False, 'cancelled': True, 'path': '', 'error': ''}
    return {'success': True, 'cancelled': False, 'path': normalized_path, 'error': ''}


def _picker_cancelled():
    return {'success': False, 'cancelled': True, 'path': '', 'error': ''}


def _picker_error(message):
    return {
        'success': False,
        'cancelled': False,
        'path': '',
        'error': str(message or 'Could not open folder picker'),
    }


def _pick_folder_tkinter(initial_path=None, title='Select folder'):
    try:
        import tkinter as tk
        from tkinter import filedialog
    except Exception as exc:
        return _picker_error(exc)

    root = None
    try:
        root = tk.Tk()
        root.withdraw()
        root.update_idletasks()
        try:
            root.attributes('-topmost', True)
        except Exception:
            pass

        dialog_kwargs = {
            'title': str(title or 'Select folder'),
            'mustexist': False,
        }
        normalized_initial_path = str(initial_path or '').strip()
        if normalized_initial_path and os.path.isdir(normalized_initial_path):
            dialog_kwargs['initialdir'] = normalized_initial_path

        selected_path = filedialog.askdirectory(parent=root, **dialog_kwargs)
        return _picker_success(selected_path) if selected_path else _picker_cancelled()
    except Exception as exc:
        return _picker_error(exc)
    finally:
        if root is not None:
            try:
                root.destroy()
            except Exception:
                pass


def _pick_folder_windows(initial_path=None, title='Select folder'):
    env = os.environ.copy()
    env['YT2PP_PICKER_TITLE'] = str(title or 'Select folder')
    env['YT2PP_PICKER_INITIAL_PATH'] = str(initial_path or '')

    powershell_script = r"""
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
$owner = New-Object System.Windows.Forms.Form
$owner.StartPosition = [System.Windows.Forms.FormStartPosition]::CenterScreen
$owner.ShowInTaskbar = $false
$owner.TopMost = $true
$owner.Opacity = 0
$owner.Width = 1
$owner.Height = 1
$owner.Show()
$owner.Activate()
$dialog = New-Object System.Windows.Forms.FolderBrowserDialog
$dialog.Description = $env:YT2PP_PICKER_TITLE
$dialog.ShowNewFolderButton = $true
if ($env:YT2PP_PICKER_INITIAL_PATH -and (Test-Path -LiteralPath $env:YT2PP_PICKER_INITIAL_PATH)) {
    $dialog.SelectedPath = $env:YT2PP_PICKER_INITIAL_PATH
}
$result = $dialog.ShowDialog($owner)
$owner.Close()
if ($result -eq [System.Windows.Forms.DialogResult]::OK) {
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
    Write-Output $dialog.SelectedPath
    exit 0
}
exit 2
"""

    try:
        result = subprocess.run(
            ['powershell.exe', '-NoProfile', '-STA', '-Command', powershell_script],
            capture_output=True,
            text=True,
            encoding='utf-8',
            errors='replace',
            env=env,
            check=False,
        )
    except OSError as exc:
        return _picker_error(exc)

    if result.returncode == 2:
        return _picker_cancelled()

    if result.returncode != 0:
        return _picker_error(result.stderr.strip() or result.stdout.strip() or 'Windows folder picker failed')

    return _picker_success(result.stdout)


def _pick_folder_macos(initial_path=None, title='Select folder'):
    script_lines = [
        'set promptText to system attribute "YT2PP_PICKER_TITLE"',
        'set defaultPosix to system attribute "YT2PP_PICKER_INITIAL_PATH"',
        'if defaultPosix is not "" then',
        '  try',
        '    set selectedFolder to choose folder with prompt promptText default location POSIX file defaultPosix',
        '  on error',
        '    set selectedFolder to choose folder with prompt promptText',
        '  end try',
        'else',
        '  set selectedFolder to choose folder with prompt promptText',
        'end if',
        'POSIX path of selectedFolder',
    ]
    command = ['/usr/bin/osascript']
    for line in script_lines:
        command.extend(['-e', line])

    env = os.environ.copy()
    env['YT2PP_PICKER_TITLE'] = str(title or 'Select folder')
    env['YT2PP_PICKER_INITIAL_PATH'] = str(initial_path or '')

    try:
        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            encoding='utf-8',
            errors='replace',
            env=env,
            check=False,
        )
    except OSError as exc:
        return _picker_error(exc)

    stderr = (result.stderr or '').strip()
    if result.returncode != 0:
        if 'User canceled' in stderr or '(-128)' in stderr:
            return _picker_cancelled()
        return _picker_error(stderr or result.stdout.strip() or 'macOS folder picker failed')

    return _picker_success(result.stdout)


def _pick_folder_linux(initial_path=None, title='Select folder'):
    normalized_initial_path = str(initial_path or '').strip()

    if shutil.which('zenity'):
        command = ['zenity', '--file-selection', '--directory', '--title', str(title or 'Select folder')]
        if normalized_initial_path:
            filename = normalized_initial_path
            if os.path.isdir(filename) and not filename.endswith(os.sep):
                filename = f'{filename}{os.sep}'
            command.extend(['--filename', filename])
        try:
            result = subprocess.run(
                command,
                capture_output=True,
                text=True,
                encoding='utf-8',
                errors='replace',
                check=False,
            )
        except OSError as exc:
            return _picker_error(exc)

        if result.returncode == 1:
            return _picker_cancelled()
        if result.returncode != 0:
            return _picker_error(result.stderr.strip() or result.stdout.strip() or 'zenity folder picker failed')
        return _picker_success(result.stdout)

    if shutil.which('kdialog'):
        start_dir = normalized_initial_path or os.path.expanduser('~')
        command = ['kdialog', '--getexistingdirectory', start_dir, '--title', str(title or 'Select folder')]
        try:
            result = subprocess.run(
                command,
                capture_output=True,
                text=True,
                encoding='utf-8',
                errors='replace',
                check=False,
            )
        except OSError as exc:
            return _picker_error(exc)

        if result.returncode == 1:
            return _picker_cancelled()
        if result.returncode != 0:
            return _picker_error(result.stderr.strip() or result.stdout.strip() or 'kdialog folder picker failed')
        return _picker_success(result.stdout)

    return _picker_error('No native folder picker available on this Linux system. Enter the path manually.')


def pick_folder(initial_path=None, title='Select folder'):
    tkinter_result = _pick_folder_tkinter(initial_path=initial_path, title=title)
    if tkinter_result.get('success') or tkinter_result.get('cancelled'):
        return tkinter_result
    logger.warning('Tkinter folder picker failed, falling back: %s', tkinter_result.get('error') or 'Unknown error')

    current_platform = platform.system()
    if current_platform == 'Windows':
        return _pick_folder_windows(initial_path=initial_path, title=title)
    if current_platform == 'Darwin':
        return _pick_folder_macos(initial_path=initial_path, title=title)
    if current_platform == 'Linux':
        return _pick_folder_linux(initial_path=initial_path, title=title)
    return _picker_error(f'Folder picker is not implemented for platform: {current_platform}')
