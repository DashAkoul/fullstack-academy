import { describe, expect, it } from 'vitest'
import { parseRepoRef } from '@shared/repoRef'

describe('parseRepoRef', () => {
  it.each([
    ['owner/repo', { owner: 'owner', repo: 'repo', branch: undefined }],
    ['https://github.com/owner/repo', { owner: 'owner', repo: 'repo', branch: undefined }],
    ['https://github.com/owner/repo.git', { owner: 'owner', repo: 'repo', branch: undefined }],
    ['github.com/owner/repo/', { owner: 'owner', repo: 'repo', branch: undefined }],
    ['git@github.com:owner/repo.git', { owner: 'owner', repo: 'repo', branch: undefined }],
    ['https://github.com/owner/repo/tree/feature/x', { owner: 'owner', repo: 'repo', branch: 'feature/x' }]
  ])('%s را می‌شناسد', (input, expected) => {
    expect(parseRepoRef(input)).toEqual(expected)
  })

  it.each([
    '',
    '   ',
    'just-a-word',
    'owner/repo/extra',
    'https://gitlab.com/owner/repo',
    'https://github.com/owner',
    'https://github.com/',
    'owner/re po'
  ])('%s را رد می‌کند', (input) => {
    expect(parseRepoRef(input)).toBeNull()
  })
})
