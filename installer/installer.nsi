!include "MUI2.nsh"
!include "LogicLib.nsh"

Name 'YT2Premiere Installer'
OutFile '..\dist\YT2PremiereInstaller.exe'
InstallDir '$PROGRAMFILES64\YT2Premiere'
RequestExecutionLevel admin
!define MUI_ABORTWARNING

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!define MUI_FINISHPAGE_SHOWREADME ""
!define MUI_FINISHPAGE_SHOWREADME_TEXT "View Chrome Extension setup instructions"
!define MUI_FINISHPAGE_SHOWREADME_FUNCTION ShowInstructions
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_LANGUAGE 'English'

Function ShowInstructions
    MessageBox MB_OK "To load the Chrome Extension:$\r$\n$\r$\n\
1. Open Chrome and go to chrome://extensions$\r$\n\
2. Enable 'Developer mode' (toggle top right)$\r$\n\
3. Click 'Load unpacked'$\r$\n\
4. Select: $INSTDIR\chrome-extension$\r$\n$\r$\n\
That's it! The extension will appear on YouTube."
FunctionEnd

Section 'Install'
    ; Check if already running
    nsExec::ExecToLog 'tasklist /FI "IMAGENAME eq YT2Premiere.exe" | find "YT2Premiere.exe"'
    Pop $0
    ${If} $0 == 0
        MessageBox MB_OK|MB_ICONSTOP 'YT2Premiere is currently running. Please close it first.'
        Abort
    ${EndIf}

    ; Backend exe
    SetOutPath '$INSTDIR\exec'
    File '..\dist\staging\exec\YT2Premiere.exe'

    ; FFmpeg
    SetOutPath '$INSTDIR\exec\ffmpeg_win'
    File /nonfatal /r '..\dist\staging\exec\ffmpeg_win\*.*'

    ; aria2c
    SetOutPath '$INSTDIR\exec\aria2c'
    File /nonfatal '..\dist\staging\exec\aria2c\aria2c.exe'

    ; CEP Extension
    SetOutPath '$PROGRAMFILES64\Common Files\Adobe\CEP\extensions\com.yt2premiere.cep'
    File /r '..\dist\staging\cep-extension\*.*'

    ; Chrome Extension (unpacked)
    SetOutPath '$INSTDIR\chrome-extension'
    File /r '..\dist\staging\chrome-extension\*.*'

    ; Desktop shortcut
    CreateShortcut '$DESKTOP\YT2Premiere.lnk' '$INSTDIR\exec\YT2Premiere.exe'

    ; Uninstaller
    WriteUninstaller '$INSTDIR\uninstall.exe'

    ; Add to Add/Remove Programs
    WriteRegStr HKLM 'Software\Microsoft\Windows\CurrentVersion\Uninstall\YT2Premiere' 'DisplayName' 'YT2Premiere'
    WriteRegStr HKLM 'Software\Microsoft\Windows\CurrentVersion\Uninstall\YT2Premiere' 'UninstallString' '$INSTDIR\uninstall.exe'
    WriteRegStr HKLM 'Software\Microsoft\Windows\CurrentVersion\Uninstall\YT2Premiere' 'InstallLocation' '$INSTDIR'
SectionEnd

Section 'Enable CSXS Debug Mode'
    WriteRegStr HKCU 'Software\Adobe\CSXS.6' 'PlayerDebugMode' '1'
    WriteRegStr HKCU 'Software\Adobe\CSXS.7' 'PlayerDebugMode' '1'
    WriteRegStr HKCU 'Software\Adobe\CSXS.8' 'PlayerDebugMode' '1'
    WriteRegStr HKCU 'Software\Adobe\CSXS.9' 'PlayerDebugMode' '1'
    WriteRegStr HKCU 'Software\Adobe\CSXS.10' 'PlayerDebugMode' '1'
    WriteRegStr HKCU 'Software\Adobe\CSXS.11' 'PlayerDebugMode' '1'
    WriteRegStr HKCU 'Software\Adobe\CSXS.12' 'PlayerDebugMode' '1'
    WriteRegStr HKCU 'Software\Adobe\CSXS.13' 'PlayerDebugMode' '1'
SectionEnd

Section 'Uninstall'
    ; Kill process if running
    nsExec::ExecToLog 'taskkill /F /IM YT2Premiere.exe'

    ; Remove files
    RMDir /r '$INSTDIR\exec'
    RMDir /r '$INSTDIR\chrome-extension'
    Delete '$INSTDIR\uninstall.exe'
    RMDir '$INSTDIR'

    ; Remove CEP extension
    RMDir /r '$PROGRAMFILES64\Common Files\Adobe\CEP\extensions\com.yt2premiere.cep'

    ; Remove shortcuts
    Delete '$DESKTOP\YT2Premiere.lnk'

    ; Remove registry entries
    DeleteRegKey HKLM 'Software\Microsoft\Windows\CurrentVersion\Uninstall\YT2Premiere'
SectionEnd
