import { describe, expect, it } from 'vitest'
import { isReviewable, looksLikeSecret, selectReviewFiles } from '@shared/fileSelection'

describe('isReviewable', () => {
  it('فایل‌های سورس و پیکربندی را می‌پذیرد', () => {
    for (const path of ['src/app.tsx', 'README.md', 'package.json', 'docker-compose.yml', 'Dockerfile', '.env.example', 'prisma/schema.prisma'])
      expect(isReviewable(path), path).toBe(true)
  })

  it('وابستگی‌ها، خروجی‌ها و قفل‌ها را رد می‌کند', () => {
    for (const path of [
      'node_modules/react/index.js',
      'dist/bundle.js',
      'coverage/lcov.info',
      'package-lock.json',
      'yarn.lock',
      '.git/config',
      'src/logo.png',
      'assets/app.min.js',
      'build/app.js.map'
    ])
      expect(isReviewable(path), path).toBe(false)
  })

  it('فایل env واقعی را هرگز ارسال نمی‌کند', () => {
    expect(isReviewable('.env')).toBe(false)
    expect(isReviewable('.env.local')).toBe(false)
    expect(isReviewable('config/.env.production')).toBe(false)
    expect(isReviewable('.env.sample')).toBe(true)
  })

  it('فایل‌های بسیار بزرگ را رد می‌کند', () => {
    expect(isReviewable('src/huge.ts', 500_000)).toBe(false)
    expect(isReviewable('src/ok.ts', 10_000)).toBe(true)
  })
})

describe('selectReviewFiles', () => {
  const files = [
    { path: 'node_modules/x/index.js', size: 10 },
    { path: 'src/components/Card.tsx', size: 10 },
    { path: 'package.json', size: 10 },
    { path: 'README.md', size: 10 },
    { path: 'src/index.ts', size: 10 }
  ]

  it('اولویت را رعایت می‌کند و node_modules را حذف می‌کند', () => {
    const selected = selectReviewFiles(files, { maxFiles: 10 }).map((f) => f.path)
    expect(selected).not.toContain('node_modules/x/index.js')
    expect(selected[0]).toBe('package.json')
    expect(selected[1]).toBe('README.md')
  })

  it('سقف تعداد فایل را اعمال می‌کند', () => {
    expect(selectReviewFiles(files, { maxFiles: 2 })).toHaveLength(2)
  })
})

describe('جلوگیری از نشت راز', () => {
  it('.npmrc و .env واقعی ارسال نمی‌شوند', () => {
    expect(isReviewable('.npmrc')).toBe(false)
    expect(isReviewable('.env')).toBe(false)
    expect(isReviewable('.env.local')).toBe(false)
    expect(isReviewable('.env.example')).toBe(true)
  })

  it('محتوای حاوی کلید خصوصی یا توکن را تشخیص می‌دهد', () => {
    expect(looksLikeSecret('-----BEGIN RSA PRIVATE KEY-----\nabc')).toBe(true)
    expect(looksLikeSecret('const key = "sk-abcdefghijklmnopqrstuvwxyz123456"')).toBe(true)
    expect(looksLikeSecret('const key = "ghp_abcdefghijklmnopqrstuvwxyz1234"')).toBe(true)
    expect(looksLikeSecret('AKIAIOSFODNN7EXAMPLE')).toBe(true)
    expect(looksLikeSecret('const title = "hello world"')).toBe(false)
  })
})
