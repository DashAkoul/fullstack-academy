import { useEffect, useRef, useState } from 'react'
import {
  CheckCircle2,
  Copy,
  GitBranch,
  KeyRound,
  Loader2,
  Lock,
  LogOut,
  Palette,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Trash2,
  TriangleAlert
} from 'lucide-react'
import type { AIProvider, DeviceCodeResponse } from '@shared/types'
import { AI_PROVIDERS, DEFAULT_MODELS } from '@shared/types'
import { useApp } from '@/store/useApp'
import { useSecrets } from '@/store/useSecrets'
import { Badge, Callout, Modal, Spinner } from './ui'

const PROVIDER_INFO: Record<AIProvider, { label: string; hint: string; keyUrl: string }> = {
  gemini: {
    label: 'Google Gemini',
    hint: 'کلید را از Google AI Studio بسازید. مدل پیشنهادی: gemini-2.5-flash',
    keyUrl: 'https://aistudio.google.com/app/apikey'
  },
  openai: {
    label: 'OpenAI',
    hint: 'کلید را از پنل OpenAI بسازید. امکان تنظیم Base URL سازگار (پروکسی/OpenRouter) هم هست.',
    keyUrl: 'https://platform.openai.com/api-keys'
  },
  anthropic: {
    label: 'Anthropic',
    hint: 'کلید را از Anthropic Console بسازید. مدل پیشنهادی: claude-sonnet-4-5',
    keyUrl: 'https://console.anthropic.com/settings/keys'
  }
}

function Section({
  title,
  icon,
  children,
  description
}: {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
  description?: string
}) {
  return (
    <section className="border-b border-[var(--border-soft)] py-5 first:pt-0 last:border-b-0">
      <h3 className="flex items-center gap-2 text-sm font-bold">
        {icon}
        {title}
      </h3>
      {description && <p className="mt-1 text-xs leading-6 text-[var(--text-3)]">{description}</p>}
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  )
}

