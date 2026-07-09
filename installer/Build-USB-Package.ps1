$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$releaseDir = Join-Path $root "release-usb"
$bundleDir = Join-Path $root "src-tauri\target\release\bundle\nsis"
$setupName = "Dietoy-FINAL-0.3.0-Setup.exe"
$vswhere = "C:\Program Files (x86)\Microsoft Visual Studio\Installer\vswhere.exe"

Set-Location $root

if (-not (Test-Path $vswhere)) {
  throw "Microsoft Visual Studio Build Tools is not installed. Run installer\Install-Windows-Build-Prerequisites.ps1 first, or install Desktop development with C++ manually."
}

$vcTools = & $vswhere -all -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
if (-not $vcTools) {
  throw "Microsoft C++ build tools are missing. Open Visual Studio Installer and install 'Desktop development with C++'."
}

$linker = Get-ChildItem $vcTools -Recurse -Filter link.exe -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $linker) {
  throw "link.exe was not found. Visual C++ tools are not completely installed yet."
}

npm.cmd install
npm.cmd run tauri:build

if (Test-Path $releaseDir) {
  Remove-Item -LiteralPath $releaseDir -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $releaseDir | Out-Null

$setup = Get-ChildItem -Path $bundleDir -Filter "*.exe" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $setup) {
  throw "NSIS setup EXE was not found in $bundleDir. The Tauri build did not finish successfully."
}

Copy-Item $setup.FullName (Join-Path $releaseDir $setupName) -Force
Copy-Item (Join-Path $PSScriptRoot "Customer-Install.vbs") (Join-Path $releaseDir "INSTALL.vbs") -Force
Copy-Item (Join-Path $PSScriptRoot "Customer-Install-Silent.vbs") (Join-Path $releaseDir "INSTALL-SILENT.vbs") -Force
Copy-Item (Join-Path $PSScriptRoot "README-USB.txt") $releaseDir -Force

Write-Host ""
Write-Host "USB package is ready:"
Write-Host $releaseDir
Write-Host ""
Write-Host "Copy the whole release-usb folder to the flash drive."
Write-Host "Customer should double-click INSTALL.vbs."
