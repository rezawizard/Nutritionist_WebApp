# Dietoy

Offline-first Windows desktop app for Persian RTL dietitian workflows.

Current update: `v0.2.0 Premium UI/UX Polish`.

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

## v0.2.0 — Premium UI/UX Polish

This update keeps the current customer-ready feature set and improves perceived quality, release traceability, and premium visual polish without changing the local-first architecture.

### Included in this update

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

`INSTALL-SILENT.vbs` runs the installer hidden.

## Update Workflow

Before installing a new version, the customer exports a small update backup from inside Dietoy:

```text
Settings > Backup and Update > Export lightweight update backup
```

After installing the new version, they restore that JSON file:

```text
Settings > Backup and Update > Restore previous data
```

This keeps clients, settings, credentials, notes, and records across app updates.

## Data Storage

Dietoy stores its SQLite database in the app data directory on the customer's Windows account. The identifier is intentionally kept stable so future app updates continue using the same data location.

## Version History

- `v0.1.0`: first customer-ready Dietoy installer pipeline and local-first feature set.
- `v0.2.0`: premium UI/UX polish, versioned installer artifact, update branch release workflow, and changelog documentation.
