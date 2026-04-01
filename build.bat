@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "ROOT=%~dp0"
set "STAGING=%ROOT%dist\staging"
set "EXEC_DIR=%STAGING%\exec"

call :maybe_add_to_path "C:\Program Files (x86)\NSIS"
call :maybe_add_to_path "C:\Program Files\NSIS"

call :require_command npm "Node.js and npm are required."
call :require_command python "Python is required."

echo === [1/4] Building Chrome Extension ===
pushd "%ROOT%extension" || exit /b 1
call npm ci
if errorlevel 1 (
    echo ERROR: npm ci failed.
    exit /b 1
)
call npm run build
if errorlevel 1 (
    echo ERROR: Extension build failed.
    exit /b 1
)
popd

echo === [2/4] Building Python Backend (.exe) ===
pushd "%ROOT%backend" || exit /b 1
python -m pip install -r requirements-build.txt --quiet
if errorlevel 1 (
    echo ERROR: Python dependency installation failed.
    exit /b 1
)
python -m PyInstaller --noconfirm --clean --onefile --name YT2Premiere ^
    --add-data "notification_sound.mp3;." ^
    --hidden-import=engineio.async_drivers.threading ^
    server.py
if errorlevel 1 (
    echo ERROR: PyInstaller build failed.
    exit /b 1
)
popd

echo === [3/4] Staging release files ===
if exist "%STAGING%" rmdir /s /q "%STAGING%"
mkdir "%EXEC_DIR%"
call :copy_required "%ROOT%backend\dist\YT2Premiere.exe" "%EXEC_DIR%\YT2Premiere.exe" "backend executable"
if errorlevel 1 exit /b 1

call :stage_ffmpeg
if errorlevel 1 exit /b 1
call :stage_optional_binary aria2c "%ROOT%tools\aria2c\aria2c.exe" "%EXEC_DIR%\aria2c\aria2c.exe"
if errorlevel 1 exit /b 1

xcopy /E /I /Y "%ROOT%extension\dist" "%STAGING%\chrome-extension" >nul
if errorlevel 1 (
    echo ERROR: Could not stage Chrome extension files.
    exit /b 1
)
xcopy /E /I /Y "%ROOT%cep-extension" "%STAGING%\cep-extension" >nul
if errorlevel 1 (
    echo ERROR: Could not stage CEP extension files.
    exit /b 1
)

echo === [4/4] Building Installer (.exe) ===
where makensis >nul 2>&1
if errorlevel 1 (
    echo WARNING: NSIS not found. Skipping installer build.
    echo Install NSIS from https://nsis.sourceforge.io/Download to create dist\YT2PremiereInstaller.exe.
) else (
    makensis "%ROOT%installer\installer.nsi"
    if errorlevel 1 (
        echo ERROR: NSIS installer build failed.
        exit /b 1
    )
)

echo.
echo Release staging complete:
echo   Chrome extension: dist\staging\chrome-extension\
echo   CEP extension:    dist\staging\cep-extension\
echo   Backend:          dist\staging\exec\YT2Premiere.exe
exit /b 0

:maybe_add_to_path
if exist "%~1\makensis.exe" set "PATH=%PATH%;%~1"
exit /b 0

:require_command
where %~1 >nul 2>&1
if errorlevel 1 (
    echo ERROR: %~2
    exit /b 1
)
exit /b 0

:copy_required
set "SOURCE=%~1"
set "TARGET=%~2"
if not exist "%SOURCE%" (
    echo ERROR: Missing %~3: %SOURCE%
    exit /b 1
)
for %%I in ("%TARGET%") do if not exist "%%~dpI" mkdir "%%~dpI"
copy /Y "%SOURCE%" "%TARGET%" >nul
exit /b 0

:stage_ffmpeg
if exist "%ROOT%tools\ffmpeg_win\bin\ffmpeg.exe" (
    xcopy /E /I /Y "%ROOT%tools\ffmpeg_win" "%EXEC_DIR%\ffmpeg_win" >nul
    echo Bundled FFmpeg from tools\ffmpeg_win.
    exit /b 0
)

for /f "delims=" %%I in ('where ffmpeg 2^>nul') do (
    set "FFMPEG_EXE=%%~fI"
    goto :stage_ffmpeg_from_path
)

echo ERROR: FFmpeg not found. Install ffmpeg on PATH or place it in tools\ffmpeg_win\.
exit /b 1

:stage_ffmpeg_from_path
for %%I in ("%FFMPEG_EXE%") do set "FFMPEG_DIR=%%~dpI"
if not exist "%EXEC_DIR%\ffmpeg_win\bin" mkdir "%EXEC_DIR%\ffmpeg_win\bin"
copy /Y "%FFMPEG_EXE%" "%EXEC_DIR%\ffmpeg_win\bin\ffmpeg.exe" >nul
if exist "!FFMPEG_DIR!ffprobe.exe" copy /Y "!FFMPEG_DIR!ffprobe.exe" "%EXEC_DIR%\ffmpeg_win\bin\ffprobe.exe" >nul
echo Bundled FFmpeg from PATH: !FFMPEG_EXE!
exit /b 0

:stage_optional_binary
set "TOOL_NAME=%~1"
set "PREFERRED_SOURCE=%~2"
set "TARGET=%~3"

if exist "%PREFERRED_SOURCE%" (
    call :copy_required "%PREFERRED_SOURCE%" "%TARGET%" "%TOOL_NAME%"
    echo Bundled optional %TOOL_NAME% from tools.
    exit /b 0
)

for /f "delims=" %%I in ('where %TOOL_NAME% 2^>nul') do (
    call :copy_required "%%~fI" "%TARGET%" "%TOOL_NAME%"
    echo Bundled optional %TOOL_NAME% from PATH: %%~fI
    exit /b 0
)

echo INFO: Optional %TOOL_NAME% not found. Continuing without it.
exit /b 0
