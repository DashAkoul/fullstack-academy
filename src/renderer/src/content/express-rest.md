# Express و طراحی REST API

> مراجع: [Express Guide](https://expressjs.com/en/guide/routing.html) · [Zod](https://zod.dev/) · [MDN — HTTP Status](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status)

## ۱. راه‌اندازی با TypeScript

```bash
mkdir library-api && cd library-api
npm init -y
npm i express zod cors helmet morgan
npm i -D typescript tsx @types/express @types/cors @types/morgan
npx tsc --init
```

```json
// package.json
{
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js"
  }
}
```

```ts
// src/server.ts
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import { errorHandler } from './middleware/error.js'
import { booksRouter } from './routes/books.js'

const app = express()

app.use(helmet())
app.use(cors({ origin: process.env.CORS_ORIGIN?.split(',') ?? true }))
app.use(express.json({ limit: '100kb' }))
app.use(morgan('tiny'))

app.get('/health', (_req, res) => res.json({ status: 'ok' }))
app.use('/api/books', booksRouter)

app.use((_req, res) => res.status(404).json({ error: 'مسیر یافت نشد' }))
app.use(errorHandler)

const port = Number(process.env.PORT ?? 4000)
app.listen(port, () => console.log(`http://localhost:${port}`))
```

## ۲. ساختار لایه‌ای

```
src/
├─ routes/        ← فقط تعریف مسیر و اعتبارسنجی
│  └─ books.ts
├─ controllers/   ← تبدیل HTTP به فراخوانی سرویس
│  └─ books.ts
├─ services/      ← منطق دامنه (قابل تست بدون HTTP)
│  └─ books.ts
├─ repositories/  ← دسترسی به داده (جای تعویض با DB)
├─ schemas/       ← Zod
├─ middleware/    ← error، auth، validate
└─ server.ts
```

```ts
// src/routes/books.ts
import { Router } from 'express'
import { z } from 'zod'
import * as ctrl from '../controllers/books.js'
import { validate } from '../middleware/validate.js'

export const booksRouter = Router()

const createSchema = z.object({
  title: z.string().min(1).max(200),
  author: z.string().min(1).max(120),
  year: z.number().int().min(1400).max(2100),
  isbn: z.string().regex(/^\d{10,13}$/).optional()
})

const listSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(100).optional()
})

booksRouter.get('/', validate({ query: listSchema }), ctrl.list)
booksRouter.get('/:id', ctrl.getById)
booksRouter.post('/', validate({ body: createSchema }), ctrl.create)
booksRouter.patch('/:id', ctrl.update)
booksRouter.delete('/:id', ctrl.remove)
```

> در Express 5 هندلرهای async خطاهای Promise را خودکار به middleware خطا می‌فرستند. در Express 4 باید `asyncHandler` بنویسید.

## ۳. Controller و Service

```ts
// src/controllers/books.ts
import type { Request, Response } from 'express'
import * as service from '../services/books.js'

export async function list(req: Request, res: Response) {
  const { page, limit, q } = req.query as unknown as { page: number; limit: number; q?: string }
  const result = await service.list({ page, limit, q })
  res.json(result)
}

export async function getById(req: Request, res: Response) {
  const book = await service.findById(req.params.id)
  if (!book) return res.status(404).json({ error: 'کتاب پیدا نشد' })
  res.json(book)
}

export async function create(req: Request, res: Response) {
  const book = await service.create(req.body)
  res.status(201).location(`/api/books/${book.id}`).json(book)
}

export async function remove(req: Request, res: Response) {
  const deleted = await service.remove(req.params.id)
  if (!deleted) return res.status(404).json({ error: 'کتاب پیدا نشد' })
  res.status(204).end()
}
```

## ۴. کدهای وضعیت درست

| وضعیت | کجا |
| --- | --- |
| 200 OK | GET/PATCH موفق |
| 201 Created | POST موفق (+ هدر Location) |
| 204 No Content | DELETE موفق (بدون بدنه) |
| 400 Bad Request | ورودی نامعتبر |
| 401 Unauthorized | بدون احراز هویت |
| 403 Forbidden | احراز هویت شده ولی بی‌مجوز |
| 404 Not Found | منبع نیست |
| 409 Conflict | تکراری/تداخل |
| 422 Unprocessable | معتبر از نظر شکل، نامعتبر از نظر معنا |
| 500 | خطای پیش‌بینی‌نشده |

## ۵. Middleware اعتبارسنجی

```ts
// src/middleware/validate.ts
import type { RequestHandler } from 'express'
import type { ZodTypeAny } from 'zod'

