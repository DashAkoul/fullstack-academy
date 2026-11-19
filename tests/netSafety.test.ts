import { describe, expect, it } from 'vitest'
import {
  isPrivateHost,
  isSafeExternalUrl,
  isTrustedReleaseAssetUrl,
  isTrustedReleasePageUrl,
  normalizeBaseUrl
} from '../src/shared/netSafety'
import { sanitizeCompletionRequest, sanitizeModelListRequest } from '../src/shared/aiRequest'
import { readTextCapped } from '../src/main/http'

describe('normalizeBaseUrl', () => {
  it('https عمومی را می‌پذیرد و اسلش انتهایی را حذف می‌کند', () => {
    expect(normalizeBaseUrl('https://api.openai.com/v1/')).toBe('https://api.openai.com/v1')
    expect(normalizeBaseUrl('https://openrouter.ai/api/v1')).toBe('https://openrouter.ai/api/v1')
  })

  it('http را فقط برای localhost مجاز می‌داند', () => {
    expect(normalizeBaseUrl('http://localhost:11434/v1')).toBe('http://localhost:11434/v1')
    expect(normalizeBaseUrl('http://127.0.0.1:1234/v1')).toBe('http://127.0.0.1:1234/v1')
    expect(() => normalizeBaseUrl('http://example.com/v1')).toThrow()
  })

  it('شبکه‌ی داخلی، metadata و پروتکل غیرمجاز را رد می‌کند', () => {
    expect(() => normalizeBaseUrl('https://169.254.169.254/latest')).toThrow()
    expect(() => normalizeBaseUrl('https://192.168.1.10/v1')).toThrow()
    expect(() => normalizeBaseUrl('https://10.0.0.5/v1')).toThrow()
    expect(() => normalizeBaseUrl('https://metadata.google.internal/v1')).toThrow()
    expect(() => normalizeBaseUrl('ftp://example.com/v1')).toThrow()
  })

  it('نام کاربری، query و fragment را رد می‌کند', () => {
    expect(() => normalizeBaseUrl('https://user:pass@example.com/v1')).toThrow()
    expect(() => normalizeBaseUrl('https://example.com/v1?x=1')).toThrow()
    expect(() => normalizeBaseUrl('https://example.com/v1#x')).toThrow()
  })
})

describe('isPrivateHost', () => {
  it('محدوده‌های خصوصی را تشخیص می‌دهد', () => {
    for (const host of ['127.0.0.1', '10.2.3.4', '172.20.1.1', '192.168.0.1', '169.254.169.254', '[::1]', 'fd00::1']) {
      expect(isPrivateHost(host), host).toBe(true)
    }
    expect(isPrivateHost('api.openai.com')).toBe(false)
  })
})

describe('URLهای خارجی و انتشار', () => {
  it('فقط https و http لوکال را باز می‌کند', () => {
    expect(isSafeExternalUrl('https://developer.mozilla.org')).toBe(true)
    expect(isSafeExternalUrl('http://localhost:5173')).toBe(true)
    expect(isSafeExternalUrl('http://example.com')).toBe(false)
    expect(isSafeExternalUrl('javascript:alert(1)')).toBe(false)
    expect(isSafeExternalUrl('file:///etc/passwd')).toBe(false)
  })

  it('دارایی‌های انتشار را به مخزن پروژه محدود می‌کند', () => {
    const repo = 'DashAkoul/fullstack-academy'
    expect(
      isTrustedReleaseAssetUrl(`https://github.com/${repo}/releases/download/v1.0.0/a.exe`, repo)
    ).toBe(true)
    expect(isTrustedReleaseAssetUrl('https://evil.example/a.exe', repo)).toBe(false)
    expect(isTrustedReleaseAssetUrl(`https://github.com/other/repo/releases/download/v1/a.exe`, repo)).toBe(false)
    expect(isTrustedReleasePageUrl(`https://github.com/${repo}/releases/tag/v1.0.0`, repo)).toBe(true)
    expect(isTrustedReleasePageUrl('https://github.com/other/repo/releases', repo)).toBe(false)
  })
})

describe('sanitizeCompletionRequest', () => {
  const valid = {
    provider: 'openai',
    model: 'gpt-4.1-mini',
    system: 'system',
    prompt: 'prompt',
    json: true
  }

  it('درخواست معتبر را نرمال می‌کند', () => {
    expect(sanitizeCompletionRequest(valid)).toMatchObject(valid)
    expect(
      sanitizeCompletionRequest({ ...valid, baseUrl: 'https://openrouter.ai/api/v1/' }).baseUrl
    ).toBe('https://openrouter.ai/api/v1')
  })

  it('سرویس، مدل و اندازه را اعتبارسنجی می‌کند', () => {
    expect(() => sanitizeCompletionRequest({ ...valid, provider: 'evil' })).toThrow()
    expect(() => sanitizeCompletionRequest({ ...valid, model: 'bad model with spaces' })).toThrow()
    expect(() => sanitizeCompletionRequest({ ...valid, prompt: 'x'.repeat(400_001) })).toThrow()
    expect(() => sanitizeCompletionRequest({ ...valid, json: 'yes' })).toThrow()
  })

  it('Base URL ناامن را رد می‌کند', () => {
    expect(() => sanitizeCompletionRequest({ ...valid, baseUrl: 'http://10.0.0.1/v1' })).toThrow()
  })

  it('درخواست فهرست مدل‌ها را اعتبارسنجی می‌کند', () => {
    expect(sanitizeModelListRequest({ provider: 'gemini' })).toEqual({ provider: 'gemini', baseUrl: undefined })
    expect(() => sanitizeModelListRequest({ provider: 'nope' })).toThrow()
  })
})

describe('readTextCapped', () => {
  it('بدنه‌ی بزرگ را قطع می‌کند و بیش از سقف نمی‌خواند', async () => {
    const res = new Response('x'.repeat(1000))
    const { text, truncated } = await readTextCapped(res, 100)
    expect(truncated).toBe(true)
    expect(text).toHaveLength(100)
  })

  it('بدنه‌ی کوچک را کامل برمی‌گرداند', async () => {
    const res = new Response('hello')
    await expect(readTextCapped(res, 100)).resolves.toEqual({ text: 'hello', truncated: false })
  })
})
