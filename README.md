# FullStack Academy — آکادمی فول‌استک

اپلیکیشن دسکتاپ کراس‌پلتفرم (Windows / macOS / Linux) برای یادگیری ساختاریافته‌ی فول‌استک از صفر تا سطح حرفه‌ای.
مسیر یادگیری شامل ۲۱ درس فارسی، تمرین‌های واقعی، بازبینی کد با هوش مصنوعی (BYOK) و سیستم باز شدن ترتیبی درس‌هاست.

## قابلیت‌ها

- **مسیر ترتیبی و قفل‌گذاری:** درس بعدی فقط پس از تأیید تمرین درس قبل باز می‌شود.
- **درس‌های فارسی مبتنی بر مستندات رسمی:** هر درس با لینک مستقیم به MDN، react.dev، Next.js Docs، Node.js Docs، Expo Docs و… .
- **تمرین‌های واقعی:** هر درس یک سناریوی شغلی، کارهای خواسته‌شده، معیارهای پذیرش و راهنمایی دارد.
- **بازبینی کد از GitHub:** فایل‌های مخزن با GitHub API دریافت و با معیارهای تمرین مقایسه می‌شوند.
- **BYOK:** کلید Gemini / OpenAI / Anthropic (و هر endpoint سازگار با OpenAI) در تنظیمات ذخیره می‌شود.
- **مینی‌درس پویا:** در صورت ضعف در یک مفهوم، مینی‌درس اختصاصی با مثال‌های متنوع داخل برنامه ساخته می‌شود.
- **تاریخچه ارسال‌ها:** هر بازبینی با commit، امتیاز و نتیجه ذخیره می‌شود.
- **حالت تاریک/روشن، RTL کامل و UI بهینه برای توسعه‌دهنده.**

## پشته فناوری

| لایه | فناوری |
| --- | --- |
| Desktop | Electron 45 + electron-vite |
| UI | React 19 + TypeScript + Tailwind CSS 4 + Lucide |
| Markdown | react-markdown + remark-gfm + rehype-highlight |
| State | Zustand (همگام‌شده با فایل JSON محلی) |
| اعتبارسنجی | Zod (پاسخ AI، پارس repo و…) |
| تست | Vitest |
| بسته‌بندی | electron-builder (NSIS / DMG / AppImage, deb) |

## اجرا

```bash
npm install
npm run dev        # حالت توسعه با HMR
npm run typecheck  # بررسی تایپ‌ها (main + renderer)
npm test           # اجرای تست‌ها
npm run build      # ساخت خروجی production در out/
npm run dist:win   # نصب‌کننده ویندوز (یا dist:mac / dist:linux)
```

نیازمندی: Node.js 20+ و npm. برای ساخت نسخه‌ی مک/لینوکس باید همان سیستم‌عامل یا CI مربوطه استفاده شود.

## پیکربندی

### ۱) کلید هوش مصنوعی (BYOK)

تنظیمات → بخش «هوش مصنوعی»:

| سرویس | مدل پیش‌فرض | توضیح |
| --- | --- | --- |
| Google Gemini | `gemini-2.5-flash` | ساخت کلید در Google AI Studio |
| OpenAI | `gpt-4.1-mini` | امکان تنظیم Base URL سازگار (پروکسی، OpenRouter، مدل محلی) |
| Anthropic | `claude-sonnet-4-5` | Claude Messages API |

کلیدها با `safeStorage` (Keychain در macOS، DPAPI در ویندوز، libsecret در لینوکس) رمزنگاری می‌شوند و **هرگز به رندرر یا لاگ ارسال نمی‌شوند**.
اگر رمزنگاری سیستمی در دسترس نباشد، برنامه هشدار می‌دهد و ذخیره‌سازی مبهم (base64) انجام می‌شود.

### ۲) اتصال GitHub

- **Personal Access Token (ساده‌ترین):** تنظیمات → GitHub → توکن. برای مخازن خصوصی scope `repo` و برای عمومی `public_repo` کافی است. توکن هنگام ذخیره با `/user` اعتبارسنجی می‌شود.
- **OAuth Device Flow:** یک OAuth App بسازید، در تنظیمات آن **Enable Device Flow** را فعال کنید، سپس `Client ID` را در برنامه وارد کنید و «شروع ورود» را بزنید. کد نمایش‌داده‌شده را در `github.com/login/device` وارد کنید. (Client Secret لازم نیست؛ برای اپ دسکتاپ مناسب است.)

بدون اتصال هم مخازن عمومی قابل بررسی هستند (با محدودیت نرخ ۶۰ درخواست در ساعت).

## معماری

