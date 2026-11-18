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
  github: { connected: boolean; login?: string; method?: 'oauth' | 'pat' }
  /** false when the OS keychain is unavailable and secrets are stored obfuscated only */
  encrypted: boolean
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

export interface DeviceCodeResponse {
  deviceCode: string
  userCode: string
  verificationUri: string
  expiresIn: number
  interval: number
}

export type DevicePollResult =
  | { status: 'pending' | 'slow_down'; interval?: number }
  | { status: 'success'; login: string }
  | { status: 'expired' | 'denied' | 'error'; message: string }

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
    setGithubToken(token: string | null): Promise<SecretsStatus>
  }
  github: {
    startDeviceFlow(clientId: string): Promise<DeviceCodeResponse>
    pollDeviceFlow(clientId: string, deviceCode: string): Promise<DevicePollResult>
    fetchRepo(ref: string): Promise<RepoSnapshot>
  }
  ai: {
    complete(req: AICompletionRequest): Promise<string>
  }
  shell: { openExternal(url: string): Promise<void> }
  app: { info(): Promise<AppInfo> }
}
