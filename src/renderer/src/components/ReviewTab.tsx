import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  GitBranch,
  History,
  KeyRound,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  XCircle
} from 'lucide-react'
import type { RepoSnapshot } from '@shared/types'
import type { IssueSeverity, ReviewIssue, ReviewResult, Verdict } from '@shared/review'
import { parseRepoRef } from '@shared/repoRef'
import type { Lesson } from '@/data/types'
import { lessons } from '@/data/curriculum'
import { isLessonUnlocked, useApp, useLessonProgress, type ReviewAttempt } from '@/store/useApp'
import { useSecrets } from '@/store/useSecrets'
import { fetchRepository, generateMiniLesson, newId, runReview } from '@/lib/reviewService'
import { Markdown } from './Markdown'
import { Badge, Callout, Spinner } from './ui'

type Phase = 'idle' | 'fetching' | 'reviewing' | 'mini' | 'error'

const SEVERITY: Record<IssueSeverity, { label: string; tone: 'danger' | 'warning' | 'neutral' }> = {
  critical: { label: 'بحرانی', tone: 'danger' },
  major: { label: 'مهم', tone: 'warning' },
  minor: { label: 'جزئی', tone: 'neutral' },
  nit: { label: 'سلیقه‌ای', tone: 'neutral' }
}

const PHASE_LABEL: Record<Exclude<Phase, 'idle' | 'error'>, string> = {
  fetching: 'دریافت فایل‌های مخزن از GitHub…',
  reviewing: 'بررسی کد با هوش مصنوعی…',
  mini: 'ساخت مینی‌درس متناسب با نقطه ضعف…'
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso))
  } catch {
    return iso
  }
}

