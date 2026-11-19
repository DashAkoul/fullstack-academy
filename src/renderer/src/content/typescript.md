# مبانی تایپ‌اسکریپت

> مرجع اصلی: [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html) · [Everyday Types](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html) · [Type Challenges](https://github.com/type-challenges/type-challenges)

## در این درس چه یاد می‌گیرید؟

هدف این درس «اضافه کردن `:string` به کد» نیست؛ هدف این است که **مدل داده را با تایپ طراحی کنید** تا کامپایلر بخشی از تست‌های شما را انجام دهد. در پایان یک هسته‌ی سبد خرید با تایپ‌های دقیق، توابع بدون side effect، تخفیف‌های discriminated union و یک `groupBy` جنریک می‌نویسید.

---

## ۱. تایپ‌اسکریپت در یک نگاه

```
TS source ──tsc──▶ JavaScript + type checking
```

- تایپ‌ها فقط در زمان کامپایل وجود دارند؛ در خروجی حذف می‌شوند.
- `tsc` دو کار می‌کند: بررسی تایپ و حذف تایپ‌ها (در Vite، esbuild تایپ‌ها را حذف می‌کند و `tsc --noEmit` جدا بررسی می‌کند).
- تایپ‌اسکریپت **کافی نیست** برای داده‌ی خارجی؛ پاسخ API را باید در زمان اجرا اعتبارسنجی کنید (بخش ۹).

```bash
npm create vite@latest cart -- --template vanilla-ts
npx tsc --noEmit          # بررسی بدون تولید فایل
```

## ۲. `tsconfig` سخت‌گیرانه: چرا هر فلگ مهم است

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023", "DOM"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "noUnusedLocals": true,
    "noEmit": true,
    "verbatimModuleSyntax": true
  }
}
```

| فلگ | چه چیزی را می‌گیرد |
| --- | --- |
| `strict` | مجموعه‌ای شامل `strictNullChecks` و `noImplicitAny` |
| `noUncheckedIndexedAccess` | `arr[0]` را `T \| undefined` می‌کند؛ منبع باگ‌های واقعی |
| `exactOptionalPropertyTypes` | تفاوت `foo?: string` با `foo: string \| undefined` |
| `verbatimModuleSyntax` | مجبور می‌کند `import type` را صریح بنویسید |

`strict` را هرگز خاموش نکنید. اگر روی کد قدیمی است، به‌تدریج فایل‌ها را با `// @ts-strict-ignore` جدا کنید، نه کل پروژه.

## ۳. استنتاج (Inference) و انواع لیترال

```ts
let title = 'آکادمی'        // string  (widening)
const fixed = 'آکادمی'      // "آکادمی" (literal)
const config = { mode: 'dark' }        // { mode: string }
const config2 = { mode: 'dark' } as const  // { readonly mode: "dark" }
```

- `let` نوع را گسترده می‌کند، `const` لیترال را نگه می‌دارد.
- `as const` همه چیز را `readonly` و لیترال می‌کند — عالی برای نقشه‌ی وضعیت‌ها.
- `satisfies` بررسی می‌کند بدون از دست دادن نوع دقیق:

```ts
const routes = {
  home: '/',
  blog: '/blog'
} satisfies Record<string, `/${string}`>

type RouteName = keyof typeof routes // "home" | "blog"
```

## ۴. `interface` یا `type`؟

```ts
interface User {
  readonly id: string
  name: string
  email?: string
}

type Status = 'idle' | 'loading' | 'success' | 'error'
type UserId = string
```

- `interface` برای شکل آبجکت و قرارداد قابل گسترش (`extends`، declaration merging).
- `type` برای union، tuple، mapped/conditional type و ترکیب‌ها.
- تفاوت عملکردی مهم: interface را می‌توان دوباره باز کرد و ادغام کرد؛ type نه.

**آبجکت تودرتو را با تایپ جدا مدل کنید**؛ تایپ‌های خیلی بزرگ و تودرتو پیام‌های خطای وحشتناک می‌دهند.

## ۵. Narrowing: قلب ایمنی تایپ

```ts
function format(value: string | number | Date): string {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number') return value.toFixed(2)
  return value.toISOString()             // اینجا Date است
}
```

