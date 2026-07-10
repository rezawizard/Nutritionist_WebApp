# اعمال آپدیت Dietory 5.0.0 در GitHub

## روش پیشنهادی

1. ZIP فایل‌های جایگزینی را Extract کنید.
2. هر فایل را دقیقاً با همان مسیر داخل branch `main` آپلود و Replace کنید.
3. فایل‌های ذکرشده در `DELETE_THESE_IF_PRESENT.txt` را در صورت وجود حذف کنید.
4. بعد از پایان همه آپلودها وارد تب Actions شوید.
5. workflow زیر را باز کنید:

```text
USE THIS - Dietory 5.0.0 Final Installer
```

6. `Run workflow` و سپس branch `main` را انتخاب کنید.
7. پس از سبزشدن Run، artifact زیر را دانلود کنید:

```text
dietory-5.0.0-release
```

8. فایل زیر را نصب کنید:

```text
Dietory-5.0.0-Setup.exe
```

این workflow فقط دستی اجرا می‌شود؛ بنابراین هنگام Replace کردن چند فایل، Runهای تکراری ساخته نمی‌شوند.
