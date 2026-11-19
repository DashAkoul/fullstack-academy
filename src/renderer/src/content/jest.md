# تست واحد با Jest (و Vitest)

> مراجع: [Jest Docs](https://jestjs.io/docs/getting-started) · [Vitest Docs](https://vitest.dev/) · [Testing Library](https://testing-library.com/docs/) · [MSW](https://mswjs.io/)

## در این درس چه یاد می‌گیرید؟

تست‌هایی می‌نویسید که رفتار را تضمین می‌کنند نه پیاده‌سازی را: ساختار تست، matcherها، کد غیرهمگام، mock و fake timer، تست کامپوننت با Testing Library و اندازه‌گیری پوشش. در پایان، منطق سبد خرید و یک کامپوننت فرم را با تست‌های پایدار پوشش می‌دهید.

---

## ۱. هرم تست و هدف

```
        /\        E2E (کم، کند، اطمینان بالا)
       /  \       Integration (متوسط)
      /____\      Unit (زیاد، سریع، ارزان)
```

- **Unit**: تابع خالص، reducer، validator.
- **Integration**: کامپوننت + چند ماژول، API + DB.
- **E2E**: مسیر کاربر در مرورگر واقعی (درس Playwright).

تست خوب: سریع، مستقل، تکرارپذیر، روی رفتار قابل مشاهده. تستی که با تغییر نام متغیر داخلی می‌شکند، تست خوبی نیست.

## ۲. راه‌اندازی

```bash
# Jest + TypeScript
npm i -D jest ts-jest @types/jest
npx jest --init

# یا Vitest (سریع‌تر، سازگار با Vite)
npm i -D vitest @vitest/coverage-v8
```

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: { provider: 'v8', reporter: ['text', 'html'], thresholds: { lines: 80 } }
  }
})
```

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:cov": "vitest run --coverage"
  }
}
```

API تقریباً یکسان است؛ تفاوت‌های اصلی: `vi` به‌جای `jest`، و Vitest نیاز به transform جدا ندارد.

## ۳. ساختار تست

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { calculateTotal, applyCoupon } from '../src/cart'

describe('calculateTotal', () => {
  it('جمع قیمت × تعداد را برمی‌گرداند', () => {
    const items = [
      { price: 100_000, qty: 2 },
      { price: 50_000, qty: 1 }
    ]
    expect(calculateTotal(items)).toBe(250_000)
  })

  it('برای سبد خالی صفر برمی‌گرداند', () => {
    expect(calculateTotal([])).toBe(0)
  })
})
```

```ts
// جدول‌محور: موارد مرزی را یکجا پوشش می‌دهد
it.each([
  { items: [], expected: 0 },
  { items: [{ price: 10, qty: 2 }], expected: 20 },
  { items: [{ price: 0, qty: 5 }], expected: 0 }
])('calculateTotal($items) = $expected', ({ items, expected }) => {
  expect(calculateTotal(items)).toBe(expected)
})
```

## ۴. Matcherهای پرکاربرد

```ts
expect(value).toBe(3)                 // برابری دقیق (Object.is)
expect(obj).toEqual({ a: 1 })         // برابری ساختاری
expect(obj).toStrictEqual({ a: 1 })   // + نوع/undefined
expect(arr).toContain('x')
expect(arr).toHaveLength(2)
expect(fn).toThrow(/نامعتبر/)
expect(value).toBeCloseTo(0.3, 5)
expect(mock).toHaveBeenCalledWith('id-1')
expect(fn).not.toHaveBeenCalled()
```

`toBe` برای آبجکت‌ها **اشتباه** است (مرجع مقایسه می‌شود). اعداد اعشاری را با `toBeCloseTo` تست کنید.

## ۵. کد غیرهمگام

```ts
it('پست را برمی‌گرداند', async () => {
  const post = await getPost('slug')
  expect(post.title).toBe('سلام')
})

it('برای ۴۰۴ خطا می‌دهد', async () => {
  await expect(getPost('missing')).rejects.toThrow('HTTP 404')
})

it('با fake timer تایمر را کنترل می‌کند', () => {
  vi.useFakeTimers()
  const spy = vi.fn()
  setTimeout(spy, 3000)
  vi.advanceTimersByTime(3000)
  expect(spy).toHaveBeenCalledTimes(1)
  vi.useRealTimers()
})
```

از `done` callback پرهیز کنید؛ `async/await` خواناتر و کم‌خطاتر است.

## ۶. Mock: چه چیزی را جدا کنیم؟

```ts
// ماژول
vi.mock('../src/lib/mailer', () => ({
  sendMail: vi.fn().mockResolvedValue({ id: 'm1' })
}))

import { sendMail } from '../src/lib/mailer'
import { register } from '../src/services/auth'

