[CmdletBinding(SupportsShouldProcess = $true)]
param()

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$sourceDir = Join-Path $repoRoot 'cep-extension'
$targetDir = Join-Path $env:APPDATA 'Adobe\CEP\extensions\com.yt2premiere.cep'
$targetParent = Split-Path -Parent $targetDir
$csxsVersions = 6..13

if (-not (Test-Path -LiteralPath $sourceDir)) {
    throw "Missing source CEP directory: $sourceDir"
}

if ($PSCmdlet.ShouldProcess($targetDir, 'Install CEP extension for development')) {
    New-Item -ItemType Directory -Force -Path $targetParent | Out-Null

    if (Test-Path -LiteralPath $targetDir) {
        Remove-Item -LiteralPath $targetDir -Recurse -Force
    }

    Copy-Item -LiteralPath $sourceDir -Destination $targetDir -Recurse -Force

    foreach ($version in $csxsVersions) {
        $registryPath = "HKCU:\Software\Adobe\CSXS.$version"
        New-Item -Path $registryPath -Force | Out-Null
        Set-ItemProperty -Path $registryPath -Name 'PlayerDebugMode' -Value '1'
    }
}

Write-Host "Installed CEP panel to: $targetDir"
Write-Host 'Restart Premiere Pro if it was already open.'
