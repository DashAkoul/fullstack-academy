# تست End-to-End با Playwright

> مرجع رسمی: [playwright.dev](https://playwright.dev/docs/intro)

تست واحد می‌گوید «قطعات درست کار می‌کنند». تست E2E می‌گوید «کاربر می‌تواند کارش را انجام دهد». Playwright این کار را با پایداری و ابزار دیباگ عالی انجام می‌دهد.

## ۱. نصب

```bash
npm init playwright@latest
# TypeScript ✓  tests/ ✓  GitHub Actions ✓
npx playwright install --with-deps
```

```
playwright.config.ts
tests/
├─ example.spec.ts
└─ e2e/
   └─ todo.spec.ts
```

## ۲. پیکربندی

```ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: { timeout: 5_000 },
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
    { name: 'mobile', use: { ...devices['Pixel 7'] } }
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI
  }
})
```

## ۳. اولین تست

```ts
import { test, expect } from '@playwright/test'

test('کاربر می‌تواند وظیفه اضافه کند', async ({ page }) => {
  await page.goto('/')
  await page.getByPlaceholder('چه کاری باید انجام شود؟').fill('خرید نان')
  await page.getByPlaceholder('چه کاری باید انجام شود؟').press('Enter')
  await expect(page.getByRole('listitem').filter({ hasText: 'خرید نان' })).toBeVisible()
})
```

## ۴. Locatorها: کاربرمحور، نه CSS شکننده

```ts
page.getByRole('button', { name: 'افزودن' })
page.getByLabel('ایمیل')
page.getByPlaceholder('جستجو…')
page.getByText('فاکتور صادر شد')
page.getByTestId('cart-total')

// زنجیره‌ای
page.getByRole('listitem').filter({ hasText: 'خرید نان' }).getByRole('button', { name: 'حذف' })
```

| خوب | بد |
| --- | --- |
| `getByRole('button', { name: 'ذخیره' })` | `page.locator('.btn.btn-primary')` |
| `getByLabel('ایمیل')` | `page.locator('#input-3')` |
| `getByTestId('cart-total')` | مسیرهای XPath طولانی |

مزیت پنهان: اگر با role/label تست کنید، دسترس‌پذیری اپ هم خودکار بررسی می‌شود.

## ۵. Assertionهای web-first

```ts
await expect(page.getByRole('heading', { name: 'سفارش‌ها' })).toBeVisible()
await expect(page.getByTestId('total')).toHaveText('۲۵۴٬۲۵۰')
await expect(page.getByRole('button', { name: 'ذخیره' })).toBeEnabled()
await expect(page.getByRole('alert')).toContainText('نامعتبر')
await expect(page).toHaveURL(/\/orders\/\d+/)
await expect(page.getByRole('listitem')).toHaveCount(3)
```

`expect` در Playwright **خودکار منتظر می‌ماند** تا شرط برقرار شود. به همین دلیل نیازی به `waitForTimeout` ندارید:

```ts
// ❌ شکننده و کند
await page.click('#save')
await page.waitForTimeout(2000)
expect(await page.textContent('.status')).toBe('ذخیره شد')

// ✅
await page.getByRole('button', { name: 'ذخیره' }).click()
await expect(page.getByRole('status')).toHaveText('ذخیره شد')
```

## ۶. Page Object Model

```ts
// tests/pages/todo.page.ts
import { type Page, expect } from '@playwright/test'

export class TodoPage {
  constructor(private readonly page: Page) {}

  async goto() {
    await this.page.goto('/')
  }

  async add(text: string) {
    const input = this.page.getByPlaceholder('چه کاری باید انجام شود؟')
    await input.fill(text)
    await input.press('Enter')
  }

  item(text: string) {
    return this.page.getByRole('listitem').filter({ hasText: text })
  }

  async complete(text: string) {
    await this.item(text).getByRole('checkbox').check()
  }

  async expectCount(n: number) {
    await expect(this.page.getByRole('listitem')).toHaveCount(n)
  }
}
```

```ts
// tests/e2e/todo.spec.ts
import { test, expect } from '@playwright/test'
import { TodoPage } from '../pages/todo.page'

test.describe('اپ وظایف', () => {
  let todo: TodoPage

  test.beforeEach(async ({ page }) => {
    todo = new TodoPage(page)
    await todo.goto()
  })

  test('افزودن و تکمیل وظیفه', async ({ page }) => {
    await todo.add('خرید نان')
    await todo.add('تماس با مشتری')
    await todo.expectCount(2)

    await todo.complete('خرید نان')
    await expect(todo.item('خرید نان').getByRole('checkbox')).toBeChecked()
  })

  test('فیلتر وظایف تکمیل‌شده', async ({ page }) => {
    await todo.add('کار ۱')
    await todo.complete('کار ۱')
    await page.getByRole('link', { name: 'تکمیل‌شده' }).click()
    await expect(page.getByRole('listitem')).toHaveCount(1)
  })
})
```

## ۷. Fixture سفارشی

```ts
// tests/fixtures.ts
import { test as base } from '@playwright/test'
import { TodoPage } from './pages/todo.page'

export const test = base.extend<{ todo: TodoPage }>({
  todo: async ({ page }, use) => {
    const todo = new TodoPage(page)
    await todo.goto()
    await use(todo)
  }
})
export { expect } from '@playwright/test'
```

## ۸. حالت احراز هویت

```ts
// tests/auth.setup.ts
import { test as setup, expect } from '@playwright/test'

const authFile = 'playwright/.auth/user.json'

setup('ورود', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('ایمیل').fill(process.env.E2E_EMAIL!)
  await page.getByLabel('رمز عبور').fill(process.env.E2E_PASSWORD!)
  await page.getByRole('button', { name: 'ورود' }).click()
  await expect(page.getByRole('heading', { name: 'داشبورد' })).toBeVisible()
  await page.context().storageState({ path: authFile })
})
```

```ts
// playwright.config.ts
projects: [
  { name: 'setup', testMatch: /auth\.setup\.ts/ },
  {
    name: 'chromium',
    use: { ...devices['Desktop Chrome'], storageState: 'playwright/.auth/user.json' },
    dependencies: ['setup']
  }
]
```

## ۹. CI با GitHub Actions

```yaml
# .github/workflows/e2e.yml
name: E2E

on:
  pull_request:
  push:
    branches: [main]

jobs:
  test:
    timeout-minutes: 20
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm run build
      - run: npx playwright test
        env:
          BASE_URL: http://localhost:4173
      - uses: actions/upload-artifact@v4
        if: ${{ !cancelled() }}
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 7
```

## ۱۰. دیباگ

```bash
npx playwright test --ui            # حالت UI تعاملی (بهترین ابزار)
npx playwright test --debug         # Inspector گام‌به‌گام
npx playwright test --headed
npx playwright show-trace trace.zip
npx playwright codegen http://localhost:5173
```

`trace: 'on-first-retry'` را نگه دارید: وقتی تست در CI شکست، trace دقیقاً نشان می‌دهد چه اتفاقی افتاده.

## ۱۱. ضدالگوها

| ضدالگو | جایگزین |
| --- | --- |
| `waitForTimeout` | assertion خودکارانتظار |
| selectorهای CSS عمیق | role/label/testid |
| تست وابسته به ترتیب | هر تست مستقل، داده‌ی خودش |
| داده‌ی تولیدی مشترک | seed یا API در `beforeEach` |
| تست همه‌چیز در یک فایل بزرگ | specهای کوچک بر اساس قابلیت |

## تمرین این درس

مجموعه‌ی E2E برای اپ وظایف: افزودن/تکمیل/فیلتر/حذف، locatorهای کاربرمحور، Page Object، پیکربندی چند مرورگر و workflow گیت‌هاب. جزئیات در تب تمرین است.
