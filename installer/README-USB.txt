Dietoy USB installer package

Build on the developer machine:
1. Install Node.js, Rust, Microsoft C++ Build Tools, and WebView2 requirements.
2. If Microsoft C++ Build Tools is missing, run installer\Install-Windows-Build-Prerequisites.ps1 once as administrator.
3. Right-click installer\Build-USB-Package.ps1 and run with PowerShell.
4. Copy the generated release-usb folder to the flash drive.

Customer install:
1. Open the flash drive or copied folder.
2. Double-click INSTALL.vbs.
3. Follow the installer.
4. Open Dietoy from the desktop icon.

Silent install:
Double-click INSTALL-SILENT.vbs.

Default app login:
Username: admin
Password: admin

After login, open Settings and change the username/password before real use.