export function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const settings = useApp((s) => s.settings)
  const setSettings = useApp((s) => s.setSettings)
  const setProviderModel = useApp((s) => s.setProviderModel)
  const resetAll = useApp((s) => s.resetAll)
  const progress = useApp((s) => s.progress)
  const secrets = useSecrets((s) => s.status)
  const refreshSecrets = useSecrets((s) => s.refresh)

  const [keyDraft, setKeyDraft] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [patDraft, setPatDraft] = useState('')
  const [dataPath, setDataPath] = useState('')
  const [device, setDevice] = useState<DeviceCodeResponse | null>(null)
  const [deviceError, setDeviceError] = useState<string | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const cancelled = useRef(false)

  const provider = settings.provider

  useEffect(() => {
    if (open) void refreshSecrets()
    else setDevice(null)
  }, [open, refreshSecrets])

  useEffect(() => {
    if (!open) return
    void window.academy.app.info().then((info) => setDataPath(info.dataPath))
  }, [open])

  // OAuth device flow polling
  useEffect(() => {
    if (!device) return
    cancelled.current = false
    let interval = device.interval
    let timer: ReturnType<typeof setTimeout>

    const poll = async () => {
      try {
        const res = await window.academy.github.pollDeviceFlow(settings.githubClientId, device.deviceCode)
        if (cancelled.current) return
        switch (res.status) {
          case 'success':
            setDevice(null)
            setNotice(`به GitHub متصل شدید: ${res.login}`)
            await refreshSecrets()
            return
          case 'pending':
            timer = setTimeout(poll, interval * 1000)
            return
          case 'slow_down':
            interval = res.interval ?? interval + 5
            timer = setTimeout(poll, interval * 1000)
            return
          default:
            setDevice(null)
            setDeviceError(res.message)
        }
      } catch (e) {
        if (!cancelled.current) {
          setDevice(null)
          setDeviceError(e instanceof Error ? e.message : 'خطای ورود به GitHub')
        }
      }
    }

    timer = setTimeout(poll, interval * 1000)
    return () => {
      cancelled.current = true
      clearTimeout(timer)
    }
  }, [device, settings.githubClientId, refreshSecrets])

  function flash(msg: string) {
    setNotice(msg)
    setTimeout(() => setNotice(null), 4000)
  }

  async function saveKey() {
    setError(null)
    if (keyDraft.trim().length < 10) {
      setError('کلید واردشده معتبر به نظر نمی‌رسد.')
      return
    }
    setBusy('key')
    try {
      await window.academy.secrets.setApiKey(provider, keyDraft.trim())
      await refreshSecrets()
      setKeyDraft('')
      flash(`کلید ${PROVIDER_INFO[provider].label} ذخیره شد.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ذخیره کلید ناموفق بود')
    } finally {
      setBusy(null)
    }
  }

  async function removeKey() {
    setBusy('key')
    setError(null)
    try {
      await window.academy.secrets.setApiKey(provider, null)
      await refreshSecrets()
      flash(`کلید ${PROVIDER_INFO[provider].label} حذف شد.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'حذف کلید ناموفق بود')
    } finally {
      setBusy(null)
    }
  }

  async function connectPat() {
    setError(null)
    if (patDraft.trim().length < 20) {
      setError('توکن GitHub معتبر به نظر نمی‌رسد.')
      return
    }
    setBusy('pat')
    try {
      await window.academy.secrets.setGithubToken(patDraft.trim())
      await refreshSecrets()
      setPatDraft('')
      flash('توکن GitHub ذخیره شد.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'اتصال به GitHub ناموفق بود')
    } finally {
      setBusy(null)
    }
  }

  async function disconnectGithub() {
    setBusy('github')
    try {
      await window.academy.secrets.setGithubToken(null)
      await refreshSecrets()
      flash('اتصال GitHub قطع شد.')
    } finally {
      setBusy(null)
    }
  }

  async function startDeviceFlow() {
    setError(null)
    setDeviceError(null)
    if (!settings.githubClientId.trim()) {
      setDeviceError('ابتدا Client ID برنامه OAuth گیت‌هاب را وارد کنید.')
      return
    }
    setBusy('device')
    try {
      setDevice(await window.academy.github.startDeviceFlow(settings.githubClientId))
    } catch (e) {
      setDeviceError(e instanceof Error ? e.message : 'شروع ورود ناموفق بود')
    } finally {
      setBusy(null)
    }
  }

  const github = secrets?.github
  const keySaved = Boolean(secrets?.apiKeys[provider])
  const completedCount = Object.values(progress).filter((p) => p.completedAt).length

  return (
    <Modal open={open} onClose={onClose} title="تنظیمات" wide>
      {notice && (
        <div className="mb-4">
          <Callout tone="success" icon={<CheckCircle2 className="size-4" />}>
            {notice}
          </Callout>
        </div>
      )}
      {error && (
        <div className="mb-4">
          <Callout tone="danger" icon={<TriangleAlert className="size-4" />}>
            {error}
          </Callout>
        </div>
      )}

      <Section
        title="هوش مصنوعی (BYOK)"
        icon={<Sparkles className="size-4 text-[var(--accent)]" />}
        description="کلید API شما فقط در همین رایانه ذخیره می‌شود و هرگز در کد یا فضای ابری قرار نمی‌گیرد."
      >
        <div className="flex flex-wrap gap-2">
          {AI_PROVIDERS.map((p) => (
            <button
              key={p}
              onClick={() => setSettings({ provider: p })}
              className={`btn text-xs ${p === provider ? 'btn-primary' : 'btn-secondary'}`}
            >
              {PROVIDER_INFO[p].label}
              {secrets?.apiKeys[p] ? (
                <CheckCircle2 className="size-3.5" />
              ) : (
                <span className="size-1.5 rounded-full bg-current opacity-40" />
              )}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 text-xs text-[var(--text-2)]">
          {keySaved ? (
            <Badge tone="success">کلید ثبت شده است</Badge>
          ) : (
            <Badge tone="warning">کلید ثبت نشده</Badge>
          )}
          {secrets?.encrypted ? (
            <span className="inline-flex items-center gap-1 text-[var(--success)]">
              <Lock className="size-3" /> رمزنگاری با Keychain سیستم
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[var(--warning)]">
              <TriangleAlert className="size-3" /> رمزنگاری سیستمی در دسترس نیست
            </span>
          )}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="password"
            className="input"
            placeholder={`API key ${PROVIDER_INFO[provider].label}`}
            value={keyDraft}
            onChange={(e) => setKeyDraft(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
          <button className="btn btn-primary shrink-0" onClick={() => void saveKey()} disabled={busy === 'key'}>
            {busy === 'key' ? <Spinner /> : <KeyRound className="size-4" />}
            ذخیره
          </button>
          {keySaved && (
            <button className="btn btn-danger shrink-0" onClick={() => void removeKey()} disabled={busy === 'key'}>
              <Trash2 className="size-4" />
              حذف
            </button>
          )}
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <label className="block text-xs text-[var(--text-2)]">
            مدل
            <input
              className="input mt-1"
              dir="ltr"
              value={settings.models[provider]}
              placeholder={DEFAULT_MODELS[provider]}
              onChange={(e) => setProviderModel(provider, e.target.value)}
            />
          </label>
          <label className="block text-xs text-[var(--text-2)]">
            Base URL {provider !== 'openai' && '(فقط برای OpenAI-compatible)'}
            <input
              className="input mt-1 disabled:opacity-50"
              dir="ltr"
              placeholder="https://api.openai.com/v1"
              value={settings.baseUrl}
              onChange={(e) => setSettings({ baseUrl: e.target.value })}
              disabled={provider !== 'openai'}
            />
          </label>
        </div>

        <p className="text-[0.7rem] leading-6 text-[var(--text-3)]">
          {PROVIDER_INFO[provider].hint}{' '}
          <button
            className="underline"
            onClick={() => void window.academy.shell.openExternal(PROVIDER_INFO[provider].keyUrl)}
          >
            ساخت کلید
          </button>
        </p>
      </Section>

      <Section
        title="اتصال GitHub"
        icon={<GitBranch className="size-4" />}
        description="برای بررسی مخازن خصوصی و جلوگیری از محدودیت نرخ API. دسترسی فقط خواندن مخازن است."
      >
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {github?.connected ? (
            <>
              <Badge tone="success">
                متصل به {github.login} ({github.method === 'oauth' ? 'OAuth' : 'توکن'})
              </Badge>
              <button className="btn btn-secondary ms-auto text-xs" onClick={() => void disconnectGithub()} disabled={busy === 'github'}>
                <LogOut className="size-3.5" /> قطع اتصال
              </button>
            </>
          ) : (
            <Badge tone="neutral">متصل نیست (فقط مخازن عمومی)</Badge>
          )}
        </div>

        <div className="rounded-xl bg-[var(--surface-2)] p-3">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold">
            <ShieldCheck className="size-3.5" /> گزینه ۱: Personal Access Token
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="password"
              className="input"
              placeholder="github_pat_..."
              value={patDraft}
              onChange={(e) => setPatDraft(e.target.value)}
              autoComplete="off"
            />
            <button className="btn btn-secondary shrink-0" onClick={() => void connectPat()} disabled={busy === 'pat'}>
              {busy === 'pat' ? <Spinner /> : <KeyRound className="size-4" />}
              اتصال
            </button>
          </div>
          <p className="mt-1.5 text-[0.68rem] text-[var(--text-3)]">
            یک توکن با دسترسی <span className="font-mono">repo</span> بسازید (برای مخازن خصوصی) یا فقط
            <span className="font-mono"> public_repo</span>.
          </p>
        </div>

        <div className="rounded-xl bg-[var(--surface-2)] p-3">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold">
            <GitBranch className="size-3.5" /> گزینه ۲: ورود OAuth (Device Flow)
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              className="input"
              dir="ltr"
              placeholder="OAuth App Client ID"
              value={settings.githubClientId}
              onChange={(e) => setSettings({ githubClientId: e.target.value })}
            />
            <button
              className="btn btn-secondary shrink-0"
              onClick={() => void startDeviceFlow()}
              disabled={busy === 'device' || Boolean(device)}
            >
              {busy === 'device' ? <Spinner /> : <GitBranch className="size-4" />}
              شروع ورود
            </button>
          </div>

          {deviceError && <p className="mt-2 text-xs text-[var(--danger)]">{deviceError}</p>}

          {device && (
            <div className="mt-2 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-1)] p-3 text-xs">
              <p>این کد را در صفحه‌ی گیت‌هاب وارد کنید:</p>
              <div className="my-2 flex items-center gap-2">
                <code className="rounded bg-[var(--surface-3)] px-2 py-1 font-mono text-base tracking-widest">
                  {device.userCode}
                </code>
                <button
                  className="btn btn-ghost px-1.5 py-1"
                  aria-label="کپی کد"
                  onClick={() => void navigator.clipboard.writeText(device.userCode)}
                >
                  <Copy className="size-3.5" />
                </button>
                <button
                  className="btn btn-secondary ms-auto text-[0.7rem]"
                  onClick={() => void window.academy.shell.openExternal(device.verificationUri)}
                >
                  باز کردن {device.verificationUri.replace('https://', '')}
                </button>
              </div>
              <p className="flex items-center gap-1.5 text-[var(--text-3)]">
                <Loader2 className="size-3 animate-spin" /> در انتظار تأیید شما در مرورگر…
              </p>
            </div>
          )}
        </div>
      </Section>

      <Section title="ظاهر" icon={<Palette className="size-4" />}>
        <div className="flex gap-2">
          {(['dark', 'light'] as const).map((t) => (
            <button
              key={t}
              className={`btn text-xs ${settings.theme === t ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setSettings({ theme: t })}
            >
              {t === 'dark' ? 'تاریک' : 'روشن'}
            </button>
          ))}
        </div>
      </Section>

      <Section
        title="داده‌ها"
        icon={<RotateCcw className="size-4" />}
        description={`پیشرفت شما در ${completedCount} درس تکمیل‌شده، به‌صورت محلی ذخیره شده است.`}
      >
        <p className="break-all font-mono text-[0.68rem] text-[var(--text-3)]" dir="ltr">
          {dataPath || '…'}
        </p>
        {confirmReset ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-[var(--danger)]">همه‌ی پیشرفت و بازبینی‌ها پاک شود؟</span>
            <button
              className="btn btn-danger text-xs"
              onClick={() => {
                void resetAll().then(() => {
                  setConfirmReset(false)
                  flash('پیشرفت پاک شد.')
                })
              }}
            >
              بله، پاک کن
            </button>
            <button className="btn btn-ghost text-xs" onClick={() => setConfirmReset(false)}>
              انصراف
            </button>
          </div>
        ) : (
          <button className="btn btn-secondary text-xs" onClick={() => setConfirmReset(true)}>
            <Trash2 className="size-3.5" /> پاک کردن پیشرفت
          </button>
        )}
      </Section>
    </Modal>
  )
}
