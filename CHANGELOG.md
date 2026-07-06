# Dietoy Changelog

## v0.2.0 — Premium UI/UX Polish

This update keeps the existing Dietoy feature set but improves perceived quality, release traceability, and stable customer delivery.

### Added

- Premium UI polish styles for calm surfaces, refined hover lift, visible focus states, subtle surface animation, and result-card treatment.
- Versioned installer artifact name: `dietoy-v0.2.0-release-usb`.
- Update-branch build support in GitHub Actions, so installer packages can be built before merging into `main`.
- Version history and release notes in README.

### Changed

- Frontend package version bumped to `0.2.0`.
- Rust/Tauri package version bumped to `0.2.0`.
- Tauri installer metadata bumped to `0.2.0`.
- Customer package naming now clearly identifies the update version.

### Compatibility

- Existing SQLite data location is unchanged.
- Existing backup/restore JSON workflow is unchanged.
- Existing client records and settings should remain compatible.

### Validation

- Frontend build was checked locally with `npm run build` in the prepared update workspace.
- Final Windows installer should be built through GitHub Actions workflow `USE THIS - Dietoy Final Installer`.

### Customer package

Download the GitHub Actions artifact:

```text
dietoy-v0.2.0-release-usb
```

Expected contents:

```text
Dietoy-Setup.exe
INSTALL.vbs
INSTALL-SILENT.vbs
README-USB.txt
```
