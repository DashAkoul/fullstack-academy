# PostgreSQL و Prisma

> مراجع: [PostgreSQL Tutorial](https://www.postgresql.org/docs/current/tutorial.html) · [Prisma Docs](https://www.prisma.io/docs) · [Use The Index, Luke](https://use-the-index-luke.com/)

## در این درس چه یاد می‌گیرید؟

مدل رابطه‌ای را درست طراحی می‌کنید، کوئری و ایندکس می‌نویسید، تراکنش و ایزولیشن را می‌فهمید و با Prisma یک لایه‌ی داده‌ی تایپ‌سیف می‌سازید. در پایان، دیتابیس یک وبلاگ با نویسنده/پست/کامنت/تگ را می‌سازید و کوئری‌های سنگین را بهینه می‌کنید.

---

## ۱. مدل رابطه‌ای

```sql
CREATE TABLE authors (
  id          bigserial PRIMARY KEY,
  email       citext NOT NULL UNIQUE,
  name        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE posts (
  id          bigserial PRIMARY KEY,
  author_id   bigint NOT NULL REFERENCES authors(id) ON DELETE CASCADE,
  title       text NOT NULL CHECK (length(title) BETWEEN 3 AND 200),
  slug        text NOT NULL UNIQUE,
  body        text NOT NULL,
  published   boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE comments (
  id         bigserial PRIMARY KEY,
  post_id    bigint NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author_id  bigint REFERENCES authors(id) ON DELETE SET NULL,
  body       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

- **کلید اصلی** یکتاست و تغییر نمی‌کند؛ `bigserial`/`bigint identity`.
- **کلید خارجی** یکپارچگی را در سطح دیتابیس تضمین می‌کند؛ `ON DELETE` را آگاهانه انتخاب کنید.
- `timestamptz` برای زمان؛ `timestamp` بدون منطقه‌زمانی منبع باگ است.
- `CHECK` قوانین ساده را در دیتابیس نگه می‌دارد.

## ۲. کوئری: از ساده به تحلیلی

```sql
-- نویسندگان و تعداد پست‌های منتشرشده
SELECT a.id, a.name, count(p.id) AS post_count
FROM authors a
LEFT JOIN posts p ON p.author_id = a.id AND p.published
GROUP BY a.id, a.name
ORDER BY post_count DESC
LIMIT 10;
```

```sql
-- آخرین کامنت هر پست با window function
SELECT DISTINCT ON (c.post_id)
  c.post_id, c.body, c.created_at
FROM comments c
ORDER BY c.post_id, c.created_at DESC;
```

```sql
-- جستجوی متنی
SELECT id, title
FROM posts
WHERE to_tsvector('simple', title || ' ' || body) @@ plainto_tsquery('simple', $1)
ORDER BY created_at DESC
LIMIT 20;
```

تفاوت‌های مهم:

| کار | ابزار |
| --- | --- |
| شمارش/میانگین | `count`, `avg`, `sum` + `GROUP BY` |
| رتبه‌بندی داخل گروه | `row_number() OVER (PARTITION BY ...)` |
| اولین رکورد هر گروه | `DISTINCT ON` |
| جستجوی متنی | `tsvector` + GIN index |

## ۳. ایندکس: سریع، ولی رایگان نیست

```sql
CREATE INDEX posts_author_published_idx ON posts (author_id, published, created_at DESC);
CREATE INDEX posts_search_idx ON posts USING GIN (to_tsvector('simple', title || ' ' || body));
CREATE UNIQUE INDEX authors_email_lower_idx ON authors (lower(email));
```

- ایندکس، نوشتن را کند و فضا مصرف می‌کند؛ فقط برای کوئری‌های واقعی.
- ترتیب ستون‌ها در ایندکس مرکب مهم است: ستون‌های برابری اول، سپس بازه/مرتب‌سازی.
- `EXPLAIN (ANALYZE, BUFFERS)` ببینید از ایندکس استفاده می‌شود یا `Seq Scan`.
- ایندکس روی ستون کم‌تنوع (مثل `boolean`) معمولاً بی‌فایده است؛ ایندکس جزئی بهتر است:

```sql
CREATE INDEX posts_unpublished_idx ON posts (created_at) WHERE NOT published;
```

## ۴. تراکنش و ایزولیشن

```sql
BEGIN;
UPDATE accounts SET balance = balance - 100 WHERE id = 1;
UPDATE accounts SET balance = balance + 100 WHERE id = 2;
COMMIT;
```

- `BEGIN … COMMIT` یا `ROLLBACK`؛ در خطا حتماً rollback.
- سطح پیش‌فرض `READ COMMITTED` است.
- برای «خواندن، تصمیم، نوشتن» از `SELECT ... FOR UPDATE` استفاده کنید تا دو تراکنش هم‌زمان موجودی را دو بار کم نکنند.
- `SERIALIZABLE` امن‌ترین است ولی نیاز به retry دارد.

```sql
BEGIN;
SELECT balance FROM accounts WHERE id = 1 FOR UPDATE;
-- بررسی کافی بودن موجودی
UPDATE accounts SET balance = balance - 100 WHERE id = 1;
COMMIT;
```

## ۵. Prisma: schema

```prisma
// prisma/schema.prisma
generator client { provider = "prisma-client-js" }
datasource db { provider = "postgresql"; url = env("DATABASE_URL") }

model Author {
  id        BigInt    @id @default(autoincrement())
  email     String    @unique
  name      String
  createdAt DateTime  @default(now()) @map("created_at")
  posts     Post[]
  comments  Comment[]

  @@map("authors")
}

model Post {
  id        BigInt    @id @default(autoincrement())
  authorId  BigInt    @map("author_id")
  author    Author    @relation(fields: [authorId], references: [id], onDelete: Cascade)
  title     String
  slug      String    @unique
  body      String
  published Boolean   @default(false)
  createdAt DateTime  @default(now()) @map("created_at")
  comments  Comment[]
  tags      Tag[]

  @@index([authorId, published, createdAt(sort: Desc)])
  @@map("posts")
}

model Comment {
  id        BigInt   @id @default(autoincrement())
  postId    BigInt   @map("post_id")
  post      Post     @relation(fields: [postId], references: [id], onDelete: Cascade)
  authorId  BigInt?  @map("author_id")
  author    Author?  @relation(fields: [authorId], references: [id], onDelete: SetNull)
  body      String
  createdAt DateTime @default(now()) @map("created_at")

  @@index([postId, createdAt])
  @@map("comments")
}

model Tag {
  id    Int    @id @default(autoincrement())
  name  String @unique
  posts Post[]

  @@map("tags")
}
```

```bash
npx prisma migrate dev --name init
npx prisma generate
npx prisma studio
```

## ۶. کوئری با Prisma

```ts
// فهرست با صفحه‌بندی و شمارش
const [items, total] = await prisma.$transaction([
  prisma.post.findMany({
    where: { published: true, authorId },
    select: {
      id: true,
      title: true,
      slug: true,
      createdAt: true,
      author: { select: { name: true } },
      _count: { select: { comments: true } }
    },
    orderBy: { createdAt: 'desc' },
    skip: (page - 1) * limit,
    take: limit
  }),
  prisma.post.count({ where: { published: true, authorId } })
])
```

```ts
// N+1: ❌ یک کوئری برای پست‌ها + n کوئری برای کامنت‌ها
const posts = await prisma.post.findMany()
for (const p of posts) await prisma.comment.findMany({ where: { postId: p.id } })

// ✅ یک کوئری با include
const withComments = await prisma.post.findMany({
  include: { comments: { orderBy: { createdAt: 'desc' }, take: 3 } },
  take: 20
})
```

```ts
// ایجاد رابطه‌ی many-to-many با connectOrCreate
await prisma.post.create({
  data: {
    title,
    slug,
    body,
    authorId,
    tags: {
      connectOrCreate: tagNames.map((name) => ({
        where: { name },
        create: { name }
      }))
    }
  }
})
```

```ts
// تراکنش تعاملی
await prisma.$transaction(async (tx) => {
  const post = await tx.post.update({ where: { id }, data: { published: true } })
  await tx.auditLog.create({ data: { action: 'publish', postId: post.id } })
  return post
})
```

```ts
// خرید بلیت با کاهش اتمیک ظرفیت (بدون read-modify-write مسابقه‌ای)
await prisma.$transaction(async (tx) => {
  const updated = await tx.event.updateMany({
    where: { id: eventId, remaining: { gt: 0 } },
    data: { remaining: { decrement: 1 } }
  })
  if (updated.count === 0) throw new Error('ظرفیت تکمیل است')
  return tx.ticket.create({ data: { eventId, userId } })
})
```

`updateMany` با شرط `remaining > 0` خودش اتمیک است؛ دو خرید هم‌زمان نمی‌توانند آخرین بلیت را دوبار بفروشند.

**انتخاب فیلد:** `select` را دقیق بگذارید؛ `findMany()` بدون select همه‌ی ستون‌ها (و بدنه‌ی سنگین) را می‌آورد.

## ۷. مهاجرت، seed و متغیر محیطی

```bash
# .env.example (commit می‌شود؛ مقدار واقعی نه)
DATABASE_URL="postgresql://user:password@localhost:5432/app?schema=public"
printf '\n.env\n.env.local\n' >> .gitignore
```

```bash
npx prisma migrate dev --name add_tags     # توسعه: ساخت + اعمال
npx prisma migrate deploy                  # production: فقط اعمال
npx prisma migrate status
npx prisma db seed
```

```ts
// prisma/seed.ts
const author = await prisma.author.upsert({
  where: { email: 'demo@example.com' },
  update: {},
  create: { email: 'demo@example.com', name: 'کاربر نمونه' }
})
```

- فایل‌های migration را **commit** کنید؛ هرگز در production از `db push` استفاده نکنید.
- برای تست، دیتابیس جدا (Docker) و migration تازه؛ هر تست در تراکنش rollback شود.

```yaml
# docker-compose.yml
services:
  db:
    image: postgres:16
    environment:
      POSTGRES_PASSWORD: dev
      POSTGRES_DB: blog
    ports: ['5432:5432']
    volumes: ['pgdata:/var/lib/postgresql/data']
volumes: { pgdata: {} }
```

## ۸. اتصال و کارایی

- `DATABASE_URL` با `connection_limit` مناسب؛ هر request یک connection جدید نسازید.
- در serverless، از pooler (مثل PgBouncer/Neon/Supabase pooler) استفاده کنید.
- کوئری‌های کند را با `log: ['query']` یا `pg_stat_statements` پیدا کنید.
- برای شمارش‌های بزرگ، `count` می‌تواند گران باشد؛ تقریب یا شمارنده‌ی کش‌شده.

## ۹. ساخت گام‌به‌گام بلاگ (تمرین)

**گام ۱ — Docker:** دیتابیس محلی بالا بیاورید و `DATABASE_URL` را تنظیم کنید.

**گام ۲ — schema:** مدل‌های بخش ۵ با `@@index` لازم.

**گام ۳ — migration:** `migrate dev --name init` و بررسی SQL تولیدشده.

**گام ۴ — seed:** دو نویسنده، پنج پست، چند کامنت و تگ.

**گام ۵ — کوئری‌ها:** فهرست منتشرشده با صفحه‌بندی، صفحه‌ی پست با کامنت و نویسنده، جستجو.

**گام ۶ — بهینه‌سازی:** `EXPLAIN ANALYZE` روی کوئری فهرست؛ ایندکس مرکب بسازید و دوباره اندازه بگیرید.

**گام ۷ — تراکنش:** انتشار پست + ثبت audit در یک تراکنش.

**گام ۸ — تست:** یک تست برای ایجاد پست و یکی برای یکپارچگی حذف cascade.

### اجرای واقعی: migration، seed و کوئری

```bash
docker compose up -d db
# ✔ Container blog-db-1  Started

npx prisma migrate dev --name init
# Applying migration `20251010120000_init`
# Your database is now in sync with your schema.
# ✔ Generated Prisma Client

npx prisma db seed
# Running seed command `tsx prisma/seed.ts` ...
# 🌱  The seed command has been executed.
```

```bash
psql "$DATABASE_URL" -c "select id, title, published from posts order by id limit 3;"
#  id |      title      | published
# ----+-----------------+-----------
#   1 | اولین پست       | t
#   2 | پست پیش‌نویس     | f
# (2 rows)
```

```bash
psql "$DATABASE_URL" -c "explain analyze select * from posts where author_id = 1 and published order by created_at desc limit 10;"
#                                                       QUERY PLAN
# ----------------------------------------------------------------------------------------------------------------------
#  Limit  (cost=0.28..8.30 rows=1 width=...) (actual time=0.020..0.022 rows=1 loops=1)
#    ->  Index Scan using posts_author_id_published_created_at_idx on posts  (actual time=0.012..0.014 rows=1 loops=1)
#          Index Cond: ((author_id = 1) AND (published = true))
#  Planning Time: 0.150 ms
#  Execution Time: 0.040 ms
```

اگر `Seq Scan` دیدید، ایندکس مرکب/شرط را بررسی کنید.

**ایست بازرسی ۱ — ظرفیت اتمیک:** دو خرید هم‌زمان روی آخرین بلیت بزنید:

```bash
seq 1 20 | xargs -P 20 -I{} curl -s -X POST localhost:3000/tickets -d '{"eventId":1}'
```

باید دقیقاً یک موفقیت و بقیه `ظرفیت تکمیل است` باشند. اگر دو بلیت فروخته شد، `updateMany` با شرط `remaining > 0` را در تراکنش استفاده نکرده‌اید.

**ایست بازرسی ۲ — cascade:** یک پست را حذف کنید:

```bash
psql "$DATABASE_URL" -c "delete from posts where id = 1;"
psql "$DATABASE_URL" -c "select count(*) from comments where post_id = 1;"
#  count
# -------
#      0
```

**ایست بازرسی ۳ — env:** `.env` نباید در `git status` باشد؛ `.env.example` باید `DATABASE_URL` داشته باشد.

| خطای واقعی | معنا |
| --- | --- |
| `P2002` | unique تکراری → upsert |
| `P2003` | FK نامعتبر → ترتیب ایجاد |
| `P2025` | رکورد برای update/delete نیست |
| `too many connections` | pool → pooler |

### نگاشت به معیارهای پذیرش

| معیار | کجای درس |
| --- | --- |
| `schema` | بخش ۱ و ۵ |
| `migrations` | بخش ۷ |
| `transaction` | بخش ۴ و ۶ |
| `seed` | بخش ۷ و گام ۴ |
| `indexes` | بخش ۳ و ۵ |
| `env` | بخش ۷ و ۸ |

## ۱۰. عیب‌یابی

| خطا | علت | راه‌حل |
| --- | --- | --- |
| `P2002` unique | تکراری | upsert یا بررسی قبل |
| `P2003` foreign key | والد وجود ندارد | ترتیب ایجاد |
| `P2025` record not found | update/delete روی id ناموجود | بررسی وجود |
| کندی شدید | N+1 | include/select |
| `too many connections` | pool | pooler/connection_limit |
| migration drift | تغییر دستی schema | `migrate reset` در dev |
| تاریخ اشتباه | `timestamp` بدون tz | `timestamptz` |

## ۱۱. آزمایش‌ها (با پاسخ)

**۱.** چرا `findMany()` بدون `select` می‌تواند خطرناک باشد؟

**پاسخ:** همه‌ی ستون‌ها (مثل هش رمز یا بدنه‌ی بزرگ) را برمی‌گرداند؛ هم امنیت هم کارایی.

**۲.** تفاوت `include` و `select`؟

**پاسخ:** include رابطه اضافه می‌کند؛ select دقیقاً فیلدهای خواسته‌شده را (و می‌تواند رابطه هم انتخاب کند).

**۳.** چرا `FOR UPDATE` لازم است؟

**پاسخ:** جلوگیری از read-modify-write هم‌زمان و گم شدن به‌روزرسانی.

**۴.** ایندکس مرکب `(author_id, published, created_at)` برای چه کوئری‌ای خوب است؟

**پاسخ:** فیلتر نویسنده + وضعیت و مرتب‌سازی بر اساس تاریخ؛ ترتیب ستون‌ها مهم است.

## ۱۲. خودآزمایی

1. کلید خارجی چه چیزی را تضمین می‌کند؟
2. `timestamptz` چه مشکلی را حل می‌کند؟
3. `EXPLAIN ANALYZE` چه می‌گوید؟
4. N+1 چیست و چطور رفع می‌شود؟
5. تفاوت `migrate dev` و `migrate deploy`؟
6. تراکنش تعاملی چه زمانی لازم است؟

## ۱۳. چک‌لیست تحویل

- [ ] schema با کلیدها، FK و ایندکس
- [ ] migration کامیت‌شده
- [ ] seed قابل اجرا
- [ ] کوئری‌ها با select دقیق
- [ ] بدون N+1
- [ ] تراکنش برای عملیات چندمرحله‌ای
- [ ] گزارش `EXPLAIN` قبل/بعد ایندکس
- [ ] `.env` خارج از git
