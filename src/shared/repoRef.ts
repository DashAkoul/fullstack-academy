export interface RepoRef {
  owner: string
  repo: string
  branch?: string
}

const NAME = /^[A-Za-z0-9](?:[A-Za-z0-9_.-]{0,98})[A-Za-z0-9]$|^[A-Za-z0-9]$/

/**
 * Accepts `owner/repo`, `https://github.com/owner/repo(.git)`, `.../tree/branch`
 * and `git@github.com:owner/repo.git`. Returns null when the input is not a GitHub repo.
 */
export function parseRepoRef(input: string): RepoRef | null {
  if (typeof input !== 'string') return null
  let s = input.trim()
  if (!s || s.length > 500) return null
  if (s.includes('/../') || s.endsWith('/..') || s.includes('\\')) return null
  s = s.replace(/^git@github\.com:/i, 'https://github.com/')
  let branch: string | undefined

  if (/^(https?:\/\/)?(www\.)?github\.com\//i.test(s)) {
    if (s.toLowerCase().startsWith('http:') && !s.toLowerCase().startsWith('https:')) return null
    let url: URL
    try {
      url = new URL(s.startsWith('http') ? s : `https://${s}`)
    } catch {
      return null
    }
    if (url.protocol !== 'https:' || url.username || url.password) return null
    if (url.hostname !== 'github.com' && url.hostname !== 'www.github.com') return null
    const parts = url.pathname.split('/').filter(Boolean)
    if (parts.length < 2) return null
    if (parts[2] === 'tree' && parts.length > 3) {
      branch = decodeURIComponent(parts.slice(3).join('/'))
      if (!branch || branch.length > 200 || /[\u0000-\u001f\u007f\\]/.test(branch)) return null
    }
    s = `${parts[0]}/${parts[1]}`
  }

  const [owner, rawRepo, ...rest] = s.split('/')
  if (!owner || !rawRepo || rest.length) return null
  const repo = rawRepo.replace(/\.git$/i, '')
  if (!NAME.test(owner) || !NAME.test(repo)) return null
  if (owner.length > 39 || repo.length > 100) return null
  if (owner === '.' || owner === '..' || repo === '.' || repo === '..') return null
  return { owner, repo, branch }
}
