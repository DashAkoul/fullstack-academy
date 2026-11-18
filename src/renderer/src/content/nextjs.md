# Next.js و App Router

> مرجع رسمی: [Next.js Docs](https://nextjs.org/docs)

Next.js یک فریم‌ورک React است که مسیریابی، رندر سمت سرور، بهینه‌سازی تصویر، و قراردادهای پوشه‌ای را اضافه می‌کند. از نسخه ۱۳ به بعد **App Router** (پوشه‌ی `app/`) سبک پیش‌فرض و توصیه‌شده است.

## ۱. راه‌اندازی

```bash
npx create-next-app@latest my-blog
# TypeScript ✓  ESLint ✓  Tailwind ✓  src/ ✓  App Router ✓
```

```
app/
├─ layout.tsx          ← ریشه، اجباری، شامل <html> و <body>
├─ page.tsx            ← صفحه /
├─ globals.css
├─ blog/
│  ├─ page.tsx         ← /blog
│  └─ [slug]/
│     ├─ page.tsx      ← /blog/:slug
│     └─ loading.tsx
├─ api/
│  └─ contact/route.ts ← Route Handler (GET/POST)
├─ loading.tsx
├─ error.tsx
└─ not-found.tsx
```

## ۲. Server Components (پیش‌فرض)

در App Router **همه چیز Server Component است** مگر اینکه `"use client"` بنویسید.

| | Server Component | Client Component |
| --- | --- | --- |
| دسترسی به DB/رازها | ✅ | ❌ |
| useState/useEffect | ❌ | ✅ |
| حجم JS ارسالی | صفر | دارد |
| SEO و رندر اولیه | عالی | وابسته |

قاعده‌ی عملی: تا جای ممکن سرور بمانید و `"use client"` را به «برگ‌های» درخت (دکمه، فرم تعاملی) هل دهید.

```tsx
// app/blog/page.tsx  (Server)
import { PostCard } from '@/components/PostCard'   // می‌تواند Client باشد

export default async function BlogPage() {
  const posts = await db.post.findMany({ orderBy: { date: 'desc' } })
  return (
    <main>
      <h1>وبلاگ</h1>
      {posts.map((p) => <PostCard key={p.slug} post={p} />)}
    </main>
  )
}
```

## ۳. مسیر پویا (Dynamic Route)

```tsx
// app/blog/[slug]/page.tsx
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

type Params = { params: Promise<{ slug: string }> }

export async function generateStaticParams() {
  const posts = await getAllPosts()
  return posts.map((p) => ({ slug: p.slug }))   // تولید ایستا در build
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params
  const post = await getPost(slug)
  if (!post) return { title: 'یافت نشد' }
  return {
    title: `${post.title} | وبلاگ آکادمی`,
    description: post.excerpt,
    openGraph: { title: post.title, images: [post.cover] }
  }
}

export default async function PostPage({ params }: Params) {
  const { slug } = await params
  const post = await getPost(slug)
  if (!post) notFound()
  return (
    <article>
      <h1>{post.title}</h1>
      <p>{post.body}</p>
    </article>
  )
}
```

در Next.js 15، `params` و `searchParams` **Promise** هستند؛ باید `await` شوند.

## ۴. SSR، SSG، ISR — انتخاب درست

```tsx
// SSG: در زمان build
export const dynamic = 'force-static'

// ISR: ایستا + بازتولید هر ۶۰ ثانیه
export const revalidate = 60

// SSR: در هر درخواست
export const dynamic = 'force-dynamic'
```

| استراتژی | چه زمانی |
| --- | --- |
| SSG | محتوای تقریباً ثابت (درباره ما، مستندات) |
| ISR | لیست محصولات، وبلاگ با به‌روزرسانی دوره‌ای |
| SSR | داشبورد شخصی، قیمت لحظه‌ای |
| CSR | بخش‌های تعاملی بعد از بار اول |

```ts
// کش در سطح fetch
await fetch(url, { next: { revalidate: 3600, tags: ['products'] } })

// باطل‌سازی دستی
import { revalidateTag, revalidatePath } from 'next/cache'
revalidateTag('products')
```

## ۵. Server Actions — فرم بدون API جدا

```tsx
// app/contact/actions.ts
'use server'

import { z } from 'zod'
import { db } from '@/lib/db'

const Schema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  message: z.string().min(10)
})

export type FormState = { ok: boolean; errors?: Record<string, string> }

export async function submitContact(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = Schema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    const errors: Record<string, string> = {}
    for (const issue of parsed.error.issues) errors[String(issue.path[0])] = issue.message
    return { ok: false, errors }
  }
  await db.message.create({ data: parsed.data })
  return { ok: true }
}
```

```tsx
// app/contact/ContactForm.tsx
'use client'
import { useActionState } from 'react'
import { submitContact, type FormState } from './actions'

const initial: FormState = { ok: false }

export function ContactForm() {
  const [state, action, pending] = useActionState(submitContact, initial)

  if (state.ok) return <p>پیام شما ثبت شد. با تشکر!</p>

  return (
    <form action={action}>
      <label htmlFor="name">نام</label>
      <input id="name" name="name" />
      {state.errors?.name && <p className="text-rose-500">{state.errors.name}</p>}

      <label htmlFor="email">ایمیل</label>
      <input id="email" name="email" type="email" />
      {state.errors?.email && <p className="text-rose-500">{state.errors.email}</p>}

      <label htmlFor="message">پیام</label>
      <textarea id="message" name="message" />
      {state.errors?.message && <p className="text-rose-500">{state.errors.message}</p>}

      <button disabled={pending}>{pending ? 'در حال ارسال…' : 'ارسال'}</button>
    </form>
  )
}
```

اعتبارسنجی سمت سرور غیرقابل مذاکره است؛ اعتبارسنجی کلاینت فقط تجربه‌ی کاربری است.

## ۶. Route Handler برای API

```ts
// app/api/posts/route.ts
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const page = Number(searchParams.get('page') ?? 1)
  const posts = await listPosts({ page })
  return NextResponse.json({ posts })
}

export async function POST(request: Request) {
  const body = await request.json()
  const created = await createPost(body)
  return NextResponse.json(created, { status: 201 })
}
```

## ۷. حالت‌های UI: loading / error / not-found

```tsx
// app/blog/loading.tsx
export default function Loading() {
  return <div className="animate-pulse space-y-2">در حال بارگذاری…</div>
}
```

```tsx
// app/blog/error.tsx
'use client'
export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div>
      <h2>خطایی رخ داد</h2>
      <p>{error.message}</p>
      <button onClick={reset}>تلاش دوباره</button>
    </div>
  )
}
```

`error.tsx` باید Client Component باشد.

## ۸. بهینه‌سازی

- تصاویر: همیشه `next/image` با `width/height` یا `fill`.
- فونت: `next/font/local` یا فونت‌های Google بدون درخواست خارجی در زمان اجرا.
- `next/link` برای ناوبری سمت کلاینت و prefetch.
- تحلیل باندل: `ANALYZE=true npm run build` با `@next/bundle-analyzer`.
- متغیرهای محیطی: `NEXT_PUBLIC_` فقط برای چیزهای غیرحساس.

## ۹. خطاهای رایج

| مشکل | راه‌حل |
| --- | --- |
| `useState` در Server Component | فایل را Client کنید یا state را به کامپوننت برگ ببرید |
| `window is not defined` | دسترسی در `useEffect` یا بررسی `typeof window` |
| راز در `NEXT_PUBLIC_` | حذف و انتقال به سمت سرور |
| داده تازه نمی‌شود | `revalidatePath`/`revalidateTag` را صدا بزنید |
| فراموش کردن `await params` | Next 15+ غیرهمگام است |

## تمرین این درس

وبلاگ شرکتی: `generateStaticParams`، `generateMetadata`، ISR با `revalidate = 60`، فرم تماس با Server Action و اعتبارسنجی، و `loading/error/not-found`. جزئیات در تب تمرین است.
