import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../src/main/storage', () => ({ getApiKey: vi.fn() }))

import * as storage from '../src/main/storage'
import { listModels } from '../src/main/ai'

function stubFetch(response: { status: number; body: unknown }) {
  const fetchMock = vi.fn(
    async () =>
      new Response(JSON.stringify(response.body), {
        status: response.status,
        headers: { 'content-type': 'application/json' }
      })
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

beforeEach(() => {
  vi.mocked(storage.getApiKey).mockReset()
  vi.mocked(storage.getApiKey).mockResolvedValue('test-key')
  vi.unstubAllGlobals()
})

describe('listModels', () => {
  it('مدل‌های Gemini را فیلتر و مرتب می‌کند', async () => {
    const fetchMock = stubFetch({
      status: 200,
      body: {
        models: [
          {
            name: 'models/gemini-2.5-pro',
            displayName: 'Gemini 2.5 Pro',
            inputTokenLimit: 1_048_576,
            supportedGenerationMethods: ['generateContent']
          },
          {
            name: 'models/gemini-2.5-flash',
            displayName: 'Gemini 2.5 Flash',
            inputTokenLimit: 1_048_576,
            supportedGenerationMethods: ['generateContent']
          },
          {
            name: 'models/text-embedding-004',
            displayName: 'Embedding',
            supportedGenerationMethods: ['embedContent']
          }
        ]
      }
    })

    const models = await listModels({ provider: 'gemini' })

    expect(models.map((m) => m.id)).toEqual(['gemini-2.5-flash', 'gemini-2.5-pro'])
    expect(models[0]).toMatchObject({ label: 'Gemini 2.5 Flash', contextWindow: 1_048_576 })
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, { headers: Record<string, string> }]
    expect(url).toContain('generativelanguage.googleapis.com')
    expect(init.headers['x-goog-api-key']).toBe('test-key')
  })

  it('مدل‌های غیرگفتگو OpenAI را حذف و مدل‌های جدیدتر را اول می‌گذارد', async () => {
    const fetchMock = stubFetch({
      status: 200,
      body: {
        data: [
          { id: 'text-embedding-3-small', created: 5 },
          { id: 'whisper-1', created: 4 },
          { id: 'gpt-4.1-mini', created: 2 },
          { id: 'o3-mini', created: 3 },
          { id: 'gpt-4o-mini', created: 1 }
        ]
      }
    })

    const models = await listModels({ provider: 'openai', baseUrl: 'https://proxy.example/v1/' })

    expect(models.map((m) => m.id)).toEqual(['o3-mini', 'gpt-4.1-mini', 'gpt-4o-mini'])
    const [url] = fetchMock.mock.calls[0] as unknown as [string]
    expect(url).toBe('https://proxy.example/v1/models')
  })

  it('صفحه‌بندی مدل‌های Anthropic را دنبال می‌کند', async () => {
    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = String(input)
      const page2 = url.includes('after_id=last-1')
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: page2
            ? [{ id: 'claude-sonnet-4-5', display_name: 'Claude Sonnet 4.5' }]
            : [{ id: 'claude-opus-4-1', display_name: 'Claude Opus 4.1' }],
          has_more: !page2,
          last_id: 'last-1'
        }),
        text: async () => '{}'
      }
    })
    vi.stubGlobal('fetch', fetchMock)

    const models = await listModels({ provider: 'anthropic' })

    expect(models).toEqual([
      { id: 'claude-opus-4-1', label: 'Claude Opus 4.1' },
      { id: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5' }
    ])
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('بدون کلید خطای راهنما می‌دهد', async () => {
    vi.mocked(storage.getApiKey).mockResolvedValue(undefined)
    await expect(listModels({ provider: 'gemini' })).rejects.toThrow(/کلید API/)
  })

  it('خطای 401 سرویس را با پیام فارسی منتقل می‌کند', async () => {
    stubFetch({ status: 401, body: { error: { message: 'API key not valid' } } })
    await expect(listModels({ provider: 'gemini' })).rejects.toThrow(/API key not valid/)
  })
})
