import { create } from 'zustand'
import type { AIProvider } from '@shared/types'
import { AI_PROVIDERS, DEFAULT_MODELS } from '@shared/types'
import { MiniLessonSchema, ReviewResultSchema, type MiniLesson, type ReviewResult } from '@shared/review'
import { lessons, lessonById } from '@/data/curriculum'

export type ThemeMode = 'dark' | 'light'

export interface ReviewAttempt {
  id: string
  at: string
  repoUrl: string
  commitSha: string
  provider: AIProvider
  model: string
  result: ReviewResult
  passed: boolean
  reasons: string[]
}

export interface MiniLessonRecord extends MiniLesson {
  id: string
  createdAt: string
  lessonId: string
}

export interface LessonProgress {
  repoUrl?: string
  attempts: ReviewAttempt[]
  miniLessons: MiniLessonRecord[]
  completedAt?: string
}

export interface Settings {
  provider: AIProvider
  models: Record<AIProvider, string>
  baseUrl: string
  theme: ThemeMode
}

export interface PersistedState {
  version: 1
  settings: Settings
  progress: Record<string, LessonProgress>
  lastLessonId?: string
}

const STORAGE_KEY = 'academy-state'

const defaultSettings: Settings = {
  provider: 'gemini',
  models: { ...DEFAULT_MODELS },
  baseUrl: '',
  theme: 'dark'
}

interface AppStore {
  hydrated: boolean
  settings: Settings
  progress: Record<string, LessonProgress>
  activeLessonId: string
  hydrate: () => Promise<void>
  setSettings: (patch: Partial<Settings>) => void
  setProviderModel: (provider: AIProvider, model: string) => void
  setActiveLesson: (id: string) => void
  addAttempt: (lessonId: string, attempt: ReviewAttempt, passed: boolean) => void
  addMiniLesson: (lessonId: string, mini: MiniLessonRecord) => void
  setRepoUrl: (lessonId: string, url: string) => void
  resetLesson: (lessonId: string) => void
  resetAll: () => Promise<void>
}

const emptyProgress = (): LessonProgress => ({ attempts: [], miniLessons: [] })

export const progressFor = (state: Pick<AppStore, 'progress'>, lessonId: string): LessonProgress =>
  state.progress[lessonId] ?? emptyProgress()

/** Lesson N+1 unlocks only after lesson N is completed. */
export function isLessonUnlocked(progress: Record<string, LessonProgress>, lessonId: string): boolean {
  const lesson = lessonById(lessonId)
  if (!lesson) return false
  if (lesson.index === 0) return true
  const previous = lessons[lesson.index - 1]
  return Boolean(progress[previous.id]?.completedAt)
}

let saveTimer: ReturnType<typeof setTimeout> | undefined
function persist(get: () => AppStore): void {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    const { settings, progress, activeLessonId } = get()
    const payload: PersistedState = { version: 1, settings, progress, lastLessonId: activeLessonId }
    void window.academy.storage.write(STORAGE_KEY, JSON.stringify(payload)).catch((e) => {
      console.error('ذخیره‌سازی پیشرفت ناموفق بود', e)
    })
  }, 250)
}

const isIsoDate = (value: unknown): value is string =>
  typeof value === 'string' && !Number.isNaN(Date.parse(value))

function sanitizeProgress(raw: unknown): Record<string, LessonProgress> {
  const out: Record<string, LessonProgress> = {}
  if (!raw || typeof raw !== 'object') return out

  for (const [lessonId, value] of Object.entries(raw)) {
    if (!lessonById(lessonId) || !value || typeof value !== 'object') continue
    const candidate = value as Partial<LessonProgress>
    const attempts: ReviewAttempt[] = []
    if (Array.isArray(candidate.attempts)) {
      for (const item of candidate.attempts.slice(0, 20)) {
        if (!item || typeof item !== 'object') continue
        const a = item as Partial<ReviewAttempt>
        const result = ReviewResultSchema.safeParse(a.result)
        if (
          typeof a.id !== 'string' ||
          !isIsoDate(a.at) ||
          typeof a.repoUrl !== 'string' ||
          typeof a.commitSha !== 'string' ||
          !AI_PROVIDERS.includes(a.provider as AIProvider) ||
          typeof a.model !== 'string' ||
          typeof a.passed !== 'boolean' ||
          !Array.isArray(a.reasons) ||
          !a.reasons.every((r) => typeof r === 'string') ||
          !result.success
        ) {
          continue
        }
        attempts.push({ ...(a as ReviewAttempt), result: result.data })
      }
    }

    const miniLessons: MiniLessonRecord[] = []
    if (Array.isArray(candidate.miniLessons)) {
      for (const item of candidate.miniLessons.slice(0, 30)) {
        if (!item || typeof item !== 'object') continue
        const m = item as Partial<MiniLessonRecord>
        const parsed = MiniLessonSchema.safeParse(m)
        if (typeof m.id !== 'string' || !isIsoDate(m.createdAt) || typeof m.lessonId !== 'string' || !parsed.success) {
          continue
        }
        miniLessons.push({ ...(m as MiniLessonRecord), ...parsed.data })
      }
    }

    out[lessonId] = {
      repoUrl: typeof candidate.repoUrl === 'string' ? candidate.repoUrl.slice(0, 500) : undefined,
      attempts,
      miniLessons,
      completedAt: isIsoDate(candidate.completedAt) ? candidate.completedAt : undefined
    }
  }
  return out
}

