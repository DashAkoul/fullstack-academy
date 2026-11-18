import { afterEach, describe, expect, it, vi } from 'vitest'
import { checkForUpdate, preferredAsset, type ReleaseAsset } from '../src/main/update'

const assets: ReleaseAsset[] = [
  { name: 'FullStackAcademy-1.0.0-windows-portable.exe', browser_download_url: 'https://x/portable.exe' },
  { name: 'FullStackAcademy-1.0.0-windows-setup.exe', browser_download_url: 'https://x/setup.exe' },
  { name: 'FullStackAcademy-1.0.0-mac-arm64.dmg', browser_download_url: 'https://x/mac-arm.dmg' },
  { name: 'FullStackAcademy-1.0.0-mac-x64.zip', browser_download_url: 'https://x/mac-x64.zip' },
  { name: 'FullStackAcademy-1.0.0-linux-x86_64.AppImage', browser_download_url: 'https://x/app.AppImage' },
  { name: 'FullStackAcademy-1.0.0-linux-amd64.deb', browser_download_url: 'https://x/app.deb' }
]

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('preferredAsset', () => {
  it('برای ویندوز نسخه‌ی نصبی را به پرتابل ترجیح می‌دهد', () => {
    expect(preferredAsset(assets, 'win32')?.name).toContain('setup.exe')
  })

  it('برای مک dmg و برای لینوکس AppImage را انتخاب می‌کند', () => {
    expect(preferredAsset(assets, 'darwin')?.name).toMatch(/\.dmg$/)
    expect(preferredAsset(assets, 'linux')?.name).toMatch(/\.AppImage$/)
  })

  it('در نبود فرمت ترجیحی، جایگزین مناسب برمی‌گرداند', () => {
    const onlyDeb = assets.filter((a) => a.name.endsWith('.deb'))
    expect(preferredAsset(onlyDeb, 'linux')?.name).toMatch(/\.deb$/)
    const onlyZip = assets.filter((a) => a.name.endsWith('.zip'))
    expect(preferredAsset(onlyZip, 'darwin')?.name).toMatch(/\.zip$/)
    expect(preferredAsset([], 'win32')).toBeUndefined()
  })
})

describe('checkForUpdate', () => {
  function stubFetch(status: number, body: unknown): void {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: status >= 200 && status < 300,
        status,
        json: async () => body
      }))
    )
  }

  it('نسخه‌ی جدیدتر را با لینک دانلود همان سیستم‌عامل گزارش می‌کند', async () => {
    stubFetch(200, {
      tag_name: 'v1.1.0',
      html_url: 'https://github.com/o/r/releases/tag/v1.1.0',
      body: 'یادداشت انتشار',
      published_at: '2026-02-01T00:00:00Z',
      assets
    })

    const info = await checkForUpdate('1.0.0')
    expect(info.latestVersion).toBe('1.1.0')
    expect(info.upToDate).toBe(false)
    expect(info.downloadUrl).toBe('https://x/setup.exe')
    expect(info.assetName).toContain('windows-setup')
    expect(info.notes).toBe('یادداشت انتشار')
  })

  it('نسخه‌ی برابر را به‌روز می‌داند', async () => {
    stubFetch(200, { tag_name: 'v1.0.0', html_url: 'https://github.com/o/r/releases/tag/v1.0.0', assets })
    const info = await checkForUpdate('1.0.0')
    expect(info.upToDate).toBe(true)
  })

  it('وقتی هیچ ریلیزی نیست، بدون خطا وضعیت «منتشر نشده» می‌دهد', async () => {
    stubFetch(404, { message: 'Not Found' })
    const info = await checkForUpdate('1.0.0')
    expect(info.latestVersion).toBe('')
    expect(info.upToDate).toBe(true)
    expect(info.releaseUrl).toContain('/releases')
  })

  it('خطای شبکه یا سرور را گزارش می‌کند', async () => {
    stubFetch(500, {})
    await expect(checkForUpdate('1.0.0')).rejects.toThrow(/GitHub 500/)
  })
})