export function validate(schemas: { body?: ZodTypeAny; query?: ZodTypeAny; params?: ZodTypeAny }): RequestHandler {
  return (req, res, next) => {
    const issues: { path: string; message: string }[] = []

    for (const key of ['body', 'query', 'params'] as const) {
      const schema = schemas[key]
      if (!schema) continue
      const result = schema.safeParse(req[key])
      if (result.success) {
        if (key === 'body') req.body = result.data
        else Object.assign(req[key] as object, result.data)
      } else {
        for (const issue of result.error.issues)
          issues.push({ path: [key, ...issue.path].join('.'), message: issue.message })
      }
    }

    if (issues.length) return res.status(400).json({ error: 'ورودی نامعتبر', issues })
    next()
  }
}
```

نکته‌ی مهم: با `whitelist` رفتاری، فیلدهای ناخواسته (مثل `role: "admin"`) دور ریخته می‌شوند. هرگز `req.body` خام را مستقیم به لایه‌ی داده ندهید.

## ۶. خطای متمرکز

```ts
// src/middleware/error.ts
import type { ErrorRequestHandler } from 'express'
import { ZodError } from 'zod'

export class HttpError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message)
  }
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError)
    return res.status(400).json({ error: 'ورودی نامعتبر', issues: err.issues })

  if (err instanceof HttpError)
    return res.status(err.status).json({ error: err.message, details: err.details })

  console.error('Unhandled:', err)
  res.status(500).json({ error: 'خطای داخلی سرور' })
}
```

- **چهار پارامتر** داشتن `errorHandler` اجباری است، حتی اگر `next` استفاده نشود.
- پیام خطای داخلی را به کاربر نشان ندهید (افشای اطلاعات).

## ۷. صفحه‌بندی و فیلتر

```ts
export async function list({ page, limit, q }: { page: number; limit: number; q?: string }) {
  const where = q ? { OR: [{ title: { contains: q } }, { author: { contains: q } }] } : {}
  const [items, total] = await Promise.all([
    db.book.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' } }),
    db.book.count({ where })
  ])
  return { items, meta: { page, limit, total, pages: Math.ceil(total / limit) } }
}
```

همیشه `limit` را سقف بزنید (مثل ۱۰۰)؛ وگرنه یک کلاینت می‌تواند کل جدول را بخواهد.

## ۸. تست سریع API

```bash
curl -s localhost:4000/api/books | jq
curl -s -X POST localhost:4000/api/books \
  -H 'Content-Type: application/json' \
  -d '{"title":"کیمیاگر","author":"پائولو کوئلیو","year":1368}'
```

برای تست خودکار، `supertest` را در درس Jest می‌بینیم.

## ۹. مستندسازی

حداقل کاری که می‌توانید بکنید: یک بخش «API» در README با جدول endpointها.

```md
## GET /api/books?page=1&limit=20&q=search
پاسخ 200:
{ "items": [...], "meta": { "page": 1, "limit": 20, "total": 42, "pages": 3 } }
```

بهتر: فایل `openapi.yaml` یا تولید خودکار مستندات تعاملی با `swagger-ui-express`.

## ۱۰. چک‌لیست قبل از تحویل

- [ ] لایه‌بندی route/controller/service
- [ ] اعتبارسنجی همه‌ی ورودی‌ها
- [ ] کدهای وضعیت صحیح
- [ ] خطای متمرکز و بدون افشای جزئیات
- [ ] سقف روی `limit` و اندازه‌ی body
- [ ] helmet/CORS محدود
- [ ] مستندات endpointها

## تمرین این درس

API کتابخانه: CRUD کامل با کدهای وضعیت صحیح، اعتبارسنجی Zod، صفحه‌بندی و جستجو، middleware خطا و لاگ، و مستندات. جزئیات در تب تمرین است.
