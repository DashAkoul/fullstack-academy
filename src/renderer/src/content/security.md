# امنیت وب و اپلیکیشن

> مراجع: [OWASP Top 10](https://owasp.org/www-project-top-ten/) · [OWASP Cheat Sheets](https://cheatsheetseries.owasp.org/) · [MDN Web Security](https://developer.mozilla.org/en-US/docs/Web/Security)

## در این درس چه یاد می‌گیرید؟

تهدیدهای واقعی یک اپ کامل (فرانت، API، دیتابیس، دسکتاپ) را می‌شناسید و برای هر کدام کنترل عملی پیاده می‌کنید: مدیریت راز، هش رمز، کوکی امن، جلوگیری از IDOR/XSS/SSRF/SQLi و امنیت زنجیره‌ی تأمین. در پایان، یک چک‌لیست امنیتی قابل‌اجرا برای پروژه‌ی خود دارید.

---

## ۱. مدل تهدید در ۵ سؤال

1. چه چیزی ارزش محافظت دارد؟ (رمز، توکن، داده‌ی کاربر، پرداخت)
2. چه کسی مهاجم است؟ (کاربر عادی، کاربر احراز هویت‌شده، ربات)
3. از کجا وارد می‌شود؟ (فرم، URL، هدر، فایل، وابستگی)
4. چه اتفاقی می‌افتد اگر بشکند؟
5. چه کنترلی داریم و چطور تست می‌شود؟

بدون این پنج پاسخ، «امنیت» فقط چند هدر است.

## ۲. مدیریت راز

```bash
# .gitignore
.env
.env.*
!.env.example
*.pem
```

```bash
npx gitleaks detect --no-git -v     # اسکن قبل از commit
git filter-repo --path .env --invert-paths   # حذف از تاریخچه (در صورت لو رفتن)
```

- راز فقط در env/secret manager؛ هرگز در کد، README، تست یا باندل فرانت.
- `.env.example` بدون مقدار واقعی.
- **اگر رازی لو رفت، آن را بچرخانید**؛ حذف فایل کافی نیست (در تاریخچه/کش/فورک می‌ماند).
- در فرانت فقط `VITE_`/`NEXT_PUBLIC_` عمومی؛ کلید سرویس پولی سمت سرور.

## ۳. رمز عبور

```ts
import argon2 from 'argon2'

const hash = await argon2.hash(password, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2 })
const ok = await argon2.verify(hash, candidate)
```

| الگوریتم | وضعیت |
| --- | --- |
| MD5/SHA-1/SHA-256 خام | ❌ هرگز |
| bcrypt (cost ≥ 12) | ✅ قابل قبول |
| scrypt | ✅ |
| Argon2id | ✅ توصیه‌شده |

- طول حداقل ۸–۱۲، بدون محدودیت عجیب؛ حداکثر ~۷۲ بایت برای bcrypt.
- پیام خطای ورود یکسان: «ایمیل یا رمز نادرست است» (جلوگیری از enumeration).
- rate limit روی login و فراموشی رمز.
- رمز را هرگز لاگ نکنید.

## ۴. نشست: کوکی یا JWT؟

```ts
res.cookie('session', token, {
  httpOnly: true,
  secure: true,
  sameSite: 'lax',
  path: '/',
  maxAge: 1000 * 60 * 60 * 24 * 7
})
```

| | کوکی HttpOnly | JWT در localStorage |
| --- | --- | --- |
| XSS | امن (JS نمی‌خواند) | ❌ قابل خواندن |
| CSRF | نیاز به SameSite/CSRF token | مقاوم‌تر |
| ابطال | آسان | سخت |

توصیه: کوکی `HttpOnly` + `Secure` + `SameSite` برای نشست وب؛ JWT کوتاه‌عمر برای API/موبایل با refresh چرخشی.

CSRF: با `SameSite=Lax/Strict` بیشتر پوشش داده می‌شود؛ برای عملیات حساس توکن CSRF یا بررسی `Origin` هم بگذارید.

## ۵. مجوزدهی: IDOR قاتل خاموش است

```ts
// ❌ هر کاربری با دانستن id می‌تواند فاکتور دیگران را ببیند
app.get('/invoices/:id', async (req, res) => {
  res.json(await db.invoice.findUnique({ where: { id: req.params.id } }))
})

// ✅ مالکیت/tenant بررسی می‌شود
app.get('/invoices/:id', requireAuth, async (req, res) => {
  const invoice = await db.invoice.findFirst({
    where: { id: req.params.id, userId: req.user.id }
  })
  if (!invoice) return res.sendStatus(404)
  res.json(invoice)
})
```

- هر کوئری باید `userId`/`tenantId` داشته باشد.
- نقش را در سرور بررسی کنید (`requireRole('admin')`).
- ۴۰۳ برای «می‌دانی وجود دارد ولی اجازه نداری»، ۴۰۴ برای «وجود ندارد/پنهان».
- تست بنویسید: کاربر A به منبع B دسترسی ندارد.

## ۶. XSS و CSP

React به‌طور پیش‌فرض متن را escape می‌کند؛ خطر در درگاه‌های فرار است:

```tsx
// ❌ خطرناک
<div dangerouslySetInnerHTML={{ __html: userContent }} />

// ✅ پاک‌سازی
import DOMPurify from 'dompurify'
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(userContent) }} />
```

```ts
// هدر CSP
app.use((_req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; img-src 'self' data: https:; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://api.example.com; frame-ancestors 'none'"
  )
  next()
})
```

- از `innerHTML`، `eval`، `new Function` پرهیز کنید.
- لینک‌های کاربر با `javascript:` را رد کنید (`new URL` و بررسی protocol).
- برای اپ Electron: `contextIsolation: true`، `sandbox: true`، `nodeIntegration: false` و باز کردن لینک خارجی با `shell.openExternal` بعد از اعتبارسنجی دامنه.

## ۷. تزریق SQL و NoSQL

```ts
// ❌ تزریق
db.query(`SELECT * FROM users WHERE email = '${email}'`)

// ✅ پارامتر
db.query('SELECT * FROM users WHERE email = $1', [email])

// ✅ ORM
prisma.user.findUnique({ where: { email } })
```

در MongoDB هم آبجکت ورودی را مستقیم به query ندهید (`{ $ne: null }` می‌تواند همه را برگرداند)؛ ورودی را validate و به نوع انتظاری تبدیل کنید.

## ۸. SSRF: سرور را به آدرس دلخواه نفرستید

```ts
import { isIP } from 'node:net'

const ALLOWED = new Set(['api.github.com', 'raw.githubusercontent.com'])

export function assertSafeUrl(raw: string): URL {
  const url = new URL(raw)
  if (url.protocol !== 'https:') throw new Error('فقط https')
  if (!ALLOWED.has(url.hostname)) throw new Error('دامنه مجاز نیست')
  if (isIP(url.hostname)) throw new Error('IP مجاز نیست')
  return url
}
```

اگر اپ «آدرس تصویر را از کاربر می‌گیرد و دانلود می‌کند» یا «وب‌هوک» دارد، SSRF محتمل است. allowlist دامنه، مسدودسازی IPهای داخلی (127.0.0.1، 169.254.169.254، 10/8، 192.168/16) و محدودیت redirect لازم است.

## ۹. Rate limit و سخت‌سازی

```ts
app.use(rateLimit({ windowMs: 60_000, limit: 100, standardHeaders: true }))
app.post('/auth/login', rateLimit({ windowMs: 15 * 60_000, limit: 10 }), loginHandler)
app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' } }))
app.use(express.json({ limit: '100kb' }))
app.disable('x-powered-by')
```

- login/OTP/فراموشی رمز سخت‌گیرانه‌تر.
- قفل موقت بعد از تلاش‌های ناموفق + لاگ.
- CORS با allowlist دقیق؛ `credentials: true` با `*` ممنوع.

## ۱۰. زنجیره‌ی تأمین

```bash
npm audit --omit=dev
npm ci                     # نصب دقیق از lockfile
npx npm-check-updates
```

- lockfile را commit کنید؛ `npm install` در CI بدون lock ریسک است.
- وابستگی جدید را بررسی کنید: نگه‌داری، دانلودها، اسکریپت‌های نصب.
- `ignore-scripts=true` در `.npmrc` برای محیط‌های حساس.
- به‌روزرسانی امنیتی را به تعویق نیندازید.

## ۱۱. لاگ و داده‌ی شخصی

- لاگ ساختاریافته با `requestId`، بدون رمز/توکن/کد ملی/شماره کارت.
- ماسک کردن ایمیل/تلفن در لاگ.
- سیاست نگه‌داری و حذف داده.
- خطاهای ۵۰۰ جزئیات داخلی را به کاربر نشان ندهند.

## ۱۲. ساخت گام‌به‌گام بازبینی امنیتی پروژه (تمرین)

**گام ۱ — فهرست دارایی‌ها:** رمز، توکن، داده‌ی کاربر، کلید AI.

**گام ۲ — اسکن راز:** gitleaks روی کل تاریخچه؛ `.env` از git خارج.

**گام ۳ — رمز:** Argon2id + سیاست طول + پیام یکسان + rate limit.

**گام ۴ — نشست:** کوکی HttpOnly/Secure/SameSite؛ بررسی CSRF برای عملیات حساس.

**گام ۵ — مجوز:** افزودن `userId` به همه‌ی کوئری‌ها؛ تست IDOR با دو کاربر.

**گام ۶ — ورودی/خروجی:** Zod برای همه‌ی بدنه‌ها؛ DOMPurify برای HTML؛ CSP.

**گام ۷ — SSRF:** allowlist برای هر fetch با URL کاربر.

**گام ۸ — هدرها و محدودیت:** helmet، CORS دقیق، limit بدنه، rate limit.

**گام ۹ — وابستگی:** `npm audit`، lockfile، حذف پکیج بی‌استفاده.

**گام ۱۰ — گزارش:** جدول تهدید/کنترل/تست با شواهد.

### نگاشت به معیارهای پذیرش

| معیار | کجای درس |
| --- | --- |
| `hashing` | بخش ۳ (Argon2id) |
| `cookies` | بخش ۴ (HttpOnly/Secure/SameSite) |
| `rate-limit` | بخش ۹ |
| `headers` | بخش ۶ و ۹ (CSP، helmet، CORS) |
| `secrets` | بخش ۲ |
| `enumeration` | بخش ۳ (پیام ورود یکسان) |

## ۱۳. عیب‌یابی

| نشانه | علت | راه‌حل |
| --- | --- | --- |
| کاربر به داده‌ی دیگری می‌رسد | IDOR | فیلتر مالکیت |
| کوکی در production نمی‌ماند | Secure روی http | HTTPS |
| CSRF روی POST | SameSite=None بدون توکن | Lax + CSRF token |
| XSS با محتوای ادمین | dangerouslySetInnerHTML | DOMPurify/CSP |
| کلید در باندل | `VITE_`/`NEXT_PUBLIC_` | انتقال به سرور |
| `npm audit` پر از خطا | وابستگی قدیمی | به‌روزرسانی/جایگزینی |
| خطای ۵۰۰ جزئیات لو می‌دهد | error handler خام | پیام عمومی + requestId |

## ۱۴. آزمایش‌ها (با پاسخ)

**۱.** چرا SHA-256 برای رمز کافی نیست؟

**پاسخ:** سریع است و با GPU/ASIC میلیاردها حدس در ثانیه زده می‌شود؛ الگوریتم کند و memory-hard لازم است.

**۲.** چرا localStorage برای توکن خطرناک است؟

**پاسخ:** هر XSS می‌تواند آن را بخواند؛ HttpOnly cookie از JS پنهان است.

**۳.** تفاوت ۴۰۳ و ۴۰۴ در مجوز؟

**پاسخ:** ۴۰۳ یعنی احراز هویت شده ولی اجازه ندارد؛ ۴۰۴ برای پنهان کردن وجود منبع.

**۴.** چرا allowlist دامنه در SSRF کافی نیست اگر redirect آزاد باشد؟

**پاسخ:** سرور می‌تواند به آدرس داخلی redirect کند؛ باید redirectها را دنبال/بررسی کنید.

## ۱۵. خودآزمایی

1. پنج سؤال مدل تهدید؟
2. چرا راز لو رفته باید چرخانده شود؟
3. کوکی امن چه ویژگی‌هایی دارد؟
4. IDOR چگونه رخ می‌دهد؟
5. CSP چه چیزی را محدود می‌کند؟
6. SSRF در چه قابلیتی محتمل است؟

## ۱۶. چک‌لیست تحویل

- [ ] بدون راز در git و باندل
- [ ] Argon2id/bcrypt با cost مناسب
- [ ] کوکی HttpOnly + Secure + SameSite
- [ ] بررسی مالکیت در همه‌ی کوئری‌ها
- [ ] تست IDOR با دو کاربر
- [ ] Zod برای ورودی + پاک‌سازی HTML
- [ ] CSP و هدرهای امنیتی
- [ ] rate limit روی auth
- [ ] allowlist برای fetch با URL کاربر
- [ ] lockfile + audit پاک
