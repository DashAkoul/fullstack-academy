# ساخت REST API با Express

> مراجع: [Express Docs](https://expressjs.com/) · [Express 5 Migration](https://expressjs.com/en/guide/migrating-5.html) · [HTTP Semantics (RFC 9110)](https://www.rfc-editor.org/rfc/rfc9110)

## در این درس چه یاد می‌گیرید؟

یک API قابل‌اعتماد می‌سازید: مسیرهای درست، اعتبارسنجی ورودی، کد وضعیت صحیح، خطای یکدست، صفحه‌بندی، احراز هویت با JWT، امنیت پایه و تست خودکار. در پایان، API مدیریت وظایف تمرین را با تمام این‌ها و مستند OpenAPI تحویل می‌دهید.

---

## ۱. قرارداد REST

| عمل | متد | مسیر | موفق | خطاهای رایج |
| --- | --- | --- | --- | --- |
| فهرست | GET | `/tasks?page=1&limit=20` | 200 | 400 |
| یک مورد | GET | `/tasks/:id` | 200 | 404 |
| ساخت | POST | `/tasks` | 201 + `Location` | 400 |
| جایگزینی | PUT | `/tasks/:id` | 200 | 400/404 |
| تغییر جزئی | PATCH | `/tasks/:id` | 200 | 400/404 |
| حذف | DELETE | `/tasks/:id` | 204 | 404 |

- **اسم جمع و noun**، نه فعل: `/tasks` نه `/getTasks`.
- ۴xx خطای کلاینت، ۵xx خطای سرور. هرگز 200 با `{ error }`.
- بدنه‌ی خطا یکدست باشد:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "ورودی نامعتبر است.",
    "details": [{ "path": "title", "message": "عنوان الزامی است." }],
    "requestId": "c1f2..."
  }
}
```

## ۲. اسکلت پروژه

```
src/
├─ app.ts            ← ساخت اپ (بدون listen) برای تست
├─ server.ts         ← listen + shutdown
├─ routes/tasks.ts
├─ services/tasks.ts
├─ middleware/{auth,error,validate,notFound}.ts
├─ schemas/task.ts
└─ lib/{db,logger}.ts
```

جدا کردن `app` از `server` تست را ساده می‌کند: Supertest روی `app` می‌زند، بدون باز کردن پورت.

```ts
// src/app.ts
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import { tasksRouter } from './routes/tasks.js'
import { errorHandler } from './middleware/error.js'
import { notFound } from './middleware/notFound.js'

export function createApp() {
  const app = express()
  app.use(helmet())
  app.use(cors({ origin: process.env.CORS_ORIGIN?.split(',') ?? false }))
  app.use(express.json({ limit: '100kb' }))
  app.use(morgan('tiny'))

  app.get('/health', (_req, res) => res.json({ ok: true }))
  app.use('/api/v1/tasks', tasksRouter)

  app.use(notFound)
  app.use(errorHandler)
  return app
}
```

ترتیب middleware **مهم** است: بدنه → مسیرها → notFound → errorHandler.

## ۳. اعتبارسنجی ورودی با Zod

```ts
// src/schemas/task.ts
import { z } from 'zod'

export const createTaskSchema = z.object({
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2000).optional(),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  dueDate: z.coerce.date().optional()
})

export const updateTaskSchema = createTaskSchema.partial().refine(
  (v) => Object.keys(v).length > 0,
  { message: 'حداقل یک فیلد لازم است.' }
)

export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['open', 'done']).optional(),
  q: z.string().trim().max(100).optional()
})
```

```ts
// src/middleware/validate.ts
import type { RequestHandler } from 'express'
import type { ZodType } from 'zod'
import { AppError } from '../lib/errors.js'

export const validateBody = (schema: ZodType): RequestHandler => (req, _res, next) => {
  const result = schema.safeParse(req.body)
  if (!result.success) {
    return next(new AppError(400, 'VALIDATION_ERROR', 'ورودی نامعتبر است.', result.error.issues))
  }
  req.body = result.data
  next()
}
```

```ts
// src/lib/errors.ts
export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message)
  }
}
```

## ۴. مسیرها و لایه‌ی سرویس

```ts
// src/routes/tasks.ts
import { Router } from 'express'
import { createTaskSchema, listQuerySchema, updateTaskSchema } from '../schemas/task.js'
import { validateBody } from '../middleware/validate.js'
import { requireAuth } from '../middleware/auth.js'
import * as service from '../services/tasks.js'