```ts
type Shape =
  | { kind: 'circle'; r: number }
  | { kind: 'rect'; w: number; h: number }

function area(shape: Shape): number {
  switch (shape.kind) {
    case 'circle':
      return Math.PI * shape.r ** 2
    case 'rect':
      return shape.w * shape.h
    default: {
      const _exhaustive: never = shape
      return _exhaustive
    }
  }
}
```

خط `never` تضمین می‌کند اگر فردا `{kind:'triangle'}` اضافه کنید و اینجا را فراموش کنید، **کامپایل خطا بدهد**. این الگو را در همه‌ی switchهای وضعیت استفاده کنید.

**Type predicate برای داده‌ی خارجی:**

```ts
function isUser(value: unknown): value is User {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    typeof (value as { id: unknown }).id === 'string'
  )
}
```

**Assertion function:**

```ts
function assertUser(value: unknown): asserts value is User {
  if (!isUser(value)) throw new Error('داده‌ی کاربر نامعتبر است')
}
```

## ۶. Generics: تایپ را پارامتر بگیر

```ts
function first<T>(items: readonly T[]): T | undefined {
  return items[0]
}

function groupBy<T, K extends PropertyKey>(
  items: readonly T[],
  keyOf: (item: T) => K
): Record<K, T[]> {
  const out = {} as Record<K, T[]>
  for (const item of items) {
    const key = keyOf(item)
    ;(out[key] ??= []).push(item)
  }
  return out
}

const byCategory = groupBy(products, (p) => p.category) // Record<Category, Product[]>
```

قواعد:

- `K extends PropertyKey` تضمین می‌کند کلید قابل استفاده در آبجکت باشد.
- برای آرایه‌ی ورودی `readonly T[]` بنویسید تا تابع با آرایه‌ی readonly هم کار کند.
- Generic را وقتی استفاده کنید که **رابطه‌ی بین ورودی و خروجی** مهم است؛ برای `any` تایپ‌دار استفاده نکنید.

```ts
async function getJson<T>(url: string, parse: (v: unknown) => T): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return parse(await res.json())
}
```

## ۷. Utility Types و اپراتورهای تایپ

```ts
type UserUpdate = Partial<User>
type UserPreview = Pick<User, 'id' | 'name'>
type UserNoEmail = Omit<User, 'email'>
type UsersById = Record<string, User>
type ReadonlyUser = Readonly<User>
type MaybeUser = NonNullable<User | null | undefined>
```

```ts
type Keys = keyof User                 // "id" | "name" | "email"
type NameType = User['name']           // string
type UserMap = { [K in keyof User]: User[K][] }   // mapped
type OnlyStrings = Extract<string | number, string> // string
type WithoutNull = Exclude<string | null, null>     // string
```

این‌ها را زیاد استفاده می‌کنید: `Partial` در به‌روزرسانی، `Pick/Omit` در DTO، `Record` در نقشه‌ها.

## ۸. `unknown` در برابر `any`

| | `any` | `unknown` |
| --- | --- | --- |
| اجازه‌ی هر کاری | ✅ | ❌ تا narrow نشود |
| ایمنی | از بین می‌رود | حفظ می‌شود |
| کاربرد | کد قدیمی/escape hatch | داده‌ی خارجی |

```ts
const data: unknown = JSON.parse(input)
// data.name ❌
if (isUser(data)) console.log(data.name) // ✅
```

هر بار که `as SomeType` روی پاسخ API می‌نویسید، به کامپایلر دروغ گفته‌اید. از schema validation استفاده کنید.

## ۹. مرز واقعی: اعتبارسنجی داده‌ی شبکه با Zod

```ts
import { z } from 'zod'

export const ProductSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  price: z.number().int().nonnegative(),
  category: z.enum(['book', 'course', 'tool'])
})

export type Product = z.infer<typeof ProductSchema>

export function parseProducts(input: unknown): Product[] {
  const result = z.array(ProductSchema).safeParse(input)
  if (!result.success) {
    console.error(result.error.issues)
    throw new Error('ساختار پاسخ API نامعتبر است')
  }
  return result.data
}
```

تایپ را از schema بگیرید تا یک منبع حقیقت داشته باشید.

