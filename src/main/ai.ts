import type { AICompletionRequest, ModelInfo } from '@shared/types'
import { sanitizeCompletionRequest, sanitizeModelListRequest } from '@shared/aiRequest'
import { getApiKey } from './storage'
import { readJsonCapped, readTextCapped } from './http'

const TIMEOUT = 180_000

const MAX_API_BYTES = 5_000_000

async function readError(res: Response): Promise<string> {
  const { text } = await readTextCapped(res, 2_000)
  try {
    const j = JSON.parse(text) as { error?: { message?: string } | string; message?: string }
    if (typeof j.error === 'string') return j.error
    return j.error?.message ?? j.message ?? text
  } catch {
    return text.slice(0, 500) || res.statusText
  }
}

async function post(url: string, headers: Record<string, string>, body: unknown): Promise<unknown> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
    redirect: 'error',
    signal: AbortSignal.timeout(TIMEOUT)
  })
  if (!res.ok) {
    const msg = await readError(res)
    if (res.status === 401 || res.status === 403) throw new Error(`کلید API نامعتبر است یا دسترسی ندارد (${res.status}): ${msg}`)
    if (res.status === 429) throw new Error(`محدودیت نرخ/سهمیه سرویس هوش مصنوعی (429): ${msg}`)
    throw new Error(`خطای سرویس هوش مصنوعی (${res.status}): ${msg}`)
  }
  return readJsonCapped<unknown>(res, MAX_API_BYTES)
}

async function gemini(key: string, r: AICompletionRequest): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(r.model)}:generateContent`
  const data = (await post(url, { 'x-goog-api-key': key }, {
    systemInstruction: { parts: [{ text: r.system }] },
    contents: [{ role: 'user', parts: [{ text: r.prompt }] }],
    generationConfig: {
      temperature: 0.3,
      ...(r.json ? { responseMimeType: 'application/json' } : {})
    }
  })) as { candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[] }
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''
  if (!text) throw new Error(`پاسخ خالی از Gemini (${data.candidates?.[0]?.finishReason ?? 'unknown'})`)
  return text
}

async function openai(key: string, r: AICompletionRequest): Promise<string> {
  const base = (r.baseUrl?.trim() || 'https://api.openai.com/v1').replace(/\/+$/, '')
  const data = (await post(`${base}/chat/completions`, { Authorization: `Bearer ${key}` }, {
    model: r.model,
    messages: [
      { role: 'system', content: r.system },
      { role: 'user', content: r.prompt }
    ],
    ...(r.json ? { response_format: { type: 'json_object' } } : {})
  })) as { choices?: { message?: { content?: string } }[] }
  const text = data.choices?.[0]?.message?.content ?? ''
  if (!text) throw new Error('پاسخ خالی از OpenAI')
  return text
}

async function anthropic(key: string, r: AICompletionRequest): Promise<string> {
  const data = (await post(
    'https://api.anthropic.com/v1/messages',
    { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    {
      model: r.model,
      max_tokens: 8192,
      system: r.json ? `${r.system}\n\nRespond with a single valid JSON object only.` : r.system,
      messages: [{ role: 'user', content: r.prompt }]
    }
  )) as { content?: { type: string; text?: string }[] }
  const text = data.content?.filter((c) => c.type === 'text').map((c) => c.text).join('') ?? ''
  if (!text) throw new Error('پاسخ خالی از Anthropic')
  return text
}

export async function complete(input: unknown): Promise<string> {
  const r = sanitizeCompletionRequest(input)
  const key = await getApiKey(r.provider)
  if (!key) throw new Error('کلید API برای این سرویس ثبت نشده است. به تنظیمات بروید.')
  if (!r.model.trim()) throw new Error('نام مدل مشخص نشده است.')
  switch (r.provider) {
    case 'gemini':
      return gemini(key, r)
    case 'openai':
      return openai(key, r)
    case 'anthropic':
      return anthropic(key, r)
    default:
      throw new Error('سرویس ناشناخته')
  }
}


// ---------- Model discovery ----------

const NON_CHAT =
  /(embedding|whisper|tts|dall-e|moderation|transcribe|audio-speech|image-1|sora|davinci|babbage|curie|(^|-)ada($|-)|text-similarity|text-search|code-search)/i

async function listGemini(key: string): Promise<ModelInfo[]> {
  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', {
    headers: { 'x-goog-api-key': key, Accept: 'application/json' },
    signal: AbortSignal.timeout(30_000)
  })
  if (!res.ok) throw new Error(await readError(res))
  const body = (await res.json()) as {
    models?: {
      name: string
      displayName?: string
      inputTokenLimit?: number
      supportedGenerationMethods?: string[]
    }[]
  }
  return (body.models ?? [])
    .filter((m) => (m.supportedGenerationMethods ?? []).includes('generateContent'))
    .map((m) => ({
      id: m.name.replace(/^models\//, ''),
      label: m.displayName ?? m.name.replace(/^models\//, ''),
      contextWindow: m.inputTokenLimit
    }))
    .sort((a, b) => a.id.localeCompare(b.id))
}

async function listOpenAI(key: string, baseUrl?: string): Promise<ModelInfo[]> {
  const base = (baseUrl?.trim() || 'https://api.openai.com/v1').replace(/\/+$/, '')
  const res = await fetch(`${base}/models`, {
    headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
    redirect: 'error',
    signal: AbortSignal.timeout(30_000)
  })
  if (!res.ok) throw new Error(await readError(res))
  const body = (await res.json()) as { data?: { id: string; created?: number }[] }
  const score = (id: string): number => {
    if (/^o\d/.test(id)) return 0
    if (/^gpt-5/.test(id)) return 1
    if (/^gpt-4\.1/.test(id)) return 2
    if (/^gpt-4o/.test(id)) return 3
    if (/^gpt-4/.test(id)) return 4
    if (/^gpt-3\.5/.test(id)) return 5
    return 6
  }
  return (body.data ?? [])
    .filter((m) => !NON_CHAT.test(m.id))
    .sort((a, b) => score(a.id) - score(b.id) || (b.created ?? 0) - (a.created ?? 0) || a.id.localeCompare(b.id))
    .map((m) => ({ id: m.id, label: m.id }))
}

async function listAnthropic(key: string): Promise<ModelInfo[]> {
  const models: ModelInfo[] = []
  let afterId: string | undefined
  for (let page = 0; page < 5; page++) {
    const url = new URL('https://api.anthropic.com/v1/models')
    url.searchParams.set('limit', '100')
    if (afterId) url.searchParams.set('after_id', afterId)

    const res = await fetch(url, {
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        Accept: 'application/json'
      },
      signal: AbortSignal.timeout(30_000)
    })
    if (!res.ok) throw new Error(await readError(res))
    const body = (await res.json()) as {
      data?: { id: string; display_name?: string }[]
      has_more?: boolean
      last_id?: string
    }
    for (const m of body.data ?? []) models.push({ id: m.id, label: m.display_name ?? m.id })
    if (!body.has_more || !body.last_id) break
    afterId = body.last_id
  }
  return models
}

export async function listModels(input: unknown): Promise<ModelInfo[]> {
  const { provider, baseUrl } = sanitizeModelListRequest(input)
  const key = await getApiKey(provider)
  if (!key) throw new Error('برای دریافت لیست مدل‌ها ابتدا کلید API را ذخیره کنید.')
  switch (provider) {
    case 'gemini':
      return listGemini(key)
    case 'openai':
      return listOpenAI(key, baseUrl)
    case 'anthropic':
      return listAnthropic(key)
    default:
      throw new Error('سرویس ناشناخته')
  }
}
