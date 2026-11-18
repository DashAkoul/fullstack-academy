# Git و کنترل نسخه

> مرجع اصلی: [Pro Git](https://git-scm.com/book/en/v2) و [GitHub Flow](https://docs.github.com/en/get-started/using-github/github-flow)

Git فقط «ذخیره‌ی کد» نیست؛ ابزار همکاری و مستندسازی تاریخ پروژه است. در مصاحبه‌های شغلی و روز اول کار، این مهارت فرض شده است.

## ۱. مدل ذهنی درست

سه ناحیه‌ی اصلی:

```
Working Directory  →  Staging Area (index)  →  Repository (.git)
        git add                git commit
```

- **Working Directory**: فایل‌هایی که ویرایش می‌کنید.
- **Staging**: چیزی که در commit بعدی می‌رود.
- **Commit**: عکس فوری تغییرناپذیر با شناسه‌ی یکتا (SHA).

Commit یک *snapshot* است، نه diff. همین جمله نصف سردرگمی‌ها را حل می‌کند.

## ۲. تنظیمات اولیه

```bash
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
git config --global init.defaultBranch main
git config --global pull.rebase true     # history تمیزتر
git config --global core.autocrlf input  # ویندوز → سازگاری خط جدید
```

## ۳. چرخه‌ی روزمره

```bash
git status                 # چه چیزی تغییر کرده؟
git diff                   # تغییرات دقیق
git add src/api.ts         # فقط همین فایل را stage کن
git diff --staged          # چه چیزی وارد commit می‌شود؟
git commit -m "feat(api): add retry on 5xx"
```

> فایل‌های بزرگ یا حساس را با `git add .` کورکورانه اضافه نکنید. اول `git status` را نگاه کنید.

## ۴. ‎.gitignore — خط دفاعی اول

```gitignore
node_modules/
dist/
out/
coverage/
.env
.env.*
!.env.example
*.log
.DS_Store
```

اگر فایلی از قبل commit شده و حالا ignore شده:

```bash
git rm --cached .env
git commit -m "chore: stop tracking secrets"
```

> اگر رمزی commit شد، فقط حذف کردن کافی نیست — باید آن راز را **باطل و از نو بسازید**، چون در تاریخچه مانده است.

## ۵. شاخه‌ها

```bash
git switch -c feature/login-form   # ساخت و رفتن به شاخه جدید
git switch main                    # برگشت
git branch                         # لیست شاخه‌ها
git branch -d feature/login-form   # حذف شاخه ادغام‌شده
```

نام‌گذاری پیشنهادی:

| نوع | نمونه |
| --- | --- |
| Feature | `feature/cart-checkout` |
| Bugfix | `fix/login-redirect` |
| Hotfix | `hotfix/payment-timeout` |
| Chore | `chore/upgrade-node` |

## ۶. merge یا rebase؟

**merge** تاریخچه را حفظ می‌کند و یک commit ادغام می‌سازد:

```bash
git switch main && git pull
git switch feature/x && git merge main
```

**rebase** شاخه‌ی شما را روی آخرین main بازمی‌چیند و خط می‌سازد:

```bash
git fetch origin
git rebase origin/main
```

قاعده‌ی طلایی: **روی شاخه‌ای که دیگران از آن استفاده می‌کنند rebase نکنید.** rebase فقط برای شاخه‌ی محلی/شخصی خودتان.

## ۷. حل تعارض (Conflict)

```bash
git status            # فایل‌های conflict دار
# فایل را باز کنید و نشانه‌ها را حل کنید:
# <<<<<<< HEAD
# نسخه تو
# =======
# نسخه دیگر
# >>>>>>> feature/x
git add <file>
git commit            # یا git rebase --continue
```

```bash
git merge --abort     # اگر خواستید همه چیز را لغو کنید
```

## ۸. Conventional Commits

فرمت استاندارد که ابزارهای نسخه‌گذاری و changelog را خودکار می‌کند:

```
<type>(<scope>): <subject>
```

| نوع | معنا |
| --- | --- |
| `feat` | قابلیت جدید |
| `fix` | رفع باگ |
| `docs` | مستندات |
| `refactor` | بازنویسی بدون تغییر رفتار |
| `test` | افزودن/اصلاح تست |
| `chore` | کارهای نگهداری |
| `perf` | بهبود کارایی |

نمونه‌های خوب:

```
feat(cart): persist items in localStorage
fix(auth): refresh token on 401 response
docs(readme): document pnpm workspace setup
```

نمونه‌های بد: `update`, `fix bug`, `changes`, `asdf`.

commit کوچک و متمرکز بنویسید؛ یک commit = یک تغییر منطقی قابل توضیح.

## ۹. Pull Request حرفه‌ای

1. شاخه را از `main` بسازید.
2. کار را انجام دهید و پوش کنید.
3. PR را با توضیح باز کنید: **چه**، **چرا**، **چگونه تست شده** و تصویر/اسکرین‌شات برای UI.
4. درخواست بازبینی بدهید؛ روی شاخه‌ی خودتان force-push نکنید اگر بازبین در حال خواندن است.
5. بعد از تأیید، squash merge (بسته به سیاست تیم) و حذف شاخه.

## ۱۰. دستورات نجات‌بخش

```bash
git restore .                        # تغییرات working directory را دور بریز
git restore --staged file.ts         # از staging خارج کن
git commit --amend -m "feat: better message"   # فقط قبل از push
git reset --soft HEAD~1              # آخرین commit را به staging برگردان
git reflog                           # تاریخچه‌ی حرکت HEAD — پیدا کردن commit گم‌شده
git stash                            # کار نیمه‌کاره را کنار بگذار
git stash pop
git cherry-pick <sha>                # یک commit خاص را روی شاخه‌ی فعلی بیاور
```

`git reflog` تقریباً همه‌ی «کدهای گم شده» را برمی‌گرداند. نترسید.

## ۱۱. کار تیمی

```bash
git fetch --prune                      # شاخه‌های حذف‌شده‌ی ریموت را پاک کن
git pull --rebase origin main          # تاریخچه‌ی خط‌شکل
git log --oneline --graph --all --decorate   # نمای کامل تاریخچه
git blame src/api.ts                   # چه کسی چرا این خط را نوشت
```

## تمرین این درس

یک «مخزن الگو» برای تیم بسازید: README کامل، ‎.gitignore، CONTRIBUTING با قواعد شاخه و commit، قالب PR و Issue در ‎.github، و حداقل یک PR واقعی با commitهای Conventional. جزئیات در تب تمرین است.
