/** Bounded response readers. Never let a remote server exhaust the process heap. */

export interface CappedText {
  text: string
  truncated: boolean
}

export async function readTextCapped(res: Response, maxBytes: number): Promise<CappedText> {
  const declared = Number(res.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > maxBytes * 4) {
    await res.body?.cancel().catch(() => {})
    return { text: '', truncated: true }
  }

  if (!res.body) {
    const text = await res.text()
    return { text: text.slice(0, maxBytes), truncated: text.length > maxBytes }
  }

  const reader = res.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  let truncated = false

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    if (!value) continue
    const remaining = maxBytes - total
    if (value.byteLength > remaining) {
      if (remaining > 0) chunks.push(value.subarray(0, remaining))
      total = maxBytes
      truncated = true
      await reader.cancel().catch(() => {})
      break
    }
    chunks.push(value)
    total += value.byteLength
  }

  const merged = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.byteLength
  }
  return { text: new TextDecoder().decode(merged), truncated }
}

export async function readJsonCapped<T>(res: Response, maxBytes: number): Promise<T> {
  const { text, truncated } = await readTextCapped(res, maxBytes)
  if (truncated) throw new Error('پاسخ سرور بیش از حد بزرگ است.')
  return JSON.parse(text) as T
}