function sanitize(raw: unknown): PersistedState | null {
  if (!raw || typeof raw !== 'object') return null
  const candidate = raw as Partial<PersistedState>
  if (!candidate.progress || typeof candidate.progress !== 'object') return null
  const saved: Partial<Settings> = candidate.settings ?? {}
  const models = { ...defaultSettings.models }
  for (const provider of AI_PROVIDERS) {
    const model = saved.models?.[provider]
    if (typeof model === 'string' && model.trim()) models[provider] = model.trim()
  }
  const settings: Settings = {
    provider: AI_PROVIDERS.includes(saved.provider as AIProvider)
      ? (saved.provider as AIProvider)
      : defaultSettings.provider,
    models,
    baseUrl: typeof saved.baseUrl === 'string' ? saved.baseUrl.slice(0, 500) : '',
    theme: saved.theme === 'light' ? 'light' : 'dark'
  }
  return {
    version: 1,
    settings,
    progress: sanitizeProgress(candidate.progress),
    lastLessonId: typeof candidate.lastLessonId === 'string' ? candidate.lastLessonId : undefined
  }
}

export const useApp = create<AppStore>((set, get) => ({
  hydrated: false,
  settings: defaultSettings,
  progress: {},
  activeLessonId: lessons[0].id,

  hydrate: async () => {
    try {
      const raw = await window.academy.storage.read(STORAGE_KEY)
      const parsed = raw ? sanitize(JSON.parse(raw)) : null
      if (parsed) {
        const active = parsed.lastLessonId && lessonById(parsed.lastLessonId)
          ? parsed.lastLessonId
          : lessons[0].id
        set({ settings: parsed.settings, progress: parsed.progress, activeLessonId: active })
      }
    } catch (e) {
      console.error('بارگذاری وضعیت ناموفق بود', e)
    } finally {
      set({ hydrated: true })
      document.documentElement.dataset.theme = get().settings.theme
    }
  },

  setSettings: (patch) => {
    set((s) => ({ settings: { ...s.settings, ...patch } }))
    if (patch.theme) document.documentElement.dataset.theme = patch.theme
    persist(get)
  },

  setProviderModel: (provider, model) => {
    set((s) => ({ settings: { ...s.settings, provider, models: { ...s.settings.models, [provider]: model } } }))
    persist(get)
  },

  setActiveLesson: (id) => {
    set({ activeLessonId: id })
    persist(get)
  },

  addAttempt: (lessonId, attempt, passed) => {
    set((s) => {
      const current = s.progress[lessonId] ?? emptyProgress()
      const next: LessonProgress = {
        ...current,
        repoUrl: attempt.repoUrl,
        attempts: [attempt, ...current.attempts].slice(0, 20),
        completedAt: passed ? (current.completedAt ?? attempt.at) : current.completedAt
      }
      return { progress: { ...s.progress, [lessonId]: next } }
    })
    persist(get)
  },

  addMiniLesson: (lessonId, mini) => {
    set((s) => {
      const current = s.progress[lessonId] ?? emptyProgress()
      return {
        progress: {
          ...s.progress,
          [lessonId]: { ...current, miniLessons: [mini, ...current.miniLessons].slice(0, 30) }
        }
      }
    })
    persist(get)
  },

  setRepoUrl: (lessonId, url) => {
    set((s) => {
      const current = s.progress[lessonId] ?? emptyProgress()
      return { progress: { ...s.progress, [lessonId]: { ...current, repoUrl: url } } }
    })
    persist(get)
  },

  resetLesson: (lessonId) => {
    set((s) => {
      const next = { ...s.progress }
      delete next[lessonId]
      return { progress: next }
    })
    persist(get)
  },

  resetAll: async () => {
    set({ progress: {} })
    await window.academy.storage.remove(STORAGE_KEY)
  }
}))

export const useLessonProgress = (lessonId: string): LessonProgress =>
  useApp((s) => s.progress[lessonId]) ?? emptyProgress()
