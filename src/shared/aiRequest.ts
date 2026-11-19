import type { AICompletionRequest, AIProvider, ModelListRequest } from './types'
import { AI_PROVIDERS } from './types'
import { normalizeBaseUrl } from './netSafety'

export const MODEL_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,119}$/
export const MAX_SYSTEM_CHARS = 20_000
export const MAX_PROMPT_CHARS = 400_000
export const MAX_TOTAL_CHARS = 420_000

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function providerOf(value: unknown): AIProvider {
  if (typeof value === 'string' && (AI_PROVIDERS as string[]).includes(value)) {
    return value as AIProvider
  }
  throw new Error('سرویس هوش مصنوعی ناشناخته است.')
}

function textOf(value: unknown, name: string, max: number): string {
  if (typeof value !== 'string') throw new Error(`${name} باید متن باشد.`)
  if (value.length > max) throw new Error(`${name} بیش از حد طولانی است (حداکثر ${max.toLocaleString('fa-IR')} کاراکتر).`)
  return value
}

function modelOf(value: unknown): string {
  if (typeof value !== 'string' || !MODEL_ID_RE.test(value.trim())) {
    throw new Error('نام مدل معتبر نیست.')
  }
  return value.trim()
}

/** Validates and normalises renderer input before any network call. */
export function sanitizeCompletionRequest(input: unknown): AICompletionRequest {
  if (!isRecord(input)) throw new Error('درخواست هوش مصنوعی نامعتبر است.')

  const provider = providerOf(input.provider)
  const model = modelOf(input.model)
  const system = textOf(input.system, 'دستور سیستم', MAX_SYSTEM_CHARS)
  const prompt = textOf(input.prompt, 'پرامپت', MAX_PROMPT_CHARS)
  if (system.length + prompt.length > MAX_TOTAL_CHARS) {
    throw new Error('حجم درخواست بیش از حد مجاز است.')
  }
  if (typeof input.json !== 'boolean') throw new Error('پرچم json باید boolean باشد.')

  let baseUrl: string | undefined
  if (provider === 'openai' && typeof input.baseUrl === 'string' && input.baseUrl.trim()) {
    baseUrl = normalizeBaseUrl(input.baseUrl)
  }

  return { provider, model, system, prompt, json: input.json, baseUrl }
}

/** Validates the model-discovery request. */
export function sanitizeModelListRequest(input: unknown): ModelListRequest {
  if (!isRecord(input)) throw new Error('درخواست فهرست مدل‌ها نامعتبر است.')
  const provider = providerOf(input.provider)
  let baseUrl: string | undefined
  if (provider === 'openai' && typeof input.baseUrl === 'string' && input.baseUrl.trim()) {
    baseUrl = normalizeBaseUrl(input.baseUrl)
  }
  return { provider, baseUrl }
}
