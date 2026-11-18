# مبانی تایپ‌اسکریپت

> مرجع اصلی: [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)

تایپ‌اسکریپت یک لایه‌ی تایپ روی جاوااسکریپت است که *قبل از اجرا* اشتباهات را پیدا می‌کند. تایپ‌ها در نهایت حذف می‌شوند؛ چیزی به خروجی اضافه نمی‌کنند.

## ۱. راه‌اندازی

```bash
npm create vite@latest my-app -- --template react-ts
# یا دستی
npm i -D typescript && npx tsc --init
```

`tsconfig.json` سخت‌گیرانه و مدرن:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "skipLibCheck": true,
    "noEmit": true
  }
}
```

`strict: true` مجموعه‌ای از بررسی‌ها (از جمله `strictNullChecks` و `noImplicitAny`) را فعال می‌کند. هرگز آن را خاموش نکنید.

## ۲. انواع پایه

```ts
let title: string = 'آکادمی'
let count: number = 42
let active: boolean = true
let tags: string[] = ['ts', 'react']
let pair: [string, number] = ['age', 30]
let anything: unknown = JSON.parse('{}')   // unknown امن است، any فرار از تایپ
```

`unknown` را قبل از استفاده باید narrow کنید؛ `any` همه‌ی محافظت‌ها را دور می‌زند.

## ۳. `interface` یا `type`؟

```ts
interface User {
  id: string
  name: string
  email?: string          // اختیاری
  readonly createdAt: Date
}

type UserId = string
type Status = 'idle' | 'loading' | 'success' | 'error'
```

- `interface` را برای شکل آبجکت‌ها و قراردادهای قابل گسترش (`extends`) بگیرید.
- `type` را برای union، tuple، mapped type و ترکیب‌ها.
- تفاوت عملی مهم: interface قابل declaration merging است؛ type نه.

## ۴. Narrowing — قلب امنیت تایپ

```ts
function format(value: string | number): string {
  if (typeof value === 'number') return value.toFixed(2)  // اینجا number است
  return value.trim()                                     // اینجا string
}

function isUser(x: unknown): x is User {
  return typeof x === 'object' && x !== null && 'id' in x
}
```

روش‌های narrowing: `typeof`، `instanceof`، `in`، برابری، و **type predicate** برای داده‌های خارجی (پاسخ API).

## ۵. Discriminated Union — الگوی طلایی مدل‌سازی

به‌جای چند فیلد اختیاری که هر ترکیبی از آن‌ها ممکن است، حالت‌ها را صریح کن:

```ts
type Discount =
  | { kind: 'percent'; value: number }        // 0..100
  | { kind: 'fixed'; amount: number }         // ریال
  | { kind: 'buyXGetY'; buy: number; free: number }

function applyDiscount(total: number, d: Discount): number {
  switch (d.kind) {
    case 'percent':
      return total - (total * d.value) / 100
    case 'fixed':
      return Math.max(0, total - d.amount)
    case 'buyXGetY':
      return total // محاسبه در سطح آیتم انجام می‌شود
    default: {
      const _exhaustive: never = d
      return _exhaustive
    }
  }
}
```

خط `never` باعث می‌شود اگر فردا حالت جدیدی اضافه کنید و اینجا را فراموش کنید، **کامپایل خطا بدهد**. این همان «بررسی جامعیت» است.

## ۶. Generics

```ts
function groupBy<T, K extends PropertyKey>(items: T[], keyOf: (item: T) => K): Record<K, T[]> {
  const out = {} as Record<K, T[]>
  for (const item of items) {
    const key = keyOf(item)
    ;(out[key] ??= []).push(item)
  }
  return out
}

const byCategory = groupBy(products, (p) => p.category)
// نوع: Record<string, Product[]>
```

Generic یعنی «تایپ را به‌عنوان پارامتر بگیر» تا کد هم بازاستفاده شود، هم تایپ‌امن بماند.

قواعد وابستگی با `extends`:

```ts
function pick<T, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> { /* ... */ }
```

## ۷. Utility Types

```ts
type UserUpdate = Partial<User>              // همه اختیاری
type UserPreview = Pick<User, 'id' | 'name'> // فقط چند فیلد
type UserWithoutEmail = Omit<User, 'email'>  // حذف فیلد
type UsersById = Record<string, User>        // نقشه
type ReadonlyUser = Readonly<User>           // غیرقابل تغییر
type NonNullUser = NonNullable<User | null>
```

## ۸. کار با DOM و `strict`

```ts
const form = document.querySelector<HTMLFormElement>('#search')
if (!form) throw new Error('فرم پیدا نشد')

form.addEventListener('submit', (event) => {
  event.preventDefault()
  const data = new FormData(form)
  const q = String(data.get('q') ?? '').trim()
})
```

با `strictNullChecks`، `querySelector` می‌تواند `null` باشد؛ بررسی‌اش وظیفه‌ی شماست — و همین منشأ بسیاری از باگ‌های واقعی است.

## ۹. تایپ داده‌ی خارجی: `unknown` + Zod

پاسخ API قابل اعتماد نیست. `as User` نوشتن یعنی دروغ گفتن به کامپایلر.

```ts
import { z } from 'zod'

const UserSchema = z.object({
  id: z.number(),
  login: z.string(),
  public_repos: z.number()
})

const user = UserSchema.parse(await res.json()) // اگر شکل داده غلط باشد، خطا می‌دهد
```

## ۱۰. خطاهای رایج تازه‌کارها

| خطا | راه‌حل |
| --- | --- |
| استفاده از `any` برای ساکت کردن کامپایلر | `unknown` + narrowing |
| `as SomeType` روی داده‌ی شبکه | schema validation |
| `!` غیرضروری (`user!.name`) | بررسی واقعی `if (!user) return` |
| unionهای بی‌شمار به‌جای یک discriminated union | فیلد `kind`/`type` اضافه کنید |
| تایپ‌های تکراری در چند فایل | یک فایل `types.ts` مشترک |

## تمرین این درس

هسته‌ی سبد خرید یک فروشگاه را با تایپ‌اسکریپت strict بنویسید: انواع Product/CartItem/Cart، توابع immutable، تخفیف به‌صورت discriminated union با بررسی exhaustive، و یک `groupBy` جنریک. جزئیات در تب تمرین است.
