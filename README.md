# Matab Taghzieh

Offline-first Persian RTL Windows desktop app for dietitians.

## Features

- Local SQLite client database
- Add, edit, search, and archive clients
- Nutrition calculator with saved-client selection or manual input
- BMI, BMR, TDEE, target calories, protein, carbs, and fat calculations
- Manual override for calories and macros
- Login screen with default username/password: `admin` / `admin`
- Change username/password inside Settings
- Minimal Settings for dietitian name, clinic name, primary color, backup, and restore
- Lightweight JSON data backup for professional updates
- Full SQLite export for developer/archive use
- No backend, no cloud, no internet required for customer use after installation

## Customer install

The Windows installer is built by GitHub Actions.

1. Open the repository on GitHub.
2. Go to **Actions**.
3. Open **Build Windows Installer**.
4. Download the artifact named `matab-taghzieh-release-usb`.
5. Extract the ZIP.
6. Copy the extracted folder to a flash drive.
7. On the customer laptop, double-click `INSTALL.vbs`.
8. After install, open **Matab Taghzieh** from the desktop icon.

Silent install is available with `INSTALL-SILENT.vbs`.

## Update workflow

This is the recommended professional update path:

1. On the customer app, open **Settings**.
2. Click **خروجی سبک برای آپدیت**.
3. The app creates a small `matab-taghzieh-data-*.json` file in Documents.
4. The customer sends only that JSON file.
5. Build and deliver the new app installer.
6. After installing the new version, open **Settings**.
7. Click **بازیابی اطلاعات قبلی** and select the JSON file.
8. Clients, settings, username, and password hash are restored.

## Developer build

Local build requires Node.js, Rust, and Microsoft C++ Build Tools on Windows:

```bash
npm install
npm run build
npm run tauri:build
```

If local Windows build tools are heavy or slow to install, use GitHub Actions instead.
