/**
 * Identity of the public project. Used for update checks and release links.
 * Keep in sync with package.json "repository" and the GitHub release workflow.
 */
export const APP_REPO = 'DashAkoul/fullstack-academy'
export const REPO_URL = `https://github.com/${APP_REPO}`
export const RELEASES_URL = `${REPO_URL}/releases`
export const LATEST_RELEASE_API = `https://api.github.com/repos/${APP_REPO}/releases/latest`

/** Parses "1.2.3", "v1.2.3" or "1.2.3-beta.1" into numeric parts. */
export function parseVersion(version: string): number[] {
  const core = version.trim().replace(/^v/i, '').split(/[-+]/)[0]
  return core.split('.').map((p) => {
    const n = Number.parseInt(p, 10)
    return Number.isFinite(n) ? n : 0
  })
}

/** Returns true when `latest` is newer than `current`. */
export function isNewerVersion(latest: string, current: string): boolean {
  const a = parseVersion(latest)
  const b = parseVersion(current)
  const length = Math.max(a.length, b.length)
  for (let i = 0; i < length; i++) {
    const x = a[i] ?? 0
    const y = b[i] ?? 0
    if (x > y) return true
    if (x < y) return false
  }
  return false
}
