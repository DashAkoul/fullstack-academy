import { app, safeStorage } from 'electron'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import type { AIProvider, SecretsStatus } from '@shared/types'
import { AI_PROVIDERS } from '@shared/types'

const dataDir = () => join(app.getPath('userData'), 'data')
const secretsFile = () => join(app.getPath('userData'), 'secrets.json')

const KEY_RE = /^[a-z0-9._-]{1,64}$/i
const MAX_DOC_BYTES = 5_000_000
const MAX_READ_BYTES = 8_000_000
const MAX_API_KEY_CHARS = 4096

function keyPath(key: string): string {
  if (!KEY_RE.test(key)) throw new Error(`Invalid storage key: ${key}`)
  return join(dataDir(), `${key}.json`)
}

async function atomicWrite(file: string, content: string): Promise<void> {
  const tmp = `${file}.${process.pid}.tmp`
  const handle = await fs.open(tmp, 'w', 0o600)
  try {
    await handle.writeFile(content, 'utf8')
    await handle.sync()
  } finally {
    await handle.close()
  }
  await fs.rename(tmp, file)
  // Best effort: some platforms ignore chmod on removable/network folders.
  await fs.chmod(file, 0o600).catch(() => {})
}

// ---------- Local JSON document storage (progress, submissions, settings) ----------

export async function readDoc(key: string): Promise<string | null> {
  const file = keyPath(key)
  try {
    const stat = await fs.stat(file)
    if (stat.size > MAX_READ_BYTES) throw new Error('فایل وضعیت بیش از حد بزرگ است.')
    return await fs.readFile(file, 'utf8')
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw e
  }
}

export async function writeDoc(key: string, value: string): Promise<void> {
  if (typeof value !== 'string') throw new Error('مقدار ذخیره‌سازی باید متن باشد.')
  if (Buffer.byteLength(value, 'utf8') > MAX_DOC_BYTES) {
    throw new Error('حجم داده‌ی ذخیره‌سازی بیش از حد مجاز است (حداکثر ۵ مگابایت).')
  }
  await fs.mkdir(dataDir(), { recursive: true })
  await atomicWrite(keyPath(key), value)
}

export async function removeDoc(key: string): Promise<void> {
  await fs.rm(keyPath(key), { force: true })
}

// ---------- Secrets (AI API keys) — never exposed to the renderer ----------

interface SecretsFile {
  apiKeys: Partial<Record<AIProvider, string>>
}

type StoredSecrets = { encrypted: boolean; payload: string }

let cache: SecretsFile | null = null

async function canEncrypt(): Promise<boolean> {
  try {
    return await safeStorage.isAsyncEncryptionAvailable()
  } catch {
    try {
      return safeStorage.isEncryptionAvailable()
    } catch {
      return false
    }
  }
}

async function encrypt(json: string): Promise<StoredSecrets> {
  if (await canEncrypt()) {
    const payload = await safeStorage.encryptStringAsync(json)
    return { encrypted: true, payload: payload.toString('base64') }
  }
  return { encrypted: false, payload: Buffer.from(json, 'utf8').toString('base64') }
}

function validateSecrets(parsed: unknown): SecretsFile {
  const result: SecretsFile = { apiKeys: {} }
  if (!parsed || typeof parsed !== 'object') return result
  const apiKeys = (parsed as { apiKeys?: unknown }).apiKeys
  if (!apiKeys || typeof apiKeys !== 'object') return result
  for (const provider of AI_PROVIDERS) {
    const value = (apiKeys as Record<string, unknown>)[provider]
    if (typeof value === 'string' && value.trim() && value.length <= MAX_API_KEY_CHARS) {
      result.apiKeys[provider] = value.trim()
    }
  }
  return result
}

async function loadSecrets(): Promise<SecretsFile> {
  if (cache) return cache
  try {
    const raw = JSON.parse(await fs.readFile(secretsFile(), 'utf8')) as StoredSecrets
    if (!raw || typeof raw.payload !== 'string' || typeof raw.encrypted !== 'boolean') {
      throw new Error('ساختار فایل رازها نامعتبر است.')
    }
    const buf = Buffer.from(raw.payload, 'base64')
    const json = raw.encrypted ? (await safeStorage.decryptStringAsync(buf)).result : buf.toString('utf8')
    cache = validateSecrets(JSON.parse(json))
  } catch {
    cache = { apiKeys: {} }
  }
  return cache
}

async function saveSecrets(s: SecretsFile): Promise<void> {
  cache = s
  const stored = await encrypt(JSON.stringify(s))
  await fs.mkdir(app.getPath('userData'), { recursive: true })
  await atomicWrite(secretsFile(), JSON.stringify(stored))
}

export async function secretsStatus(): Promise<SecretsStatus> {
  const s = await loadSecrets()
  const apiKeys = Object.fromEntries(AI_PROVIDERS.map((p) => [p, Boolean(s.apiKeys[p])])) as Record<
    AIProvider,
    boolean
  >
  return { apiKeys, encrypted: await canEncrypt() }
}

export async function getApiKey(provider: AIProvider): Promise<string | undefined> {
  if (!AI_PROVIDERS.includes(provider)) return undefined
  return (await loadSecrets()).apiKeys[provider]
}

export async function setApiKey(provider: AIProvider, key: string | null): Promise<void> {
  if (!AI_PROVIDERS.includes(provider)) throw new Error('Unknown provider')
  const trimmed = typeof key === 'string' ? key.trim() : ''
  if (trimmed.length > MAX_API_KEY_CHARS) throw new Error('کلید API بیش از حد طولانی است.')
  if (trimmed && /[\u0000-\u001f\u007f]/.test(trimmed)) throw new Error('کلید API شامل کاراکتر غیرمجاز است.')

  const s = await loadSecrets()
  const apiKeys = { ...s.apiKeys }
  if (trimmed) apiKeys[provider] = trimmed
  else delete apiKeys[provider]
  await saveSecrets({ ...s, apiKeys })
}
