import { contextBridge, ipcRenderer } from 'electron'
import type { AcademyBridge, IpcResult } from '@shared/types'

async function call<T>(channel: string, ...args: unknown[]): Promise<T> {
  const res = (await ipcRenderer.invoke(channel, ...args)) as IpcResult<T>
  if (!res.ok) throw new Error(res.error)
  return res.data
}

const api: AcademyBridge = {
  storage: {
    read: (key) => call('storage:read', key),
    write: (key, value) => call('storage:write', key, value),
    remove: (key) => call('storage:remove', key)
  },
  secrets: {
    status: () => call('secrets:status'),
    setApiKey: (provider, key) => call('secrets:setApiKey', provider, key)
  },
  github: {
    fetchRepo: (ref) => call('github:fetchRepo', ref)
  },
  ai: {
    complete: (req) => call('ai:complete', req),
    listModels: (req) => call('ai:listModels', req)
  },
  shell: { openExternal: (url) => call('shell:openExternal', url) },
  app: {
    info: () => call('app:info'),
    checkUpdate: () => call('app:checkUpdate')
  }
}

contextBridge.exposeInMainWorld('academy', api)
