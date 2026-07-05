$ErrorActionPreference = "Stop"

$downloadDir = Join-Path $env:TEMP "dietoy-build-tools"
$installer = Join-Path $downloadDir "vs_BuildTools.exe"

New-Item -ItemType Directory -Force -Path $downloadDir | Out-Null

if (-not (Test-Path $installer)) {
  Invoke-WebRequest `
    -Uri "https://aka.ms/vs/17/release/vs_BuildTools.exe" `
    -OutFile $installer
}

Write-Host "Installing Microsoft C++ Build Tools. This can take a while."
Write-Host "If Windows asks for permission, approve it."

Start-Process `
  -FilePath $installer `
  -ArgumentList @(
    "--quiet",
    "--wait",
    "--norestart",
    "--nocache",
    "--add", "Microsoft.VisualStudio.Workload.VCTools",
    "--add", "Microsoft.VisualStudio.Component.Windows11SDK.26100"
  ) `
  -Wait

Write-Host "Build prerequisites installed. Restart PowerShell/Codex, then run:"
Write-Host "npm.cmd run package:usb"
