Dietory 5.3.0 installer package

روش پیشنهادی برای همه کاربران:
1. فایل START-HERE-DIETORY.hta را باز کنید.
2. اگر Dietory قبلاً نصب است، «بروزرسانی نسخه فعلی» را بزنید.
3. اگر برنامه روی سیستم وجود ندارد، «نصب جدید» را انتخاب کنید.

بروزرسانی استاندارد:
- UPDATE-CURRENT-APP.vbs نصب‌کننده را با گزینه /UPDATE اجرا می‌کند.
- پیش از بروزرسانی از AppData در Documents\Dietory Update Backups\pre-update-latest نسخه ایمنی می‌سازد.
- پرونده‌ها، تنظیمات، تصاویر، PDFها و دیتابیس حفظ می‌شوند.

پشتیبان داخل اپ:
- هنگام هر بار بستن عادی برنامه، Dietory-Auto-Backup-Latest پیش از خروج به‌طور خودکار جایگزین می‌شود.
- نسخه قبلی نیز در Dietory-Auto-Backup-Previous نگهداری می‌شود.
- محل بکاپ از Settings قابل انتخاب است؛ پوشه فلش، هارد اکسترنال یا Google Drive Desktop نیز قابل انتخاب است.
- بازیابی، سلامت فایل‌ها را با SHA-256 بررسی و مسیر فایل‌ها را برای سیستم جدید اصلاح می‌کند.

فایل‌ها:
- START-HERE-DIETORY.hta: منوی نصب، بروزرسانی و حذف
- UPDATE-CURRENT-APP.vbs: بروزرسانی امن نسخه نصب‌شده
- INSTALL.vbs: نصب معمولی همراه با پشتیبان ایمنی
- INSTALL-SILENT.vbs: نصب بی‌صدا
- UNINSTALL-CURRENT-APP.vbs: اجرای حذف‌کننده برنامه
- Dietory-5.3.0-Setup.exe: نصب‌کننده اصلی
