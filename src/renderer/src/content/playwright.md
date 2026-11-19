# تست End-to-End با Playwright

> مراجع: [Playwright Docs](https://playwright.dev/docs/intro) · [Best Practices](https://playwright.dev/docs/best-practices) · [Trace Viewer](https://playwright.dev/docs/trace-viewer)

## در این درس چه یاد می‌گیرید؟

تست‌هایی می‌نویسید که مثل کاربر واقعی در مرورگر کار می‌کنند و پایدار می‌مانند: locator مقاوم، انتظار خودکار، احراز هویت یک‌بار، mock شبکه، اشکال‌زدایی با Trace و اجرا در CI. در پایان، مسیر خرید یک فروشگاه را end-to-end تست می‌کنید.

---

## ۱. E2E کجا ارزش دارد؟

E2E برای **مسیرهای حیاتی کسب‌وکار** است: ثبت‌نام، ورود، پرداخت، ساخت سفارش، انتشار محتوا.

- کند و شکننده است → تعداد کم، انتخاب دقیق.
- چیزهایی که unit/integration پوشش می‌دهند را تکرار نکنید.
- E2E واقعی: مرورگر + سرور + دیتابیس (یا محیط staging).

```bash
npm init playwright@latest
npx playwright install --with-deps
npx playwright test
npx playwright test --ui
npx playwright show-report
```

## ۲. پیکربندی

```ts
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } }
  ],
  webServer: {
    command: 'npm run preview',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000
  }
})
```

`webServer` اپ را قبل از تست بالا می‌آورد و بعد می‌بندد.

## ۳. Locator: مقاوم در برابر تغییر UI

```ts
// ✅ نقش و نام قابل مشاهده (مثل کاربر و screen reader)
page.getByRole('button', { name: 'افزودن به سبد' })
page.getByRole('heading', { name: 'سبد خرید' })
page.getByLabel('ایمیل')
page.getByPlaceholder('جستجو…')
page.getByText('سفارش ثبت شد')

// ⚠️ آخرین راه
page.getByTestId('checkout-total')
```

**هرگز** از CSS/XPath شکننده مثل `div > div:nth-child(3) span` استفاده نکنید (مگر ناچار با توضیح).

```ts
const row = page.getByRole('row', { name: /پیتزا/ })
await row.getByRole('button', { name: 'حذف' }).click()
```

Playwright در حالت strict است: اگر locator چند عنصر پیدا کند، خطا می‌دهد؛ همین باعث می‌شود تست مبهم نباشد. برای چند عنصر: `.first()`, `.nth(0)`, `.filter({ hasText })`.

## ۴. انتظار خودکار (بدون sleep)

```ts
// ✅ web-first assertion: تا شرط برقرار نشود صبر می‌کند
await expect(page.getByRole('heading', { name: 'سبد خرید' })).toBeVisible()
await expect(page.getByTestId('total')).toHaveText('۲۵۰٬۰۰۰ تومان')
await expect(page.getByRole('alert')).toContainText('موجودی کافی نیست')

// ❌ شکننده و کند
await page.waitForTimeout(2000)
```

Actionها (`click`, `fill`) هم خودشان منتظر actionable بودن (visible, enabled, stable) می‌مانند.

## ۵. تست کامل یک مسیر

```ts
// e2e/checkout.spec.ts
import { test, expect } from '@playwright/test'

test.describe('خرید', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'افزودن پیتزا به سبد' }).click()
    await page.getByRole('link', { name: 'سبد خرید' }).click()
  })

  test('کاربر می‌تواند سفارش را ثبت کند', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'سبد خرید' })).toBeVisible()
    await page.getByLabel('نام').fill('سارا')
    await page.getByLabel('آدرس').fill('تهران، خیابان ولیعصر')
    await page.getByRole('button', { name: 'ثبت سفارش' }).click()

    await expect(page.getByRole('status')).toContainText('سفارش شما ثبت شد')
    await expect(page).toHaveURL(/\/orders\/\d+/)
  })

  test('خطای اعتبارسنجی نمایش داده می‌شود', async ({ page }) => {
    await page.getByRole('button', { name: 'ثبت سفارش' }).click()
    await expect(page.getByRole('alert')).toContainText('نام الزامی است')
    await expect(page).toHaveURL(/\/cart/)
  })
})
```

### Page Object Model: وقتی تست‌ها زیاد می‌شوند

منطق صفحه را یک‌بار بنویسید و در چند تست استفاده کنید:

```ts
// e2e/pages/cart.page.ts
import { type Page, expect } from '@playwright/test'

export class CartPage {
  constructor(private readonly page: Page) {}

  async goto() {
    await this.page.goto('/cart')
    await expect(this.page.getByRole('heading', { name: 'سبد خرید' })).toBeVisible()
  }

  async fillCustomer(name: string, address: string) {
    await this.page.getByLabel('نام').fill(name)
    await this.page.getByLabel('آدرس').fill(address)
  }

  async submit() {
    await this.page.getByRole('button', { name: 'ثبت سفارش' }).click()
  }

  get confirmation() {
    return this.page.getByRole('status')
  }
}
```

```ts
// تست
import { CartPage } from './pages/cart.page'

test('ثبت سفارش', async ({ page }) => {
  const cart = new CartPage(page)
  await cart.goto()
  await cart.fillCustomer('سارا', 'تهران')
  await cart.submit()
  await expect(cart.confirmation).toContainText('سفارش شما ثبت شد')
})
```

POM را بیش از حد انتزاعی نکنید: فقط locatorها و اکشن‌های همان صفحه، بدون assertionهای سناریو (assertion در تست بماند).

## ۶. احراز هویت یک‌بار برای همه

```ts
// e2e/auth.setup.ts
import { test as setup, expect } from '@playwright/test'

setup('ورود', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('ایمیل').fill('demo@example.com')
  await page.getByLabel('رمز').fill('demo1234')
  await page.getByRole('button', { name: 'ورود' }).click()
  await expect(page.getByRole('heading', { name: 'داشبورد' })).toBeVisible()
  await page.context().storageState({ path: 'e2e/.auth/user.json' })
})
```

```ts
// playwright.config.ts
projects: [
  { name: 'setup', testMatch: /auth\.setup\.ts/ },
  {
    name: 'chromium',
    use: { ...devices['Desktop Chrome'], storageState: 'e2e/.auth/user.json' },
    dependencies: ['setup']
  }
]
```

`e2e/.auth` را در `.gitignore` بگذارید؛ توکن واقعی است.

## ۷. Mock شبکه

```ts
test('پیام خطای سرور نمایش داده می‌شود', async ({ page }) => {
  await page.route('**/api/checkout', (route) =>
    route.fulfill({ status: 500, json: { error: { message: 'خطای سرور' } } })
  )

  await page.goto('/cart')
  await page.getByRole('button', { name: 'ثبت سفارش' }).click()
  await expect(page.getByRole('alert')).toContainText('خطای سرور')
})

test('پاسخ کند', async ({ page }) => {
  await page.route('**/api/products', async (route) => {
    await new Promise((r) => setTimeout(r, 1500))
    await route.continue()
  })
  await page.goto('/')
  await expect(page.getByText('در حال بارگذاری…')).toBeVisible()
})
```

برای تست حالت‌های خطا/کندی که ساختنشان در محیط واقعی سخت است.

## ۸. اشکال‌زدایی

```bash
npx playwright test --ui
npx playwright test --debug
npx playwright codegen http://localhost:5173
npx playwright show-trace test-results/.../trace.zip
```

Trace شامل DOM snapshot در هر مرحله، شبکه، console و منبع خطاست؛ بهترین ابزار برای تست شکست‌خورده در CI.

## ۹. تست دسترس‌پذیری

```bash
npm i -D @axe-core/playwright
```

```ts
import AxeBuilder from '@axe-core/playwright'

test('صفحه‌ی سبد بدون خطای a11y', async ({ page }) => {
  await page.goto('/cart')
  const results = await new AxeBuilder({ page }).analyze()
  expect(results.violations).toEqual([])
})
```

## ۱۰. اجرا در CI

```yaml
name: e2e
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npx playwright test
        env:
          BASE_URL: http://localhost:5173
          CI: 'true'
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 7
```

برای تست‌های زیاد از sharding استفاده کنید:

```bash
npx playwright test --shard=1/4
```

## ۱۱. ساخت گام‌به‌گام تست فروشگاه (تمرین)

**گام ۱ — اپ:** یک فروشگاه کوچک با لیست محصول، سبد، فرم و صفحه‌ی تأیید.

**گام ۲ — setup:** `playwright.config.ts` با `webServer` و project کروم.

**گام ۳ — مسیر خوش:** افزودن به سبد → سبد → فرم → ثبت → URL تأیید؛ locatorها را در `CartPage` بگذارید.

**گام ۴ — مسیر خطا:** فرم خالی؛ انتظار پیام و ماندن در صفحه.

**گام ۵ — شبکه:** mock خطای ۵۰۰ و حالت loading.

**گام ۶ — auth:** setup + storageState برای مسیرهای محافظت‌شده.

**گام ۷ — mobile:** project با `Pixel 7`؛ بررسی منو و هدف لمس.

**گام ۸ — a11y:** axe روی سه صفحه‌ی اصلی.

**گام ۹ — CI:** اجرا با retries و آپلود trace در شکست.

### اجرای واقعی: اجرا، شکست و Trace

```bash
npx playwright test
# Running 3 tests using 3 workers
#
#   ✓  1 e2e/checkout.spec.ts:10:7 › خرید › کاربر می‌تواند سفارش را ثبت کند (2.1s)
#   ✓  2 e2e/checkout.spec.ts:22:7 › خرید › خطای اعتبارسنجی نمایش داده می‌شود (1.4s)
#   ○  3 e2e/checkout.spec.ts:31:7 › خرید › موبایل (skipped)
#
#   2 passed, 1 skipped (6.2s)
```

**یک locator اشتباه:**

```bash
npx playwright test --grep "سفارش"
```

```text
Error: strict mode violation: getByRole('button', { name: 'ثبت سفارش' }) resolved to 2 elements:
    1) <button>ثبت سفارش</button>
    2) <button>ثبت سفارش و پرداخت</button>
```

یعنی locator مبهم است. آن را دقیق کنید:

```ts
page.getByRole('button', { name: 'ثبت سفارش', exact: true })
```

**شکست واقعی با انتظار:**

```text
Error: expect(locator).toHaveText(expected)

Locator: getByTestId('total')
Expected string: "۲۵۰٬۰۰۰ تومان"
Received string: "250000 تومان"
Timeout: 5000ms
```

پیام دقیقاً تفاوت قالب‌بندی را نشان می‌دهد؛ این تست درست شکست خورده است.

**Trace:**

```bash
npx playwright show-trace test-results/checkout-.../trace.zip
# ════════════════════════════════════════════
#  Trace Viewer opened in browser
```

در Trace، تب‌های **Actions**، **Network**، **Console** و **Source** را ببینید؛ معمولاً علت در snapshot همان لحظه است.

**ایست بازرسی ۱ — بدون sleep:** در کل تست‌ها جستجو کنید:

```bash
grep -R "waitForTimeout" e2e || echo "clean"
# clean
```

**ایست بازرسی ۲ — auth:** فایل `e2e/.auth/user.json` نباید در git باشد:

```bash
git check-ignore -v e2e/.auth/user.json
# .gitignore:12:e2e/.auth/    e2e/.auth/user.json
```

**ایست بازرسی ۳ — CI:** در GitHub Actions لاگ را ببینید:

```text
Run npx playwright test
  2 passed (18.4s)
Upload artifact playwright-report
```

اگر job با `browser not found` شکست خورد، `npx playwright install --with-deps chromium` را در workflow گذاشته‌اید؟

| خطا | معنا | اصلاح |
| --- | --- | --- |
| `strict mode violation` | locator چندتایی | `exact`/`filter`/`nth` |
| `Target closed` | صفحه بسته شد | بررسی popup/تب |
| `Timeout 30000ms exceeded` | انتظار بی‌پایان | locator/شرط را بررسی کنید |
| `Executable doesn't exist` | مرورگر نصب نیست | `playwright install` |

### نگاشت به معیارهای پذیرش

| معیار | کجای درس |
| --- | --- |
| `config` | بخش ۲ |
| `locators` | بخش ۳ |
| `pom` | بخش ۵ (Page Object Model) |
| `assertions` | بخش ۴ |
| `ci` | بخش ۱۰ |

## ۱۲. عیب‌یابی

| نشانه | علت | راه‌حل |
| --- | --- | --- |
| strict mode violation | locator چند عنصر | دقیق‌تر/filter/first |
| تست محلی سبز، CI قرمز | زمان/منبع/داده | trace، retries، انتظار درست |
| element not visible | انیمیشن/پوشش | `expect(...).toBeVisible()` و بررسی CSS |
| تست به هم می‌ریزد | داده‌ی مشترک | داده‌ی یکتا per test |
| ورود هر تست | storageState ندارد | setup project |
| could not find browser | بدون install | `npx playwright install --with-deps` |
| تست کند | sleepهای واقعی | حذف waitForTimeout |

## ۱۳. آزمایش‌ها (با پاسخ)

**۱.** چرا `waitForTimeout` بد است؟

**پاسخ:** زمان‌بندی را حدس می‌زند؛ روی CI کندتر می‌شود یا زمان هدر می‌رود. assertion خودکار بهتر است.

**۲.** چرا `getByRole` پایدارتر از CSS است؟

**پاسخ:** به ساختار DOM و کلاس‌ها وابسته نیست و همان چیزی است که کاربر می‌بیند.

**۳.** چرا `storageState` امنیت را بهتر می‌کند؟

**پاسخ:** یک‌بار ورود، بدون تکرار و بدون قرار دادن رمز در هر تست.

**۴.** چه زمانی باید شبکه را mock کنیم؟

**پاسخ:** برای حالت‌های سخت (خطا/کندی/مرز) — نه برای مسیر خوش که باید واقعی تست شود.

## ۱۴. خودآزمایی

1. E2E چه زمانی انتخاب درست است؟
2. locator strict یعنی چه؟
3. web-first assertion چگونه کار می‌کند؟
4. setup project چه کاری می‌کند؟
5. trace چه اطلاعاتی دارد؟
6. sharding برای چه؟

## ۱۵. چک‌لیست تحویل

- [ ] config با webServer و baseURL
- [ ] locatorهای role/label
- [ ] بدون waitForTimeout
- [ ] مسیر خوش + خطا
- [ ] auth با storageState
- [ ] mock برای حالت‌های سخت
- [ ] project موبایل
- [ ] axe روی صفحات اصلی
- [ ] CI با artifact trace
