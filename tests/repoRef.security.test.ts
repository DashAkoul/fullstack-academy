import { describe, expect, it } from 'vitest'
import { parseRepoRef } from '../src/shared/repoRef'

describe('parseRepoRef — سخت‌گیری امنیتی', () => {
  it('ورودی‌های معتبر را می‌پذیرد', () => {
    expect(parseRepoRef('DashAkoul/fullstack-academy')).toEqual({
      owner: 'DashAkoul',
      repo: 'fullstack-academy',
      branch: undefined
    })
    expect(parseRepoRef('https://github.com/o/r/tree/feature/x')?.branch).toBe('feature/x')
  })

  it('مسیرهای پیمایش و نام‌های نامعتبر را رد می‌کند', () => {
    expect(parseRepoRef('../etc')).toBeNull()
    expect(parseRepoRef('owner/..')).toBeNull()
    expect(parseRepoRef('https://github.com/o/r/tree/..')).toBeNull()
    expect(parseRepoRef('git@evil.com:o/r.git')).toBeNull()
    expect(parseRepoRef('http://github.com/o/r')).toBeNull()
  })

  it('ورودی بیش از حد طولانی را رد می‌کند', () => {
    expect(parseRepoRef('a'.repeat(600))).toBeNull()
  })
})
