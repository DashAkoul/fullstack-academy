# GraphQL

> مراجع: [graphql.org/learn](https://graphql.org/learn/) · [Apollo Server](https://www.apollographql.com/docs/apollo-server/) · [DataLoader](https://github.com/graphql/dataloader)

GraphQL به کلاینت اجازه می‌دهد دقیقاً همان داده‌ای را بخواهد که لازم دارد. هزینه‌اش: طراحی schema، حل مسئله‌ی N+1 و مدیریت خطای متفاوت.

## ۱. Schema — قرارداد بین کلاینت و سرور

```graphql
type Instructor {
  id: ID!
  name: String!
  bio: String
  courses: [Course!]!
}

type Review {
  id: ID!
  rating: Int!
  text: String
  author: String!
  createdAt: String!
}

type Course {
  id: ID!
  title: String!
  description: String!
  price: Int!          # ریال
  instructor: Instructor!
  reviews: [Review!]!
  averageRating: Float
}

type CourseConnection {
  items: [Course!]!
  total: Int!
  hasMore: Boolean!
}

input CreateReviewInput {
  courseId: ID!
  rating: Int!
  text: String
  author: String!
}

type Query {
  courses(page: Int = 1, pageSize: Int = 20, search: String): CourseConnection!
  course(id: ID!): Course
}

type Mutation {
  createReview(input: CreateReviewInput!): Review!
}
```

نکته‌ها:

- `!` یعنی غیرNullable؛ تا جای ممکن دقیق باشید.
- برای لیست‌های بزرگ از الگوی Connection استفاده کنید.
- Input type برای Mutation الزامی است (نه type خروجی).

## ۲. راه‌اندازی Apollo Server

```bash
npm i @apollo/server graphql @graphql-tools/schema dataloader
npm i -D tsx typescript @types/node
```

```ts
// src/index.ts
import { ApolloServer } from '@apollo/server'
import { startStandaloneServer } from '@apollo/server/standalone'
import { readFileSync } from 'node:fs'
import { resolvers } from './resolvers.js'
import { db } from './db.js'
import { createLoaders } from './loaders.js'

const typeDefs = readFileSync(new URL('./schema.graphql', import.meta.url), 'utf8')

const server = new ApolloServer({ typeDefs, resolvers })

const { url } = await startStandaloneServer(server, {
  context: async ({ req }) => ({
    db,
    userId: req.headers.authorization?.replace('Bearer ', ''),
    loaders: createLoaders()   // ← در هر درخواست تازه
  }),
  listen: { port: 4000 }
})

console.log(`GraphQL: ${url}`)
```

## ۳. Resolverها

```ts
// src/resolvers.ts
import { GraphQLError } from 'graphql'
import type { Context } from './context.js'

export const resolvers = {
  Query: {
    courses: async (_: unknown, args: { page: number; pageSize: number; search?: string }, ctx: Context) => {
      const { page, pageSize, search } = args
      const where = search ? { title: { contains: search } } : {}
      const [items, total] = await Promise.all([
        ctx.db.course.findMany({ where, skip: (page - 1) * pageSize, take: pageSize }),
        ctx.db.course.count({ where })
      ])
      return { items, total, hasMore: page * pageSize < total }
    },

    course: async (_: unknown, { id }: { id: string }, ctx: Context) => {
      const course = await ctx.db.course.findUnique({ where: { id } })
      if (!course)
        throw new GraphQLError('دوره پیدا نشد', { extensions: { code: 'NOT_FOUND', id } })
      return course
    }
  },

  Mutation: {
    createReview: async (_: unknown, { input }: { input: CreateReviewInput }, ctx: Context) => {
      if (input.rating < 1 || input.rating > 5)
        throw new GraphQLError('امتیاز باید بین ۱ تا ۵ باشد', { extensions: { code: 'BAD_USER_INPUT' } })

      const course = await ctx.db.course.findUnique({ where: { id: input.courseId } })
      if (!course) throw new GraphQLError('دوره پیدا نشد', { extensions: { code: 'NOT_FOUND' } })

      return ctx.db.review.create({ data: input })
    }
  },

  Course: {
    instructor: (parent: { instructorId: string }, _: unknown, ctx: Context) =>
      ctx.loaders.instructorById.load(parent.instructorId),

    reviews: (parent: { id: string }, _: unknown, ctx: Context) =>
      ctx.loaders.reviewsByCourseId.load(parent.id),

    averageRating: async (parent: { id: string }, _: unknown, ctx: Context) => {
      const agg = await ctx.db.review.aggregate({
        where: { courseId: parent.id },
        _avg: { rating: true }
      })
      return agg._avg.rating
    }
  }
}
```

## ۴. مسئله‌ی N+1 و DataLoader

اگر `courses` ده دوره برگرداند و هر دوره `instructor` بخواهد، بدون DataLoader ده کوئری جدا اجرا می‌شود.

```ts
// src/loaders.ts
import DataLoader from 'dataloader'
import type { db as Db } from './db.js'

type Instructor = { id: string; name: string; bio?: string | null }
type Review = { id: string; courseId: string; rating: number; author: string; text?: string | null }

export function createLoaders() {
  const instructorById = new DataLoader<string, Instructor | null>(async (ids) => {
    const rows = await Db.instructor.findMany({ where: { id: { in: [...ids] } } })
    const map = new Map(rows.map((r) => [r.id, r]))
    return ids.map((id) => map.get(id) ?? null)   // ترتیب باید مطابق ids باشد
  })

  const reviewsByCourseId = new DataLoader<string, Review[]>(async (courseIds) => {
    const rows = await Db.review.findMany({ where: { courseId: { in: [...courseIds] } } })
    return courseIds.map((id) => rows.filter((r) => r.courseId === id))
  })

  return { instructorById, reviewsByCourseId }
}
```

نکات حیاتی:

- DataLoader را **در هر درخواست** بسازید، نه یک بار برای همه؛ وگرنه داده‌ی یک کاربر در context دیگری کش می‌شود (نشت داده).
- خروجی آرایه باید هم‌طول و هم‌ترتیب ورودی باشد.
- `{ cache: false }` برای داده‌های حساس/دائماً متغیر در نظر بگیرید.

## ۵. Query در کلاینت

```graphql
query CoursePage($id: ID!) {
  course(id: $id) {
    title
    price
    averageRating
    instructor { name }
    reviews { rating author text }
  }
}
```

فقط فیلدهای لازم را بخواهید؛ یکی از مزایای اصلی GraphQL همین است.

## ۶. مدیریت خطا

| رویکرد | کجا |
| --- | --- |
| `GraphQLError` با `extensions.code` | خطای قابل انتظار (NOT_FOUND, BAD_USER_INPUT) |
| null کردن فیلد | خطای جزئی در یک فیلد |
| استثنای معمولی | به «Unexpected error» تبدیل می‌شود — پیام در production مخفی می‌شود |

کدهای پیشنهادی: `BAD_USER_INPUT`, `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`.

## ۷. امنیت و محدودیت‌ها

- **Query depth/complexity limit** بگذارید؛ یک query تودرتو می‌تواند سرور را زمین بزند (`graphql-depth-limit`).
- **Persisted queries** یا allowlist در production.
- Introspection را در production غیرفعال کنید.
- احراز هویت در context؛ autorization در resolver.
- برای لیست‌ها سقف `pageSize` بگذارید (مثل ۱۰۰).

## ۸. REST یا GraphQL؟

| معیار | REST | GraphQL |
| --- | --- | --- |
| کش HTTP | ساده و قوی | نیاز به تنظیم |
| چند کلاینت متفاوت | چند endpoint | یک endpoint انعطاف‌پذیر |
| منحنی یادگیری | کم | متوسط |
| پیچیدگی سرور | کم | schema + N+1 + امنیت query |
| مناسب | سرویس ساده، عمومی | BFF، اپ‌های چندپلتفرمه |

## ۹. تست سریع

```bash
curl -s localhost:4000 -H 'Content-Type: application/json' \
  -d '{"query":"{ courses(page:1,pageSize:2){ total items { title instructor { name } } } }"}' | jq
```

## تمرین این درس

Schema دوره/مدرس/دیدگاه با صفحه‌بندی، Mutation افزودن دیدگاه با input و اعتبارسنجی، DataLoader برای روابط، و خطاهای کددار. جزئیات در تب تمرین است.