## ۱۰. ساخت گام‌به‌گام هسته‌ی سبد خرید (تمرین)

**گام ۱ — مدل داده**

```ts
export interface Product {
  readonly id: string
  readonly title: string
  readonly price: number
  readonly category: string
}

export interface CartItem {
  readonly product: Product
  readonly quantity: number
}

export interface Cart {
  readonly items: readonly CartItem[]
}
```

**گام ۲ — توابع بدون تغییر ورودی**

```ts
export function addItem(cart: Cart, product: Product, quantity = 1): Cart {
  const existing = cart.items.find((i) => i.product.id === product.id)
  if (existing) {
    return {
      items: cart.items.map((i) =>
        i.product.id === product.id ? { ...i, quantity: i.quantity + quantity } : i
      )
    }
  }
  return { items: [...cart.items, { product, quantity }] }
}

export function updateQuantity(cart: Cart, id: string, quantity: number): Cart {
  const next = Math.max(0, Math.trunc(quantity))
  return {
    items: cart.items
      .map((i) => (i.product.id === id ? { ...i, quantity: next } : i))
      .filter((i) => i.quantity > 0)
  }
}
```

**گام ۳ — تخفیف‌ها به‌صورت discriminated union**

```ts
export type Discount =
  | { kind: 'percent'; value: number }
  | { kind: 'fixed'; amount: number }
  | { kind: 'buyXGetY'; buy: number; free: number }

export function applyDiscount(subtotal: number, discount: Discount): number {
  switch (discount.kind) {
    case 'percent':
      return Math.round(subtotal * (1 - clamp(discount.value, 0, 100) / 100))
    case 'fixed':
      return Math.max(0, subtotal - discount.amount)
    case 'buyXGetY':
      return subtotal // در سطح آیتم اعمال می‌شود
    default: {
      const _never: never = discount
      return _never
    }
  }
}
```

**گام ۴ — جمع کل و `groupBy`**

```ts
export const subtotal = (cart: Cart): number =>
  cart.items.reduce((sum, i) => sum + i.product.price * i.quantity, 0)

const byCategory = groupBy(cart.items, (i) => i.product.category)
// Record<string, CartItem[]>
```

**گام ۵ — تست**: با Vitest یا حتی `node --test`؛ موارد مرزی: سبد خالی، quantity صفر، تخفیف ۱۲۰٪، تخفیف بیشتر از جمع.

### اجرای واقعی: کامپایلر چه می‌گوید؟

پروژه‌ی کوچک بسازید:

```bash
mkdir fsa-03-demo && cd fsa-03-demo
npm init -y
npm i -D typescript
npx tsc --init --strict
```

فایل `src/cart.ts` را با این کد اشتباه بنویسید:

```ts
type Cart = { items: readonly string[] }
const cart: Cart = { items: [] }
cart.items.push('book')
```

```bash
npx tsc --noEmit
# خروجی واقعی:
src/cart.ts(3,12): error TS2339: Property 'push' does not exist on type 'readonly string[]'.
```

پیام دقیقاً می‌گوید **چه چیزی** و **کجا**. اصلاح immutable:

```ts
type Cart = { items: readonly string[] }
const cart: Cart = { items: [] }
const next: Cart = { ...cart, items: [...cart.items, 'book'] }
```

```bash
npx tsc --noEmit && echo OK
# OK
```

**بررسی exhaustive بودن union:**

```ts
type Discount =
  | { kind: 'percent'; value: number }
  | { kind: 'fixed'; value: number }
  | { kind: 'bogo'; buy: number; free: number }

function label(d: Discount): string {
  switch (d.kind) {
    case 'percent': return `${d.value}%`
    case 'fixed': return `${d.value} تومان`
  }
}
```

```bash
npx tsc --noEmit
# src/discount.ts(9,5): error TS2366: Function lacks ending return statement
# and return type does not include 'undefined'.
```

چرا؟ چون حالت `bogo` پوشش داده نشده. این همان چیزی است که `never` را الزامی می‌کند:

```ts
default: {
  const never: never = d
  return never
}
```

**ایست بازرسی:** `npx tsc --noEmit` باید **هیچ خروجی‌ای** نداشته باشد. هر خط خروجی یک خطای واقعی است؛ آن را نادیده نگیرید و `any` اضافه نکنید.