it('بعد از ثبت‌نام ایمیل می‌فرستد', async () => {
  await register({ email: 'a@b.com', password: 'secret123' })
  expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ to: 'a@b.com' }))
})
```

```ts
// spy روی متد
const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
// ...
expect(spy).toHaveBeenCalled()
spy.mockRestore()
```

| نوع | کاربرد |
| --- | --- |
| Stub | مقدار ثابت برمی‌گرداند |
| Spy | رفتار اصلی + ثبت فراخوانی |
| Mock | رفتار کامل جعلی |
| Fake | پیاده‌سازی سبک (مثلاً DB در حافظه) |

**قاعده:** فقط مرزهای بیرونی (شبکه، زمان، تصادفی، فایل، ایمیل) را mock کنید؛ منطق داخلی را نه.

> در Jest همین کد با `jest.mock`، `jest.fn()` و `jest.spyOn` نوشته می‌شود؛ نام‌ها یک‌به‌یک معادل‌اند. `jest.mock` هم hoist می‌شود، پس متغیرهای بیرونی را با نام `mock...` تعریف کنید یا `jest.hoisted` را به کار ببرید.

## ۷. تست کامپوننت با Testing Library

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { LoginForm } from '../src/LoginForm'

it('با ایمیل نامعتبر خطا نشان می‌دهد', async () => {
  const onSubmit = vi.fn()
  render(<LoginForm onSubmit={onSubmit} />)

  await userEvent.type(screen.getByLabelText('ایمیل'), 'not-an-email')
  await userEvent.click(screen.getByRole('button', { name: 'ورود' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('ایمیل معتبر نیست')
  expect(onSubmit).not.toHaveBeenCalled()
})

it('با ورودی معتبر ارسال می‌کند', async () => {
  const onSubmit = vi.fn()
  render(<LoginForm onSubmit={onSubmit} />)

  await userEvent.type(screen.getByLabelText('ایمیل'), 'a@b.com')
  await userEvent.type(screen.getByLabelText('رمز'), 'secret123')
  await userEvent.click(screen.getByRole('button', { name: 'ورود' }))

  expect(onSubmit).toHaveBeenCalledWith({ email: 'a@b.com', password: 'secret123' })
})
```

**اولویت queryها:** `getByRole` > `getByLabelText` > `getByText` > `getByTestId` (آخرین راه).

- `getBy` فوری است، `findBy` غیرهمگام (منتظر می‌ماند)، `queryBy` برای «نباید باشد».
- `userEvent` بهتر از `fireEvent` است (رفتار واقعی مرورگر).

## ۸. شبکه با MSW

```ts
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

const server = setupServer(
  http.get('/api/tasks', () =>
    HttpResponse.json({ data: [{ id: '1', title: 'تست' }] })
  )
)

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

it('لیست را نمایش می‌دهد', async () => {
  render(<TaskList />)
  expect(await screen.findByText('تست')).toBeInTheDocument()
})
```

MSW در سطح شبکه مداخله می‌کند، نه با mock کردن `fetch`؛ تست به کد واقعی نزدیک‌تر است.

## ۹. پوشش: عدد گمراه‌کننده

```bash
npm run test:cov
```

- `lines/branches/functions/statements` را ببینید ولی **هدف نباشید**.
- ۱۰۰٪ پوشش با assertion ضعیف بی‌فایده است.
- مسیرهای خطا و مرزها (خالی، صفر، منفی، طولانی) را پوشش دهید.
- کد تولیدشده/type-only را از coverage خارج کنید.

## ۱۰. تست پایدار (flaky-proof)

- هر تست state خودش را می‌سازد؛ بدون وابستگی به ترتیب.
- زمان و تصادفی را تزریق کنید (`clock`، `idGen`).
- از `sleep` واقعی پرهیز کنید؛ `findBy`/fake timer.
- پاک‌سازی: `afterEach` برای timer، server، DOM.
- تست را با اجرای تنها همان فایل دیباگ کنید: `vitest run path -t "name"`.
- در CI با `--runInBand` یا worker محدود اگر منابع کم است.

## ۱۱. ساخت گام‌به‌گام تست سبد خرید (تمرین)

**گام ۱ — کد قابل تست:** توابع خالص `calculateTotal`، `applyCoupon`، `reducer` را از UI جدا کنید.

**گام ۲ — تست واحد:** جمع، تخفیف درصدی، سقف تخفیف، کد نامعتبر، سبد خالی.

**گام ۳ — reducer:** add/remove/setQty با `it.each` (در Jest: `test.each`).

**گام ۴ — کامپوننت:** `CartSummary` تعداد و جمع را نشان دهد؛ با RTL و `getByRole`.

**گام ۵ — فرم:** `CouponForm` با اعتبارسنجی، خطا با `role="alert"`، فراخوانی callback.

**گام ۶ — شبکه:** MSW برای `GET /api/products` و حالت خطا.

**گام ۷ — پوشش:** آستانه‌ی ۸۰٪؛ بررسی branchهای پوشش‌نداده.

**گام ۸ — CI:** `npm test -- --coverage` در workflow.

### اجرای واقعی: تست، خطا و پوشش

```bash
npm test
#  ✓ src/cart.test.ts (4 tests) 18ms
#    ✓ calculateTotal (3)
#      ✓ جمع قیمت × تعداد را برمی‌گرداند
#      ✓ برای سبد خالی صفر برمی‌گرداند
#      ✓ موارد جدول را پوشش می‌دهد
#    ✓ applyCoupon (1)
#
#  Test Files  1 passed (1)
#       Tests  4 passed (4)
```

