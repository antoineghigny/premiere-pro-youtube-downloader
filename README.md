# YT2Premiere

YT2Premiere adds download actions directly on YouTube and sends the result to Adobe Premiere Pro.

It is made of three parts:

- a Chrome extension injected on YouTube
- a local Python backend running on `127.0.0.1:3001`
- a CEP panel for Premiere Pro

## User install

End users should not install Node, Python, or run terminal commands.

Windows installers are available in two GitHub-native places:

- stable releases: [GitHub Releases](https://github.com/antoineghigny/premiere-pro-youtube-downloader/releases)
- latest `main` build artifact: [Release workflow runs](https://github.com/antoineghigny/premiere-pro-youtube-downloader/actions/workflows/release.yml)
- installer filename: `YT2PremiereInstaller.exe`

Install flow:

- download `YT2PremiereInstaller.exe`
- run the installer
- open `chrome://extensions`
- enable `Developer mode`
- click `Load unpacked`
- select `C:\Program Files\YT2Premiere\chrome-extension`
- use YouTube download buttons normally

After installation, YT2Premiere works like this:

- the Chrome extension adds download actions directly on YouTube
- when you click one, the installed YT2Premiere app downloads the file on your machine
- if Premiere Pro is open, the downloaded file is sent into the current project automatically
- if Premiere Pro is not open or no project is available, the file is saved to the fallback download folder

The installer is rebuilt from the current repository state by `.github/workflows/release.yml`:

- every push to `main` produces a fresh `release-assets` artifact in GitHub Actions
- every tag matching `v*` publishes the same build output as a GitHub Release
- backend, extension, CEP, and installer changes all come from the same commit, so the installer stays in sync with the code

## Runtime behavior

- settings are stored in the user config directory:
  - Windows: `%APPDATA%\YT2Premiere`
  - macOS: `~/Library/Application Support/YT2Premiere`
  - Linux: `${XDG_CONFIG_HOME:-~/.config}/YT2Premiere`
- the installer does not register Windows startup entries, scheduled tasks, or auto-launch behavior
- downloads default to the current Premiere project folder when Premiere is available
- otherwise downloads fall back to `~/Downloads/YT2Premiere/YYYY-MM-DD`
- the extension routes backend traffic through its service worker; Chrome can present these localhost requests as either the pinned extension origin or the active YouTube tab origin, so the local API trusts both

## Contributing

Source setup, local development, and release automation are documented in [CONTRIBUTING.md](./CONTRIBUTING.md).
