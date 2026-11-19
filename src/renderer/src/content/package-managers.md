# مدیریت بسته‌ها: npm، pnpm و yarn

> مرجع رسمی: [npm Docs](https://docs.npmjs.com/) · [package.json](https://docs.npmjs.com/cli/configuring-npm/package-json) · [pnpm](https://pnpm.io/) · [SemVer](https://semver.org/lang/fa/)

## در این درس چه یاد می‌گیرید؟

می‌فهمید چرا دو نفر با یک `package.json` دو نسخه‌ی متفاوت نصب می‌کنند، lockfile چه نقشی دارد، تفاوت `dependencies` و `devDependencies` کجا دردسر می‌سازد و چطور یک ابزار خط فرمان قابل نصب با npm بسازید (با `bin`، تست و lockfile). در پایان تمرین این درس، یک بسته‌ی واقعی دارید نه یک پوشه‌ی تمرینی.

---

## ۱. `package.json` را مثل قرارداد بخوانید

```json
{
  "name": "@acme/unit-cli",
  "version": "1.2.0",
  "description": "ابزار تبدیل واحد در خط فرمان",
  "license": "MIT",
  "type": "module",
  "bin": { "unit": "./bin/cli.js" },
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" }
  },
  "files": ["dist", "bin", "README.md"],
  "engines": { "node": ">=20" },
  "scripts": {
    "start": "node ./bin/cli.js",
    "test": "node --test",
    "lint": "eslint ."
  },
  "dependencies": { "picocolors": "^1.1.1" },
  "devDependencies": { "eslint": "^9.0.0" }
}
```

| فیلد | چرا حیاتی است |
| --- | --- |
| `name` + `version` | هویت یکتا؛ برای انتشار باید تغییر کند |
| `type: module` | فایل‌های `.js` به‌صورت ESM تفسیر می‌شوند |
| `bin` | دستور قابل اجرا پس از نصب (`npx unit`) |
| `exports` | API عمومی بسته؛ مسیرهای داخلی را می‌بندد |
| `files` | سفیدلیست انتشار؛ حجم و سطح حمله را کم می‌کند |
| `engines` | حداقل نسخه‌ی Node؛ با `engine-strict` سخت‌گیرانه می‌شود |
| `packageManager` | نسخه‌ی pnpm/yarn پروژه (Corepack) |

```json
{ "packageManager": "pnpm@9.12.0", "engines": { "node": ">=20" } }
```

## ۲. SemVer: قرارداد نسخه‌ها

`MAJOR.MINOR.PATCH`

- **MAJOR**: تغییر ناسازگار (کد مصرف‌کننده می‌شکند)
- **MINOR**: قابلیت جدید سازگار
- **PATCH**: رفع باگ سازگار

پیش‌انتشار: `2.0.0-beta.1` (کمتر از `2.0.0`).

```json
{
  "exact": "1.4.2",
  "patch": "~1.4.2",
  "minor": "^1.4.2",
  "range": ">=1.4.2 <2",
  "any": "*"
}
```

| نماد | اجازه می‌دهد |
| --- | --- |
| `1.4.2` | فقط همین |
| `~1.4.2` | `>=1.4.2 <1.5.0` |
| `^1.4.2` | `>=1.4.2 <2.0.0` |
| `^0.4.2` | `>=0.4.2 <0.5.0` (نسخه‌های ۰ محافظه‌کارانه‌ترند) |

> `^` برای کتابخانه‌ها منطقی است. برای برنامه‌ی production، **lockfile** است که نسخه‌ی واقعی را تثبیت می‌کند، نه range.

## ۳. وابستگی‌ها: چهار نوع، چهار رفتار

| بخش | زمان لازم است | مثال |
| --- | --- | --- |
| `dependencies` | اجرا (production) | `express`, `zod` |
| `devDependencies` | توسعه/بیلد/تست | `typescript`, `vite`, `eslint` |
| `peerDependencies` | توسط مصرف‌کننده تأمین می‌شود | `react` در یک کتابخانه‌ی UI |
| `optionalDependencies` | اگر نصب نشد، ادامه بده | باینری‌های پلتفرمی |

اشتباه رایج: گذاشتن bundler یا type-only packageها در `dependencies` → نصب production سنگین‌تر و سطح حمله بیشتر.

```bash
npm i express              # dependency
npm i -D typescript        # devDependency
npm i -P react             # peer? (در npm 7+ نصب می‌شود ولی برای مصرف‌کننده هم اعلام کنید)
npm i --omit=dev           # نصب فقط production
```

## ۴. Lockfile و نصب قابل تکرار

`package-lock.json` (یا `pnpm-lock.yaml`) دقیقاً نسخه و hash کل درخت وابستگی‌ها را قفل می‌کند.

```bash
npm ci          # نصب دقیق از lockfile؛ برای CI و production
npm install     # حل مجدد و به‌روزرسانی lockfile
```

- lockfile را **همیشه commit کنید**.
- در CI فقط `npm ci`؛ اگر lockfile با package.json ناسازگار باشد، خطا می‌دهد (خوب است).
- `npm install` و `npm ci` را قاطی نکنید.
- بعد از merge، اگر lockfile تعارض داشت: یکی را بردارید و `npm install` کنید (دستی ادغام نکنید).

## ۵. درخت وابستگی، dedupe و overrides

```bash
npm ls react
npm dedupe
npm explain lodash
```

گاهی دو نسخه از یک بسته نصب می‌شود (یکی برای A، یکی برای B). `npm dedupe` تلاش می‌کند نسخه‌ی مشترک بسازد، اما اگر rangeها ناسازگار باشند، دو نسخه می‌ماند.

اجبار نسخه (با احتیاط):

```json
{
  "overrides": {
    "lodash": "^4.17.21"
  }
}
```

```json
{ "resolutions": { "lodash": "^4.17.21" } }
```

`overrides` برای رفع CVE یا سازگاری موقت است؛ در تیم مستند کنید و در بلندمدت وابستگی را به‌روز کنید.

## ۶. Scripts: چرخه‌ی عمر

```json
{
  "scripts": {
    "prebuild": "node scripts/check-env.js",
    "build": "tsc -p tsconfig.build.json",
    "postbuild": "node scripts/copy-assets.js",
    "test": "node --test",
    "dev": "node --watch src/server.js"
  }
}
```

- `pre<script>` و `post<script>` خودکار اجرا می‌شوند.
- `npm run build -- --watch` آرگومان را پاس می‌دهد.
- `prepare` بعد از نصب بسته اجرا می‌شود؛ برای کتابخانه‌ها مفید و برای مخازن ناشناس خطرناک است.

Portability:

```bash
npm i -D cross-env rimraf
"clean": "rimraf dist",
"start:win": "cross-env PORT=3000 node src/index.js"
```

`rm -rf` در اسکریپت npm روی ویندوز کار نمی‌کند؛ `rimraf` یا اسکریپت Node استفاده کنید.

## ۷. npm vs pnpm vs yarn

| ویژگی | npm | pnpm | yarn Berry |
| --- | --- | --- | --- |
| همراه Node | ✅ | ❌ | ❌ |
| ساختار `node_modules` | تخت | symlink به store | تخت یا PnP |
| phantom dependencies | ممکن | جلوگیری می‌شود | با PnP |
| فضای دیسک | زیاد | کم (hard link) | کم |
| Workspace | ✅ | ✅ عالی | ✅ |

pnpm وابستگی‌های غیرمستقیم را در دسترس مستقیم قرار نمی‌دهد؛ اگر بسته‌ای را import کردید که در `package.json` نیست، خطا می‌گیرید — همین باعث می‌شود وابستگی‌های واقعی را اعلام کنید.

```bash
corepack enable
corepack use pnpm@9
pnpm add react
pnpm add -D typescript
pnpm why react
```

## ۸. Monorepo با Workspaces

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
pnpm -r build              # همه
pnpm --filter web dev      # فقط web
pnpm --filter web... build # web و وابستگی‌هایش
```

## ۹. امنیت زنجیره‌ی تأمین

```bash
npm audit
npm audit --omit=dev
npm audit fix              # فقط سازگار
npx npm-check-updates -i   # ارتقای تعاملی
```

عادت‌های حرفه‌ای:

- وابستگی کمتر = سطح حمله کمتر. قبل از نصب بپرسید «۲۰ خط کد خودم کافی نیست؟»
- `postinstall` ناشناس را محدود کنید: `npm config set ignore-scripts true` برای پروژه‌های حساس، سپس فقط بسته‌های لازم را استثنا کنید.
- به `npm view <pkg> time.modified` نگاه کنید؛ بسته‌ی رهاشده ریسک است.
- برای انتشار عمومی، npm provenance را فعال کنید.

## ۱۰. ساخت گام‌به‌گام CLI تبدیل واحد (تمرین)

**گام ۱ — ساختار**

```
fsa-05-unit-cli/
├─ bin/cli.js
├─ src/convert.js
├─ test/convert.test.js
├─ package.json
└─ README.md
```

**گام ۲ — منطق خالص**

```js
// src/convert.js
const FACTORS = {
  km: { base: 'm', factor: 1000 },
  m: { base: 'm', factor: 1 },
  cm: { base: 'm', factor: 0.01 },
  mi: { base: 'm', factor: 1609.344 }
}

export function convert(value, from, to) {
  if (!Number.isFinite(value)) throw new TypeError('مقدار باید عدد باشد')
  if (!FACTORS[from] || !FACTORS[to]) throw new Error('واحد ناشناخته')
  if (FACTORS[from].base !== FACTORS[to].base) throw new Error('واحدها هم‌خانواده نیستند')
  return (value * FACTORS[from].factor) / FACTORS[to].factor
}
```

**گام ۳ — CLI با shebang**

```js
#!/usr/bin/env node
import { parseArgs } from 'node:util'
import { convert } from '../src/convert.js'

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { help: { type: 'boolean', short: 'h' } }
})

