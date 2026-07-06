# Dietoy

Offline-first Windows desktop app for Persian RTL dietitian workflows.

Current update: `v0.2.1 Update-Safe Installer`.

## Main Features

- Local login with default credentials: `admin` / `admin`
- Change username and password from Settings
- Client database with add, edit, search, archive, notes, phone, email, and profile photo
- Local SQLite storage only; no backend, no cloud
- Client progress records with dated weight/body measurements
- Nutrition calculator with saved-client selection or manual mode
- BMI, BMR, TDEE, target calories, and macro grams
- Manual override for calories, protein, carbs, and fat
- Persian RTL interface with Vazirmatn typography
- Theme settings: primary color, background color, text color, logo, and background image
- Built-in Dietoy theme with background `#10517A`
- Lightweight JSON backup/restore for professional updates
- Windows installer package with desktop shortcut
- Automatic safety backup before customer update install through `INSTALL.vbs`

## v0.2.1 — Update-Safe Installer

This update adds a professional update-safety layer for customer installs. When the customer runs `INSTALL.vbs`, the script checks the existing Dietoy app-data folder and creates a safety backup before launching the new installer.

### Why this matters

Dietoy stores customer data in the Windows app-data folder, separate from installed program files. Updating the app should replace the application files while preserving clients, settings, credentials, profile images, and records.

### Automatic pre-install backup

If previous Dietoy data exists, `INSTALL.vbs` creates this folder before installing the update:

```text
Documents\Dietoy Update Backups\pre-install-backup
```

The installer then continues normally. Existing app data remains in place; the backup is only a safety copy.

### Update guarantee

Do not change these without a planned migration:

```text
identifier: com.rezo.persian-dietitian
SQLite data location: Windows app data directory
SQLite filename: nutritionist.sqlite
```

## v0.2.0 — Premium UI/UX Polish

This update keeps the current customer-ready feature set and improves perceived quality, release traceability, and premium visual polish without changing the local-first architecture.

### Included in v0.2.0

- App version bumped to `0.2.0` for the frontend package, Rust package, and Tauri installer metadata.
- Premium CSS polish layer added for calmer surfaces, refined focus states, subtle surface animation, hover lift, result-card treatment, and long-use visual comfort.
- Changelog added so future updates are traceable.
- GitHub Actions artifact renamed to a versioned customer package: `dietoy-v0.2.0-release-usb`.
- The installer workflow can now be run from update branches such as `codex/**` and `update/**`, not only `main`.

### Not changed in this stable polish pass

- Data model is unchanged.
- SQLite storage path is unchanged.
- Backup/restore format is unchanged.
- Login/default credential behavior is unchanged.
- Existing customer data should remain compatible.

## Logo

Put the default brand logo here:

```text
public/logo.png
```

Recommended: transparent PNG, square, 512x512 or larger.

Users can also choose a logo inside the app from:

```text
Settings > Appearance > Logo
```

## Development

```powershell
npm.cmd install
npm.cmd run tauri:dev
```

For a quick frontend-only check:

```powershell
npm.cmd run build
```

## Windows Build

The recommended build path is GitHub Actions because it installs Rust and Windows build tools on GitHub's Windows runner.

Manual local build requires Node.js, Rust/Cargo, Microsoft C++ Build Tools, and WebView2:

```powershell
npm.cmd install
npm.cmd run tauri:build
```

The installer is generated under:

```text
src-tauri/target/release/bundle/nsis/
```

## Customer USB Package

GitHub Actions creates a downloadable artifact named:

```text
dietoy-v0.2.0-release-usb
```

The customer package contains:

```text
Dietoy-Setup.exe
INSTALL.vbs
INSTALL-SILENT.vbs
README-USB.txt
```

For customers, copy the whole folder to a flash drive. They only need to double-click:

```text
INSTALL.vbs
```

`INSTALL.vbs` first creates a safety backup if old Dietoy data exists, then starts the installer.

## Update Workflow

Professional customer update path:

```text
1. Customer opens the new release folder.
2. Customer double-clicks INSTALL.vbs.
3. INSTALL.vbs creates a safety backup from existing AppData when available.
4. Dietoy installer updates the app files.
5. Existing clients, settings, credentials, images, and records remain in AppData.
```

Manual backup is still available inside Dietoy:

```text
Settings > Backup and Update > Export lightweight update backup
```

Manual restore is still available when needed:

```text
Settings > Backup and Update > Restore previous data
```

## Data Storage

Dietoy stores its SQLite database in the app data directory on the customer's Windows account. The identifier is intentionally kept stable so future app updates continue using the same data location.

## Version History

- `v0.1.0`: first customer-ready Dietoy installer pipeline and local-first feature set.
- `v0.2.0`: premium UI/UX polish, versioned installer artifact, update branch release workflow, and changelog documentation.
- `v0.2.1`: update-safe installer behavior with automatic pre-install safety backup.
