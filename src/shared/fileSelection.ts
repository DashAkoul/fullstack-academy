/** Decides which repository files are worth sending to the AI reviewer. */

const IGNORED_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'out', '.next', '.expo', '.turbo', 'coverage',
  '.vercel', 'vendor', '.cache', '.idea', '.vscode', 'android', 'ios', '__snapshots__',
  'playwright-report', 'test-results', '.pnpm-store', '.yarn'
])

const IGNORED_FILES = new Set([
  'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lockb', 'bun.lock', '.DS_Store'
])

const TEXT_EXT = new Set([
  'html', 'htm', 'css', 'scss', 'sass', 'less', 'js', 'jsx', 'mjs', 'cjs', 'ts', 'tsx', 'mts', 'cts',
  'json', 'md', 'mdx', 'yml', 'yaml', 'toml', 'prisma', 'graphql', 'gql', 'sql', 'sh', 'vue',
  'svelte', 'txt', 'env.example', 'example', 'sample', 'template', 'conf', 'ini'
])

const SPECIAL_NAMES = new Set([
  'dockerfile', '.dockerignore', '.gitignore', '.gitattributes', '.npmrc', '.nvmrc', 'makefile',
  'procfile', '.editorconfig', '.prettierrc', '.eslintrc', 'license'
])

export interface CandidateFile {
  path: string
  size?: number
}

export function isReviewable(path: string, size = 0): boolean {
  const parts = path.split('/')
  if (parts.slice(0, -1).some((d) => IGNORED_DIRS.has(d))) return false
  const name = parts[parts.length - 1]
  const lower = name.toLowerCase()
  if (IGNORED_FILES.has(name)) return false
  // Never ship real secrets to an AI provider.
  if (/^\.env(\..*)?$/.test(lower) && !/\.(example|sample|template)$/.test(lower)) return false
  if (/\.min\.(js|css)$/.test(lower) || lower.endsWith('.map')) return false
  if (size > 400_000) return false
  if (SPECIAL_NAMES.has(lower) || lower.startsWith('dockerfile') || lower.startsWith('docker-compose'))
    return true
  const ext = lower.includes('.') ? lower.slice(lower.lastIndexOf('.') + 1) : ''
  return TEXT_EXT.has(ext)
}

function priority(path: string): number {
  const lower = path.toLowerCase()
  const name = lower.split('/').pop() ?? ''
  if (name === 'package.json' && !lower.includes('/')) return 0
  if (name === 'readme.md' && !lower.includes('/')) return 1
  if (/(^|\/)(src|app|pages|components|lib|server|api|routes|prisma|tests?|e2e|__tests__)\//.test(lower))
    return 2
  if (/\.(ts|tsx|js|jsx|html|css|prisma|graphql)$/.test(lower)) return 3
  if (/config|dockerfile|compose|tsconfig|\.ya?ml$/.test(lower)) return 4
  return 5
}

export function selectReviewFiles<T extends CandidateFile>(files: T[], opts: { maxFiles: number }): T[] {
  return files
    .filter((f) => isReviewable(f.path, f.size))
    .sort((a, b) => priority(a.path) - priority(b.path) || a.path.split('/').length - b.path.split('/').length || a.path.localeCompare(b.path))
    .slice(0, opts.maxFiles)
}