| خطا | معنا | راه‌حل |
| --- | --- | --- |
| `TS2339` | پراپرتی روی تایپ نیست | تایپ را درست کنید یا narrow کنید |
| `TS2345` | آرگومان ناسازگار | امضای تابع/نوع ورودی |
| `TS18048` | ممکن است undefined باشد | بررسی `if` یا مقدار پیش‌فرض |
| `TS2322` | نوع قابل انتساب نیست | اتحاد/جنریک را بررسی کنید |

### نگاشت به معیارهای پذیرش

| معیار | کجای درس |
| --- | --- |
| `strict` | بخش ۲ |
| `types` | بخش ۳ تا ۵ و گام ۱ |
| `union` | بخش ۵ و گام ۳ |
| `generic` | بخش ۶ و گام ۴ |
| `immutable` | گام ۲ |
| `utility` | بخش ۷ |

## ۱۱. خطاهای پرتکرار کامپایلر و ریشه‌شان

| پیام | معنا | راه‌حل |
| --- | --- | --- |
| `Type 'X' is not assignable to type 'Y'` | شکل داده مطابق قرارداد نیست | interface یا داده را اصلاح کنید، نه `as` |
| `Object is possibly 'undefined'` | `strictNullChecks` | بررسی واقعی `if (!x) return` یا مقدار پیش‌فرض |
| `Property does not exist on type 'unknown'` | داده‌ی خارجی | type guard/schema |
| `Argument of type ... not assignable` | امضای تابع | پارامتر را دقیق تایپ کنید |
| `Cannot find module './x'` | مسیر/پسوند/`paths` | `moduleResolution` و `paths` را هم‌راستا کنید |
| `Conversion of type ... may be a mistake` | `as` ناسازگار | ابتدا `unknown` سپس guard |

## ۱۲. آزمایش‌ها (با پاسخ)

**۱.** چرا `const user: User = { id: 1 }` خطا می‌دهد ولی `const user = { id: 1 }` نه؟

**پاسخ:** در حالت اول قرارداد `User` اعمال می‌شود و `id` باید string باشد؛ در حالت دوم فقط استنتاج است.

**۲.** این تابع چه تایپی برمی‌گرداند و چرا؟

```ts
function pick<T, K extends keyof T>(obj: T, keys: K[]): Pick<T, K>
```

**پاسخ:** آبجکتی با فقط کلیدهای داده‌شده و همان تایپ مقادیر؛ `K` تضمین می‌کند کلید ناموجود قابل ارسال نیست.

**۳.** چرا `if (err instanceof Error)` بهتر از `catch (err: any)` است؟

**پاسخ:** چون تایپ را narrow می‌کند و امکان بررسی امن `err.message` می‌دهد؛ در TS 4.4+ `useUnknownInCatchVariables` این را پیش‌فرض می‌کند.

**۴.** چه تفاوتی بین `readonly string[]` و `ReadonlyArray<string>` هست؟

**پاسخ:** هر دو یک معنا دارند؛ `readonly T[]` سینتکس کوتاه است. آرایه‌ی readonly متدهای تغییردهنده ندارد.

## ۱۳. خودآزمایی

1. `unknown` را چرا به `any` ترجیح می‌دهیم؟
2. `never` در بررسی exhaustive چه نقشی دارد؟
3. چه زمانی `interface` و چه زمانی `type`؟
4. `satisfies` چه مشکلی را حل می‌کند؟
5. چرا `noUncheckedIndexedAccess` باگ‌های واقعی را کم می‌کند؟
6. تفاوت `Partial<T>` و `Readonly<Partial<T>>`؟

## ۱۴. چک‌لیست تحویل

- [ ] `strict: true` و بدون `any` غیرضروری
- [ ] انواع دامنه با `interface`/`type` و `readonly` مناسب
- [ ] تخفیف به‌صورت discriminated union با بررسی `never`
- [ ] `groupBy` جنریک با `K extends PropertyKey`
- [ ] توابع سبد خرید ورودی را تغییر نمی‌دهند
- [ ] حداقل یک utility type
- [ ] اعتبارسنجی ورودی/پاسخ API (Zod یا معادل)
- [ ] تست موارد مرزی
