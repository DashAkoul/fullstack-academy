# تست واحد با Jest

> مراجع: [Jest Docs](https://jestjs.io/docs/getting-started) · [Testing Library](https://testing-library.com/docs/react-testing-library/intro/)

تست واحد سریع، ایزوله و قابل تکرار است. هدفش این نیست که «پوشش ۱۰۰٪» بسازیم؛ هدف این است که تغییرات آینده نترسناک شوند.

## ۱. راه‌اندازی

```bash
npm i -D jest ts-jest @types/jest
# یا با Vitest (سازگار با APی Jest و سریع‌تر در Vite)
npm i -D vitest
```

```json
// jest.config.ts
import type { Config } from 'jest'

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts'],
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts', '!src/server.ts'],
  coverageThreshold: {
    global: { branches: 75, functions: 80, lines: 80, statements: 80 }
  }
}

export default config
```

```bash
npx jest --watch          # حالت تعاملی
npx jest --coverage       # گزارش پوشش
```

## ۲. ساختار AAA

```ts
import { calculateInvoice } from '../invoice'

describe('calculateInvoice', () => {
  it('جمع اقلام را با مالیات ۹٪ محاسبه می‌کند', () => {
    // Arrange
    const items = [{ price: 100_000, qty: 2 }, { price: 50_000, qty: 1 }]

    // Act
    const total = calculateInvoice(items)

    // Assert
    expect(total).toBe(254_250)
  })
})
```

نام تست باید رفتار را توصیف کند: `it('برای سبد خالی صفر برمی‌گرداند')` نه `it('تست ۱')`.

## ۳. matcherهای پرکاربرد

```ts
expect(value).toBe(3)                        // برابری دقیق (Object.is)
expect(obj).toEqual({ a: 1 })                // ساختاری
expect(arr).toHaveLength(3)
expect(arr).toContain('x')
expect(fn).toThrow('پیام')
expect(fn).toThrow(/الگو/)
expect(value).toBeGreaterThan(0)
expect(value).toBeCloseTo(0.30000000000000004, 5)
expect(value).toBeNull()
expect(value).toBeTruthy()
```

تفاوت `toBe` و `toEqual` را جدی بگیرید: برای آبجکت/آرایه `toEqual` (یا `toStrictEqual`) استفاده کنید.

## ۴. تست جدول‌محور

```ts
describe('applyDiscount', () => {
  it.each([
    { total: 1000, discount: 10, expected: 900 },
    { total: 1000, discount: 0, expected: 1000 },
    { total: 500, discount: 100, expected: 0 },
    { total: 0, discount: 50, expected: 0 }
  ])('برای $total با $discount٪ تخفیف → $expected', ({ total, discount, expected }) => {
    expect(applyDiscount(total, discount)).toBe(expected)
  })
})
```

این الگو موارد مرزی (۰، منفی، سقف) را ارزان پوشش می‌دهد.

## ۵. Mock کردن وابستگی‌ها

کد باید تست‌پذیر نوشته شود: وابستگی خارجی را **تزریق** کنید.

```ts
// payment.ts
export interface Gateway {
  charge(amount: number, token: string): Promise<{ id: string; status: 'ok' | 'failed' }>
}

export async function pay(order: { total: number }, token: string, gateway: Gateway) {
  if (order.total <= 0) throw new Error('مبلغ نامعتبر')
  const result = await gateway.charge(order.total, token)
  if (result.status !== 'ok') throw new Error('پرداخت ناموفق')
  return { paymentId: result.id }
}
```

```ts
// payment.test.ts
const okGateway: Gateway = {
  charge: jest.fn().mockResolvedValue({ id: 'p_1', status: 'ok' })
}

it('شناسه پرداخت را برمی‌گرداند', async () => {
  const res = await pay({ total: 100_000 }, 'tok', okGateway)
  expect(res).toEqual({ paymentId: 'p_1' })
  expect(okGateway.charge).toHaveBeenCalledWith(100_000, 'tok')
})

it('برای مبلغ صفر خطا می‌دهد و درگاه را صدا نمی‌زند', async () => {
  await expect(pay({ total: 0 }, 'tok', okGateway)).rejects.toThrow('مبلغ نامعتبر')
  expect(okGateway.charge).not.toHaveBeenCalled()
})
```

```ts
// ماژول‌محور
jest.mock('../lib/gateway', () => ({
  charge: jest.fn().mockResolvedValue({ id: 'p_1', status: 'ok' })
}))
```

## ۶. تست کد ناهمگام

```ts
it('در خطای شبکه reject می‌شود', async () => {
  const gw: Gateway = { charge: jest.fn().mockRejectedValue(new Error('timeout')) }
  await expect(pay({ total: 10 }, 't', gw)).rejects.toThrow('timeout')
})

it('با تایمر جعلی، timeout را بررسی می‌کند', () => {
  jest.useFakeTimers()
  const onTimeout = jest.fn()
  scheduleTimeout(onTimeout, 5000)
  jest.advanceTimersByTime(5000)
  expect(onTimeout).toHaveBeenCalledTimes(1)
  jest.useRealTimers()
})
```

## ۷. beforeEach و پاک‌سازی

```ts
let db: InMemoryStore

beforeEach(() => {
  db = new InMemoryStore()
  jest.clearAllMocks()      // شمارنده‌ی فراخوانی mockها را صفر می‌کند
})
```

اگر تست‌ها به هم وابسته باشند، شکست یکی باعث آبشار می‌شود. هر تست باید از صفر شروع کند.

## ۸. تست کامپوننت React

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TaskForm } from './TaskForm'

