param(
    [string]$TargetTriple = "x86_64-pc-windows-msvc"
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$binariesDir = Join-Path $repoRoot "desktop\src-tauri\binaries"
New-Item -ItemType Directory -Force -Path $binariesDir | Out-Null

$ytDlpDestination = Join-Path $binariesDir "yt-dlp-$TargetTriple.exe"
$ffmpegDestination = Join-Path $binariesDir "ffmpeg-$TargetTriple.exe"

function Download-File {
    param(
        [string]$Url,
        [string]$Destination
    )

    Write-Host "Downloading $Url"
    Invoke-WebRequest -Uri $Url -OutFile $Destination
}

function Ensure-NonEmptyFile {
    param([string]$Path)

    if (!(Test-Path $Path)) {
        throw "Expected file was not created: $Path"
    }

    $file = Get-Item $Path
    if ($file.Length -le 0) {
        throw "Downloaded file is empty: $Path"
    }
}

if (!(Test-Path $ytDlpDestination)) {
    Download-File `
        -Url "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe" `
        -Destination $ytDlpDestination
    Ensure-NonEmptyFile -Path $ytDlpDestination
} else {
    Write-Host "Using existing yt-dlp sidecar at $ytDlpDestination"
}

if (!(Test-Path $ffmpegDestination)) {
    $tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("yt2premiere-ffmpeg-" + [System.Guid]::NewGuid().ToString("N"))
    $zipPath = Join-Path $tempRoot "ffmpeg.zip"
    $extractDir = Join-Path $tempRoot "expanded"

    New-Item -ItemType Directory -Force -Path $tempRoot, $extractDir | Out-Null

    try {
        Download-File `
            -Url "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip" `
            -Destination $zipPath
        Expand-Archive -Path $zipPath -DestinationPath $extractDir -Force

        $ffmpegSource = Get-ChildItem -Path $extractDir -Recurse -Filter "ffmpeg.exe" | Select-Object -First 1
        if ($null -eq $ffmpegSource) {
            throw "Could not locate ffmpeg.exe in downloaded archive"
        }

        Copy-Item -LiteralPath $ffmpegSource.FullName -Destination $ffmpegDestination -Force
        Ensure-NonEmptyFile -Path $ffmpegDestination
    } finally {
        Remove-Item -LiteralPath $tempRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
} else {
    Write-Host "Using existing FFmpeg sidecar at $ffmpegDestination"
}
