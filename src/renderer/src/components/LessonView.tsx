import { lazy, Suspense, useEffect, useState } from 'react'
import {
  BookOpen,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileCode2,
  Lock,
  Rocket,
  ShieldCheck
} from 'lucide-react'
import { lessonById, lessons, moduleById } from '@/data/curriculum'
import { isLessonUnlocked, useApp, useLessonProgress } from '@/store/useApp'
import { Markdown } from './Markdown'
import { ExerciseTab } from './ExerciseTab'

import { Badge, Spinner } from './ui'

const ReviewTab = lazy(() => import('./ReviewTab').then((m) => ({ default: m.ReviewTab })))

type Tab = 'lesson' | 'exercise' | 'review'

const TABS: { id: Tab; label: string; icon: typeof BookOpen }[] = [
  { id: 'lesson', label: 'درس', icon: BookOpen },
  { id: 'exercise', label: 'تمرین', icon: FileCode2 },
  { id: 'review', label: 'بازبینی کد', icon: ShieldCheck }
]

export function LessonView({ onOpenSettings }: { onOpenSettings: () => void }) {
  const activeLessonId = useApp((s) => s.activeLessonId)
  const progress = useApp((s) => s.progress)
  const setActiveLesson = useApp((s) => s.setActiveLesson)
  const lesson = lessonById(activeLessonId)
  const lessonProgress = useLessonProgress(activeLessonId)
  const [tab, setTab] = useState<Tab>('lesson')
  const [seen, setSeen] = useState<Record<Tab, boolean>>({ lesson: true, exercise: false, review: false })

  useEffect(() => {
    setTab('lesson')
    setSeen({ lesson: true, exercise: false, review: false })
    document.getElementById('lesson-scroll')?.scrollTo({ top: 0 })
  }, [activeLessonId])

  useEffect(() => {
    setSeen((prev) => (prev[tab] ? prev : { ...prev, [tab]: true }))
    document.getElementById('lesson-scroll')?.scrollTo({ top: 0 })
  }, [tab])

  if (!lesson) return null

  const mod = moduleById(lesson.moduleId)
  const unlocked = isLessonUnlocked(progress, lesson.id)
  const completed = Boolean(lessonProgress.completedAt)
  const previous = lesson.index > 0 ? lessons[lesson.index - 1] : null
  const prevCompleted = previous ? Boolean(progress[previous.id]?.completedAt) : true

  if (!unlocked) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="surface-card max-w-md p-8 text-center">
          <div className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-[var(--surface-2)]">
            <Lock className="size-6 text-[var(--text-3)]" />
          </div>
          <h2 className="text-base font-bold">این درس هنوز قفل است</h2>
          <p className="mt-2 text-sm leading-7 text-[var(--text-2)]">
            مسیر یادگیری ترتیبی است. برای باز شدن «{lesson.title}» ابتدا تمرین درس قبل را با موفقیت به پایان
            برسانید.
          </p>
          {previous && (
            <button className="btn btn-primary mt-5" onClick={() => setActiveLesson(previous.id)}>
              {prevCompleted ? 'بازگشت به درس قبل' : `رفتن به «${previous.title}»`}
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* header */}
      <header className="border-b border-[var(--border-soft)] bg-[var(--surface-1)]/70 px-6 pt-4 pb-0 backdrop-blur">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="mb-1 flex items-center gap-1.5 text-[0.68rem] text-[var(--text-3)]">
              <span>{mod?.title}</span>
              <span>/</span>
              <span>
                درس {lesson.index + 1} از {lessons.length}
              </span>
            </p>
            <h1 className="flex items-center gap-2 text-xl font-bold">
              {lesson.title}
              {completed && <CheckCircle2 className="size-4 text-[var(--success)]" aria-label="تکمیل‌شده" />}
            </h1>
            <p className="mt-1 max-w-2xl text-xs leading-6 text-[var(--text-2)]">{lesson.summary}</p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <span className="chip">
              <Clock className="size-3" /> {lesson.minutes} دقیقه
            </span>
            <Badge tone={completed ? 'success' : lessonProgress.attempts.length ? 'warning' : 'neutral'}>
              {completed ? 'تکمیل‌شده' : lessonProgress.attempts.length ? `${lessonProgress.attempts.length} بازبینی` : 'شروع نشده'}
            </Badge>
          </div>
        </div>

        <nav className="mt-4 flex gap-1" aria-label="بخش‌های درس">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              aria-current={tab === id ? 'page' : undefined}
              className={`flex items-center gap-1.5 rounded-t-lg border-b-2 px-3.5 py-2 text-xs font-medium transition-colors ${
                tab === id
                  ? 'border-[var(--accent)] text-[var(--text-1)]'
                  : 'border-transparent text-[var(--text-3)] hover:text-[var(--text-1)]'
              }`}
            >
              <Icon className="size-3.5" />
              {label}
              {id === 'review' && completed && <span className="size-1.5 rounded-full bg-[var(--success)]" />}
            </button>
          ))}
        </nav>
      </header>

      {/* body */}
      <div id="lesson-scroll" className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-6 py-6">
          <div className={tab === 'lesson' ? 'animate-in' : 'hidden'}>
              <Markdown>{lesson.content}</Markdown>

              <div className="mt-8 flex flex-wrap items-center gap-3 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-1)] px-4 py-3">
                <div className="text-xs text-[var(--text-2)]">
                  آماده‌ی تمرین هستید؟ تمرین این درس یک سناریوی واقعی دارد.
                </div>
                <button className="btn btn-primary ms-auto text-xs" onClick={() => setTab('exercise')}>
                  <Rocket className="size-3.5" /> دیدن تمرین
                </button>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {lesson.docs.map((doc) => (
                  <button
                    key={doc.url}
                    className="chip hover:border-[var(--accent)] hover:text-[var(--accent)]"
                    onClick={() => void window.academy.shell.openExternal(doc.url)}
                  >
                    {doc.title}
                    <ExternalLink className="size-3" />
                  </button>
                ))}
              </div>
          </div>

          {seen.exercise && (
            <div className={tab === 'exercise' ? 'animate-in' : 'hidden'}>
              <ExerciseTab lesson={lesson} onGoReview={() => setTab('review')} />
            </div>
          )}

          {seen.review && (
            <div className={tab === 'review' ? 'animate-in' : 'hidden'}>
              <Suspense fallback={<div className="flex justify-center py-10"><Spinner /></div>}>
                <ReviewTab lesson={lesson} onOpenSettings={onOpenSettings} />
              </Suspense>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
