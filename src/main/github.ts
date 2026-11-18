import type { RepoFile, RepoSnapshot } from '@shared/types'
import { parseRepoRef } from '@shared/repoRef'
import { selectReviewFiles } from '@shared/fileSelection'

const API = 'https://api.github.com'
const RAW = 'https://raw.githubusercontent.com'
const UA = 'FullStack-Academy-Desktop'

const MAX_FILE_BYTES = 60_000
const MAX_TOTAL_BYTES = 300_000

async function gh<T>(path: string): Promise<{ data: T; remaining?: number }> {
  const res = await fetch(`${API}${path}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': UA
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
        'مخزن پیدا نشد (404). مطمئن شوید آدرس درست است و مخزن «عمومی» است؛ بررسی مخزن خصوصی پشتیبانی نمی‌شود.'
      )
    if (res.status === 403 && remaining === 0)
      throw new Error('سقف درخواست‌های عمومی GitHub تمام شده است. حدود یک ساعت بعد دوباره تلاش کنید.')
    if (res.status === 451)
      throw new Error('دسترسی به این مخزن توسط GitHub محدود شده است.')
    throw new Error(`GitHub API ${res.status}: ${msg}`)
  }
  return { data: (await res.json()) as T, remaining: Number.isNaN(remaining) ? undefined : remaining }
}

interface TreeEntry {
  path: string
  type: 'blob' | 'tree' | 'commit'
  sha: string
  size?: number
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R | null>): Promise<(R | null)[]> {
  const out: (R | null)[] = new Array(items.length).fill(null)
  let i = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const index = i++
      out[index] = await fn(items[index])
    }
  })
  await Promise.all(workers)
  return out
}

async function fetchRaw(owner: string, repo: string, sha: string, path: string): Promise<string | null> {
  // raw.githubusercontent.com is a CDN and does not consume the REST rate limit.
  const url = `${RAW}/${owner}/${repo}/${sha}/${path.split('/').map(encodeURIComponent).join('/')}`
  const res = await fetch(url, {
    headers: { 'User-Agent': UA },
    signal: AbortSignal.timeout(20_000)
  })
  if (!res.ok) return null
  return res.text()
}

export async function fetchRepo(input: string): Promise<RepoSnapshot> {
  const ref = parseRepoRef(input)
  if (!ref)
    throw new Error('آدرس مخزن نامعتبر است. نمونه: username/repo یا https://github.com/username/repo')

  const base = `/repos/${ref.owner}/${ref.repo}`
  const { data: repo } = await gh<{
    full_name: string
    default_branch: string
    html_url: string
    private: boolean
  }>(base)

  if (repo.private)
    throw new Error(
      'این مخزن خصوصی است. برای بررسی، مخزن را در GitHub عمومی کنید (Settings → General → Danger Zone → Change visibility).'
    )

  const branch = ref.branch ?? repo.default_branch
  const { data: commit } = await gh<{
    sha: string
    commit: { message: string; committer: { date: string } }
  }>(`${base}/commits/${encodeURIComponent(branch)}`)

  const { data: treeRes, remaining } = await gh<{ tree: TreeEntry[]; truncated: boolean }>(
    `${base}/git/trees/${commit.sha}?recursive=1`
  )

  const blobs = treeRes.tree.filter((e) => e.type === 'blob')
  const selected = selectReviewFiles(blobs, { maxFiles: 60 })

  let total = 0
  const budgeted = selected.filter((e) => {
    const size = Math.min(e.size ?? 0, MAX_FILE_BYTES)
    if (total + size > MAX_TOTAL_BYTES) return false
    total += size
    return true
  })

  const contents = await mapLimit(budgeted, 6, async (entry) => {
    const text = await fetchRaw(ref.owner, ref.repo, commit.sha, entry.path)
    if (text == null) return null
    const truncated = text.length > MAX_FILE_BYTES
    return {
      path: entry.path,
      content: truncated ? text.slice(0, MAX_FILE_BYTES) : text,
      size: entry.size ?? text.length,
      truncated
    } satisfies RepoFile
  })

  const files = contents.filter((f): f is RepoFile => f !== null)

  return {
    owner: ref.owner,
    repo: ref.repo,
    fullName: repo.full_name,
    branch,
    commitSha: commit.sha,
    commitMessage: commit.commit.message,
    commitDate: commit.commit.committer.date,
    htmlUrl: repo.html_url,
    isPrivate: false,
    tree: blobs.map((b) => b.path).slice(0, 500),
    files,
    skippedFiles: blobs.length - files.length,
    rateLimitRemaining: remaining
  }
}
