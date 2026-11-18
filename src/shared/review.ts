/**
 * AI review contract: request/response shapes, tolerant JSON extraction and
 * the deterministic pass/fail rule (the model never decides completion alone).
 */
import { z } from 'zod'

export const IssueSeverity = z.enum(['critical', 'major', 'minor', 'nit'])
export type IssueSeverity = z.infer<typeof IssueSeverity>

export const ReviewIssueSchema = z.object({
  title: z.string().min(1),
  severity: IssueSeverity,
  /** Persian explanation of *why* it matters */
  explanation: z.string().min(1),
  /** Concrete fix suggestion, ideally with a short code snippet */
  suggestion: z.string().min(1),
  file: z.string().optional(),
  concept: z.string().optional()
})
export type ReviewIssue = z.infer<typeof ReviewIssueSchema>

export const RequirementCheckSchema = z.object({
  id: z.string().min(1),
  met: z.boolean(),
  /** Evidence from the code (file + what was found) */
  evidence: z.string().min(1)
})
export type RequirementCheck = z.infer<typeof RequirementCheckSchema>

export const MiniLessonSchema = z.object({
  title: z.string().min(1),
  concept: z.string().min(1),
  /** Markdown body in Persian */
  body: z.string().min(40)
})
export type MiniLesson = z.infer<typeof MiniLessonSchema>

export const ReviewResultSchema = z.object({
  score: z.number().min(0).max(100),
  summary: z.string().min(1),
  requirements: z.array(RequirementCheckSchema),
  issues: z.array(ReviewIssueSchema).default([]),
  nextSteps: z.array(z.string()).default([]),
  miniLesson: MiniLessonSchema.nullish()
})
export type ReviewResult = z.infer<typeof ReviewResultSchema>

export interface Verdict {
  passed: boolean
  reasons: string[]
  missingRequirementIds: string[]
  criticalCount: number
}

/**
 * A submission passes only when every requirement of the exercise is verified
 * and no critical issue remains. This keeps completion deterministic and
 * independent of model mood.
 */
export function decideVerdict(
  requirements: RequirementCheck[],
  issues: ReviewIssue[],
  expectedIds: string[]
): Verdict {
  const byId = new Map(requirements.map((r) => [r.id, r]))
  const missingRequirementIds = expectedIds.filter((id) => !byId.get(id)?.met)
  const criticalCount = issues.filter((i) => i.severity === 'critical').length
  const reasons: string[] = []

  if (expectedIds.length === 0) reasons.push('این تمرین معیار پذیرش تعریف‌شده ندارد.')
  for (const id of missingRequirementIds) reasons.push(`معیار «${id}» هنوز تأیید نشده است.`)
  if (criticalCount > 0) reasons.push(`${criticalCount} مشکل بحرانی باید برطرف شود.`)

  return {
    passed: expectedIds.length > 0 && missingRequirementIds.length === 0 && criticalCount === 0,
    reasons,
    missingRequirementIds,
    criticalCount
  }
}

/** Extracts the first balanced JSON object/array from arbitrary model output. */
export function extractJson(text: string): string | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidates = fenced ? [fenced[1], text] : [text]

  for (const candidate of candidates) {
    const start = candidate.search(/[{[]/)
    if (start === -1) continue
    const open = candidate[start]
    const close = open === '{' ? '}' : ']'
    let depth = 0
    let inString = false
    let escaped = false

    for (let i = start; i < candidate.length; i++) {
      const ch = candidate[i]
      if (inString) {
        if (escaped) escaped = false
        else if (ch === '\\') escaped = true
        else if (ch === '"') inString = false
        continue
      }
      if (ch === '"') inString = true
      else if (ch === open) depth++
      else if (ch === close) {
        depth--
        if (depth === 0) {
          const slice = candidate.slice(start, i + 1)
          try {
            JSON.parse(slice)
            return slice
          } catch {
            break
          }
        }
      }
    }
  }
  return null
}

export interface ParsedReview {
  ok: boolean
  data?: ReviewResult
  error?: string
}

export function parseReviewResponse(raw: string): ParsedReview {
  const json = extractJson(raw)
  if (!json) return { ok: false, error: 'پاسخ هوش مصنوعی JSON معتبری نداشت.' }
  try {
    const parsed = ReviewResultSchema.safeParse(JSON.parse(json))
    if (!parsed.success) {
      const first = parsed.error.issues[0]
      return {
        ok: false,
        error: `ساختار پاسخ نامعتبر است (${first?.path.join('.') ?? '?'}: ${first?.message ?? 'unknown'}).`
      }
    }
    return { ok: true, data: parsed.data }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'خطای ناشناخته در تجزیه پاسخ.' }
  }
}
