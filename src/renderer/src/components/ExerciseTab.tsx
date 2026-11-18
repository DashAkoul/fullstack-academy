import { useState } from 'react'
import {
  BookOpen,
  Check,
  ClipboardList,
  Copy,
  ExternalLink,
  Lightbulb,
  ListChecks,
  Rocket,
  Target
} from 'lucide-react'
import type { Lesson } from '@/data/types'
import { moduleById } from '@/data/curriculum'
import { useLessonProgress } from '@/store/useApp'
import { Badge, Callout } from './ui'

export function ExerciseTab({ lesson, onGoReview }: { lesson: Lesson; onGoReview: () => void }) {
  const { exercise } = lesson
  const mod = moduleById(lesson.moduleId)
  const progress = useLessonProgress(lesson.id)
  const [done, setDone] = useState<Record<number, boolean>>({})
  const [copied, setCopied] = useState(false)
  const completed = Boolean(progress.completedAt)

  async function copyRepoName() {
    await navigator.clipboard.writeText(exercise.repoName)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="space-y-5">
      <section className="surface-card overflow-hidden">
        <div className="border-b border-[var(--border-soft)] bg-[var(--surface-2)] px-5 py-4">
          <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-3)]">
            <ClipboardList className="size-3.5" />
            <span>تمرین عملی</span>
            <span>•</span>
            <span>{mod?.title}</span>
            <Badge tone={completed ? 'success' : 'accent'}>{completed ? 'تکمیل‌شده' : 'در جریان'}</Badge>
          </div>
          <h2 className="mt-1.5 text-lg font-bold">{exercise.title}</h2>
        </div>

        <div className="space-y-5 px-5 py-4">
          <div>
            <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-[var(--text-2)]">
              <BookOpen className="size-3.5" /> سناریو
            </h3>
            <p className="text-sm leading-8 text-[var(--text-1)]">{exercise.scenario}</p>
          </div>

          <div>
            <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-[var(--text-2)]">
              <ListChecks className="size-3.5" /> کارهایی که باید انجام دهید
            </h3>
            <ul className="space-y-1.5">
              {exercise.tasks.map((task, i) => (
                <li key={i}>
                  <label className="flex cursor-pointer items-start gap-2.5 rounded-lg px-2 py-1.5 hover:bg-[var(--surface-2)]">
                    <input
                      type="checkbox"
                      className="mt-1.5 size-3.5 accent-[var(--accent)]"
                      checked={Boolean(done[i])}
                      onChange={(e) => setDone((d) => ({ ...d, [i]: e.target.checked }))}
                    />
                    <span className={`text-[0.85rem] leading-7 ${done[i] ? 'text-[var(--text-3)] line-through' : ''}`}>
                      {task}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            <p className="mt-1.5 px-2 text-[0.65rem] text-[var(--text-3)]">
              این تیک‌ها فقط برای نظم شخصی است؛ تأیید نهایی با بازبینی کد انجام می‌شود.
            </p>
          </div>

          <div>
            <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-[var(--text-2)]">
              <Target className="size-3.5" /> معیارهای پذیرش (هوش مصنوعی همین‌ها را بررسی می‌کند)
            </h3>
            <ol className="grid gap-1.5 sm:grid-cols-2">
              {exercise.requirements.map((r) => (
                <li key={r.id} className="flex items-start gap-2 rounded-lg bg-[var(--surface-2)] px-3 py-2 text-[0.8rem] leading-6">
                  <span className="mt-0.5 font-mono text-[0.62rem] text-[var(--text-3)]" dir="ltr">
                    {r.id}
                  </span>
                  <span>{r.text}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="rounded-xl border border-dashed border-[var(--border-soft)] p-3">
            <p className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-2)]">
              نام پیشنهادی مخزن:
              <code className="mx-1.5 rounded bg-[var(--surface-2)] px-1.5 py-0.5 font-mono text-[0.75rem]" dir="ltr">
                {exercise.repoName}
              </code>
              <button className="btn btn-ghost px-1.5 py-0.5 align-middle" onClick={() => void copyRepoName()} aria-label="کپی نام مخزن">
                {copied ? <Check className="size-3.5 text-[var(--success)]" /> : <Copy className="size-3.5" />}
              </button>
              <button
                className="btn btn-ghost ms-auto px-1.5 py-0.5 text-[0.7rem] text-[var(--accent)]"
                onClick={() =>
                  void window.academy.shell.openExternal(
                    `https://github.com/new?name=${encodeURIComponent(exercise.repoName)}&description=${encodeURIComponent(exercise.title)}`
                  )
                }
              >
                <ExternalLink className="size-3.5" />
                ساخت مخزن عمومی در GitHub
              </button>
            </p>
          </div>

          {exercise.hints.length > 0 && (
            <details className="rounded-xl bg-[var(--warning-soft)] px-4 py-3">
              <summary className="flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-[var(--warning)]">
                <Lightbulb className="size-3.5" /> راهنمایی (اول خودتان تلاش کنید)
              </summary>
              <ul className="mt-2 space-y-1.5 text-[0.8rem] leading-6 text-[var(--text-2)]">
                {exercise.hints.map((h, i) => (
                  <li key={i} className="flex gap-1.5">
                    <span className="text-[var(--warning)]">•</span>
                    {h}
                  </li>
                ))}
              </ul>
            </details>
          )}

          <Callout tone="info" title="گردش کار">
            کد را در مخزن GitHub خود پوش کنید، آدرس مخزن را در تب «بازبینی» بگذارید و دکمه‌ی بررسی را بزنید.
            اگر ایرادی پیدا شد، اصلاح کنید، پوش کنید و دوباره بررسی بگیرید تا همه‌ی معیارها تأیید شوند.
          </Callout>

          <div className="flex flex-wrap gap-2">
            <button className="btn btn-primary" onClick={onGoReview}>
              <Rocket className="size-4" />
              {completed ? 'بررسی نسخه جدید' : 'ارسال برای بازبینی'}
            </button>
          </div>
        </div>
      </section>

      <section className="surface-card p-5">
        <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-[var(--text-2)]">
          <ExternalLink className="size-3.5" /> مستندات رسمی این درس
        </h3>
        <ul className="flex flex-wrap gap-2">
          {lesson.docs.map((doc) => (
            <li key={doc.url}>
              <button
                className="chip hover:border-[var(--accent)] hover:text-[var(--accent)]"
                onClick={() => void window.academy.shell.openExternal(doc.url)}
              >
                {doc.title}
                <ExternalLink className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
