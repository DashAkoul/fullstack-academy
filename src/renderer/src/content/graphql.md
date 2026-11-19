# GraphQL: Schema، Resolver و DataLoader

> مراجع: [GraphQL Spec](https://spec.graphql.org/) · [GraphQL.js](https://graphql.org/graphql-js/) · [GraphQL Yoga](https://the-guild.dev/graphql/yoga-server/docs) · [DataLoader](https://github.com/graphql/dataloader)

## در این درس چه یاد می‌گیرید؟

یک schema تایپ‌سیف می‌نویسید، resolverها را درست پیاده می‌کنید، مشکل N+1 را با DataLoader حل می‌کنید و خطا/احراز هویت/صفحه‌بندی را حرفه‌ای مدیریت می‌کنید. در پایان، API بلاگ GraphQL تمرین را با کوئری و mutation کارا تحویل می‌دهید.

---

## ۱. Schema قرارداد است

```graphql
# schema.graphql
type Query {
  posts(first: Int = 20, after: String): PostConnection!
  post(slug: String!): Post
  me: User
}

type Mutation {
  createPost(input: CreatePostInput!): CreatePostPayload!
  publishPost(id: ID!): Post!
  deletePost(id: ID!): Boolean!
}

type Post {
  id: ID!
  title: String!
  slug: String!
  body: String!
  published: Boolean!
  createdAt: DateTime!
  author: User!
  comments(first: Int = 10): [Comment!]!
}

type User {
  id: ID!
  name: String!
  posts: [Post!]!
}

type Comment {
  id: ID!
  body: String!
  author: User
}

type PostConnection {
  edges: [PostEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}

type PostEdge { cursor: String!; node: Post! }
type PageInfo { hasNextPage: Boolean!; endCursor: String }

input CreatePostInput {
  title: String!
  slug: String!
  body: String!
  tagNames: [String!] = []
}

type CreatePostPayload {
  post: Post
  errors: [UserError!]!
}

type UserError { field: String; message: String! }

scalar DateTime
```

قواعد طراحی:

- `!` یعنی غیرnull. **سخت‌گیرانه نباشید**: اگر eventual consistency دارید یا خطای جزئی ممکن است، nullable بگذارید.
- لیست‌ها: `[Post!]!` یعنی خود لیست و اعضایش null نیستند.
- ورودی‌ها را با `input` بدهید؛ خروجی mutation را با payload (هم داده هم خطا) برگردانید تا خطای قابل‌نمایش بدون از دست دادن داده داشته باشید.
- از scalar سفارشی برای تاریخ استفاده کنید (نه String خام).

## ۲. Resolver: هر فیلد یک تابع

```ts
// resolvers/post.ts
export const Post = {
  author: (parent: PostRow, _args: unknown, ctx: Context) =>
    ctx.loaders.userById.load(parent.authorId),

  comments: (parent: PostRow, args: { first: number }, ctx: Context) =>
    ctx.prisma.comment.findMany({
      where: { postId: parent.id },
      orderBy: { createdAt: 'desc' },
      take: Math.min(args.first, 50)
    }),

  createdAt: (parent: PostRow) => parent.createdAt.toISOString()
}

export const Query = {
  posts: async (_p: unknown, args: { first: number; after?: string }, ctx: Context) => {
    const take = Math.min(args.first, 50)
    const rows = await ctx.prisma.post.findMany({
      where: { published: true },
      orderBy: { createdAt: 'desc' },
      take: take + 1,
      ...(args.after ? { cursor: { id: decodeCursor(args.after) }, skip: 1 } : {})
    })

    const hasNextPage = rows.length > take
    const edges = rows.slice(0, take).map((node) => ({
      cursor: encodeCursor(node.id),
      node
    }))

    return {
      edges,
      pageInfo: { hasNextPage, endCursor: edges.at(-1)?.cursor ?? null },
      totalCount: await ctx.prisma.post.count({ where: { published: true } })
    }
  },

  post: (_p: unknown, args: { slug: string }, ctx: Context) =>
    ctx.prisma.post.findUnique({ where: { slug: args.slug } }),

  me: (_p: unknown, _a: unknown, ctx: Context) =>
    ctx.user ? ctx.prisma.user.findUnique({ where: { id: ctx.user.id } }) : null
}
```

- Resolver والد را به‌عنوان آرگومان اول می‌گیرد؛ فیلدهای ساده معمولاً resolver لازم ندارند.
- context جای همه‌ی سرویس‌ها/کاربر است؛ آن را در هر request بسازید.
- `parent` را mutate نکنید.

## ۳. سرور با GraphQL Yoga

```ts
// src/server.ts
import { createYoga, createSchema } from 'graphql-yoga'
import { createServer } from 'node:http'
import { resolvers } from './resolvers/index.js'
import { loadSchema } from './schema.js'
import { createContext } from './context.js'

const yoga = createYoga({
  schema: createSchema({ typeDefs: await loadSchema(), resolvers }),
  context: createContext,
  graphiql: process.env.NODE_ENV !== 'production',
  maskedErrors: process.env.NODE_ENV === 'production'
})

createServer(yoga).listen(4000, () => console.log('http://localhost:4000/graphql'))
```

```ts
// src/context.ts
import DataLoader from 'dataloader'
import { prisma } from './prisma.js'
import { verifyToken } from './auth.js'

export async function createContext({ request }: { request: Request }) {
  const auth = request.headers.get('authorization')
  const user = auth?.startsWith('Bearer ') ? await verifyToken(auth.slice(7)) : null

  return {
    prisma,
    user,
    loaders: {
      userById: new DataLoader<string, UserRow | null>(async (ids) => {
        const users = await prisma.user.findMany({ where: { id: { in: [...ids] } } })
        const map = new Map(users.map((u) => [u.id, u]))
        return ids.map((id) => map.get(id) ?? null)
      })
    }
  }
}
```

## ۴. N+1 و DataLoader

بدون DataLoader، کوئری `posts { author { name } }` برای ۲۰ پست ۲۰ کوئری نویسنده می‌زند.

DataLoader درخواست‌های هم‌زمان را در یک tick جمع می‌کند و با `IN (...)` یک کوئری می‌زند، سپس نتیجه را به ترتیب ورودی برمی‌گرداند و cache می‌کند.

```ts
const loader = new DataLoader<string, UserRow | null>(async (ids) => {
  const users = await prisma.user.findMany({ where: { id: { in: [...ids] } } })
  const map = new Map(users.map((u) => [u.id, u]))
  return ids.map((id) => map.get(id) ?? null)   // طول و ترتیب باید برابر ids باشد
})
```

- DataLoader **per-request** بسازید، نه global (وگرنه داده‌ی کاربران قاطی می‌شود).
- batch function باید آرایه‌ای هم‌طول ورودی برگرداند؛ برای نبودِ رکورد `null` بدهید.
- برای batchهای سنگین `maxBatchSize` بگذارید.

## ۵. Mutation با خطای قابل‌نمایش

```ts
export const Mutation = {
  createPost: async (
    _p: unknown,
    { input }: { input: { title: string; slug: string; body: string; tagNames: string[] } },
    ctx: Context
  ) => {
    if (!ctx.user) {
      return { post: null, errors: [{ field: null, message: 'ابتدا وارد شوید.' }] }
    }

    const parsed = createPostSchema.safeParse(input)
    if (!parsed.success) {
      return {
        post: null,
        errors: parsed.error.issues.map((i) => ({ field: String(i.path[0]), message: i.message }))
      }
    }

    try {
      const post = await ctx.prisma.post.create({
        data: {
          ...parsed.data,
          authorId: ctx.user.id,
          tags: {
            connectOrCreate: parsed.data.tagNames.map((name) => ({
              where: { name },
              create: { name }
            }))
          }
        }
      })
      return { post, errors: [] }
    } catch (err) {
      if (isUniqueViolation(err)) {
        return { post: null, errors: [{ field: 'slug', message: 'این slug قبلاً استفاده شده است.' }] }
      }
      throw err
    }
  }
}
```

**دو نوع خطا را جدا کنید:**

| نوع | مثال | نحوه‌ی برگشت |
| --- | --- | --- |
| خطای قابل‌انتظار دامنه | slug تکراری، ورودی نامعتبر | فیلد `errors` در payload |
| خطای غیرمنتظره | DB down، باگ | `throw` → `errors` سطح GraphQL |

## ۶. احراز هویت در سطح فیلد

```ts
import { GraphQLError } from 'graphql'

export const requireUser = (ctx: Context) => {
  if (!ctx.user) throw new GraphQLError('UNAUTHENTICATED', { extensions: { code: 'UNAUTHENTICATED' } })
  return ctx.user
}

export const Post = {
  body: (parent: PostRow, _a: unknown, ctx: Context) => {
    if (!parent.published && parent.authorId !== ctx.user?.id) {
      throw new GraphQLError('FORBIDDEN', { extensions: { code: 'FORBIDDEN' } })
    }
    return parent.body
  }
}
```

GraphQL می‌تواند فیلدهای حساس را لو بدهد؛ دسترسی را **در resolver** بررسی کنید، نه فقط در UI.

## ۷. محدودسازی کوئری

```ts
import depthLimit from 'graphql-depth-limit'
import { createComplexityLimitRule } from 'graphql-validation-complexity'

const yoga = createYoga({
  schema,
  validationRules: [
    depthLimit(7),
    createComplexityLimitRule(1000, { onCost: (cost) => console.log('cost', cost) })
  ]
})
```

- بدون محدودیت، یک کوئری تودرتو می‌تواند سرور را از پا دربیاورد.
- صفحه‌بندی اجباری: `first` را سقف بزنید و در صورت نیاز `max` در schema.
- timeout و `maxBatchSize` DataLoader را تنظیم کنید.

## ۸. کلاینت و Codegen

```graphql
query Posts($first: Int!) {
  posts(first: $first) {
    edges {
      node { id title slug author { name } }
    }
    pageInfo { hasNextPage endCursor }
  }
}
```

```bash
npm i -D @graphql-codegen/cli @graphql-codegen/client-preset
npx graphql-codegen init
```

Codegen از schema + operationها تایپ تولید می‌کند؛ دیگر حدس نمی‌زنید فیلد چه شکلی است.

## ۹. ساخت گام‌به‌گام API بلاگ (تمرین)

**گام ۱ — schema:** بخش ۱ را در `schema.graphql` بگذارید.

**گام ۲ — context:** Prisma + کاربر از JWT + DataLoaderها.

**گام ۳ — Query:** `posts` با cursor، `post` با slug، `me`.

**گام ۴ — فیلدهای رابطه:** `Post.author` با loader، `Post.comments` با take.

**گام ۵ — Mutation:** `createPost` با payload خطا، `publishPost` با بررسی مالکیت.

**گام ۶ — امنیت:** depth limit، complexity، بررسی دسترسی `body`.

**گام ۷ — تست:** کوئری posts و mutation تکراری slug؛ شمارش کوئری‌های Prisma برای اثبات رفع N+1.

**گام ۸ — Codegen:** operation نمونه و تایپ تولیدشده در کلاینت.

### اجرای واقعی: کوئری و Mutation

```bash
npm run dev
# GraphQL Yoga running at http://localhost:4000/graphql
```

```bash
curl -s http://localhost:4000/graphql \
  -H 'Content-Type: application/json' \
  -d '{"query":"{ posts(first: 2) { edges { node { id title author { name } } } pageInfo { hasNextPage endCursor } totalCount } }"}'
```

```json
{
  "data": {
    "posts": {
      "edges": [
        { "node": { "id": "1", "title": "اولین پست", "author": { "name": "سارا" } } },
        { "node": { "id": "2", "title": "دومین پست", "author": { "name": "علی" } } }
      ],
      "pageInfo": { "hasNextPage": true, "endCursor": "Mg==" },
      "totalCount": 12
    }
  }
}
```

**Mutation با خطای دامنه:**

```bash
curl -s http://localhost:4000/graphql \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"query":"mutation { createPost(input: { title: \"a\", slug: \"x\", body: \"...\" }) { post { id } errors { field message } } }"}'
```

```json
{
  "data": {
    "createPost": {
      "post": null,
      "errors": [{ "field": "title", "message": "عنوان کوتاه است" }]
    }
  }
}
```

**ایست بازرسی ۱ — N+1:** در Prisma `log: ['query']` را روشن کنید. کوئری `posts { author { name } }` با ۲۰ پست باید **۲** کوئری بزند (یکی posts، یکی `users IN (...)`). اگر ۲۱ کوئری دیدید، DataLoader وصل نیست.

**ایست بازرسی ۲ — loader per-request:** در دو درخواست هم‌زمان با دو کاربر مختلف، نباید داده‌ی کاربر A در کش B بیاید. اگر DataLoader را global ساخته‌اید، همین اتفاق می‌افتد.

**ایست بازرسی ۳ — عمق:** این کوئری را بزنید:

```graphql
{ posts { edges { node { author { posts { edges { node { author { posts { edges { node { id } } } } } } } } } } } }
```

باید خطای depth limit ببینید، نه پاسخ کند/سنگین.

**خطای واقعی:**

```json
{ "errors": [{ "message": "Cannot return null for non-nullable field Post.title." }] }
```

یعنی resolver برای فیلد non-null مقدار null داده؛ داده یا resolver را اصلاح کنید (یا فیلد را nullable کنید اگر null مجاز است).

### نگاشت به معیارهای پذیرش

| معیار | کجای درس |
| --- | --- |
| `schema` | بخش ۱ |
| `resolvers` | بخش ۲ |
| `dataloader` | بخش ۴ |
| `inputs` | بخش ۱ و ۵ (input type + اعتبارسنجی) |
| `errors` | بخش ۵ و ۶ (GraphQLError با کد) |

## ۱۰. عیب‌یابی

| نشانه | علت | راه‌حل |
| --- | --- | --- |
| `Cannot return null for non-nullable` | resolver null داد | nullable کنید یا خطا را مدیریت کنید |
| کندی با رابطه‌ها | N+1 | DataLoader |
| داده‌ی کاربر A برای B | loader global | per-request |
| `Field "x" is not defined` | schema/resolver ناهماهنگ | نام‌ها را چک کنید |
| خطای ۲۰۰ با `errors` | خطای GraphQL | `errors` را در کلاینت بررسی کنید |
| کوئری مخرب | بدون محدودیت عمق | depth/complexity |

## ۱۱. آزمایش‌ها (با پاسخ)

**۱.** چرا GraphQL روی HTTP همیشه ۲۰۰ برمی‌گرداند؟

**پاسخ:** خطاهای فیلد در بدنه‌ی `errors` گزارش می‌شوند و ممکن است داده‌ی جزئی هم وجود داشته باشد؛ کد وضعیت برای خطاهای انتقال/کل کوئری است.

**۲.** چرا DataLoader باید per-request باشد؟

**پاسخ:** cache آن بین کاربران مشترک می‌شود و نشتی داده رخ می‌دهد؛ همچنین داده‌ی کهنه.

**۳.** چه زمانی فیلد را nullable بگذارید؟

**پاسخ:** وقتی ممکن است legitimately null باشد یا خطای جزئی نباید کل پاسخ را از بین ببرد.

**۴.** چرا ورودی mutation را در `input` می‌بریم؟

**پاسخ:** توسعه‌پذیری، اعتبارسنجی یکجا و امکان افزودن فیلد بدون تغییر امضای resolver.

## ۱۲. خودآزمایی

1. تفاوت Query و Mutation در قرارداد؟
2. Resolver چهار آرگومان دارد؛ هر کدام چیست؟
3. DataLoader چه دو کاری می‌کند؟
4. چطور از کوئری‌های مخرب جلوگیری می‌کنید؟
5. خطای دامنه را کجا برمی‌گردانید؟
6. چرا Codegen مفید است؟

## ۱۳. چک‌لیست تحویل

- [ ] schema با input/payload/connection
- [ ] resolver بدون منطق تکراری
- [ ] DataLoader برای همه‌ی رابطه‌های پرتکرار
- [ ] حداقل یک mutation با خطای فیلد
- [ ] بررسی دسترسی در resolver
- [ ] depth/complexity limit
- [ ] cursor pagination
- [ ] تست + codegen