function IssueCard({
  issue,
  onMiniLesson,
  busy
}: {
  issue: ReviewIssue
  onMiniLesson: (issue: ReviewIssue) => void
  busy: boolean
}) {
  const [open, setOpen] = useState(true)
  const meta = SEVERITY[issue.severity]

  return (
    <div className="surface-card overflow-hidden">
      <button className="flex w-full items-start gap-2 px-4 py-3 text-start" onClick={() => setOpen((o) => !o)}>
        <Badge tone={meta.tone}>{meta.label}</Badge>
        <span className="flex-1 text-sm font-semibold leading-6">{issue.title}</span>
        <ChevronDown className={`mt-1 size-4 text-[var(--text-3)] transition-transform ${open ? '' : '-rotate-90'}`} />
      </button>
      {open && (
        <div className="space-y-3 border-t border-[var(--border-soft)] px-4 py-3 text-sm">
          <p className="whitespace-pre-line leading-7 text-[var(--text-2)]">{issue.explanation}</p>
          <div className="rounded-lg bg-[var(--surface-2)] p-3">
            <p className="mb-1 text-[0.7rem] font-semibold text-[var(--text-3)]">پیشنهاد اصلاح</p>
            <Markdown className="text-[0.85rem]">{issue.suggestion}</Markdown>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {issue.file && <span className="chip font-mono" dir="ltr">{issue.file}</span>}
            {issue.concept && <span className="chip">مفهوم: {issue.concept}</span>}
            <button
              className="btn btn-secondary ms-auto text-xs"
              onClick={() => onMiniLesson(issue)}
              disabled={busy}
            >
              {busy ? <Spinner /> : <Sparkles className="size-3.5" />}
              مینی‌درس برای این مفهوم
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export function ReviewTab({ lesson, onOpenSettings }: { lesson: Lesson; onOpenSettings: () => void }) {
  const settings = useApp((s) => s.settings)
  const progress = useApp((s) => s.progress)
  const addAttempt = useApp((s) => s.addAttempt)
  const addMiniLesson = useApp((s) => s.addMiniLesson)
  const setRepoUrl = useApp((s) => s.setRepoUrl)
  const setActiveLesson = useApp((s) => s.setActiveLesson)
  const lessonProgress = useLessonProgress(lesson.id)
  const secrets = useSecrets((s) => s.status)

  const [repoInput, setRepoInput] = useState(lessonProgress.repoUrl ?? '')
  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState<string | null>(null)
  const [snapshot, setSnapshot] = useState<RepoSnapshot | null>(null)
  const [outcome, setOutcome] = useState<{ result: ReviewResult; verdict: Verdict } | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [miniBusy, setMiniBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const latestAttempt = lessonProgress.attempts[0]
  const result = outcome?.result ?? latestAttempt?.result ?? null
  const verdict = outcome?.verdict ?? (latestAttempt ? { passed: latestAttempt.passed, reasons: latestAttempt.reasons, missingRequirementIds: [], criticalCount: 0 } : null)
  const displaySnapshot = snapshot
  const completed = Boolean(lessonProgress.completedAt)

  const hasKey = Boolean(secrets?.apiKeys[settings.provider])
  const busy = phase === 'fetching' || phase === 'reviewing' || phase === 'mini'

  const refCheck = useMemo(() => (repoInput.trim() ? parseRepoRef(repoInput) : null), [repoInput])
  const providerLabel = { gemini: 'Gemini', openai: 'OpenAI', anthropic: 'Anthropic' }[settings.provider]

  const issues = useMemo(() => {
    const order: Record<IssueSeverity, number> = { critical: 0, major: 1, minor: 2, nit: 3 }
    return [...(result?.issues ?? [])].sort((a, b) => order[a.severity] - order[b.severity])
  }, [result])

  function requestMiniLesson(issue: ReviewIssue) {
    void (async () => {
      setMiniBusy(true)
      setError(null)
      try {
        const mini = await generateMiniLesson(lesson, issue, settings)
        addMiniLesson(lesson.id, { ...mini, id: newId(), createdAt: new Date().toISOString(), lessonId: lesson.id })
        setNotice('مینی‌درس ساخته شد و در پایین همین صفحه اضافه شد.')
      } catch (e) {
        setError(e instanceof Error ? e.message : 'ساخت مینی‌درس ناموفق بود.')
      } finally {
        setMiniBusy(false)
      }
    })()
  }

  async function startReview() {
    setError(null)
    setNotice(null)
    const ref = parseRepoRef(repoInput)
    if (!ref) {
      setError('آدرس مخزن معتبر نیست. نمونه‌ی درست: username/repo یا https://github.com/username/repo')
      return
    }
    if (!hasKey) {
      setError(`کلید API برای ${providerLabel} ثبت نشده است. از تنظیمات، کلید خودتان را وارد کنید.`)
      return
    }

    try {
      setPhase('fetching')
      const snap = await fetchRepository(repoInput)
      setSnapshot(snap)

      setPhase('reviewing')
      const { result: reviewResult, verdict: reviewVerdict } = await runReview({
        lesson,
        repoRef: repoInput,
        settings,
        snapshot: snap
      })

      const attempt: ReviewAttempt = {
        id: newId(),
        at: new Date().toISOString(),
        repoUrl: snap.htmlUrl,
        commitSha: snap.commitSha,
        provider: settings.provider,
        model: settings.models[settings.provider],
        result: reviewResult,
        passed: reviewVerdict.passed,
        reasons: reviewVerdict.reasons
      }

      setOutcome({ result: reviewResult, verdict: reviewVerdict })
      setRepoUrl(lesson.id, repoInput.trim())
      addAttempt(lesson.id, attempt, reviewVerdict.passed)
      setPhase('idle')

      if (reviewVerdict.passed) {
        setNotice('تبریک! همه‌ی معیارها تأیید شد و درس تکمیل شد. درس بعدی باز شد.')
        return
      }

      if (!reviewResult.miniLesson) {
        const first = reviewResult.issues.find((i) => i.severity === 'critical') ?? reviewResult.issues[0]
        if (first) {
          setPhase('mini')
          try {
            const mini = await generateMiniLesson(lesson, first, settings)
            addMiniLesson(lesson.id, { ...mini, id: newId(), createdAt: new Date().toISOString(), lessonId: lesson.id })
          } catch {
            /* mini lesson is a bonus; review result is still valid */
          } finally {
            setPhase('idle')
          }
        }
      }
    } catch (e) {
      setPhase('error')
      setError(e instanceof Error ? e.message : 'خطای نامشخص در بازبینی')
    }
  }

  const nextLesson = lessons[lesson.index + 1]
  const nextUnlocked = nextLesson ? isLessonUnlocked(progress, nextLesson.id) : false

  return (
    <div className="space-y-5">
      {/* ------- submission box ------- */}
      <section className="surface-card p-5">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-bold">
              <GitBranch className="size-4 text-[var(--accent)]" />
              مخزن تمرین در GitHub
            </h2>
            <p className="mt-1 text-xs leading-6 text-[var(--text-2)]">
              کد تمرین را در یک مخزن <strong>عمومی</strong> در GitHub پوش کنید و آدرس آن را اینجا بگذارید.
              کد فقط برای بازبینی به سرویس هوش مصنوعی انتخابی شما ارسال می‌شود.
            </p>
          </div>
          <Badge tone={completed ? 'success' : 'neutral'}>{completed ? 'تکمیل‌شده' : 'در انتظار'}</Badge>
        </div>

        <div className="mb-2 flex flex-wrap items-center gap-2 text-[0.7rem] text-[var(--text-3)]">
          <span>مخزن ندارید؟</span>
          <button
            className="btn btn-ghost px-1.5 py-0.5 text-[0.7rem] text-[var(--accent)]"
            onClick={() =>
              void window.academy.shell.openExternal(
                `https://github.com/new?name=${encodeURIComponent(lesson.exercise.repoName)}&description=${encodeURIComponent(lesson.exercise.title)}`
              )
            }
          >
            ساخت مخزن جدید در GitHub
          </button>
          <span>•</span>
          <span>visibility را Public بگذارید</span>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            className="input"
            dir="ltr"
            placeholder="https://github.com/username/fsa-01-landing-page"
            value={repoInput}
            onChange={(e) => setRepoInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !busy) void startReview()
            }}
            aria-label="آدرس مخزن گیت‌هاب"
            disabled={busy}
          />
          <button className="btn btn-primary shrink-0" onClick={() => void startReview()} disabled={busy}>
            {busy ? <Spinner /> : result ? <RefreshCw className="size-4" /> : <Sparkles className="size-4" />}
            {busy ? 'در حال بررسی…' : completed ? 'بررسی نسخه جدید' : result ? 'بررسی مجدد' : 'بررسی مخزن'}
          </button>
        </div>

        {repoInput.trim() && !refCheck && (
          <p className="mt-2 text-xs text-[var(--danger)]">آدرس معتبر نیست. الگو: username/repo</p>
        )}
        {refCheck && (
          <p className="mt-2 font-mono text-[0.68rem] text-[var(--text-3)]" dir="ltr">
            {refCheck.owner}/{refCheck.repo}
            {refCheck.branch ? ` @ ${refCheck.branch}` : ''}
          </p>
        )}

        {!hasKey && (
          <div className="mt-3">
            <Callout tone="warning" title="کلید هوش مصنوعی تنظیم نشده" icon={<KeyRound className="size-4" />}>
              بازبینی کد با کلید API خودتان انجام می‌شود. برای {providerLabel} کلیدی ثبت نکرده‌اید.{' '}
              <button className="underline" onClick={onOpenSettings}>
                رفتن به تنظیمات
              </button>
            </Callout>
          </div>
        )}

        {busy && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-[var(--surface-2)] px-3 py-2 text-xs text-[var(--text-2)]">
            <Loader2 className="size-3.5 animate-spin text-[var(--accent)]" />
            {PHASE_LABEL[phase as keyof typeof PHASE_LABEL]}
          </div>
        )}

        {error && (
          <div className="mt-3">
            <Callout tone="danger" title="بازبینی انجام نشد" icon={<XCircle className="size-4" />}>
              <span className="whitespace-pre-line">{error}</span>
              {error.includes('کلید API') && (
                <button className="ms-2 underline" onClick={onOpenSettings}>
                  تنظیمات
                </button>
              )}
            </Callout>
          </div>
        )}

        {notice && !error && (
          <div className="mt-3">
            <Callout tone="success" icon={<CheckCircle2 className="size-4" />}>
              {notice}
            </Callout>
          </div>
        )}
      </section>

      {lessonProgress.attempts.length === 0 && !busy && (
        <section className="grid gap-3 sm:grid-cols-3">
          {[
            { n: '۱', title: 'مخزن عمومی بسازید', body: `در GitHub یک مخزن Public با نام ${lesson.exercise.repoName} بسازید.` },
            { n: '۲', title: 'کد را پوش کنید', body: 'تمرین را کامل کنید و با پیام commit معنادار پوش کنید.' },
            { n: '۳', title: 'بررسی بگیرید', body: 'آدرس مخزن را بالا بگذارید؛ بازخورد و معیارهای تأییدنشده را ببینید.' }
          ].map((step) => (
            <div key={step.n} className="surface-card px-4 py-3">
              <div className="mb-1 flex items-center gap-2">
                <span className="grid size-5 place-items-center rounded-full bg-[var(--accent-soft)] font-mono text-[0.65rem] text-[var(--accent)]">
                  {step.n}
                </span>
                <span className="text-xs font-semibold">{step.title}</span>
              </div>
              <p className="text-[0.72rem] leading-6 text-[var(--text-3)]">{step.body}</p>
            </div>
          ))}
        </section>
      )}

      {/* ------- repo info ------- */}
      {displaySnapshot && (
        <section className="surface-card flex flex-wrap items-center gap-x-5 gap-y-2 px-5 py-3 text-xs text-[var(--text-2)]">
          <span className="font-semibold text-[var(--text-1)]">{displaySnapshot.fullName}</span>
          <button
            className="inline-flex items-center gap-1 text-[var(--accent)]"
            onClick={() => void window.academy.shell.openExternal(displaySnapshot.htmlUrl)}
          >
            <ExternalLink className="size-3" /> مخزن
          </button>
          <span className="chip font-mono" dir="ltr">
            {displaySnapshot.branch}
          </span>
          <span className="chip font-mono" dir="ltr">
            {displaySnapshot.commitSha.slice(0, 7)}
          </span>
          <span>{displaySnapshot.files.length} فایل بررسی شد</span>
          {displaySnapshot.isPrivate && <Badge tone="warning">خصوصی</Badge>}
        </section>
      )}

      {/* ------- verdict ------- */}
      {result && verdict && (
        <section
          className={`surface-card border-s-4 p-5 ${
            verdict.passed
              ? 'border-s-[var(--success)]'
              : 'border-s-[var(--warning)]'
          }`}
        >
          <div className="flex flex-wrap items-center gap-3">
            {verdict.passed ? (
              <CheckCircle2 className="size-6 text-[var(--success)]" />
            ) : (
              <ShieldAlert className="size-6 text-[var(--warning)]" />
            )}
            <h2 className="text-base font-bold">
              {verdict.passed ? 'تمرین تأیید شد' : 'نیاز به اصلاح دارد'}
            </h2>
            <Badge tone={verdict.passed ? 'success' : 'warning'}>امتیاز {result.score}/100</Badge>
            <span className="ms-auto text-[0.7rem] text-[var(--text-3)]">
              {settings.provider}/{settings.models[settings.provider]}
            </span>
          </div>

          <p className="mt-3 whitespace-pre-line text-sm leading-7 text-[var(--text-2)]">{result.summary}</p>

          {!verdict.passed && verdict.reasons.length > 0 && (
            <ul className="mt-3 space-y-1 text-xs text-[var(--warning)]">
              {verdict.reasons.map((r) => (
                <li key={r} className="flex gap-1.5">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                  {r}
                </li>
              ))}
            </ul>
          )}

          {verdict.passed && nextLesson && (
            <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg bg-[var(--success-soft)] px-3 py-2.5 text-xs">
              <span>
                درس بعدی: <strong>{nextLesson.title}</strong>
              </span>
              <button
                className="btn btn-primary ms-auto text-xs"
                onClick={() => setActiveLesson(nextLesson.id)}
                disabled={!nextUnlocked}
              >
                <ArrowLeft className="size-3.5" />
                {nextUnlocked ? 'رفتن به درس بعدی' : 'در انتظار تکمیل این درس'}
              </button>
            </div>
          )}

          {result.nextSteps.length > 0 && (
            <div className="mt-4">
              <h3 className="mb-1.5 text-xs font-semibold text-[var(--text-2)]">قدم‌های بعدی</h3>
              <ol className="list-inside list-decimal space-y-1 text-xs leading-6 text-[var(--text-2)]">
                {result.nextSteps.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ol>
            </div>
          )}
        </section>
      )}

      {/* ------- requirements ------- */}
      {result && (
        <section className="surface-card p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold">
            <CheckCircle2 className="size-4 text-[var(--accent)]" />
            معیارهای پذیرش
          </h2>
          <ul className="space-y-2">
            {lesson.exercise.requirements.map((req) => {
              const check = result.requirements.find((r) => r.id === req.id)
              const met = Boolean(check?.met)
              return (
                <li key={req.id} className="flex gap-2.5 rounded-lg bg-[var(--surface-2)] px-3 py-2.5">
                  {met ? (
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[var(--success)]" />
                  ) : (
                    <XCircle className="mt-0.5 size-4 shrink-0 text-[var(--danger)]" />
                  )}
                  <div className="min-w-0">
                    <p className="text-[0.82rem] font-medium leading-6">{req.text}</p>
                    <p className="mt-0.5 text-[0.72rem] leading-6 text-[var(--text-3)]">
                      {check?.evidence ?? 'هوش مصنوعی برای این معیار شاهدی در کد پیدا نکرد.'}
                    </p>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {/* ------- issues ------- */}
      {issues.length > 0 && (
        <section className="space-y-2">
          <h2 className="flex items-center gap-2 text-sm font-bold">
            <AlertTriangle className="size-4 text-[var(--warning)]" />
            نکات بازبینی ({issues.length})
          </h2>
          {issues.map((issue, i) => (
            <IssueCard key={`${issue.title}-${i}`} issue={issue} onMiniLesson={requestMiniLesson} busy={miniBusy} />
          ))}
        </section>
      )}

      {/* ------- mini lessons ------- */}
      {lessonProgress.miniLessons.length > 0 && (
        <section className="space-y-2">
          <h2 className="flex items-center gap-2 text-sm font-bold">
            <BookOpen className="size-4 text-[var(--accent)]" />
            مینی‌درس‌های شما ({lessonProgress.miniLessons.length})
          </h2>
          {lessonProgress.miniLessons.map((mini) => (
            <details key={mini.id} className="surface-card group px-4 py-3" open={mini.id === lessonProgress.miniLessons[0]?.id}>
              <summary className="cursor-pointer list-none">
                <span className="text-sm font-semibold">{mini.title}</span>
                <span className="ms-2 chip">{mini.concept}</span>
                <span className="float-left text-[0.65rem] text-[var(--text-3)]">{formatDate(mini.createdAt)}</span>
              </summary>
              <div className="mt-3 border-t border-[var(--border-soft)] pt-3">
                <Markdown>{mini.body}</Markdown>
              </div>
            </details>
          ))}
        </section>
      )}

      {/* ------- AI-suggested mini lesson from the review itself ------- */}
      {result?.miniLesson && (
        <section className="surface-card p-5">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-bold">
            <Sparkles className="size-4 text-[var(--accent)]" />
            مینی‌درس پیشنهادی: {result.miniLesson.title}
          </h2>
          <Markdown>{result.miniLesson.body}</Markdown>
        </section>
      )}

      {/* ------- history ------- */}
      {lessonProgress.attempts.length > 0 && (
        <section className="surface-card p-4">
          <button className="flex w-full items-center gap-2 text-sm font-semibold" onClick={() => setShowHistory((h) => !h)}>
            <History className="size-4 text-[var(--text-3)]" />
            تاریخچه بازبینی ({lessonProgress.attempts.length})
            <ChevronDown className={`ms-auto size-4 transition-transform ${showHistory ? '' : '-rotate-90'}`} />
          </button>
          {showHistory && (
            <ul className="mt-3 divide-y divide-[var(--border-soft)]">
              {lessonProgress.attempts.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center gap-2 py-2 text-xs">
                  {a.passed ? (
                    <CheckCircle2 className="size-3.5 text-[var(--success)]" />
                  ) : (
                    <XCircle className="size-3.5 text-[var(--danger)]" />
                  )}
                  <span className="font-mono" dir="ltr">
                    {a.commitSha.slice(0, 7)}
                  </span>
                  <span className="text-[var(--text-2)]">امتیاز {a.result.score}</span>
                  <span className="text-[var(--text-3)]">{a.provider}</span>
                  <button
                    className="text-[var(--accent)]"
                    onClick={() => void window.academy.shell.openExternal(`${a.repoUrl}/commit/${a.commitSha}`)}
                  >
                    مشاهده commit
                  </button>
                  <span className="ms-auto text-[var(--text-3)]">{formatDate(a.at)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  )
}
