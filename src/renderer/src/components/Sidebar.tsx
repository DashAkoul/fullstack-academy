import { useMemo, useState } from 'react'
import {
  Atom,
  CheckCircle2,
  ChevronDown,
  Circle,
  GraduationCap,
  Layout,
  Lock,
  Server,
  ShieldCheck,
  Smartphone,
  Wrench
} from 'lucide-react'
import { modules } from '@/data/curriculum'
import { isLessonUnlocked, useApp } from '@/store/useApp'
import { ProgressBar } from './ui'

const ICONS: Record<string, typeof Layout> = {
  Layout,
  Wrench,
  Atom,
  Smartphone,
  Server,
  ShieldCheck
}

export function Sidebar({ onOpenSettings }: { onOpenSettings: () => void }) {
  const progress = useApp((s) => s.progress)
  const activeLessonId = useApp((s) => s.activeLessonId)
  const setActiveLesson = useApp((s) => s.setActiveLesson)
  const settings = useApp((s) => s.settings)
  const setSettings = useApp((s) => s.setSettings)

  const activeModuleId = useMemo(
    () => modules.find((m) => m.lessons.some((l) => l.id === activeLessonId))?.id,
    [activeLessonId]
  )
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  const total = modules.reduce((n, m) => n + m.lessons.length, 0)
  const completed = Object.values(progress).filter((p) => p.completedAt).length

  return (
    <aside className="flex h-full w-[312px] shrink-0 flex-col border-l border-[var(--border-soft)] bg-[var(--surface-1)]">
      <div className="flex items-center gap-2.5 px-5 pt-5 pb-4">
        <div className="grid size-9 place-items-center rounded-xl bg-[var(--accent)] text-white">
          <GraduationCap className="size-5" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold leading-tight">آکادمی فول‌استک</p>
          <p className="text-[0.68rem] text-[var(--text-3)]">از صفر تا مهندس فول‌استک</p>
        </div>
        <button
          className="btn btn-ghost ms-auto px-2 py-1"
          onClick={onOpenSettings}
          title="تنظیمات"
          aria-label="تنظیمات"
        >
          <Wrench className="size-4" />
        </button>
      </div>

      <div className="px-5 pb-4">
        <div className="mb-1.5 flex items-center justify-between text-[0.7rem] text-[var(--text-2)]">
          <span>پیشرفت مسیر</span>
          <span className="font-mono" dir="ltr">
            {completed}/{total}
          </span>
        </div>
        <ProgressBar value={total ? completed / total : 0} />
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4" aria-label="سرفصل دوره">
        {modules.map((mod) => {
          const Icon = ICONS[mod.icon] ?? Layout
          const isActive = mod.id === activeModuleId
          const open = !collapsed[mod.id] || isActive
          const done = mod.lessons.filter((l) => progress[l.id]?.completedAt).length

          return (
            <div key={mod.id} className="mb-1">
              <button
                className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-start transition-colors ${
                  isActive ? 'text-[var(--text-1)]' : 'text-[var(--text-2)] hover:text-[var(--text-1)]'
                }`}
                onClick={() => setCollapsed((c) => ({ ...c, [mod.id]: open }))}
                aria-expanded={open}
              >
                <Icon className={`size-4 ${isActive ? 'text-[var(--accent)]' : 'text-[var(--text-3)]'}`} />
                <span className="flex-1 text-[0.8rem] font-semibold">{mod.title}</span>
                <span className="font-mono text-[0.65rem] text-[var(--text-3)]" dir="ltr">
                  {done}/{mod.lessons.length}
                </span>
                <ChevronDown className={`size-3.5 transition-transform ${open ? '' : '-rotate-90'}`} />
              </button>

              {open && (
                <ul className="mt-0.5 mb-2 space-y-0.5 pe-1 ps-3">
                  {mod.lessons.map((lesson) => {
                    const unlocked = isLessonUnlocked(progress, lesson.id)
                    const isDone = Boolean(progress[lesson.id]?.completedAt)
                    const inReview = Boolean(progress[lesson.id]?.attempts.length) && !isDone
                    const active = lesson.id === activeLessonId

                    return (
                      <li key={lesson.id}>
                        <button
                          disabled={!unlocked}
                          onClick={() => setActiveLesson(lesson.id)}
                          className={`group flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-start text-[0.78rem] transition-colors ${
                            active
                              ? 'bg-[var(--accent-soft)] text-[var(--text-1)]'
                              : unlocked
                                ? 'text-[var(--text-2)] hover:bg-[var(--surface-2)] hover:text-[var(--text-1)]'
                                : 'cursor-not-allowed text-[var(--text-3)] opacity-60'
                          }`}
                          title={unlocked ? lesson.title : 'برای باز شدن، درس قبلی را کامل کنید'}
                        >
                          {!unlocked ? (
                            <Lock className="size-3.5 shrink-0" aria-label="قفل" />
                          ) : isDone ? (
                            <CheckCircle2 className="size-3.5 shrink-0 text-[var(--success)]" aria-label="تکمیل‌شده" />
                          ) : (
                            <Circle
                              className={`size-3.5 shrink-0 ${inReview ? 'text-[var(--warning)]' : 'text-[var(--text-3)]'}`}
                              aria-hidden
                            />
                          )}
                          <span className="flex-1 leading-5">{lesson.title}</span>
                          {inReview && <span className="text-[0.6rem] text-[var(--warning)]">در بازبینی</span>}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )
        })}
      </nav>

      <div className="border-t border-[var(--border-soft)] p-3">
        <button
          className="btn btn-secondary w-full justify-between text-[0.75rem]"
          onClick={() => setSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' })}
        >
          <span>{settings.theme === 'dark' ? 'حالت روشن' : 'حالت تاریک'}</span>
          <span className="font-mono text-[0.65rem] text-[var(--text-3)]" dir="ltr">
            {settings.theme}
          </span>
        </button>
      </div>
    </aside>
  )
}
