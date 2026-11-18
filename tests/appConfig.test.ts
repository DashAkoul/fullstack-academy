import { describe, expect, it } from 'vitest'
import { isNewerVersion, parseVersion } from '@shared/appConfig'

describe('parseVersion', () => {
  it.each([
    ['1.2.3', [1, 2, 3]],
    ['v1.0.0', [1, 0, 0]],
    ['2.0', [2, 0]],
    ['1.2.3-beta.1', [1, 2, 3]],
    ['v10.20.30+build.5', [10, 20, 30]],
    ['bad', [0]]
  ])('%s را تجزیه می‌کند', (input, expected) => {
    expect(parseVersion(input)).toEqual(expected)
  })
})

describe('isNewerVersion', () => {
  it('نسخه‌ی جدیدتر را تشخیص می‌دهد', () => {
    expect(isNewerVersion('1.0.1', '1.0.0')).toBe(true)
    expect(isNewerVersion('1.1.0', '1.0.9')).toBe(true)
    expect(isNewerVersion('2.0.0', '1.99.99')).toBe(true)
    expect(isNewerVersion('v1.2.0', '1.1.0')).toBe(true)
  })

  it('نسخه‌ی برابر یا قدیمی‌تر را جدید نمی‌داند', () => {
    expect(isNewerVersion('1.0.0', '1.0.0')).toBe(false)
    expect(isNewerVersion('1.0.0', '1.0.1')).toBe(false)
    expect(isNewerVersion('0.9.9', '1.0.0')).toBe(false)
    expect(isNewerVersion('v1.0', '1.0.0')).toBe(false)
  })
})
