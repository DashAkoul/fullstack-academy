# مدیریت بسته‌ها: npm، pnpm و yarn

> مرجع رسمی: [npm Docs](https://docs.npmjs.com/cli/v10/configuring-npm/package-json) و [pnpm Docs](https://pnpm.io/)

## ۱. `package.json` — شناسنامه‌ی پروژه

```json
{
  "name": "@acme/utils",
  "version": "1.2.0",
  "private": false,
  "description": "ابزارهای مشترک تیم",
  "license": "MIT",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" }
  },
  "bin": { "acme": "./bin/cli.js" },
  "engines": { "node": ">=20" },
  "files": ["dist", "README.md"],
  "scripts": {
    "dev": "vite",
    "build": "tsc -p tsconfig.build.json",
    "test": "node --test",
    "lint": "eslint ."
  },
  "dependencies": { "zod": "^3.23.8" },
  "devDependencies": { "typescript": "^5.6.0" }
}
```

فیلدهای حیاتی برای انتشار:

| فیلد | نقش |
| --- | --- |
| `name` | یکتا در رجیستری؛ scope دار @acme/... |
| `version` | باید در هر انتشار تغییر کند |
| `files` | سفیدلیست فایل‌های منتشرشده (کوچک‌تر = بهتر) |
| `main` / `types` / `exports` | نقطه‌ی ورود و تایپ‌ها |
| `engines` | حداقل نسخه‌ی Node |
| `private: true` | جلوگیری از انتشار ناخواسته |

## ۲. SemVer — نسخه‌بندی معنایی

`MAJOR.MINOR.PATCH` = `1.4.2`

- **MAJOR**: تغییر ناسازگار (breaking) — کد مصرف‌کننده ممکن است بشکند.
- **MINOR**: قابلیت جدید و سازگار.
- **PATCH**: رفع باگ سازگار.

در `dependencies`:

| نماد | معنا |
| --- | --- |
| `^1.4.2` | اجازه‌ی 1.x.x (پیش‌فرض npm) |
| `~1.4.2` | اجازه‌ی 1.4.x |
| `1.4.2` | دقیقاً همین |
| `*` یا `latest` | خطرناک — هرگز در پروژه‌ی جدی |

> قاعده‌ی عملی: برای کتابخانه‌ها `^` منطقی است؛ برای برنامه‌های production، **lockfile** تعیین‌کننده است، نه range.

## ۳. dependencies یا devDependencies؟

- `dependencies`: چیزی که در زمان اجرا لازم است → `react`, `express`, `zod`.
- `devDependencies`: فقط برای توسعه/build/test → `typescript`, `vite`, `jest`, `eslint`.

اشتباه رایج: گذاشتن bundler یا typeها در dependencies → حجم و سطح حمله‌ی production بالا می‌رود.

```bash
npm i express          # dependency
npm i -D typescript     # devDependency
npm i -g npm-check-updates   # global (کم استفاده کنید)
```

## ۴. lockfile — اهمیت واقعی

لاک‌فایل دقیقاً نسخه و hash همه‌ی وابستگی‌های غیرمستقیم (transitive) را قفل می‌کند.

```bash
npm ci          # نصب دقیق از lockfile — در CI استفاده کنید
npm install     # نصب/به‌روزرسانی و بازنویسی lockfile
```

- lockfile را **همیشه commit کنید**.
- از `npm ci` در CI/CD استفاده کنید تا build قابل تکرار باشد.
- `npm install` و `npm ci` را قاطی نکنید.

## ۵. npm vs pnpm vs yarn

| ویژگی | npm | pnpm | yarn (berry) |
| --- | --- | --- | --- |
| نصب‌شده با Node | ✅ | ❌ | ❌ |
| سرعت/فضا | متوسط | بسیار خوب (hard links) | خوب |
| Workspace | ✅ | ✅ عالی | ✅ |
| سخت‌گیری وابستگی | متوسط | بالا (بدون phantom deps) | بالا (PnP) |

pnpm با ساختار `node_modules` غیرتخت، از «phantom dependency» (استفاده از بسته‌ای که در package.json نیست) جلوگیری می‌کند. برای مونوریپو گزینه‌ی بسیار خوبی است.

```bash
corepack enable          # مدیریت نسخه‌ی package manager
corepack use pnpm@9
```

## ۶. Monorepo با Workspaces

```yaml
# pnpm-workspace.yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

```json
// packages/ui/package.json
{ "name": "@acme/ui", "version": "0.0.0", "main": "src/index.ts" }
```

```json
// apps/web/package.json
{ "dependencies": { "@acme/ui": "workspace:*" } }
```

```bash
pnpm -r build          # اجرای build در همه پکیج‌ها
pnpm --filter web dev  # فقط در اپ web
```

`workspace:*` یعنی از نسخه‌ی محلی استفاده کن، نه رجیستری — تغییرات فوری در همه‌ی اپ‌ها دیده می‌شوند.

## ۷. امنیت وابستگی‌ها

```bash
npm audit
npm audit fix            # فقط patch/minor سازگار
npm audit fix --force    # ⚠️ ممکن است breaking باشد
npx npm-check-updates -i # ارتقای تعاملی
```

عادت‌های حرفه‌ای:

- وابستگی کمتر = سطح حمله کمتر. قبل از نصب، آیا با ۲۰ خط کد خودتان حل نمی‌شود؟
- `npm view <pkg> time.modified` → آخرین انتشار؛ بسته‌ی رهاشده را با احتیاط.
- در CI یک مرحله‌ی `npm audit --omit=dev` بگذارید.
- `postinstall` اسکریپت‌های ناشناس را محدود کنید (`npm config set ignore-scripts true` برای پروژه‌های حساس).

## ۸. اسکریپت‌ها و `npx`

```bash
npm run dev -- --port 3000    # پاس دادن آرگومان
npx playwright install        # اجرای باینری پکیج بدون نصب گلوبال
npm pkg set scripts.clean="rm -rf dist && rm -rf node_modules/.cache"
```

اسکریپت‌های پروژه را «مستند زنده» بدانید: هر کاری که هم‌تیمی باید انجام دهد، باید یک `npm run` باشد.

## ۹. نکات ویندوز/کراس‌پلتفرم

- `rm -rf` در ویندوز کار نمی‌کند؛ از `rimraf` یا اسکریپت Node استفاده کنید.
- متغیرهای محیطی inline (`PORT=3000 node x.js`) در ویندوز کار نمی‌کند؛ از `cross-env` یا فایل `.env` استفاده کنید.
- فایل `.npmrc` را commit کنید اگر تنظیمات تیمی دارد (`engine-strict=true`).

## تمرین این درس

یک ابزار CLI تبدیل واحد بسازید که با npm نصب و اجرا می‌شود: package.json کامل با `bin`، `engines`، اسکریپت‌ها، تفکیک درست dependencies، lockfile commit‌شده و چند تست. جزئیات در تب تمرین است.
