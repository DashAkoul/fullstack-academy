import type { RepoSnapshot } from '@shared/types'
import { decideVerdict, extractJson, MiniLessonSchema, parseReviewResponse } from '@shared/review'
import type { MiniLesson, ReviewResult, Verdict } from '@shared/review'
import type { Lesson } from '@/data/types'
import { buildMiniLessonRequest, buildReviewRequest, MINI_LESSON_SYSTEM, REVIEW_SYSTEM } from './prompts'
import type { Settings } from '@/store/useApp'

export interface ReviewOutcome {
  snapshot: RepoSnapshot
  result: ReviewResult
  verdict: Verdict
}

interface RunOptions {
  lesson: Lesson
  repoRef: string
  settings: Settings
  snapshot?: RepoSnapshot
  onlyRequirementIds?: string[]
}

export async function fetchRepository(repoRef: string): Promise<RepoSnapshot> {
  return window.academy.github.fetchRepo(repoRef)
}

export async function runReview({ lesson, repoRef, settings, snapshot: preloaded, onlyRequirementIds }: RunOptions): Promise<ReviewOutcome> {
  const snapshot = preloaded ?? (await window.academy.github.fetchRepo(repoRef))

  const raw = await window.academy.ai.complete({
    provider: settings.provider,
    model: settings.models[settings.provider],
    baseUrl: settings.provider === 'openai' ? settings.baseUrl : undefined,
    system: REVIEW_SYSTEM,
    prompt: buildReviewRequest(lesson, snapshot),
    json: true
  })

  const parsed = parseReviewResponse(raw)
  if (!parsed.ok || !parsed.data) {
    throw new Error(parsed.error ?? 'پاسخ هوش مصنوعی قابل استفاده نبود.')
  }

  const expectedIds = (onlyRequirementIds ?? lesson.exercise.requirements.map((r) => r.id)).filter(Boolean)
  const verdict = decideVerdict(parsed.data.requirements, parsed.data.issues, expectedIds)

  return { snapshot, result: parsed.data, verdict }
}

export async function generateMiniLesson(
  lesson: Lesson,
  issue: { title: string; explanation: string; concept?: string },
  settings: Settings
): Promise<MiniLesson> {
  const concept = issue.concept?.trim() || issue.title
  const raw = await window.academy.ai.complete({
    provider: settings.provider,
    model: settings.models[settings.provider],
    baseUrl: settings.provider === 'openai' ? settings.baseUrl : undefined,
    system: MINI_LESSON_SYSTEM,
    prompt: buildMiniLessonRequest({
      lessonTitle: lesson.title,
      concept,
      issueTitle: issue.title,
      explanation: issue.explanation
    }),
    json: true
  })

  const json = extractJson(raw)
  if (!json) throw new Error('پاسخ مینی‌درس JSON معتبری نداشت.')
  const parsed = MiniLessonSchema.safeParse(JSON.parse(json))
  if (!parsed.success) throw new Error('ساختار مینی‌درس نامعتبر بود.')
  return parsed.data
}

export function newId(): string {
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`
}