**یک تست را عمداً بشکنید** (مثلاً `toBe(250_001)`). خروجی واقعی:

```text
 FAIL  src/cart.test.ts > calculateTotal > جمع قیمت × تعداد را برمی‌گرداند
AssertionError: expected 250000 to be 250001 // Object.is equality

- Expected
+ Received

- 250001
+ 250000

 ❯ src/cart.test.ts:12:32
```

پیام دقیقاً می‌گوید کدام تست، چه انتظاری و چه مقدار واقعی. این را باگ تست یا باگ کد مقایسه کنید.

**پوشش:**

```bash
npm run test:cov
#  % Stmts | % Branch | % Funcs | % Lines
#     91.3 |    83.3 |   100   |   91.3
```

اگر آستانه را ۸۰ بگذارید و به ۷۹ برسید:

```text
ERROR: Coverage for branches (79%) does not meet global threshold (80%)
```

**ایست بازرسی ۱ — ایزولاسیون:** تست‌ها را به‌صورت تصادفی اجرا کنید:

```bash
npx vitest run --sequence.shuffle
```

اگر شکست خوردند، state مشترک یا ترتیب وابسته دارید.

**ایست بازرسی ۲ — تست غیرهمگام:** اگر `await` را جا بیندازید، تست سبز می‌شود ولی assertion اجرا نمی‌شود. همیشه `async` + `await` و برای خطا `rejects`:

```ts
await expect(getPost('missing')).rejects.toThrow('HTTP 404')
```

**ایست بازرسی ۳ — fake timer:**

```text
Error: Timed out in 5000ms. See https://vitest.dev/guide/common-errors
```

یعنی timer واقعی در حال انتظار است؛ `vi.useFakeTimers()` و `advanceTimersByTime` را اضافه کنید.

| خطا | علت | اصلاح |
| --- | --- | --- |
| `Cannot find module '@/...'` | alias | `resolve.alias` |
| `act(...)` warning | به‌روزرسانی خارج از act | `await userEvent` |
| `toBe` روی آبجکت | مقایسه‌ی مرجع | `toEqual` |
| تست فقط در CI شکست | TZ/ترتیب | `TZ=UTC` و ایزولاسیون |

### نگاشت به معیارهای پذیرش

| معیار | کجای درس |
| --- | --- |
| `structure` | بخش ۳ (describe/it با نام توصیفی) |
| `table` | بخش ۳ (`it.each` / `test.each`) |
| `mocks` | بخش ۶ (`jest.mock`/`jest.fn`، معادل `vi`) |
| `async` | بخش ۵ |
| `coverage` | بخش ۲ و ۹ (thresholds) |

## ۱۲. عیب‌یابی

| خطا | علت | راه‌حل |
| --- | --- | --- |
| `Cannot find module` | alias/config | `moduleNameMapper` یا `resolve.alias` |
| `toBe` روی آبجکت شکست می‌خورد | مقایسه‌ی مرجع | `toEqual` |
| تست غیرهمگام تمام می‌شود | بدون await | `async` + `await` |
| `act(...)` warning | به‌روزرسانی state خارج act | `await userEvent`/`findBy` |
| تست فقط در CI می‌شکند | منطقه‌زمانی/ترتیب | TZ ثابت، ایزولاسیون |
| mock برنمی‌گردد | hoisting | `vi.hoisted` یا import بعد از mock |
| timer واقعی کند است | sleep | fake timers |

## ۱۳. آزمایش‌ها (با پاسخ)

**۱.** چرا `toBe` برای `{a:1}` نامناسب است؟

**پاسخ:** مرجع دو آبجکت متفاوت است؛ `toEqual` ساختار را مقایسه می‌کند.

**۲.** چه چیزی را mock نکنیم؟

**پاسخ:** منطق داخلی و توابع خالص؛ فقط مرزهای بیرونی.

**۳.** تفاوت `getBy` و `findBy`؟

**پاسخ:** `findBy` برمی‌گردد Promise و تا ظاهر شدن/تایم‌اوت صبر می‌کند.

**۴.** چرا پوشش ۱۰۰٪ تضمین کیفیت نیست؟

**پاسخ:** خط اجرا شده ممکن است بدون assertion معنادار باشد؛ رفتار و مرزها مهم‌اند.

## ۱۴. خودآزمایی

1. هرم تست چیست؟
2. چهار matcher پرکاربرد؟
3. تست async را چطور می‌نویسید؟
4. mock، stub و spy چه تفاوتی دارند؟
5. چرا `getByRole` اولویت دارد؟
6. تست flaky را چطور رفع می‌کنید؟

## ۱۵. چک‌لیست تحویل

- [ ] تست واحد برای منطق خالص
- [ ] `it.each` برای موارد مرزی
- [ ] تست خطا با `rejects`/`alert`
- [ ] mock فقط برای مرزها
- [ ] تست کامپوننت با RTL
- [ ] MSW برای شبکه
- [ ] بدون warning `act`
- [ ] coverage ≥ آستانه
- [ ] اجرای تست در CI
