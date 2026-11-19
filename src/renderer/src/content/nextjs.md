# Next.js و App Router

> مرجع رسمی: [Next.js Docs](https://nextjs.org/docs) · [Server & Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components) · [Fetching Data](https://nextjs.org/docs/app/getting-started/fetching-data)

## در این درس چه یاد می‌گیرید؟

تفاوت Server و Client Component را در عمل می‌بینید، کش و بازتولید داده را کنترل می‌کنید، با Server Actions فرم می‌سازید و حالت‌های loading/error را درست پیاده می‌کنید. در پایان، وبلاگ شرکتی تمرین را با تولید ایستا، ISR، متادیتا و فرم تماس می‌سازید.

---

## ۱. App Router: مسیر = پوشه

```
app/
├─ layout.tsx            ← ریشه؛ اجباری؛ <html> و <body>
├─ page.tsx              ← /
├─ globals.css
├─ blog/
│  ├─ page.tsx           ← /blog
│  ├─ loading.tsx
│  └─ [slug]/
│     ├─ page.tsx        ← /blog/:slug
│     └─ not-found.tsx
├─ api/contact/route.ts  ← Route Handler
├─ error.tsx
└─ not-found.tsx
```

- `layout.tsx` بین ناوبری‌ها حفظ می‌شود (state و UI مشترک).
- `template.tsx` شبیه layout است ولی در هر ناوبری از نو mount می‌شود.
- پرانتز `(marketing)` گروه مسیر است و در URL اثری ندارد.

## ۲. Server Component پیش‌فرض است

در App Router همه چیز Server Component است مگر `"use client"` بنویسید.

| | Server | Client |
| --- | --- | --- |
| دسترسی به DB/راز | ✅ | ❌ |
| useState/useEffect | ❌ | ✅ |
| حجم JS ارسالی | تقریباً صفر | دارد |
| رندر اولیه/SEO | عالی | وابسته |

**قاعده:** `"use client"` را به «برگ‌ها» ببرید، نه ریشه.

```tsx
// app/blog/page.tsx  (Server)
import { PostCard } from '@/components/PostCard'
import { listPosts } from '@/lib/posts'

export default async function BlogPage() {
  const posts = await listPosts()
  return (
    <main>
      <h1>وبلاگ</h1>
      <ul>
        {posts.map((p) => <li key={p.slug}><PostCard post={p} /></li>)}
      </ul>
    </main>
  )
}
```

```tsx
// components/PostCard.tsx  (Client فقط چون تعامل دارد)
'use client'
import { useState } from 'react'

export function PostCard({ post }: { post: Post }) {
  const [open, setOpen] = useState(false)
  return (
    <article>
      <h2>{post.title}</h2>
      <button onClick={() => setOpen((v) => !v)}>{open ? 'بستن' : 'بیشتر'}</button>
      {open && <p>{post.excerpt}</p>}
    </article>
  )
}
```

**مرز سریال‌سازی:** از Server به Client فقط داده‌ی قابل سریال‌سازی (string/number/array/plain object/Date) پاس بدهید؛ تابع، کلاس یا connection دیتابیس نه.

## ۳. مسیر پویا و متادیتا

```tsx
// app/blog/[slug]/page.tsx
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

type Props = { params: Promise<{ slug: string }> }

export async function generateStaticParams() {
  const posts = await listPosts()
  return posts.map((p) => ({ slug: p.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const post = await getPost(slug)
  if (!post) return { title: 'یافت نشد' }
  return {
    title: `${post.title} | وبلاگ آکادمی`,
    description: post.excerpt,
    openGraph: { title: post.title, images: [post.cover] }
  }
}

export default async function PostPage({ params }: Props) {
  const { slug } = await params          // Next 15: params یک Promise است
  const post = await getPost(slug)
  if (!post) notFound()
  return (
    <article>
      <h1>{post.title}</h1>
      <time dateTime={post.date}>{post.date}</time>
      <div>{post.body}</div>
    </article>
  )
}
```

## ۴. کش، SSG، ISR و SSR

```ts
// app/blog/page.tsx
export const revalidate = 60          // ISR: حداکثر هر ۶۰ ثانیه بازتولید
// export const dynamic = 'force-static'
// export const dynamic = 'force-dynamic'
```

Next 15: درخواست‌های `fetch` به‌صورت پیش‌فرض **کش نمی‌شوند**. برای کش صریح:

```ts
await fetch(url, { cache: 'force-cache' })

await fetch(url, { next: { revalidate: 3600, tags: ['products'] } })
```

```ts
import { revalidatePath, revalidateTag } from 'next/cache'
revalidateTag('products')
revalidatePath('/blog')
```

| استراتژی | چه زمانی |
| --- | --- |
| SSG | محتوای ثابت (درباره ما، مستندات) |
| ISR | وبلاگ/محصولات با به‌روزرسانی دوره‌ای |
| SSR | داشبورد شخصی، قیمت لحظه‌ای |
| CSR | بخش تعاملی بعد از بار اول |

## ۵. Server Actions: فرم بدون API جداگانه

```ts
// app/contact/actions.ts
'use server'

import { z } from 'zod'
import { db } from '@/lib/db'
import { revalidatePath } from 'next/cache'

const Schema = z.object({
  name: z.string().min(2, 'نام کوتاه است'),
  email: z.string().email('ایمیل معتبر نیست'),
  message: z.string().min(10, 'پیام کوتاه است')
})

export type FormState = { ok: boolean; errors?: Record<string, string> }

export async function submitContact(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = Schema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    message: formData.get('message')
  })

  if (!parsed.success) {
    const errors: Record<string, string> = {}
    for (const issue of parsed.error.issues) errors[String(issue.path[0])] = issue.message
    return { ok: false, errors }
  }

  await db.message.create({ data: parsed.data })
  revalidatePath('/contact')
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

  if (state.ok) return <p role="status">پیام شما ثبت شد. با تشکر!</p>

  return (
    <form action={action} noValidate>
      <label htmlFor="name">نام</label>
      <input id="name" name="name" />
      {state.errors?.name && <p role="alert">{state.errors.name}</p>}

      <label htmlFor="email">ایمیل</label>
      <input id="email" name="email" type="email" />
      {state.errors?.email && <p role="alert">{state.errors.email}</p>}

      <label htmlFor="message">پیام</label>
      <textarea id="message" name="message" />
      {state.errors?.message && <p role="alert">{state.errors.message}</p>}

      <button disabled={pending}>{pending ? 'در حال ارسال…' : 'ارسال'}</button>
    </form>
  )
}
```

اعتبارسنجی سمت سرور اجباری است؛ اعتبارسنجی کلاینت فقط UX است.

## ۶. حالت‌های مسیر

```tsx
// app/blog/loading.tsx
export default function Loading() {
  return <div aria-busy="true">در حال بارگذاری…</div>
}
```

```tsx
// app/blog/error.tsx
'use client'
export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div role="alert">
      <h2>خطایی رخ داد</h2>
      <p>{error.message}</p>
      <button onClick={reset}>تلاش دوباره</button>
    </div>
  )
}
```

`notFound()` صفحه‌ی `not-found.tsx` نزدیک‌ترین را نشان می‌دهد.

## ۷. جریان داده و Streaming

```tsx
import { Suspense } from 'react'

export default async function Page() {
  return (
    <>
      <h1>داشبورد</h1>
      <Suspense fallback={<p>در حال بارگذاری آمار…</p>}>
        <Stats />
      </Suspense>
      <Suspense fallback={<p>در حال بارگذاری نمودار…</p>}>
        <Chart />
      </Suspense>
    </>
  )
}

async function Stats() {
  const stats = await getStats()   // کند اما فقط این بخش را بلاک می‌کند
  return <StatCards data={stats} />
}
```

Suspense مرزهای streaming می‌سازد: HTML سریع می‌رسد و بخش‌های کند بعداً پر می‌شوند.

## ۸. Route Handlers و کوکی‌ها

```ts
// app/api/posts/route.ts
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const page = Math.max(1, Number(searchParams.get('page') ?? 1))
  return NextResponse.json(await listPosts({ page }))
}
```

```ts
import { cookies, headers } from 'next/headers'

export async function GET() {
  const token = (await cookies()).get('session')?.value
  const ua = (await headers()).get('user-agent')
  // ...
}
```

در Next 15، `cookies()` و `headers()` غیرهمگام هستند.

## ۹. متغیرهای محیطی و امنیت

```bash
DATABASE_URL=...
NEXT_PUBLIC_SITE_URL=https://example.com
SESSION_SECRET=...
```

- `NEXT_PUBLIC_` به کلاینت می‌رود؛ فقط داده‌ی عمومی.
- رازها فقط در Server Component/Action/Route Handler خوانده شوند.
- برای auth، در middleware فقط وجود/اعتبار امضای کوکی را بررسی کنید؛ بررسی سنگین DB را در layout/route بگذارید.

## ۱۰. ساخت گام‌به‌گام وبلاگ (تمرین)

**گام ۱ — پروژه**

```bash
npx create-next-app@latest blog --ts --tailwind --eslint --app --src-dir
```

**گام ۲ — لایه‌ی داده:** `lib/posts.ts` با خواندن Markdown/JSON یا Prisma؛ تایپ `Post`.

**گام ۳ — ایندکس وبلاگ:** `app/blog/page.tsx` به‌صورت Server؛ `revalidate = 60`.

**گام ۴ — صفحه‌ی مقاله:** `[slug]` با `generateStaticParams`، `notFound()` برای slug نامعتبر و `generateMetadata`.

**گام ۵ — فرم تماس:** Server Action + Zod + `useActionState`؛ بعد از موفقیت پیام و `revalidatePath`.

**گام ۶ — حالت‌ها:** `loading.tsx`، `error.tsx`، `not-found.tsx`.

**گام ۷ — SEO:** `sitemap.ts`، `robots.ts` و OpenGraph.

**گام ۸ — بررسی بیلد:** `npm run build`؛ ببینید کدام مسیرها Static و کدام Dynamic هستند (`○`/`ƒ`).

### اجرای واقعی: dev، build و بررسی کش

```bash
npx create-next-app@latest fsa-09-blog --ts --tailwind --eslint --app --src-dir
cd fsa-09-blog
npm run dev
#   ▲ Next.js 15.5.0
#   - Local:        http://localhost:3000
#   - Environments: .env.local
#
#  ✓ Starting...
#  ✓ Ready in 2.1s
```

**build واقعی و جدول مسیرها:**

```bash
npm run build
#    ▲ Next.js 15.5.0
#
#    Creating an optimized production build ...
#  ✓ Compiled successfully
#  ✓ Generating static pages (6/6)
#
#  Route (app)                                 Size  First Load JS
#  ┌ ○ /                                    1.2 kB         106 kB
#  ├ ○ /_not-found                           ...
#  ├ ● /blog                                 ...
#  └ ● /blog/[slug]                          ...
#
#  ○  (Static)  prerendered as static content
#  ●  (SSG)     prerendered as static HTML (uses generateStaticParams)
#  ƒ  (Dynamic) server-rendered on demand
```

اگر مسیر `[slug]` با `ƒ` نمایش داده شد نه `●`، `generateStaticParams` را نداشته‌اید یا `fetch` با `cache: 'no-store'` زده‌اید.

**ایست بازرسی ۱ — کش:** در `npm run dev`، دو بار `/blog` را باز کنید. در ترمینال باید فقط یک بار درخواست دیتابیس/فایل ببینید (اگر `fetch` کش‌شده است). برای بازتولید فوری:

```ts
revalidatePath('/blog')
```

سپس صفحه را رفرش کنید؛ محتوای جدید باید بیاید.

**ایست بازرسی ۲ — فرم بدون JS:** در Chrome، DevTools → Settings → Debugger → **Disable JavaScript** را فعال کنید. فرم تماس را پر و ارسال کنید؛ باید همان پیام موفقیت را ببینید (Server Action). اگر خطا داد، `action` را به تابع سمت کلاینت وصل کرده‌اید.

**خطای واقعی ۱:**

```text
Error: Route "/blog/[slug]" used `params.slug`. `params` should be awaited before using its properties.
```

یعنی `params` را در Next 15 await نکرده‌اید: `const { slug } = await params`.

**خطای واقعی ۲:**

```text
Error: useActionState is not exported from 'react'
```

نسخه‌ی React کمتر از 19 است؛ `npm i react@19 react-dom@19` (یا از قالب جدید Next استفاده کنید).

**ایست بازرسی ۳ — امنیت env:** در باندل کلاینت جستجو کنید:

```bash
grep -r "SESSION_SECRET" .next/static || echo "not leaked"
# not leaked
```

اگر پیدا شد، متغیر را بدون `NEXT_PUBLIC_` در یک Client Component خوانده‌اید.

### نگاشت به معیارهای پذیرش

| معیار | کجای درس |
| --- | --- |
| `app-router` | بخش ۱ و ۲ |
| `ssg` | بخش ۳ و ۴ |
| `metadata` | بخش ۳ |
| `server-client` | بخش ۲ |
| `server-action` | بخش ۵ |
| `ui-states` | بخش ۶ |

## ۱۱. عیب‌یابی

| خطا | علت | راه‌حل |
| --- | --- | --- |
| `useState is not a function` در Server | هوک در Server Component | `"use client"` در برگ یا انتقال state |
| `window is not defined` | دسترسی در رندر سرور | `useEffect` یا بررسی محیط |
| `params should be awaited` | Next 15 | `await params` |
| داده به‌روز نمی‌شود | کش | `revalidatePath/Tag` یا `cache: 'no-store'` |
| راز در باندل | `NEXT_PUBLIC_` | انتقال به سرور |
| فرم بدون JS کار نمی‌کند | action سمت کلاینت | Server Action با `<form action={...}>` |
| build با نوع اشتباه | `params` تایپ‌نشده | `Promise<{...}>` |

## ۱۲. آزمایش‌ها (با پاسخ)

**۱.** چرا `fetch` در Next 15 به‌صورت پیش‌فرض کش نمی‌شود؟

**پاسخ:** رفتار پیش‌فرض برای داده‌ی شخصی/تازه امن‌تر است؛ با `cache: 'force-cache'` یا `next.revalidate` صریح کش کنید.

**۲.** تفاوت `revalidatePath` و `revalidateTag`؟

**پاسخ:** اولی مسیر را باطل می‌کند، دومی همه‌ی fetchهای دارای آن tag را (مثلاً `products`).

**۳.** چرا `error.tsx` باید Client باشد؟

**پاسخ:** خطا در مرز رندر رخ می‌دهد و نیاز به reset/تعامل دارد؛ هوک‌ها فقط در Client.

**۴.** چطور فرم بدون جاوااسکریپت هم کار کند؟

**پاسخ:** `<form action={serverAction}>`؛ مرورگر فرم را به سرور می‌فرستد و Next action را اجرا می‌کند.

## ۱۳. خودآزمایی

1. Server Component چه محدودیت‌هایی دارد؟
2. `generateStaticParams` چه کاری می‌کند؟
3. SSG، ISR و SSR را چه زمانی انتخاب می‌کنید؟
4. مرز `"use client"` را کجا می‌گذارید؟
5. Server Action چگونه امنیت ورودی را تضمین می‌کند؟
6. `loading.tsx` با `<Suspense>` چه تفاوتی دارد؟

## ۱۴. چک‌لیست تحویل

- [ ] ساختار `app/` با layout و مسیر پویا
- [ ] تفکیک درست Server/Client
- [ ] `generateStaticParams` + متادیتا
- [ ] ISR یا کش صریح مستند
- [ ] Server Action با اعتبارسنجی سرور
- [ ] loading/error/not-found
- [ ] رازها فقط سمت سرور
- [ ] `npm run build` بدون خطا
