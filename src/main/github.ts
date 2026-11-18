import type { DeviceCodeResponse, DevicePollResult, RepoFile, RepoSnapshot } from '@shared/types'
import { parseRepoRef } from '@shared/repoRef'
import { selectReviewFiles } from '@shared/fileSelection'
import { getGithubToken } from './storage'

const API = 'https://api.github.com'
const UA = 'FullStack-Academy-Desktop'

const MAX_FILE_BYTES = 60_000
const MAX_TOTAL_BYTES = 300_000

async function gh<T>(path: string, token?: string): Promise<{ data: T; remaining?: number }> {
  const res = await fetch(`${API}${path}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': UA,
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    signal: AbortSignal.timeout(30_000)
  })
  const remaining = Number(res.headers.get('x-ratelimit-remaining') ?? NaN)
  if (!res.ok) {
    let msg = res.statusText
    try {
      msg = ((await res.json()) as { message?: string }).message ?? msg
    } catch {
      /* ignore */
    }
    if (res.status === 404)
      throw new Error(
        token
          ? 'مخزن پیدا نشد یا توکن به آن دسترسی ندارد (404).'
          : 'مخزن پیدا نشد (404). اگر مخزن خصوصی است، ابتدا در تنظیمات به GitHub متصل شوید.'
      )
    if (res.status === 401) throw new Error('توکن GitHub نامعتبر یا منقضی است (401). دوباره متصل شوید.')
    if (res.status === 403 && remaining === 0)
      throw new Error('محدودیت نرخ درخواست GitHub تمام شده است. برای سقف بالاتر به GitHub متصل شوید.')
    throw new Error(`GitHub API ${res.status}: ${msg}`)
  }
  return { data: (await res.json()) as T, remaining: Number.isNaN(remaining) ? undefined : remaining }
}

export async function validateToken(token: string): Promise<string> {
  const { data } = await gh<{ login: string }>('/user', token)
  return data.login
}

// ---------- OAuth device flow (no client secret needed — ideal for desktop apps) ----------

export async function startDeviceFlow(clientId: string): Promise<DeviceCodeResponse> {
  if (!clientId.trim()) throw new Error('Client ID برنامه OAuth گیت‌هاب را در تنظیمات وارد کنید.')
  const res = await fetch('https://github.com/login/device/code', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': UA },
    body: JSON.stringify({ client_id: clientId.trim(), scope: 'repo read:user' })
  })
  const body = (await res.json()) as Record<string, string | number>
  if (!res.ok || body.error)
    throw new Error(`GitHub: ${body.error_description ?? body.error ?? res.statusText}`)
  return {
    deviceCode: String(body.device_code),
    userCode: String(body.user_code),
    verificationUri: String(body.verification_uri),
    expiresIn: Number(body.expires_in),
    interval: Number(body.interval ?? 5)
  }
}

export async function pollDeviceFlow(
  clientId: string,
  deviceCode: string
): Promise<{ result: DevicePollResult; token?: string }> {
  const res = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': UA },
    body: JSON.stringify({
      client_id: clientId.trim(),
      device_code: deviceCode,
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
    })
  })
  const body = (await res.json()) as Record<string, string | number>
  if (body.access_token) {
    const token = String(body.access_token)
    const login = await validateToken(token)
    return { result: { status: 'success', login }, token }
  }
  switch (body.error) {
    case 'authorization_pending':
      return { result: { status: 'pending' } }
    case 'slow_down':
      return { result: { status: 'slow_down', interval: Number(body.interval ?? 10) } }
    case 'expired_token':
      return { result: { status: 'expired', message: 'کد منقضی شد. دوباره تلاش کنید.' } }
    case 'access_denied':
      return { result: { status: 'denied', message: 'دسترسی توسط کاربر رد شد.' } }
    default:
      return { result: { status: 'error', message: String(body.error_description ?? body.error) } }
  }
}

// ---------- Repository snapshot ----------

interface TreeEntry {
  path: string
  type: 'blob' | 'tree' | 'commit'
  sha: string
  size?: number
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let i = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++
      out[idx] = await fn(items[idx])
    }
  })
  await Promise.all(workers)
  return out
}

export async function fetchRepo(input: string): Promise<RepoSnapshot> {
  const ref = parseRepoRef(input)
  if (!ref) throw new Error('آدرس مخزن نامعتبر است. نمونه: username/repo یا https://github.com/username/repo')
  const token = await getGithubToken()
  const base = `/repos/${ref.owner}/${ref.repo}`

  const { data: repo } = await gh<{
    full_name: string
    default_branch: string
    html_url: string
    private: boolean
  }>(base, token)
  const branch = ref.branch ?? repo.default_branch

  const { data: commit } = await gh<{
    sha: string
    commit: { message: string; committer: { date: string } }
  }>(`${base}/commits/${encodeURIComponent(branch)}`, token)

  const { data: treeRes, remaining } = await gh<{ tree: TreeEntry[]; truncated: boolean }>(
    `${base}/git/trees/${commit.sha}?recursive=1`,
    token
  )

  const blobs = treeRes.tree.filter((e) => e.type === 'blob')
  const selected = selectReviewFiles(blobs, { maxFiles: 60 })
  const files: RepoFile[] = []
  let total = 0
  const budgeted = selected.filter((e) => {
    const size = Math.min(e.size ?? 0, MAX_FILE_BYTES)
    if (total + size > MAX_TOTAL_BYTES) return false
    total += size
    return true
  })

  const fetched = await mapLimit(budgeted, 6, async (e) => {
    const { data } = await gh<{ content: string; encoding: string }>(`${base}/git/blobs/${e.sha}`, token)
    let content = Buffer.from(data.content, data.encoding === 'base64' ? 'base64' : 'utf8').toString('utf8')
    const truncated = content.length > MAX_FILE_BYTES
    if (truncated) content = content.slice(0, MAX_FILE_BYTES)
    return { path: e.path, content, size: e.size ?? content.length, truncated }
  })
  files.push(...fetched)

  return {
    owner: ref.owner,
    repo: ref.repo,
    fullName: repo.full_name,
    branch,
    commitSha: commit.sha,
    commitMessage: commit.commit.message,
    commitDate: commit.commit.committer.date,
    htmlUrl: repo.html_url,
    isPrivate: repo.private,
    tree: blobs.map((b) => b.path).slice(0, 500),
    files,
    skippedFiles: blobs.length - files.length,
    rateLimitRemaining: remaining
  }
}