it('وظیفه خالی را اضافه نمی‌کند', async () => {
  const onSubmit = jest.fn()
  render(<TaskForm onSubmit={onSubmit} />)

  await userEvent.click(screen.getByRole('button', { name: 'افزودن' }))
  expect(onSubmit).not.toHaveBeenCalled()
})

it('عنوان را trim کرده و ارسال می‌کند', async () => {
  const onSubmit = jest.fn()
  render(<TaskForm onSubmit={onSubmit} />)

  await userEvent.type(screen.getByLabelText('عنوان'), '  خرید نان  ')
  await userEvent.click(screen.getByRole('button', { name: 'افزودن' }))

  expect(onSubmit).toHaveBeenCalledWith('خرید نان')
})
```

قواعد:

- با نقش و نام (role/label) کوئری کنید، نه `className`.
- رفتار کاربر را تست کنید، نه جزئیات پیاده‌سازی (state داخلی).
- روی `await` برای `userEvent` دقت کنید.

## ۹. TDD در عمل

چرخه‌ی Red → Green → Refactor:

1. یک تست کوچک بنویسید که شکست بخورد.
2. کمترین کد برای پاس شدن بنویسید.
3. بازنویسی کنید، تست‌ها همچنان پاس.

TDD برای منطق دامنه (محاسبات، اعتبارسنجی، reducerها) عالی است؛ برای UI اکتشافی کمتر.

## ۱۰. آنچه نباید تست کنید

- کتابخانه‌های خارجی (خودشان تست دارند).
- جزئیات پیاده‌سازی (نام تابع خصوصی، تعداد رندر).
- تست شکننده‌ای که با تغییر یک متن ساده می‌شکند ولی رفتار عوض نشده.

## ۱۱. اشکال‌زدایی تست

```bash
npx jest -t "نام تست"      # فقط یک تست
npx jest --detectOpenHandles
npx jest --runInBand
```

خطای رایج: `Jest did not exit one second after...` → یک تایمر/اتصال باز مانده است.

## تمرین این درس

ماژول فاکتور و پرداخت: تست‌های table-driven برای فاکتور، mock کردن درگاه با سناریوهای موفق/ناموفق/timeout، و آستانه‌ی پوشش در پیکربندی. جزئیات در تب تمرین است.