export const tasksRouter = Router()
tasksRouter.use(requireAuth)

tasksRouter.get('/', async (req, res) => {
  const query = listQuerySchema.parse(req.query)
  const { items, total } = await service.list(req.user.id, query)
  res.json({
    data: items,
    meta: { page: query.page, limit: query.limit, total, pages: Math.ceil(total / query.limit) }
  })
})

tasksRouter.get('/:id', async (req, res) => {
  const task = await service.get(req.user.id, req.params.id)
  if (!task) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'وظیفه یافت نشد.' } })
  res.json({ data: task })
})

tasksRouter.post('/', validateBody(createTaskSchema), async (req, res) => {
  const task = await service.create(req.user.id, req.body)
  res.status(201).location(`/api/v1/tasks/${task.id}`).json({ data: task })
})

tasksRouter.patch('/:id', validateBody(updateTaskSchema), async (req, res) => {
  const task = await service.update(req.user.id, req.params.id, req.body)
  if (!task) throw new AppError(404, 'NOT_FOUND', 'وظیفه یافت نشد.')
  res.json({ data: task })
})

tasksRouter.delete('/:id', async (req, res) => {
  const deleted = await service.remove(req.user.id, req.params.id)
  if (!deleted) throw new AppError(404, 'NOT_FOUND', 'وظیفه یافت نشد.')
  res.status(204).end()
})
```

Express 5 خطای async را خودکار به error handler می‌فرستد. در Express 4 باید `try/catch` یا wrapper بگذارید.

**لایه‌ی سرویس** هیچ چیزی از `req`/`res` نمی‌داند؛ همین باعث می‌شود در تست و در کارهای دیگر (CLI، job) قابل استفاده باشد:

```ts
// src/services/tasks.ts
export async function list(userId: string, q: ListQuery) {
  const where = {
    userId,
    ...(q.status ? { status: q.status } : {}),
    ...(q.q ? { title: { contains: q.q, mode: 'insensitive' as const } } : {})
  }

  const [items, total] = await prisma.$transaction([
    prisma.task.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (q.page - 1) * q.limit,
      take: q.limit
    }),
    prisma.task.count({ where })
  ])

  return { items, total }
}

export function create(userId: string, input: CreateTaskInput) {
  return prisma.task.create({ data: { ...input, userId } })
}
```

## ۵. Error Handler نهایی

```ts
// src/middleware/error.ts
import type { ErrorRequestHandler } from 'express'
import { ZodError } from 'zod'
import { AppError } from '../lib/errors.js'
import { logger } from '../lib/logger.js'

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const requestId = String(req.headers['x-request-id'] ?? crypto.randomUUID())

  if (err instanceof AppError) {
    return res.status(err.status).json({
      error: { code: err.code, message: err.message, details: err.details, requestId }
    })
  }

  if (err instanceof ZodError) {
    return res.status(400).json({
      error: { code: 'BAD_REQUEST', message: 'پارامترهای نامعتبر.', details: err.issues, requestId }
    })
  }

  logger.error({ err, requestId }, 'خطای پیش‌بینی‌نشده')
  res.status(500).json({ error: { code: 'INTERNAL', message: 'خطای سرور.', requestId } })
}
```

هرگز `err.stack` یا پیام خام دیتابیس را به کلاینت نفرستید.

## ۶. احراز هویت با JWT

```ts
import jwt from 'jsonwebtoken'
import type { RequestHandler } from 'express'

const SECRET = process.env.JWT_SECRET
if (!SECRET || SECRET.length < 32) throw new Error('JWT_SECRET تنظیم نشده است')

export const requireAuth: RequestHandler = (req, res, next) => {
  const header = req.headers.authorization
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'توکن لازم است.' } })

  try {
    const payload = jwt.verify(token, SECRET) as { sub: string; role?: string }
    req.user = { id: payload.sub, role: payload.role ?? 'user' }
    next()
  } catch {
    res.status(401).json({ error: { code: 'INVALID_TOKEN', message: 'توکن نامعتبر یا منقضی است.' } })
  }
}
```

- راز را در env نگه دارید؛ طول ≥۳۲.
- توکن کوتاه‌عمر (۱۵ دقیقه) + refresh token.
- نقش/دسترسی را در سرور بررسی کنید، نه فقط UI.
- برای خروج واقعی، لیست ابطال (denylist) یا چرخش refresh لازم است.

## ۷. امنیت پایه

```ts
app.set('trust proxy', 1)
app.use(helmet())
app.use(rateLimit({ windowMs: 60_000, limit: 100 }))
```

- `express.json({ limit })` برای جلوگیری از payload غول.
- CORS با لیست صریح origin، نه `*` همراه با credentials.
- ورودی را همیشه validate کنید؛ SQL/ORM با پارامتر.
- لاگ بدون رمز/توکن؛ ماسک کردن فیلدهای حساس.
- برای آپلود، نوع/اندازه و نام فایل را بررسی کنید.

## ۸. صفحه‌بندی، فیلتر و مرتب‌سازی

```ts
const where = {
  userId,
  ...(query.status ? { status: query.status } : {}),
  ...(query.q ? { title: { contains: query.q, mode: 'insensitive' } } : {})
}