if (values.help || positionals.length !== 3) {
  console.log('استفاده: unit <value> <from> <to>   مثال: unit 10 km mi')
  process.exit(values.help ? 0 : 1)
}

const [raw, from, to] = positionals
try {
  const result = convert(Number(raw), from, to)
  console.log(`${raw} ${from} = ${result.toFixed(3)} ${to}`)
} catch (err) {
  console.error(`خطا: ${err.message}`)
  process.exitCode = 1
}
```

**گام ۴ — تست با اجراکننده‌ی داخلی Node**

```js
// test/convert.test.js
import test from 'node:test'
import assert from 'node:assert/strict'
import { convert } from '../src/convert.js'

test('کیلومتر به مایل', () => {
  assert.equal(Number(convert(10, 'km', 'mi').toFixed(3)), 6.214)
})

test('واحد ناشناخته خطا می‌دهد', () => {
  assert.throws(() => convert(1, 'km', 'parsec'), /ناشناخته/)
})
```

**گام ۵ — `package.json` کامل** با `bin`، `engines`، `scripts`، `license`، `files`.

**گام ۶ — lockfile و README**؛ تست دستی: `node bin/cli.js 10 km mi` و `npm link` برای اجرای `unit`.

### اجرای واقعی: انتشار و اجرای CLI

```bash
mkdir fsa-05-unit-cli && cd fsa-05-unit-cli
npm init -y
# Wrote to /home/you/fsa-05-unit-cli/package.json