```
src/
├─ shared/                 # کد مشترک main ↔ renderer (types، review، repoRef، fileSelection)
├─ main/                   # پروسه‌ی Electron
│  ├─ index.ts             # ساخت پنجره، IPC امن، CSP/ناوبری
│  ├─ storage.ts           # ذخیره JSON اتمیک + secrets با safeStorage
│  ├─ github.ts            # Device Flow، دریافت مخزن، blobها، محدودیت نرخ
│  └─ ai.ts                # آداپترهای Gemini / OpenAI / Anthropic
├─ preload/index.ts        # پل contextBridge (بدون nodeIntegration)
└─ renderer/src/
   ├─ data/                # سرفصل ۲۱ درس + معیارهای پذیرش
   ├─ content/             # متن درس‌ها (Markdown فارسی)
   ├─ lib/                 # prompts، orchestration بازبینی
   ├─ store/               # Zustand: پیشرفت، تنظیمات، وضعیت کلیدها
   └─ components/          # Sidebar، LessonView، ReviewTab، SettingsDialog، ...
```

### جریان بازبینی

1. کاربر آدرس مخزن (`owner/repo` یا URL) را وارد می‌کند؛ پارس و اعتبارسنجی سمت رندرر انجام می‌شود.
2. Main با GitHub API شاخه‌ی پیش‌فرض (یا شاخه‌ی مشخص‌شده) و آخرین commit را می‌گیرد، درخت فایل را می‌خواند و فقط فایل‌های متنی مرتبط را انتخاب می‌کند.
   - `node_modules`، خروجی build، lockfileها، فایل‌های واقعی `.env` و فایل‌های بزرگ حذف می‌شوند.
   - حداکثر ۶۰ فایل و ~۳۰۰KB محتوا به مدل ارسال می‌شود.
3. پرامپت شامل سناریو، وظایف، **id و متن معیارها** و محتوای فایل‌هاست؛ مدل ملزم به پاسخ JSON است.
4. پاسخ با Zod اعتبارسنجی می‌شود (JSON داخل بلوک کد هم پشتیبانی می‌شود).
5. **تصمیم نهایی با کد است، نه مدل:** درس فقط وقتی تکمیل می‌شود که همه‌ی معیارهای تمرین `met: true` باشند و هیچ issue با severity `critical` وجود نداشته باشد. بنابراین مدل نمی‌تواند بی‌دلیل درس را پاس کند.
6. در صورت رد شدن، مینی‌درس به‌صورت خودکار برای مهم‌ترین مشکل ساخته می‌شود و در همان صفحه نمایش داده می‌شود.

## داده‌های محلی

- مسیر: `app.getPath('userData')` (در تنظیمات → داده‌ها نمایش داده می‌شود)
- `data/academy-state.json`: پیشرفت، تنظیمات، تاریخچه بازبینی‌ها، مینی‌درس‌ها
- `secrets.json`: کلیدهای API و توکن GitHub (رمزنگاری‌شده)
- نوشتن اتمیک (فایل موقت + rename) برای جلوگیری از خرابی داده

## امنیت

- `contextIsolation: true`، `sandbox: true`، `nodeIntegration: false`
- IPC با بررسی‌های صریح و پاسخ‌های `{ ok, data | error }`
- کلیدهای API فقط در main خوانده می‌شوند؛ رندرر هیچ راهی برای خواندن آن‌ها ندارد
- CSP در `index.html`، باز شدن لینک‌ها فقط در مرورگر سیستم، مسدودسازی ناوبری
- حذف خودکار فایل‌های `.env` از محتوای ارسالی به مدل
- ذخیره‌ی امن رازها با Keychain/DPAPI/libsecret

## تست

```bash
npm test
```

پوشش فعلی: پارس آدرس مخزن، انتخاب فایل‌های قابل بررسی (و حذف اسرار)، تصمیم قبولی/رد، استخراج و اعتبارسنجی JSON مدل، و orchestration بازبینی با پل شبیه‌سازی‌شده.

## سرفصل‌ها

1. **مبانی فرانت‌اند:** HTML/CSS مدرن، JavaScript ES6+، TypeScript
2. **ابزارها و معماری:** Git، npm/pnpm/yarn، Vite
3. **وب پیشرفته:** React Hooks، Context/Zustand/Redux، Next.js App Router
4. **موبایل:** Expo/React Native، Expo Router، Native APIs
5. **بک‌اند:** Node.js، Express، NestJS، PostgreSQL/Prisma، GraphQL
6. **DevOps و تست:** Docker، امنیت وب، Jest، Playwright

## محدودیت‌ها

- بازبینی نیازمند اینترنت و اعتبار API شماست؛ هزینه‌ی فراخوانی مدل با کاربر است.
- برای تغییرات بزرگ، فقط زیرمجموعه‌ای از فایل‌ها ارسال می‌شود (۶۰ فایل / ۳۰۰KB) تا هزینه و محدودیت context کنترل شود.
- پاسخ مدل ممکن است به‌ندرت JSON معتبر نباشد؛ برنامه خطای فارسی و قابل‌تلاش‌مجدد نشان می‌دهد.
- GitHub بدون توکن محدود به ۶۰ درخواست در ساعت است.
