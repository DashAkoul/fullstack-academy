import { describe, expect, it } from 'vitest'
import { decideVerdict, extractJson, parseReviewResponse } from '@shared/review'
import type { ReviewIssue } from '@shared/review'

const critical: ReviewIssue = {
  title: 'نبود اعتبارسنجی',
  severity: 'critical',
  explanation: 'ورودی خام به پایگاه داده می‌رود.',
  suggestion: 'از Zod استفاده کنید.'
}

describe('decideVerdict', () => {
  it('وقتی همه معیارها تأیید شده و خطای بحرانی نیست، قبول می‌کند', () => {
    const v = decideVerdict(
      [
        { id: 'a', met: true, evidence: 'src/x.ts' },
        { id: 'b', met: true, evidence: 'src/y.ts' }
      ],
      [{ ...critical, severity: 'minor' }],
      ['a', 'b']
    )
    expect(v.passed).toBe(true)
    expect(v.reasons).toHaveLength(0)
  })

  it('معیار تأییدنشده باعث رد می‌شود', () => {
    const v = decideVerdict([{ id: 'a', met: true, evidence: 'x' }], [], ['a', 'b'])
    expect(v.passed).toBe(false)
    expect(v.missingRequirementIds).toEqual(['b'])
  })

  it('مشکل بحرانی باعث رد می‌شود حتی اگر معیارها تأیید شده باشند', () => {
    const v = decideVerdict([{ id: 'a', met: true, evidence: 'x' }], [critical], ['a'])
    expect(v.passed).toBe(false)
    expect(v.criticalCount).toBe(1)
  })

  it('اگر مدل معیاری را برنگرداند، تأییدنشده حساب می‌شود', () => {
    const v = decideVerdict([], [], ['a'])
    expect(v.passed).toBe(false)
    expect(v.missingRequirementIds).toEqual(['a'])
  })

  it('تمرین بدون معیار را قبول نمی‌کند', () => {
    expect(decideVerdict([], [], []).passed).toBe(false)
  })
})

describe('extractJson', () => {
  it('JSON خام را برمی‌گرداند', () => {
    expect(extractJson('{"a":1}')).toBe('{"a":1}')
  })

  it('بلوک کد مارک‌داون را می‌شود', () => {
    expect(extractJson('متن\n```json\n{"a":1}\n```\nپایان')).toBe('{"a":1}')
  })

  it('متن اضافه قبل و بعد را نادیده می‌گیرد', () => {
    expect(extractJson('Sure! {"a":{"b":"}"}} hope it helps')).toBe('{"a":{"b":"}"}}')
  })

  it('آکولاد داخل رشته را اشتباه نمی‌گیرد', () => {
    expect(extractJson('x {"s":"a } b { c","n":1} y')).toBe('{"s":"a } b { c","n":1}')
  })

  it('برای ورودی بدون JSON مقدار null می‌دهد', () => {
    expect(extractJson('هیچ آبجکتی نیست')).toBeNull()
    expect(extractJson('{broken')).toBeNull()
  })
})

describe('parseReviewResponse', () => {
  const valid = {
    score: 72,
    summary: 'ساختار خوب است اما اعتبارسنجی ندارد.',
    requirements: [{ id: 'a', met: false, evidence: 'src/index.ts: هیچ schema ای نیست' }],
    issues: [critical],
    nextSteps: ['افزودن Zod'],
    miniLesson: null
  }

  it('پاسخ معتبر را می‌پذیرد', () => {
    const parsed = parseReviewResponse(JSON.stringify(valid))
    expect(parsed.ok).toBe(true)
    expect(parsed.data?.issues[0].severity).toBe('critical')
  })

  it('severity ناشناخته را رد می‌کند', () => {
    const bad = { ...valid, issues: [{ ...critical, severity: 'blocker' }] }
    const parsed = parseReviewResponse(JSON.stringify(bad))
    expect(parsed.ok).toBe(false)
  })

  it('فیلدهای اختیاری غایب را پیش‌فرض می‌گذارد', () => {
    const { issues: _issues, nextSteps: _next, miniLesson: _mini, ...partial } = valid
    const parsed = parseReviewResponse(JSON.stringify(partial))
    expect(parsed.ok).toBe(true)
    expect(parsed.data?.issues).toEqual([])
    expect(parsed.data?.nextSteps).toEqual([])
  })

  it('متن غیر JSON را رد می‌کند', () => {
    expect(parseReviewResponse('کد شما خوب بود!').ok).toBe(false)
  })
})
