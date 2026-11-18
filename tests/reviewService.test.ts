import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RepoSnapshot } from '@shared/types'
import type { Lesson } from '@/data/types'
import type { Settings } from '@/store/useApp'
import { generateMiniLesson, runReview } from '@/lib/reviewService'

const lesson: Lesson = {
  id: 'demo',
  moduleId: 'frontend-basics',
  index: 0,
  title: 'درس نمونه',
  summary: 'خلاصه',
  minutes: 10,
  content: '# نمونه',
  docs: [],
  exercise: {
    title: 'تمرین نمونه',
    scenario: 'سناریو',
    tasks: ['کار اول'],
    requirements: [
      { id: 'semantic', text: 'ساختار معنایی' },
      { id: 'grid', text: 'استفاده از Grid' }
    ],
    repoName: 'demo-repo',
    hints: []
  }
}

const snapshot: RepoSnapshot = {
  owner: 'acme',
  repo: 'demo-repo',
  fullName: 'acme/demo-repo',
  branch: 'main',
  commitSha: 'abcdef1234567890',
  commitMessage: 'feat: initial',
  commitDate: '2026-01-01T00:00:00Z',
  htmlUrl: 'https://github.com/acme/demo-repo',
  isPrivate: false,
  tree: ['index.html', 'styles.css'],
  files: [
    { path: 'index.html', content: '<main><h1>x</h1></main>', size: 24, truncated: false },
    { path: 'styles.css', content: '.grid{display:grid}', size: 19, truncated: false }
  ],
  skippedFiles: 0
}

const settings: Settings = {
  provider: 'gemini',
  models: { gemini: 'gemini-2.5-flash', openai: 'gpt-4.1-mini', anthropic: 'claude-sonnet-4-5' },
  baseUrl: '',
  theme: 'dark'
}

const reviewJson = JSON.stringify({
  score: 88,
  summary: 'ساختار و چیدمان درست است.',
  requirements: [
    { id: 'semantic', met: true, evidence: 'index.html از main و h1 استفاده کرده' },
    { id: 'grid', met: true, evidence: 'styles.css دارای display:grid' }
  ],
  issues: [],
  nextSteps: ['افزودن تست دسترس‌پذیری'],
  miniLesson: null
})

function stubBridge(overrides: { ai?: (req: unknown) => Promise<string> } = {}) {
  const fetchRepo = vi.fn(async () => snapshot)
  const complete = vi.fn(overrides.ai ?? (async () => reviewJson))
  ;(globalThis as unknown as { window: unknown }).window = {
    academy: { github: { fetchRepo }, ai: { complete } }
  }
  return { fetchRepo, complete }
}

beforeEach(() => vi.restoreAllMocks())
afterEach(() => {
  delete (globalThis as { window?: unknown }).window
})

describe('runReview', () => {
  it('کد را دریافت، بازبینی و در صورت تأیید همه معیارها verdict مثبت می‌دهد', async () => {
    const { fetchRepo, complete } = stubBridge()

    const outcome = await runReview({ lesson, repoRef: 'acme/demo-repo', settings })

    expect(fetchRepo).toHaveBeenCalledWith('acme/demo-repo')
    expect(complete).toHaveBeenCalledTimes(1)
    const req = complete.mock.calls[0][0] as { provider: string; prompt: string; json: boolean }
    expect(req.provider).toBe('gemini')
    expect(req.json).toBe(true)
    expect(req.prompt).toContain('id="grid"')
    expect(req.prompt).toContain('index.html')
    expect(outcome.verdict.passed).toBe(true)
    expect(outcome.snapshot.commitSha).toBe(snapshot.commitSha)
  })

  it('اگر معیاری برآورده نشده باشد، رد می‌کند', async () => {
    stubBridge({
      ai: async () =>
        JSON.stringify({
          score: 50,
          summary: 'ناقص',
          requirements: [
            { id: 'semantic', met: true, evidence: 'ok' },
            { id: 'grid', met: false, evidence: 'Grid وجود ندارد' }
          ],
          issues: [],
          nextSteps: []
        })
    })

    const outcome = await runReview({ lesson, repoRef: 'acme/demo-repo', settings })
    expect(outcome.verdict.passed).toBe(false)
    expect(outcome.verdict.missingRequirementIds).toEqual(['grid'])
  })

  it('از دریافت دوباره‌ی مخزن وقتی snapshot داده شده صرف‌نظر می‌کند', async () => {
    const { fetchRepo } = stubBridge()
    await runReview({ lesson, repoRef: 'acme/demo-repo', settings, snapshot })
    expect(fetchRepo).not.toHaveBeenCalled()
  })

  it('پاسخ غیر JSON را با خطای فارسی گزارش می‌کند', async () => {
    stubBridge({ ai: async () => 'کد شما عالی است!' })
    await expect(runReview({ lesson, repoRef: 'acme/demo-repo', settings })).rejects.toThrow(/JSON/)
  })

  it('خطای GitHub را منتقل می‌کند', async () => {
    ;(globalThis as unknown as { window: unknown }).window = {
      academy: {
        github: { fetchRepo: vi.fn(async () => Promise.reject(new Error('مخزن پیدا نشد (404).'))) },
        ai: { complete: vi.fn() }
      }
    }
    await expect(runReview({ lesson, repoRef: 'acme/nope', settings })).rejects.toThrow('404')
  })
})

describe('generateMiniLesson', () => {
  it('مینی‌درس معتبر را تجزیه می‌کند', async () => {
    stubBridge({
      ai: async () =>
        JSON.stringify({
          title: 'Grid در یک نگاه',
          concept: 'CSS Grid',
          body: 'توضیح کوتاه و کامل درباره‌ی grid-template-columns و کاربردهای آن در چیدمان.'
        })
    })

    const mini = await generateMiniLesson(
      lesson,
      { title: 'استفاده نکردن از Grid', explanation: 'چیدمان با float انجام شده' },
      settings
    )
    expect(mini.title).toBe('Grid در یک نگاه')
    expect(mini.concept).toBe('CSS Grid')
  })

  it('مینی‌درس ناقص را رد می‌کند', async () => {
    stubBridge({ ai: async () => JSON.stringify({ title: 'x' }) })
    await expect(
      generateMiniLesson(lesson, { title: 'مشکل', explanation: 'دلیل' }, settings)
    ).rejects.toThrow()
  })
})
