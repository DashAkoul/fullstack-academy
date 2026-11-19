// Types shared between the Electron main process, preload bridge and renderer.

export type AIProvider = 'gemini' | 'openai' | 'anthropic'

export const AI_PROVIDERS: AIProvider[] = ['gemini', 'openai', 'anthropic']

export const DEFAULT_MODELS: Record<AIProvider, string> = {
  gemini: 'gemini-2.5-flash',
  openai: 'gpt-4.1-mini',
  anthropic: 'claude-sonnet-4-5'
}

export interface SecretsStatus {
  apiKeys: Record<AIProvider, boolean>
  /** false when the OS keychain is unavailable: keys live in memory for this session only */
  encrypted: boolean
}

export interface ModelInfo {
  /** model id to pass to the API */
  id: string
  /** human friendly label */
  label: string
  /** optional context window in tokens */
  contextWindow?: number
}

export interface ModelListRequest {
  provider: AIProvider
  baseUrl?: string
}

export interface UpdateInfo {
  currentVersion: string
  latestVersion: string
  upToDate: boolean
  releaseUrl: string
  publishedAt?: string
  notes?: string
  downloadUrl?: string
  assetName?: string
}

export interface AICompletionRequest {
  provider: AIProvider
  model: string
  /** Optional OpenAI-compatible base URL (e.g. a proxy, OpenRouter, local LLM). */
  baseUrl?: string
  system: string
  prompt: string
  json: boolean
}

export interface RepoFile {
  path: string
  content: string
  size: number
  truncated: boolean
}

export interface RepoSnapshot {
  owner: string
  repo: string
  fullName: string
  branch: string
  commitSha: string
  commitMessage: string
  commitDate: string
  htmlUrl: string
  isPrivate: boolean
  tree: string[]
  files: RepoFile[]
  skippedFiles: number
  rateLimitRemaining?: number
}

export interface AppInfo {
  version: string
  platform: string
  dataPath: string
}

export type IpcResult<T> = { ok: true; data: T } | { ok: false; error: string }

export interface AcademyBridge {
  storage: {
    read(key: string): Promise<string | null>
    write(key: string, value: string): Promise<void>
    remove(key: string): Promise<void>
  }
  secrets: {
    status(): Promise<SecretsStatus>
    setApiKey(provider: AIProvider, key: string | null): Promise<SecretsStatus>
  }
  github: {
    fetchRepo(ref: string): Promise<RepoSnapshot>
  }
  ai: {
    complete(req: AICompletionRequest): Promise<string>
    listModels(req: ModelListRequest): Promise<ModelInfo[]>
  }
  shell: { openExternal(url: string): Promise<void> }
  app: {
    info(): Promise<AppInfo>
    checkUpdate(): Promise<UpdateInfo>
  }
}
