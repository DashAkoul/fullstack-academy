# Git و کنترل نسخه

> مرجع اصلی: [Pro Git](https://git-scm.com/book/en/v2) · [Git Reference](https://git-scm.com/docs) · [GitHub Flow](https://docs.github.com/en/get-started/using-github/github-flow)

## در این درس چه یاد می‌گیرید؟

Git را از دید «مدل داده» یاد می‌گیرید، نه فهرست دستور. بعد از این درس می‌توانید تعارض را با اعتماد حل کنید، شاخه را بدون ترس rebase کنید، commit گم‌شده را با reflog برگردانید و یک مخزن استاندارد تیمی با قالب PR و commitهای قابل خواندن بسازید.

---

## ۱. مدل ذهنی: Git چه چیزی ذخیره می‌کند؟

Git یک **گراف جهت‌دار از commitها** است. هر commit:

- یک snapshot از کل درخت فایل‌ها (نه diff)
- اشاره به commit والد (یا چند والد در merge)
- شناسه‌ی یکتا (SHA-1/256) که از محتوا ساخته می‌شود

سه آبجکت اصلی:

| آبجکت | محتوا |
| --- | --- |
| `blob` | محتوای یک فایل |
| `tree` | فهرست فایل‌ها/پوشه‌ها و اشاره به blobها |
| `commit` | اشاره به tree والد/والدها + نویسنده + پیام |

```
commit A ──▶ commit B ──▶ commit C
                            ▲
                       main (ref)
```

شاخه فقط یک **برچسب متحرک** روی یک commit است؛ ساخت شاخه تقریباً صفر هزینه دارد.

**سه ناحیه:**

```
Working tree  ──git add──▶  Index (staging)  ──git commit──▶  Repository
```

`HEAD` یعنی «جایی که هستید» و معمولاً به شاخه اشاره می‌کند (`HEAD → main → C`).

## ۲. تنظیمات اولیه‌ی حرفه‌ای

```bash
git config --global user.name "Sara Ahmadi"
git config --global user.email "sara@example.com"
git config --global init.defaultBranch main
git config --global pull.rebase true
git config --global fetch.prune true
git config --global rebase.autoStash true
git config --global core.autocrlf input      # ویندوز
git config --global core.editor "code --wait"
```

برای SSH (توصیه‌شده به‌جای رمز):

```bash
ssh-keygen -t ed25519 -C "sara@example.com"
# کلید عمومی را در GitHub → Settings → SSH and GPG keys اضافه کنید
ssh -T git@github.com
```

## ۳. چرخه‌ی روزمره و دیدن دقیق تغییرات

```bash
git status -sb
git diff                      # تغییرات stage نشده
git diff --staged             # چیزی که commit می‌شود
git add -p src/api.ts         # انتخاب تکه‌تکه (بهترین عادت)
git commit -m "feat(api): retry on 5xx"
```

`git add -p` باعث می‌شود commitهای کوچک و منطقی بسازید؛ همین کار بازبینی را ممکن می‌کند.

**commit خوب = تغییر واحد + پیام چرا:**

```
feat(cart): persist items in localStorage

Keep the cart after refresh. Uses zustand/persist with version 1
so future shape changes can migrate.
```

## ۴. شاخه، merge و rebase: تفاوت واقعی

```bash
git switch -c feature/login
# کار و commit...
git switch main
git pull --rebase
git switch feature/login
git rebase main
```

- **merge** یک commit ادغام با دو والد می‌سازد؛ تاریخچه واقعی حفظ می‌شود.
- **rebase** commitهای شما را روی نوک شاخه‌ی مقصد بازمی‌چیند و commitهای جدید می‌سازد (SHA عوض می‌شود).

```
merge:            rebase:
A─B───C─M         A─B─C
   \     /            \
    D─E─            D'─E'
```

**قاعده‌ی طلایی:** rebase فقط روی شاخه‌ای که **تنها شما** استفاده می‌کنید. rebase کردن شاخه‌ی مشترک، تاریخچه‌ی هم‌تیمی‌ها را می‌شکند.

## ۵. حل تعارض: گام‌به‌گام

تعارض وقتی رخ می‌دهد که هر دو طرف **همان خطوط** را تغییر داده باشند.

```bash
git merge feature/login
# CONFLICT (content): Merge conflict in src/auth.ts
```

1. `git status` → فایل‌های conflict دار.
2. فایل را باز کنید:

```ts
<<<<<<< HEAD
const timeout = 5000
=======
const timeout = 10_000
>>>>>>> feature/login
```

3. تصمیم بگیرید: یکی را نگه دارید، ترکیب کنید یا هر دو را بازنویسی کنید. **نشانه‌ها را کامل حذف کنید.**
4. تست/بیلد بگیرید (تعارض سینتکسی سالم لزوماً منطق سالم نیست).
5. `git add src/auth.ts` و سپس `git commit` (در rebase: `git rebase --continue`).

راه فرار:

```bash
git merge --abort
git rebase --abort
git checkout --ours src/auth.ts     # در حین merge
git checkout --theirs src/auth.ts
```

## ۶. نجات: reflog و cherry-pick

`git reflog` تاریخچه‌ی حرکت HEAD است؛ تقریباً هر «کد گم‌شده» را برمی‌گرداند.

```bash
git reflog
# 1f2a3b4 HEAD@{2}: commit: feat: add checkout
git reset --hard HEAD@{2}      # برگشت به همان لحظه
git switch -c rescue 1f2a3b4   # شاخه از commit گم‌شده
```

```bash
git cherry-pick 9c8b7a6        # یک commit خاص را روی شاخه‌ی فعلی بیاور
git revert 9c8b7a6             # commit معکوس (امن برای تاریخچه‌ی مشترک)
git bisect start               # پیدا کردن commit باگ‌دار با جستجوی دودویی
git bisect bad HEAD
git bisect good v1.0.0
```

**تفاوت reset و revert:** `reset` تاریخچه را جابه‌جا می‌کند (خطرناک روی شاخه‌ی مشترک)، `revert` یک commit جدید می‌سازد.

## ۷. ‎.gitignore و فایل‌های حساس

```gitignore
node_modules/
dist/
out/
coverage/
.env
.env.*
!.env.example
.DS_Store
*.log
```

اگر فایلی قبلاً track شده:

```bash
git rm --cached .env
git commit -m "chore: stop tracking secrets"
```

> حذف فایل، راز را از تاریخچه پاک نمی‌کند. اگر کلید commit شد: **کلید را باطل کنید**، سپس در صورت نیاز تاریخچه را با `git filter-repo` بازنویسی کنید و همه‌ی هم‌تیمی‌ها را مطلع کنید.

## ۸. Conventional Commits و نسخه‌گذاری

```
<type>(<scope>): <subject>

<body: چه و چرا>

<footer: BREAKING CHANGE / refs>
```

| type | کاربرد |
| --- | --- |
| `feat` | قابلیت جدید (minor) |
| `fix` | رفع باگ (patch) |
| `refactor` | بازنویسی بدون تغییر رفتار |
| `perf` | بهبود کارایی |
| `test` | تست |
| `docs` | مستندات |
| `chore` | ابزار/نگهداری |
| `build`/`ci` | بیلد و CI |

```
feat(auth)!: replace session cookie with JWT

BREAKING CHANGE: /api/login no longer returns Set-Cookie.
```

`!` یا `BREAKING CHANGE` یعنی major. ابزارهایی مثل semantic-release و changesets از همین الگو نسخه و changelog می‌سازند.

## ۹. جریان کاری Pull Request

```bash
git switch main && git pull --rebase
git switch -c feature/cart-persist
# کد، تست، commitهای کوچک
git push -u origin feature/cart-persist
gh pr create --fill --base main
```

PR خوب شامل:

- **چه** تغییر کرد و **چرا**
- **چطور تست شد** (دستور/سناریو)
- اسکرین‌شات برای UI
- ریسک و rollback

قبل از merge:

```bash
git fetch origin
git rebase origin/main     # شاخه‌ی خودتان
git push --force-with-lease   # امن‌تر از --force
```

`--force-with-lease` اگر کسی بعد از fetch شما پوش کرده باشد، جلوی بازنویسی را می‌گیرد.

## ۱۰. Hooks و اتوماسیون محلی

```bash
npm i -D husky lint-staged
npx husky init
```

```json
// package.json
{
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
    "*.{css,md}": "prettier --write"
  }
}
```

```bash
# .husky/pre-commit
npx lint-staged
```

Hooks را سبک نگه دارید؛ اگر pre-commit ده ثانیه طول بکشد، همه `--no-verify` می‌زنند.

## ۱۱. ساخت گام‌به‌گام مخزن الگو (تمرین)

**گام ۱ — مخزن و README:** عنوان، توضیح یک‌پاراگرافی، نیازمندی‌ها، نصب، اجرا، تست، مشارکت.

**گام ۲ — ‎.gitignore:** `node_modules`، خروجی build، فایل‌های env، فایل‌های سیستم‌عامل و IDE.

**گام ۳ — ‎.env.example:** کلیدهای لازم بدون مقدار واقعی.

**گام ۴ — CONTRIBUTING.md:** نام‌گذاری شاخه (`feature/`, `fix/`)، قالب commit، نحوه‌ی اجرای تست، قواعد بازبینی.

**گام ۵ — قالب‌ها:**

```
.github/
├─ pull_request_template.md
└─ ISSUE_TEMPLATE/
   ├─ bug_report.md
   └─ feature_request.md
```

**گام ۶ — شاخه و PR واقعی:** یک تغییر کوچک، commitهای Conventional، PR با توضیح و سپس squash merge.

**گام ۷ — محافظت:** در GitHub → Settings → Branches، برای `main` require PR + status checks را فعال کنید (در مخزن شخصی هم قابل تنظیم است).

**گام ۸ — بازبینی:** `git log --oneline --graph` باید خطی و خوانا باشد.

### نگاشت به معیارهای پذیرش

| معیار | کجای درس |
| --- | --- |
| `readme` | گام ۱ |
| `gitignore` | گام ۲ |
| `contributing` | گام ۴ |
| `templates` | گام ۵ |
| `commits` | بخش ۸ و گام ۶ |

## ۱۲. عیب‌یابی

| مشکل | علت | راه‌حل |
| --- | --- | --- |
| `rejected (fetch first)` | ریموت جلوتر است | `git pull --rebase` |
| `detached HEAD` | checkout روی commit | `git switch -c fix-here` |
| فراموش کردم شاخه بسازم | commit روی main | `git branch feature/x && git reset --hard origin/main` |
| فایل حذف‌شده برنمی‌گردد | commit نشده | `git restore --source=HEAD -- path` یا reflog |
| تاریخچه شلوغ | mergeهای زیاد | rebase + squash (طبق سیاست تیم) |
| `LF will be replaced by CRLF` | autocrlf | `.gitattributes` با `* text=auto eol=lf` |

```gitattributes
* text=auto eol=lf
*.png binary
*.woff2 binary
```

## ۱۳. آزمایش‌ها (با پاسخ)

**۱.** بعد از `git commit --amend` چه اتفاقی برای SHA می‌افتد؟

**پاسخ:** SHA عوض می‌شود چون محتوا/پیام/metadata تغییر کرده؛ اگر قبلاً push شده، history بازنویسی می‌شود و force-with-lease لازم است.

**۲.** `git reset --soft HEAD~1` و `git reset --hard HEAD~1` چه تفاوتی دارند؟

**پاسخ:** soft فقط pointer را عقب می‌برد و تغییرات در staging می‌مانند؛ hard تغییرات working tree را هم دور می‌ریزد.

**۳.** چرا `git pull` روی شاخه‌ی main شما merge commit ناخواسته می‌سازد؟

**پاسخ:** پیش‌فرض merge است؛ `pull.rebase true` یا `git pull --rebase` تاریخچه را خطی می‌کند.

**۴.** تعارض در فایل قفل (`package-lock.json`) را چطور حل می‌کنید؟

**پاسخ:** نشانه‌ها را دستی ادغام نکنید؛ نسخه‌ی یکی را بردارید، `npm install` بزنید و lockfile را دوباره تولید کنید، سپس تست.

## ۱۴. خودآزمایی

1. چرا commit یک snapshot است نه diff؟
2. merge و rebase چه تفاوتی در تاریخچه و SHA دارند؟
3. reflog چه چیزی را ذخیره می‌کند؟
4. `--force-with-lease` چه خطری را کم می‌کند؟
5. چرا حذف `.env` از commit کافی نیست؟
6. `git bisect` چگونه کار می‌کند؟

## ۱۵. چک‌لیست تحویل

- [ ] README اجرایی و کامل
- [ ] ‎.gitignore بدون فایل‌های حساس
- [ ] CONTRIBUTING با قواعد شاخه و commit
- [ ] قالب PR و Issue
- [ ] commitهای Conventional و کوچک
- [ ] حداقل یک PR واقعی
- [ ] `git log --graph` خوانا
- [ ] بدون راز در تاریخچه
