import { app, BrowserWindow, ipcMain, Menu, shell, nativeTheme, type MenuItemConstructorOptions } from 'electron'
import { join } from 'node:path'
import type { AIProvider, IpcResult } from '@shared/types'
import * as storage from './storage'
import * as github from './github'
import * as ai from './ai'
import { checkForUpdate } from './update'

declare const __APP_VERSION__: string
const APP_VERSION = typeof __APP_VERSION__ === 'string' && __APP_VERSION__ ? __APP_VERSION__ : app.getVersion()

function isSafeExternal(url: string): boolean {
  try {
    const u = new URL(url)
    return u.protocol === 'https:' || u.protocol === 'http:'
  } catch {
    return false
  }
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1360,
    height: 880,
    minWidth: 1024,
    minHeight: 680,
    show: false,
    title: 'FullStack Academy',
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#0b0f17' : '#f8fafc',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  win.once('ready-to-show', () => win.show())

  // All links open in the user's browser, never inside the app window.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isSafeExternal(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (e, url) => {
    const devUrl = process.env['ELECTRON_RENDERER_URL']
    if (devUrl && url.startsWith(devUrl)) return
    e.preventDefault()
    if (isSafeExternal(url)) void shell.openExternal(url)
  })

  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    void win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

/** Wraps handlers so errors cross the IPC boundary as clean messages. */
function handle<A extends unknown[], R>(channel: string, fn: (...args: A) => Promise<R> | R): void {
  ipcMain.handle(channel, async (_e, ...args: unknown[]): Promise<IpcResult<R>> => {
    try {
      return { ok: true, data: await fn(...(args as A)) }
    } catch (err) {
      const message =
        err instanceof Error
          ? err.name === 'TimeoutError'
            ? 'زمان درخواست به پایان رسید. اتصال اینترنت را بررسی کنید.'
            : err.message
          : String(err)
      return { ok: false, error: message }
    }
  })
}

function buildMenu(): void {
  const isMac = process.platform === 'darwin'
  const template: MenuItemConstructorOptions[] = [
    ...(isMac ? [{ role: 'appMenu' as const }] : []),
    { role: 'fileMenu' },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

function registerIpc(): void {
  handle('storage:read', (key: string) => storage.readDoc(key))
  handle('storage:write', (key: string, value: string) => storage.writeDoc(key, value))
  handle('storage:remove', (key: string) => storage.removeDoc(key))

  handle('secrets:status', () => storage.secretsStatus())
  handle('secrets:setApiKey', async (provider: AIProvider, key: string | null) => {
    await storage.setApiKey(provider, key)
    return storage.secretsStatus()
  })
  handle('github:fetchRepo', (ref: string) => github.fetchRepo(ref))

  handle('ai:complete', (req: Parameters<typeof ai.complete>[0]) => ai.complete(req))
  handle('ai:listModels', (req: Parameters<typeof ai.listModels>[0]) => ai.listModels(req))

  handle('shell:openExternal', async (url: string) => {
    if (!isSafeExternal(url)) throw new Error('Blocked URL')
    await shell.openExternal(url)
  })
  handle('app:info', () => ({
    version: APP_VERSION,
    platform: process.platform,
    dataPath: app.getPath('userData')
  }))
  handle('app:checkUpdate', () => checkForUpdate(APP_VERSION))
}

app.setName('FullStack Academy')

const gotLock = app.requestSingleInstanceLock()

if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const [win] = BrowserWindow.getAllWindows()
    if (!win) return
    if (win.isMinimized()) win.restore()
    win.focus()
  })
}

app.whenReady().then(() => {
  if (!gotLock) return
  app.setAppUserModelId('com.fullstackacademy.desktop')
  buildMenu()
  registerIpc()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
