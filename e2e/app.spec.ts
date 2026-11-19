import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { join } from 'node:path'

let app: ElectronApplication
let page: Page

test.beforeAll(async () => {
  const env = { ...process.env }
  delete env.ELECTRON_RUN_AS_NODE
  const args = ['.']
  if (process.env.CI) args.push('--no-sandbox')
  app = await electron.launch({
    args,
    cwd: join(__dirname, '..'),
    env
  })
  page = await app.firstWindow()
  await page.waitForLoadState('domcontentloaded')
})

test.afterAll(async () => {
  await app?.close()
})

test('درس اول از محتوای واقعی و هایلایت‌شده بارگذاری می‌شود', async () => {
  await expect(page.locator('header h1')).toHaveText('HTML معنایی و CSS مدرن')
  await expect(page.locator('.lesson-prose h2').first()).toBeVisible()
  await expect(page.locator('.lesson-prose h2')).toHaveCount(16)
  await expect(page.locator('.lesson-prose table').first()).toBeVisible()
  expect(await page.locator('.hljs-keyword, .hljs-string, .hljs-title').count()).toBeGreaterThan(20)
})

test('کپی کد، محتوای واقعی را در کلیپ‌بورد می‌گذارد', async () => {
  await page.getByRole('button', { name: 'کپی کد' }).first().click()
  const text = await app.evaluate(({ clipboard }) => clipboard.readText())
  expect(text).toContain('<!doctype html>')
  expect(text.length).toBeGreaterThan(100)
})

test('تب تمرین سناریو و معیارهای پذیرش را نشان می‌دهد', async () => {
  await page.getByRole('button', { name: 'تمرین', exact: true }).click()
  await expect(page.getByText('صفحه فرود محصول برای یک استارتاپ')).toBeVisible()
  await expect(page.getByText('استفاده از CSS Grid برای چیدمان کارت‌های ویژگی')).toBeVisible()
})

test('تنظیمات باز می‌شود و بخش کلید و به‌روزرسانی دارد', async () => {
  await page.getByRole('main').getByRole('button', { name: 'تنظیمات' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText('کلید API')).toBeVisible()
  await expect(dialog.getByRole('heading', { name: 'به‌روزرسانی' })).toBeVisible()
  await dialog.getByRole('button', { name: 'بستن (Esc)' }).click()
  await expect(dialog).toBeHidden()
})

test('IPC لینک‌های خطرناک را رد می‌کند', async () => {
  const result = await page.evaluate(async () => {
    const attempts = [
      'file:///C:/Windows/System32/calc.exe',
      'javascript:alert(1)',
      'http://example.com'
    ]
    const out: Record<string, string> = {}
    for (const url of attempts) {
      try {
        await window.academy.shell.openExternal(url)
        out[url] = 'ALLOWED'
      } catch (e) {
        out[url] = String((e as Error).message)
      }
    }
    try {
      await window.academy.storage.read('../../secrets')
      out.traversal = 'ALLOWED'
    } catch (e) {
      out.traversal = String((e as Error).message)
    }
    return out
  })

  expect(result['file:///C:/Windows/System32/calc.exe']).not.toBe('ALLOWED')
  expect(result['javascript:alert(1)']).not.toBe('ALLOWED')
  expect(result['http://example.com']).not.toBe('ALLOWED')
  expect(result.traversal).not.toBe('ALLOWED')
  expect(Object.keys(result).every((key) => result[key] !== 'ALLOWED')).toBe(true)
})
