import { app, safeStorage } from 'electron'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import type { AIProvider, SecretsStatus } from '@shared/types'
import { AI_PROVIDERS } from '@shared/types'

const dataDir = () => join(app.getPath('userData'), 'data')
const secretsFile = () => join(app.getPath('userData'), 'secrets.json')

const KEY_RE = /^[a-z0-9._-]{1,64}$/i

function keyPath(key: string): string {
  if (!KEY_RE.test(key)) throw new Error(`Invalid storage key: ${key}`)
  return join(dataDir(), `${key}.json`)
}

async function atomicWrite(file: string, content: string): Promise<void> {
  const tmp = `${file}.${process.pid}.tmp`
  await fs.writeFile(tmp, content, 'utf8')
  await fs.rename(tmp, file)
}

// ---------- Local JSON document storage (progress, submissions, settings) ----------

export async function readDoc(key: string): Promise<string | null> {
  try {
    return await fs.readFile(keyPath(key), 'utf8')
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw e
  }
}

export async function writeDoc(key: string, value: string): Promise<void> {
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

async function loadSecrets(): Promise<SecretsFile> {
  if (cache) return cache
  try {
    const raw = JSON.parse(await fs.readFile(secretsFile(), 'utf8')) as StoredSecrets
    const buf = Buffer.from(raw.payload, 'base64')
    const json = raw.encrypted ? (await safeStorage.decryptStringAsync(buf)).result : buf.toString('utf8')
    cache = JSON.parse(json) as SecretsFile
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
  return (await loadSecrets()).apiKeys[provider]
}

export async function setApiKey(provider: AIProvider, key: string | null): Promise<void> {
  if (!AI_PROVIDERS.includes(provider)) throw new Error('Unknown provider')
  const s = await loadSecrets()
  const apiKeys = { ...s.apiKeys }
  if (key && key.trim()) apiKeys[provider] = key.trim()
  else delete apiKeys[provider]
  await saveSecrets({ ...s, apiKeys })
}
