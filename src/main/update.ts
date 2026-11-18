import type { UpdateInfo } from '@shared/types'
import { APP_REPO, LATEST_RELEASE_API, RELEASES_URL, isNewerVersion } from '@shared/appConfig'

export interface ReleaseAsset {
  name: string
  browser_download_url: string
}

interface GithubRelease {
  tag_name: string
  name?: string
  body?: string
  html_url: string
  published_at?: string
  assets: ReleaseAsset[]
}

export function preferredAsset(
  assets: ReleaseAsset[],
  platform: NodeJS.Platform
): ReleaseAsset | undefined {
  const patterns =
    platform === 'win32'
      ? [/-setup\.exe$/i, /\.exe$/i]
      : platform === 'darwin'
        ? [/\.dmg$/i, /mac.*\.zip$/i, /\.zip$/i]
        : [/\.AppImage$/i, /\.deb$/i, /\.tar\.gz$/i]

  for (const pattern of patterns) {
    const found = assets.find((a) => pattern.test(a.name))
    if (found) return found
  }
  return undefined
}

export async function checkForUpdate(currentVersion: string): Promise<UpdateInfo> {
  const res = await fetch(LATEST_RELEASE_API, {
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'FullStack-Academy-Desktop'
    },
    signal: AbortSignal.timeout(20_000)
  })

  if (res.status === 404) {
    return {
      currentVersion,
      latestVersion: '',
      upToDate: true,
      releaseUrl: RELEASES_URL
    }
  }

  if (!res.ok) throw new Error(`بررسی به‌روزرسانی ناموفق بود (GitHub ${res.status}).`)

  const release = (await res.json()) as GithubRelease
  const latestVersion = release.tag_name.replace(/^v/i, '')
  const asset = preferredAsset(release.assets ?? [], process.platform)

  return {
    currentVersion,
    latestVersion,
    upToDate: !isNewerVersion(latestVersion, currentVersion),
    releaseUrl: release.html_url || `${RELEASES_URL}/tag/${release.tag_name}`,
    publishedAt: release.published_at,
    notes: release.body?.slice(0, 4000),
    downloadUrl: asset?.browser_download_url,
    assetName: asset?.name
  }
}

export { APP_REPO }
