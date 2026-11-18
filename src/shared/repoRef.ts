export interface RepoRef {
  owner: string
  repo: string
  branch?: string
}

const NAME = /^[A-Za-z0-9_.-]+$/

/**
 * Accepts `owner/repo`, `https://github.com/owner/repo(.git)`, `.../tree/branch`
 * and `git@github.com:owner/repo.git`. Returns null when the input is not a GitHub repo.
 */
export function parseRepoRef(input: string): RepoRef | null {
  let s = input.trim()
  if (!s) return null
  s = s.replace(/^git@github\.com:/i, 'https://github.com/')
  let branch: string | undefined

  if (/^(https?:\/\/)?(www\.)?github\.com\//i.test(s)) {
    let url: URL
    try {
      url = new URL(s.startsWith('http') ? s : `https://${s}`)
    } catch {
      return null
    }
    const parts = url.pathname.split('/').filter(Boolean)
    if (parts.length < 2) return null
    if (parts[2] === 'tree' && parts.length > 3) branch = decodeURIComponent(parts.slice(3).join('/'))
    s = `${parts[0]}/${parts[1]}`
  }

  const [owner, rawRepo, ...rest] = s.split('/')
  if (!owner || !rawRepo || rest.length) return null
  const repo = rawRepo.replace(/\.git$/i, '')
  if (!NAME.test(owner) || !NAME.test(repo)) return null
  return { owner, repo, branch }
}
