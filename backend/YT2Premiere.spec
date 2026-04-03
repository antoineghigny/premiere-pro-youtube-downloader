# -*- mode: python ; coding: utf-8 -*-

from PyInstaller.utils.hooks import collect_data_files, collect_submodules

yt_dlp_ejs_datas = collect_data_files('yt_dlp_ejs')
yt_dlp_ejs_hiddenimports = collect_submodules('yt_dlp_ejs')


a = Analysis(
    ['server.py'],
    pathex=[],
    binaries=[],
    datas=[('notification_sound.mp3', '.'), *yt_dlp_ejs_datas],
    hiddenimports=[
        'engineio.async_drivers.threading',
        'tkinter',
        'tkinter.filedialog',
        *yt_dlp_ejs_hiddenimports,
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='YT2Premiere',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
