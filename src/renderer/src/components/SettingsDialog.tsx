import { useEffect, useState } from 'react'
import {
  CheckCircle2,
  Database,
  Download,
  KeyRound,
  Lock,
  Palette,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Trash2,
  TriangleAlert
} from 'lucide-react'
import type { AIProvider, ModelInfo, UpdateInfo } from '@shared/types'
import { AI_PROVIDERS, DEFAULT_MODELS } from '@shared/types'
import { REPO_URL, RELEASES_URL } from '@shared/appConfig'
import { useApp } from '@/store/useApp'
import { useSecrets } from '@/store/useSecrets'
import { Badge, Callout, Modal, Spinner } from './ui'

const PROVIDER_INFO: Record<AIProvider, { label: string; hint: string; keyUrl: string }> = {
  gemini: {
    label: 'Google Gemini',
    hint: 'کلید را از Google AI Studio بسازید. پس از ذخیره، فهرست مدل‌ها به‌صورت خودکار بارگذاری می‌شود.',
    keyUrl: 'https://aistudio.google.com/app/apikey'
  },
  openai: {
    label: 'OpenAI',
    hint: 'کلید را از پنل OpenAI بسازید. امکان استفاده از Base URL سازگار (پروکسی یا سرور داخلی) هم هست.',
    keyUrl: 'https://platform.openai.com/api-keys'
  },
  anthropic: {
    label: 'Anthropic',
    hint: 'کلید را از Anthropic Console بسازید. فهرست مدل‌های موجود خودکار خوانده می‌شود.',
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

  const provider = settings.provider

  const [keyDraft, setKeyDraft] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [models, setModels] = useState<ModelInfo[]>([])
  const [modelsLoading, setModelsLoading] = useState(false)
  const [modelsError, setModelsError] = useState<string | null>(null)
  const [manualModel, setManualModel] = useState(false)

  const [appVersion, setAppVersion] = useState('')
  const [dataPath, setDataPath] = useState('')
  const [update, setUpdate] = useState<UpdateInfo | null>(null)
  const [updateLoading, setUpdateLoading] = useState(false)
  const [updateError, setUpdateError] = useState<string | null>(null)

  const [confirmReset, setConfirmReset] = useState(false)

  const keySaved = Boolean(secrets?.apiKeys[provider])
  const completedCount = Object.values(progress).filter((p) => p.completedAt).length

  // Never carry a partially typed key (or a stale model list) to another provider.
  useEffect(() => {
    setKeyDraft('')
    setModels([])
    setModelsError(null)
    setManualModel(false)
  }, [provider])

  useEffect(() => {
    if (!open) return
    void refreshSecrets()
    void window.academy.app.info().then((info) => {
      setAppVersion(info.version)
      setDataPath(info.dataPath)
    })
  }, [open, refreshSecrets])

  // Auto-discover models as soon as the dialog opens for a provider that already has a key.
  useEffect(() => {
    if (!open || !keySaved) return
    void loadModels()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, keySaved, provider])

  function flash(msg: string) {
    setNotice(msg)
    setTimeout(() => setNotice(null), 4000)
  }

  async function loadModels(): Promise<void> {
    setModelsLoading(true)
    setModelsError(null)
    try {
      const list = await window.academy.ai.listModels({
        provider,
        baseUrl: provider === 'openai' ? settings.baseUrl : undefined
      })
      setModels(list)
      if (list.length && !list.some((m) => m.id === settings.models[provider])) {
        // Keep a custom model selection working, but suggest a real one.
        setManualModel(false)
      }
    } catch (e) {
      setModels([])
      setModelsError(e instanceof Error ? e.message : 'دریافت فهرست مدل‌ها ناموفق بود')
    } finally {
      setModelsLoading(false)
    }
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
      flash(`کلید ${PROVIDER_INFO[provider].label} ذخیره شد. در حال شناسایی مدل‌ها…`)
      await loadModels()
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
      setModels([])
      setModelsError(null)
      flash(`کلید ${PROVIDER_INFO[provider].label} حذف شد.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'حذف کلید ناموفق بود')
    } finally {
      setBusy(null)
    }
  }

  async function checkUpdate() {
    setUpdateLoading(true)
    setUpdateError(null)
    try {
      setUpdate(await window.academy.app.checkUpdate())
    } catch (e) {
      setUpdate(null)
      setUpdateError(e instanceof Error ? e.message : 'بررسی به‌روزرسانی ناموفق بود')
    } finally {
      setUpdateLoading(false)
    }
  }

  const useDropdown = models.length > 0 && !manualModel
  const selectedModel = settings.models[provider]

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
        description="کلید API فقط روی همین رایانه ذخیره می‌شود. پس از ذخیره، مدل‌های در دسترس کلید شما به‌صورت خودکار شناسایی و در فهرست انتخاب نمایش داده می‌شوند."
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
          {keySaved ? <Badge tone="success">کلید ثبت شده است</Badge> : <Badge tone="warning">کلید ثبت نشده</Badge>}
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

        <div>
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="text-xs text-[var(--text-2)]">مدل</span>
            <div className="flex items-center gap-2">
              {keySaved && (
                <button
                  className="btn btn-ghost px-1.5 py-0.5 text-[0.68rem]"
                  onClick={() => void loadModels()}
                  disabled={modelsLoading}
                >
                  {modelsLoading ? <Spinner /> : <RefreshCw className="size-3" />}
                  دریافت فهرست مدل‌ها
                </button>
              )}
              {models.length > 0 && (
                <button
                  className="btn btn-ghost px-1.5 py-0.5 text-[0.68rem]"
                  onClick={() => setManualModel((v) => !v)}
                >
                  {manualModel ? 'انتخاب از فهرست' : 'ورود دستی'}
                </button>
              )}
            </div>
          </div>

          {useDropdown ? (
            <select
              className="input"
              value={selectedModel}
              onChange={(e) => setProviderModel(provider, e.target.value)}
              aria-label="انتخاب مدل"
            >
              {!models.some((m) => m.id === selectedModel) && (
                <option value={selectedModel}>{selectedModel} (فعلی)</option>
              )}
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label === m.id ? m.id : `${m.label} — ${m.id}`}
                  {m.contextWindow ? ` (${Math.round(m.contextWindow / 1000)}K)` : ''}
                </option>
              ))}
            </select>
          ) : (
            <input
              className="input"
              dir="ltr"
              value={selectedModel}
              placeholder={DEFAULT_MODELS[provider]}
              onChange={(e) => setProviderModel(provider, e.target.value)}
              aria-label="نام مدل"
            />
          )}

          {modelsLoading && <p className="mt-1 text-[0.68rem] text-[var(--text-3)]">در حال شناسایی مدل‌های کلید شما…</p>}
          {modelsError && (
            <p className="mt-1 text-[0.68rem] leading-5 text-[var(--warning)]">
              {modelsError} می‌توانید نام مدل را دستی وارد کنید.
            </p>
          )}
          {!modelsLoading && !modelsError && models.length === 0 && keySaved && (
            <p className="mt-1 text-[0.68rem] text-[var(--text-3)]">
              فهرستی دریافت نشد؛ نام مدل را دستی وارد کنید یا دوباره تلاش کنید.
            </p>
          )}
          {!keySaved && (
            <p className="mt-1 text-[0.68rem] text-[var(--text-3)]">
              ابتدا کلید را ذخیره کنید تا فهرست مدل‌های مجاز نمایش داده شود.
            </p>
          )}
        </div>

        <label className="block text-xs text-[var(--text-2)]">
          Base URL {provider !== 'openai' && '(فقط برای سرویس‌های سازگار با OpenAI)'}
          <input
            className="input mt-1 disabled:opacity-50"
            dir="ltr"
            placeholder="https://api.openai.com/v1"
            value={settings.baseUrl}
            onChange={(e) => setSettings({ baseUrl: e.target.value })}
            disabled={provider !== 'openai'}
          />
        </label>

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
        title="به‌روزرسانی"
        icon={<Download className="size-4" />}
        description="نسخه‌ی جدید برنامه از صفحه‌ی انتشار GitHub خوانده می‌شود."
      >
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="chip font-mono" dir="ltr">
            v{appVersion || '…'}
          </span>
          <button className="btn btn-secondary text-xs" onClick={() => void checkUpdate()} disabled={updateLoading}>
            {updateLoading ? <Spinner /> : <RefreshCw className="size-3.5" />}
            بررسی به‌روزرسانی
          </button>
          <button
            className="btn btn-ghost text-xs"
            onClick={() => void window.academy.shell.openExternal(RELEASES_URL)}
          >
            صفحه‌ی نسخه‌ها
          </button>
        </div>

        {updateError && <Callout tone="danger">{updateError}</Callout>}

        {update && (
          <div className="rounded-xl bg-[var(--surface-2)] p-3 text-xs leading-6">
            {update.latestVersion === '' ? (
              <p className="text-[var(--text-2)]">
                هنوز نسخه‌ای در GitHub منتشر نشده است.
              </p>
            ) : update.upToDate ? (
              <p className="flex items-center gap-1.5 text-[var(--success)]">
                <CheckCircle2 className="size-3.5" />
                نسخه‌ی شما به‌روز است (v{update.latestVersion}).
              </p>
            ) : (
              <div className="space-y-2">
                <p className="font-semibold text-[var(--text-1)]">
                  نسخه‌ی جدید v{update.latestVersion} منتشر شده است.
                </p>
                {update.assetName && (
                  <p className="font-mono text-[0.68rem] text-[var(--text-3)]" dir="ltr">
                    {update.assetName}
                  </p>
                )}
                {update.notes && (
                  <p className="max-h-28 overflow-y-auto whitespace-pre-line text-[var(--text-2)]">
                    {update.notes}
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <button
                    className="btn btn-primary text-xs"
                    onClick={() =>
                      void window.academy.shell.openExternal(update.downloadUrl ?? update.releaseUrl)
                    }
                  >
                    <Download className="size-3.5" /> دانلود نسخه‌ی جدید
                  </button>
                  <button
                    className="btn btn-ghost text-xs"
                    onClick={() => void window.academy.shell.openExternal(update.releaseUrl)}
                  >
                    جزئیات در GitHub
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
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
        icon={<Database className="size-4" />}
        description={`پیشرفت شما (${completedCount} درس تکمیل‌شده) به‌صورت محلی ذخیره شده است.`}
      >
        <p className="break-all font-mono text-[0.68rem] text-[var(--text-3)]" dir="ltr">
          {dataPath || '…'}
        </p>
        <p className="text-[0.68rem] leading-6 text-[var(--text-3)]">
          پروژه متن‌باز است:{' '}
          <button className="underline" onClick={() => void window.academy.shell.openExternal(REPO_URL)}>
            {REPO_URL.replace('https://', '')}
          </button>
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
            <RotateCcw className="size-3.5" /> پاک کردن پیشرفت
          </button>
        )}
      </Section>
    </Modal>
  )
}
