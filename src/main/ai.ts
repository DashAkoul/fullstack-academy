import type { AICompletionRequest } from '@shared/types'
import { getApiKey } from './storage'

const TIMEOUT = 180_000

async function readError(res: Response): Promise<string> {
  const text = await res.text()
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
    signal: AbortSignal.timeout(TIMEOUT)
  })
  if (!res.ok) {
    const msg = await readError(res)
    if (res.status === 401 || res.status === 403) throw new Error(`کلید API نامعتبر است یا دسترسی ندارد (${res.status}): ${msg}`)
    if (res.status === 429) throw new Error(`محدودیت نرخ/سهمیه سرویس هوش مصنوعی (429): ${msg}`)
    throw new Error(`خطای سرویس هوش مصنوعی (${res.status}): ${msg}`)
  }
  return res.json()
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

export async function complete(r: AICompletionRequest): Promise<string> {
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
