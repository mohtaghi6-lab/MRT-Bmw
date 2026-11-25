# BMW 728Li iDrive Cockpit — راهنمای نصب و ساخت در گیت‌هاب

داشبورد هوشمند خودروی **BMW 728Li** با پشتیبانی کامل از اجرای آفلاین (PWA + Service Worker)، ساعت عقربه‌ای آنالوگ، کالیبراسیون خودکار مانیتور خودرو و همگام‌سازی با گیت‌هاب.

---

## ۱. ساخت مخزن (Repository) جدید در گیت‌هاب
1. وارد حساب گیت‌هاب خود شوید و روی دکمه **New** (یا آدرس `https://github.com/new`) کلیک کنید.
2. یک نام برای مخزن بنویسید (مثلاً `bmw728li-idrive-cockpit`).
3. گزینه **Public** یا **Private** را انتخاب کنید و بدون تیک زدن فایل‌های اضافه، روی **Create repository** بزنید.

## ۲. قرار دادن کدهای دانلود شده در گیت‌هاب
فایل ZIP پروژه را از حالت فشرده خارج کرده، داخل پوشه پروژه ترمینال (CMD / PowerShell / Terminal) را باز کنید و دستورات زیر را اجرا کنید (نام کاربری و نام مخزن خود را جایگزین کنید):

```bash
git init
git add .
git commit -m "Update BMW 728Li iDrive Cockpit"
git branch -M main
git remote add origin https://github.com/mohtaghi6-lab/bmw728li-idrive-cockpit.git
git push -u origin main
```

## ۳. بیلد و انتشار خودکار روی GitHub Pages
1. در صفحه مخزن گیت‌هاب خود، به تب **Settings** > **Pages** بروید.
2. در بخش **Build and deployment** گزینه **Source** را روی **GitHub Actions** بگذارید.
3. فایل `.github/workflows/deploy.yml` به‌صورت خودکار پروژه را با نام کاربری و نام مخزن شما مچ کرده، `npm run lint` و `npm run build` را اجرا و نسخه آماده (همراه با قابلیت نصب آفلاین روی مانیتور خودرو) را منتشر می‌کند.

## ۴. اجرای محلی روی سیستم (Local Build)
```bash
npm install
npm run lint
npm run build
npm run start
```
یا در محیط توسعه:
```bash
npm run dev
```