npm pkg set name="unit-convert" version="1.0.0" type="module" license="MIT" \
  bin.unit="./bin/cli.js" engines.node=">=20"
npm pkg set scripts.test="node --test" scripts.start="node ./bin/cli.js"

node bin/cli.js 10 km mi
# 10 km = 6.214 mi

node bin/cli.js 1 km parsec
# خطا: واحد ناشناخته
# echo $?
# 1
```

**تست:**

```bash
npm test
# > unit-convert@1.0.0 test
# > node --test
#
# ✔ کیلومتر به مایل (1.2ms)
# ✔ واحد ناشناخته خطا می‌دهد (0.4ms)
# ℹ tests 2
# ℹ pass 2
# ℹ fail 0
```

**بسته‌بندی واقعی:**

```bash
npm pack --dry-run
# npm notice 📦  unit-convert@1.0.0
# npm notice Tarball Contents
# npm notice 84B  bin/cli.js
# npm notice 112B package.json
# npm notice 210B src/convert.js
# npm notice Tarball Details
# npm notice name: unit-convert
# npm notice version: 1.0.0
# npm notice filename: unit-convert-1.0.0.tgz
# npm notice total files: 3
```

اگر `bin/cli.js` در فهرست نبود، `"files"` یا `bin` را اشتباه تنظیم کرده‌اید. اگر `npm link` می‌کنید و دستور `unit` پیدا نمی‌شود:

```bash
which unit        # باید مسیر global bin را نشان دهد
npm bin -g        # مسیر را بررسی کنید
```

**ایست بازرسی:** `npm pack --dry-run` باید **فقط** فایل‌های لازم را نشان دهد؛ `node_modules`، `.env` و تست‌ها (اگر نمی‌خواهید) نباید داخل بسته باشند. `npm ci` در یک پوشه‌ی تازه باید بدون تغییر lockfile اجرا شود.

### نگاشت به معیارهای پذیرش

| معیار | کجای درس |
| --- | --- |
| `package-json` | بخش ۱، گام ۵ |
| `deps` | بخش ۳ |
| `cli` | گام ۳ |
| `lockfile` | بخش ۴ و گام ۶ |
| `tests` | گام ۴ |

## ۱۱. عیب‌یابی

| خطا | معنا | راه‌حل |
| --- | --- | --- |
| `E404` | بسته/نسخه پیدا نشد | نام و رجیستری را بررسی کنید |
| `ERESOLVE unable to resolve dependency tree` | تعارض peer | نسخه‌ها را هم‌تراز کنید یا `--legacy-peer-deps` (آخرین راه) |
| `EACCES` | مجوز پوشه‌ی global | از nvm یا مسیر کاربر استفاده کنید؛ با sudo نصب نکنید |
| `ENOENT package.json` | اجرا در پوشه‌ی اشتباه | `pwd` و `npm prefix` |
| `Cannot find module` بعد از نصب pnpm | وابستگی اعلام‌نشده (phantom) | با `pnpm add` اضافه کنید |
| `engine-strict` خطا | نسخه‌ی Node | `.nvmrc` و nvm استفاده کنید |

## ۱۲. آزمایش‌ها (با پاسخ)

**۱.** `^0.3.1` چه نسخه‌هایی را اجازه می‌دهد؟

**پاسخ:** `>=0.3.1 <0.4.0` — برای major صفر، minor ناسازگار تلقی می‌شود.

**۲.** چرا `npm ci` در CI بهتر از `npm install` است؟

**پاسخ:** دقیقاً lockfile را نصب می‌کند، آن را بازنویسی نمی‌کند و اگر ناسازگاری باشد سریع شکست می‌خورد؛ نتیجه قابل تکرار است.

**۳.** بسته‌ای در `devDependencies` است ولی در کد production import می‌شود. چه اتفاقی می‌افتد؟

**پاسخ:** با `npm ci --omit=dev` ماژول نصب نمی‌شود و برنامه در زمان اجرا crash می‌کند. باید به `dependencies` منتقل شود.

**۴.** `npx cowsay hi` چه کاری می‌کند؟

**پاسخ:** باینری بسته را (در صورت نبود) موقت دانلود و اجرا می‌کند؛ نیازی به نصب global نیست.

## ۱۳. خودآزمایی

1. تفاوت `^` و `~`؟
2. نقش `exports` در بسته‌های مدرن؟
3. چرا pnpm از phantom dependency جلوگیری می‌کند؟
4. `peerDependencies` را چه زمانی استفاده می‌کنیم؟
5. `prepare` چه زمانی اجرا می‌شود و چه خطری دارد؟
6. چطور نسخه‌ی یک وابستگی غیرمستقیم را مجبور کنیم؟

## ۱۴. چک‌لیست تحویل

- [ ] `package.json` با `name/version/license/bin/engines/scripts`
- [ ] تفکیک درست dependencies و devDependencies
- [ ] lockfile در مخزن
- [ ] CLI با shebang و مدیریت آرگومان/خطا + exit code
- [ ] حداقل دو تست
- [ ] README با نصب و اجرا
- [ ] بدون راز یا فایل env در بسته
