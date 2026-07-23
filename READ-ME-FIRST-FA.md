# اعمال Dietory 5.3.0 در GitHub

فایل‌های داخل ZIP آپدیت را با حفظ مسیر دقیق جایگزین کنید. فایل‌های اصلی عبارت‌اند از:

- `package.json`
- `package-lock.json`
- `src/App.tsx`
- `src/types.ts`
- `src-tauri/Cargo.toml`
- `src-tauri/Cargo.lock`
- `src-tauri/tauri.conf.json`
- `src-tauri/src/lib.rs`
- `.github/workflows/windows-installer.yml`
- فایل‌های موجود در `installer/`

پس از Commit:

1. تب Actions را باز کنید.
2. Workflow با نام `USE THIS - Dietory 5.3.0 Final Installer` را اجرا کنید.
3. باید مراحل `Build frontend`، `Check Rust backend` و `Build Tauri installer` سبز شوند.
4. Artifact با نام `dietory-5.3.0-release` را دانلود و Extract کنید.
5. کاربر باید ابتدا `START-HERE-DIETORY.hta` را اجرا کند.
6. اگر Dietory از قبل نصب است، فقط «بروزرسانی نسخه فعلی» انتخاب شود.

نسخه قبلی نباید قبل از Update دستی Uninstall شود.
