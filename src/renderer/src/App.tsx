import { useEffect, useState } from 'react'
import { GraduationCap, KeyRound, Moon, Settings2, Sparkles, Sun } from 'lucide-react'
import { useApp } from '@/store/useApp'
import { useSecrets } from '@/store/useSecrets'
import { Sidebar } from '@/components/Sidebar'
import { LessonView } from '@/components/LessonView'
import { SettingsDialog } from '@/components/SettingsDialog'
import { Spinner } from '@/components/ui'

function TopBar({ onOpenSettings }: { onOpenSettings: () => void }) {
  const settings = useApp((s) => s.settings)
  const setSettings = useApp((s) => s.setSettings)
  const progress = useApp((s) => s.progress)
  const secrets = useSecrets((s) => s.status)
  const refresh = useSecrets((s) => s.refresh)

  useEffect(() => {
    void refresh()
  }, [refresh])

  const hasKey = Boolean(secrets?.apiKeys[settings.provider])
  const completed = Object.values(progress).filter((p) => p.completedAt).length

  return (
    <div className="flex h-12 shrink-0 items-center gap-2 border-b border-[var(--border-soft)] bg-[var(--surface-1)] px-4">
      <span className="text-[0.7rem] font-medium text-[var(--text-2)]">مسیر یادگیری فول‌استک</span>
      <span className="text-[0.65rem] text-[var(--text-3)]">•</span>
      <span className="text-[0.65rem] text-[var(--text-3)]">{completed} درس تکمیل‌شده</span>

      <div className="ms-auto flex items-center gap-1.5">
        <button
          className={`chip ${hasKey ? 'text-[var(--success)]' : 'text-[var(--warning)]'}`}
          onClick={onOpenSettings}
          title={hasKey ? `کلید ${settings.provider} ثبت شده` : 'کلید هوش مصنوعی ثبت نشده'}
        >
          {hasKey ? <Sparkles className="size-3" /> : <KeyRound className="size-3" />}
          {hasKey ? settings.provider : 'کلید AI'}
        </button>
        <button
          className="btn btn-ghost px-2 py-1"
          onClick={() => setSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' })}
          aria-label="تغییر تم"
          title="تغییر تم"
        >
          {settings.theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </button>
        <button className="btn btn-ghost px-2 py-1" onClick={onOpenSettings} aria-label="تنظیمات" title="تنظیمات">
          <Settings2 className="size-4" />
        </button>
      </div>
    </div>
  )
}

export default function App() {
  const hydrated = useApp((s) => s.hydrated)
  const [settingsOpen, setSettingsOpen] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSettingsOpen(false)
      if ((e.ctrlKey || e.metaKey) && e.key === ',') {
        e.preventDefault()
        setSettingsOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!hydrated) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 bg-[var(--surface-0)]">
        <div className="grid size-12 place-items-center rounded-2xl bg-[var(--accent)] text-white">
          <GraduationCap className="size-6" />
        </div>
        <div className="flex items-center gap-2 text-xs text-[var(--text-3)]">
          <Spinner /> در حال بارگذاری پیشرفت…
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full overflow-hidden bg-[var(--surface-0)]">
      <Sidebar onOpenSettings={() => setSettingsOpen(true)} />
      <main className="flex min-w-0 flex-1 flex-col">
        <TopBar onOpenSettings={() => setSettingsOpen(true)} />
        <div className="min-h-0 flex-1">
          <LessonView onOpenSettings={() => setSettingsOpen(true)} />
        </div>
      </main>
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  )
}
