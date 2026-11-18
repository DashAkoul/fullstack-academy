# PostgreSQL و Prisma

> مراجع: [PostgreSQL Tutorial](https://www.postgresql.org/docs/current/tutorial.html) · [Prisma Docs](https://www.prisma.io/docs)

بیشتر اپلیکیشن‌های واقعی به یک پایگاه داده‌ی رابطه‌ای نیاز دارند. PostgreSQL قدرتمندترین گزینه‌ی متن‌باز است و Prisma کار با آن را تایپ‌امن می‌کند.

## ۱. راه‌اندازی سریع با Docker

```yaml
# docker-compose.yml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: app
      POSTGRES_PASSWORD: devpassword
      POSTGRES_DB: ticketing
    ports: ['5432:5432']
    volumes: ['pgdata:/var/lib/postgresql/data']
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U app -d ticketing']
      interval: 5s
      timeout: 3s
      retries: 10

volumes:
  pgdata:
```

```bash
docker compose up -d
psql postgresql://app:devpassword@localhost:5432/ticketing
```

## ۲. SQL پایه — لازم است بدانید

```sql
-- ساخت جدول
CREATE TABLE events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL,
  capacity    integer NOT NULL CHECK (capacity >= 0),
  starts_at   timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX events_starts_at_idx ON events (starts_at);

CREATE TABLE tickets (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id  uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  seat      text NOT NULL,
  price     numeric(12,0) NOT NULL,
  sold_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, seat)
);
```

```sql
-- پرس‌وجوهای روزمره
SELECT e.title, count(t.id) AS sold
FROM events e LEFT JOIN tickets t ON t.event_id = e.id
GROUP BY e.id, e.title
ORDER BY sold DESC;

BEGIN;
UPDATE events SET capacity = capacity - 2 WHERE id = $1 AND capacity >= 2;
COMMIT;
```

اصول:

- مبالغ پولی را با `numeric` یا عدد صحیح (ریال) ذخیره کنید، نه `float`.
- زمان‌ها را با `timestamptz` (نه `timestamp` بدون منطقه) ذخیره کنید.
- `UNIQUE` و `CHECK` قوانین دامنه را در پایگاه داده تضمین می‌کنند، نه فقط در کد.

## ۳. Prisma: نصب و Schema

```bash
npm i -D prisma && npm i @prisma/client
npx prisma init --datasource-provider postgresql
```

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id      String  @id @default(uuid())
  email   String  @unique
  name    String
  orders  Order[]
  createdAt DateTime @default(now())
}

model Event {
  id        String   @id @default(uuid())
  title     String
  capacity  Int
  startsAt  DateTime
  tickets   Ticket[]
  orders    Order[]

  @@index([startsAt])
}

model Order {
  id        String   @id @default(uuid())
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId    String
  event     Event    @relation(fields: [eventId], references: [id])
  eventId   String
  quantity  Int
  total     Decimal  @db.Decimal(12, 0)
  status    OrderStatus @default(PENDING)
  createdAt DateTime @default(now())

  @@index([userId, createdAt])
}

model Ticket {
  id       String  @id @default(uuid())
  event    Event   @relation(fields: [eventId], references: [id], onDelete: Cascade)
  eventId  String
  seat     String
  price    Decimal @db.Decimal(12, 0)

  @@unique([eventId, seat])
}

