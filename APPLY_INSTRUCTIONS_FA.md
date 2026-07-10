# روش اعمال آپدیت Dietoy v4.7

## فایل‌های جایگزینی
محتوای ZIP را با حفظ مسیرها در شاخه `main` مخزن جایگزین کنید.

مسیرهای اصلی:
- `src/App.tsx`
- `src/lib.ts`
- `src/types.ts`
- `src/styles.css`
- `src-tauri/src/lib.rs`
- `src-tauri/tauri.conf.json`
- `src-tauri/icons/*`
- `public/logo.png`
- `public/logo-symbol.png`
- `public/dietoy-brand.png`
- `.github/workflows/windows-installer.yml`
- `installer/README-USB.txt`
- `docs/Dietoy_User_Guide_FA.pdf`
- `docs/Dietoy_User_Guide_FA.docx`

## اجرای Build
1. وارد تب **Actions** شوید.
2. workflow با نام **USE THIS - Dietoy Final Installer** را باز کنید.
3. `Run workflow` را روی شاخه `main` اجرا کنید.
4. در صورت سبزشدن، artifact زیر را دانلود کنید:
   `dietoy-final-0.3.0-release-usb`
5. داخل ZIP باید فقط یک EXE باشد:
   `Dietoy-FINAL-0.3.0-Setup.exe`
6. فایل `Dietoy-Guide-FA.pdf` نیز کنار Installer قرار دارد.

## تست ضروری پس از نصب
- لوگو و آیکون جدید نمایش داده شود.
- مراجع قبلی بدون حذف داده باز شود.
- محاسبات برای یک مراجع ذخیره و در خلاصه/رژیم بازیابی شود.
- یک ویزیت با سه خدمت مختلف ثبت شود.
- شیوه حضوری/آنلاین قابل انتخاب باشد.
- یک بادی آنالیز تصویر یا PDF بارگذاری و داخل مسیر نمایش داده شود.
- برنامه غذایی ذخیره و با یک کلیک چاپ شود.
- گزارش پرونده لوگو داشته و مسیر خام فایل را نشان ندهد.
- راهنمای PDF داخل artifact وجود داشته باشد.

## نکته
Frontend با `npm run build` تست شده است. کامپایل Rust و NSIS فقط بعد از اجرای GitHub Actions قطعی می‌شود.