const [items, total] = await prisma.$transaction([
  prisma.task.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }],
    skip: (query.page - 1) * query.limit,
    take: query.limit
  }),
  prisma.task.count({ where })
])
```

- `meta` شامل page/limit/total/pages باشد.
- برای دیتاست بزرگ، cursor pagination بهتر از offset است.
- `limit` را سقف بزنید (مثلاً ۱۰۰).

## ۹. تست با Supertest

```ts
import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { signToken } from '../src/lib/token.js'

const app = createApp()
const token = signToken({ sub: 'user-1' })

describe('tasks API', () => {
  it('401 بدون توکن', async () => {
    const res = await request(app).get('/api/v1/tasks')
    expect(res.status).toBe(401)
  })

  it('400 برای عنوان کوتاه', async () => {
    const res = await request(app)
      .post('/api/v1/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'a' })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('201 و Location', async () => {
    const res = await request(app)
      .post('/api/v1/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'نوشتن تست' })
    expect(res.status).toBe(201)
    expect(res.headers.location).toMatch(/\/tasks\//)
  })
})
```

## ۱۰. ساخت گام‌به‌گام API وظایف (تمرین)

**گام ۱ — راه‌اندازی**

```bash
npm init -y && npm i express zod jsonwebtoken cors helmet morgan
npm i -D typescript tsx vitest supertest @types/express @types/node
npx tsc --init --strict
```

**گام ۲ — `app.ts` و `server.ts`** با `/health` و shutdown.

**گام ۳ — اسکیمای Zod** و middleware اعتبارسنجی.

**گام ۴ — مسیرهای CRUD** با کد وضعیت درست و `Location`.

**گام ۵ — خطا:** `AppError`، `notFound`، `errorHandler` با `requestId`.

**گام ۶ — auth:** صدور توکن در `/auth/login` (کاربر نمونه) و `requireAuth`.

**گام ۷ — صفحه‌بندی/فیلتر** با `meta`.

**گام ۸ — تست‌ها** برای ۴۰۱، ۴۲۲، ۲۰۱، ۴۰۴، ۲۰۴.

**گام ۹ — OpenAPI:** فایل `openapi.yaml` با مسیرها و اسکیمای خطا:

```yaml
openapi: 3.0.3
info: { title: Tasks API, version: 1.0.0 }
paths:
  /api/v1/tasks:
    get:
      summary: فهرست وظایف کاربر
      parameters:
        - { in: query, name: page, schema: { type: integer, minimum: 1 } }
        - { in: query, name: limit, schema: { type: integer, maximum: 100 } }
      responses:
        '200': { description: صفحه‌ای از وظایف }
        '401': { description: بدون توکن }
    post:
      summary: ساخت وظیفه
      responses:
        '201': { description: ساخته شد }
        '400': { description: ورودی نامعتبر }
```

### اجرای واقعی: درخواست‌ها با curl

```bash
npm run dev
# server listening on http://localhost:3000
```

```bash
curl -i http://localhost:3000/health
# HTTP/1.1 200 OK
# Content-Type: application/json; charset=utf-8
# {"ok":true}
```

```bash
curl -i -X POST http://localhost:3000/api/v1/tasks \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"نوشتن تست"}'
# HTTP/1.1 201 Created
# Location: /api/v1/tasks/1
# {"data":{"id":"1","title":"نوشتن تست","status":"open"}}
```

```bash
curl -i -X POST http://localhost:3000/api/v1/tasks \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"a"}'
# HTTP/1.1 400 Bad Request
# {"error":{"code":"VALIDATION_ERROR","message":"ورودی نامعتبر است.","details":[{"path":"title","message":"Too small: expected string to have >=2 characters"}]}}
```

```bash
curl -i http://localhost:3000/api/v1/tasks
# HTTP/1.1 401 Unauthorized
# {"error":{"code":"UNAUTHORIZED","message":"توکن لازم است."}}
```

```bash
curl -s "http://localhost:3000/api/v1/tasks?page=2&limit=2" \
  -H "Authorization: Bearer $TOKEN"
# {"data":[...],"meta":{"page":2,"limit":2,"total":5,"pages":3}}
```

**ایست بازرسی ۱ — ترتیب middleware:** اگر بدنه را می‌فرستید و `req.body` خالی است، `express.json()` بعد از مسیرها ثبت شده. ترتیب باید body → routes → notFound → errorHandler باشد.

**ایست بازرسی ۲ — خطای async:** یک `throw new Error('boom')` در سرویس بگذارید؛ در Express 5 باید برسد به error handler و کلاینت ببیند:

```json
{"error":{"code":"INTERNAL","message":"خطای سرور.","requestId":"..."}}
```

اگر فرایند crash کرد، خطا را در callback هندل نکرده‌اید (Express 4).

**ایست بازرسی ۳ — مالکیت:** با توکن کاربر دوم، `GET /api/v1/tasks/1` (مال کاربر اول) باید `404` بدهد، نه `403` (منبع را پنهان می‌کنیم). اگر `200` داد، فیلتر `userId` جا افتاده است.

### نگاشت به معیارهای پذیرش

| معیار | کجای درس |
| --- | --- |
| `structure` | بخش ۲ (لایه‌بندی route/controller/service) و بخش ۴ |
| `rest` | بخش ۱ (متد و کد وضعیت) و بخش ۴ |
| `validation` | بخش ۳ (Zod + پاسخ ۴۰۰) |
| `error-mw` | بخش ۵ (errorHandler با چهار پارامتر) |
| `pagination` | بخش ۸ (page/limit/q) |
| `docs` | بخش ۹ (OpenAPI) |

## ۱۱. عیب‌یابی

| نشانه | علت | راه‌حل |
| --- | --- | --- |
| همه‌ی asyncها ۵۰۰ می‌دهند | Express 4 بدون catch | Express 5 یا `express-async-errors` |
| `req.body undefined` | بدون `express.json()` | middleware بدنه |
| CORS خطا | origin/credential | لیست صریح origin |
| ۴۰۴ روی همه مسیرها | ترتیب/پیشوند نادرست | `app.use('/api/v1', router)` |
| خطای اعتبارسنجی ۵۰۰ می‌شود | ZodError مدیریت نشده | بخش ۵ |
| توکن در لاگ | لاگ کامل header | ماسک کنید |

## ۱۲. آزمایش‌ها (با پاسخ)

**۱.** چرا `app` را از `server` جدا می‌کنیم؟

**پاسخ:** تست بدون listen و پورت؛ جلوگیری از side effect در import.

**۲.** چه زمانی ۴۰۰ و چه زمانی ۴۲۲؟

**پاسخ:** ۴۰۰ برای بدنه‌ی غیرقابل‌parse/ساختار خراب؛ ۴۲۲ برای داده‌ی ساختاراً درست ولی نامعتبر (اعتبارسنجی معنایی).

**۳.** چرا `DELETE` کد ۲۰۴ دارد و بدنه ندارد؟

**پاسخ:** عملیات موفق و چیزی برای برگرداندن نیست؛ کلاینت به بدنه نیاز ندارد.

**۴.** چرا نباید `limit` را بدون سقف گذاشت؟

**پاسخ:** درخواست سنگین/DoS و مصرف حافظه.

## ۱۳. خودآزمایی

1. ترتیب middleware چه اهمیتی دارد؟
2. کد وضعیت برای ساخت، حذف و خطای اعتبارسنجی؟
3. چطور از افشای جزئیات داخلی جلوگیری می‌کنید؟
4. JWT چه محدودیتی دارد؟
5. صفحه‌بندی offset چه ضعفی دارد؟
6. چرا لایه‌ی service جدا می‌شود؟

## ۱۴. چک‌لیست تحویل

- [ ] مسیرهای جمع با متد درست
- [ ] اعتبارسنجی بدنه/کوئری با Zod
- [ ] کد وضعیت و `Location` صحیح
- [ ] خطای یکدست با `requestId`
- [ ] auth و بررسی مالکیت منبع
- [ ] صفحه‌بندی با `meta`
- [ ] تست‌های موفق/خطا
- [ ] `openapi.yaml`
- [ ] بدون راز در کد