enum OrderStatus {
  PENDING
  PAID
  CANCELLED
}
```

```bash
npx prisma migrate dev --name init
npx prisma generate
npx prisma studio        # رابط گرافیکی برای دیدن داده
```

## ۴. کلاینت: پرس‌وجوهای تایپ‌امن

```ts
// src/db.ts
import { PrismaClient } from '@prisma/client'
export const prisma = new PrismaClient()
```

```ts
const events = await prisma.event.findMany({
  where: { startsAt: { gte: new Date() } },
  orderBy: { startsAt: 'asc' },
  take: 20,
  include: { _count: { select: { tickets: true } } }
})
```

```ts
const user = await prisma.user.upsert({
  where: { email: 'sara@example.com' },
  update: { name: 'سارا' },
  create: { email: 'sara@example.com', name: 'سارا' }
})
```

## ۵. تراکنش: جلوگیری از فروش بیش از ظرفیت

این سناریو کلاسیک است: دو کاربر هم‌زمان آخرین بلیت را می‌خرند.

```ts
// ❌ Race condition: خواندن، سپس نوشتن
const event = await prisma.event.findUniqueOrThrow({ where: { id } })
if (event.capacity < qty) throw new Error('ظرفیت تکمیل است')
await prisma.event.update({ where: { id }, data: { capacity: { decrement: qty } } })
```

```ts
// ✅ کاهش شرطی اتمیک
const [order] = await prisma.$transaction(async (tx) => {
  const updated = await tx.event.updateMany({
    where: { id, capacity: { gte: qty } },
    data: { capacity: { decrement: qty } }
  })

  if (updated.count === 0) throw new Error('ظرفیت کافی نیست')

  const created = await tx.order.create({
    data: { userId, eventId: id, quantity: qty, total: price * qty }
  })

  await tx.ticket.createMany({
    data: Array.from({ length: qty }, (_, i) => ({
      eventId: id,
      seat: `GA-${Date.now()}-${i}`,
      price
    }))
  })

  return [created]
})

console.log(order)
```

`updateMany` با شرط `capacity >= qty` توسط پایگاه داده به‌صورت اتمیک اجرا می‌شود. اگر `count === 0` باشد یعنی کسی جلوتر بوده است — تراکنش را rollback کنید.

## ۶. Seed

```ts
// prisma/seed.ts
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  await prisma.event.createMany({
    data: [
      { title: 'کنسرت موسیقی', capacity: 200, startsAt: new Date('2030-05-01T18:00:00Z') },
      { title: 'اجرای تئاتر', capacity: 80, startsAt: new Date('2030-06-12T19:30:00Z') }
    ],
    skipDuplicates: true
  })
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
```

```json
{ "prisma": { "seed": "tsx prisma/seed.ts" } }
```

```bash
npx prisma db seed
```

## ۷. مهاجرت‌ها در تیم

| دستور | کاربرد |
| --- | --- |
| `prisma migrate dev` | ساخت مهاجرت جدید در توسعه |
| `prisma migrate deploy` | اعمال مهاجرت‌ها در staging/production |
| `prisma migrate reset` | پاک کردن DB و اجرای مجدد (فقط توسعه!) |
| `prisma db push` | همگام‌سازی سریع بدون فایل مهاجرت (پروتوتایپ) |

- پوشه‌ی `prisma/migrations` را **همیشه commit کنید**.
- مهاجرت‌های اعمال‌شده را ویرایش نکنید؛ مهاجرت جدید بسازید.
- برای تغییرات مخرب (حذف ستون) ابتدا داده را migrate کنید.

## ۸. ایندکس و کارایی

- هر ستونی که در `WHERE`/`JOIN`/`ORDER BY` زیاد استفاده می‌شود کاندید ایندکس است.
- `@@index([userId, createdAt])` برای «آخرین سفارش‌های کاربر» عالی است.
- مشکل **N+1**: به‌جای حلقه و query تکی، از `include`/`select` استفاده کنید.

```ts
// ❌ N+1
const orders = await prisma.order.findMany()
for (const o of orders) await prisma.user.findUnique({ where: { id: o.userId } })

// ✅ یک کوئری با join
const orders = await prisma.order.findMany({ include: { user: true, event: true } })
```

## ۹. نکات امنیتی

- `DATABASE_URL` فقط در env؛ `prisma generate` را در build اجرا کنید.
- کاربر پایگاه داده در production نباید superuser باشد.
- از Prisma برای پارامترسازی استفاده کنید؛ با `$queryRaw` هرگز رشته‌ی کاربر را الحاق نکنید:

```ts
// ❌ تزریق SQL
await prisma.$queryRawUnsafe(`SELECT * FROM users WHERE email = '${email}'`)

// ✅
await prisma.$queryRaw`SELECT * FROM users WHERE email = ${email}`
```

## تمرین این درس

پایگاه داده‌ی فروش بلیت: مدل‌های User/Event/Order/Ticket با روابط، مهاجرت commit‌شده، خرید اتمیک بدون منفی شدن ظرفیت، seed، ایندکس و docker-compose. جزئیات در تب تمرین است.
