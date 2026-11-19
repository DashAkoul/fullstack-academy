/**
 * URL and network safety helpers shared by the main process and tests.
 *
 * The app only talks to a small set of remote services. These helpers keep a
 * compromised renderer (or a malicious release payload) from turning the main
 * process into an SSRF proxy or a launcher for arbitrary URL schemes.
 */

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1'])
const BLOCKED_SUFFIXES = ['.local', '.internal', '.home.arpa', '.lan', '.localhost']

function isPrivateIpv4(host: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host)
  if (!m) return false
  const [a, b, c] = [Number(m[1]), Number(m[2]), Number(m[3])]
  if ([a, b, c, Number(m[4])].some((n) => n > 255)) return true
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 192 && b === 0 && c === 0) ||
    a >= 224
  )
}

function isPrivateIpv6(host: string): boolean {
  const h = host.replace(/^\[|\]$/g, '').toLowerCase()
  if (h === '::1' || h === '::') return true
  if (h.startsWith('::ffff:')) return isPrivateIpv4(h.slice(7))
  if (h.startsWith('fc') || h.startsWith('fd')) return true
  if (/^fe[89ab]/.test(h)) return true
  if (h.startsWith('2001:db8')) return true
  if (h.startsWith('ff')) return true
  return false
}

export function isPrivateHost(host: string): boolean {
  const h = host.toLowerCase()
  if (isPrivateIpv4(h) || isPrivateIpv6(h)) return true
  if (BLOCKED_SUFFIXES.some((s) => h === s.slice(1) || h.endsWith(s))) return true
  return ['metadata.google.internal', 'metadata', 'instance-data'].includes(h)
}

export function isLocalHost(host: string): boolean {
  return LOCAL_HOSTS.has(host.toLowerCase())
}

/**
 * Normalises an OpenAI-compatible base URL.
 * - https for any public host
 * - http only for loopback (local LLM/proxy)
 * - no credentials, query string or fragment
 */
export function normalizeBaseUrl(raw: string): string {
  const value = raw.trim()
  if (!value) throw new Error('آدرس Base URL خالی است.')
  if (value.length > 500) throw new Error('آدرس Base URL بیش از حد طولانی است.')

  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error('آدرس Base URL معتبر نیست. نمونه: https://api.openai.com/v1')
  }

  if (url.username || url.password) throw new Error('Base URL نباید نام کاربری یا رمز داشته باشد.')
  if (url.search || url.hash) throw new Error('Base URL نباید query یا fragment داشته باشد.')
  if (isPrivateHost(url.hostname) && !isLocalHost(url.hostname)) {
    throw new Error('دسترسی به آدرس‌های شبکه‌ی داخلی در Base URL مجاز نیست.')
  }
  if (url.protocol === 'https:') {
    // public HTTPS endpoints (including localhost for dev proxies)
  } else if (url.protocol === 'http:' && isLocalHost(url.hostname)) {
    // local proxy only
  } else {
    throw new Error('Base URL باید https باشد؛ http فقط برای localhost مجاز است.')
  }

  return `${url.origin}${url.pathname}`.replace(/\/+$/, '')
}

/** External links may only be http(s); plain http is limited to loopback. */
export function isSafeExternalUrl(raw: string): boolean {
  if (!raw || raw.length > 2048) return false
  try {
    const url = new URL(raw)
    if (url.username || url.password) return false
    if (url.protocol === 'https:') return true
    return url.protocol === 'http:' && isLocalHost(url.hostname)
  } catch {
    return false
  }
}

/** Release assets must live under this project's GitHub release downloads. */
export function isTrustedReleaseAssetUrl(raw: string, repo: string): boolean {
  if (!raw || raw.length > 2048) return false
  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:' || url.hostname !== 'github.com') return false
    if (url.username || url.password) return false
    return url.pathname.startsWith(`/${repo}/releases/download/`)
  } catch {
    return false
  }
}

/** Release pages must live under this project's GitHub releases. */
export function isTrustedReleasePageUrl(raw: string, repo: string): boolean {
  if (!raw || raw.length > 2048) return false
  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:' || url.hostname !== 'github.com') return false
    if (url.username || url.password) return false
    return url.pathname === `/${repo}/releases` || url.pathname.startsWith(`/${repo}/releases/`)
  } catch {
    return false
  }
}
