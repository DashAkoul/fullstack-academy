import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  session,
  shell,
  nativeTheme,
  type IpcMainInvokeEvent,
  type MenuItemConstructorOptions
} from 'electron'
import { join } from 'node:path'
import type { AIProvider, IpcResult } from '@shared/types'
import { AI_PROVIDERS } from '@shared/types'
import { isSafeExternalUrl } from '@shared/netSafety'
import * as storage from './storage'
import * as github from './github'
import * as ai from './ai'
import { checkForUpdate } from './update'

declare const __APP_VERSION__: string
const APP_VERSION = typeof __APP_VERSION__ === 'string' && __APP_VERSION__ ? __APP_VERSION__ : app.getVersion()

const ALLOWED_PERMISSIONS = new Set(['clipboard-sanitized-write'])
const MAX_STORAGE_VALUE = 5_000_000

function isAppUrl(raw: string): boolean {
  try {
    const url = new URL(raw)
    const devUrl = process.env['ELECTRON_RENDERER_URL']
    if (!app.isPackaged && devUrl) return url.origin === new URL(devUrl).origin
    return url.protocol === 'file:' && url.pathname.endsWith('/out/renderer/index.html')
  } catch {
    return false
  }
}

/** Only the app's own top-level document may call privileged IPC. */
function isTrustedSender(event: IpcMainInvokeEvent): boolean {
  const frameUrl = event.senderFrame?.url
  if (!frameUrl) return false
  return isAppUrl(frameUrl)
}

function requireString(value: unknown, name: string, maxLength: number): string {
  if (typeof value !== 'string') throw new Error(`${name} باید متن باشد.`)
  if (value.length > maxLength) throw new Error(`${name} بیش از حد طولانی است.`)
  return value
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
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      webviewTag: false,
      spellcheck: false,
      devTools: !app.isPackaged
    }
  })

  win.once('ready-to-show', () => win.show())

  // All links open in the user's browser, never inside the app window.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isSafeExternalUrl(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })

  const blockForeignNavigation = (event: Electron.Event, url: string): void => {
    if (isAppUrl(url)) return
    event.preventDefault()
    if (isSafeExternalUrl(url)) void shell.openExternal(url)
  }
  win.webContents.on('will-navigate', blockForeignNavigation)
  win.webContents.on('will-redirect', blockForeignNavigation)
  win.webContents.on('will-attach-webview', (event) => event.preventDefault())

  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    void win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

/** Wraps handlers so errors cross the IPC boundary as clean messages. */
function handle<A extends unknown[], R>(channel: string, fn: (...args: A) => Promise<R> | R): void {
  ipcMain.handle(channel, async (event, ...args: unknown[]): Promise<IpcResult<R>> => {
    if (!isTrustedSender(event)) {
      return { ok: false, error: 'درخواست از منبع نامعتبر رد شد.' }
    }
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
  handle('storage:read', (key: unknown) => storage.readDoc(requireString(key, 'کلید', 64)))
  handle('storage:write', (key: unknown, value: unknown) =>
    storage.writeDoc(requireString(key, 'کلید', 64), requireString(value, 'مقدار', MAX_STORAGE_VALUE))
  )
  handle('storage:remove', (key: unknown) => storage.removeDoc(requireString(key, 'کلید', 64)))

  handle('secrets:status', () => storage.secretsStatus())
  handle('secrets:setApiKey', async (provider: unknown, key: unknown) => {
    if (typeof provider !== 'string' || !(AI_PROVIDERS as string[]).includes(provider)) {
      throw new Error('سرویس ناشناخته')
    }
    if (key !== null && typeof key !== 'string') throw new Error('کلید API نامعتبر است.')
    await storage.setApiKey(provider as AIProvider, key as string | null)
    return storage.secretsStatus()
  })

  handle('github:fetchRepo', (ref: unknown) => github.fetchRepo(requireString(ref, 'آدرس مخزن', 500)))

  handle('ai:complete', (req: unknown) => ai.complete(req))
  handle('ai:listModels', (req: unknown) => ai.listModels(req))

  handle('shell:openExternal', async (url: unknown) => {
    const value = requireString(url, 'آدرس', 2048)
    if (!isSafeExternalUrl(value)) throw new Error('آدرس نامعتبر است.')
    await shell.openExternal(value)
  })
  handle('app:info', () => ({
    version: APP_VERSION,
    platform: process.platform,
    dataPath: app.getPath('userData')
  }))
  handle('app:checkUpdate', () => checkForUpdate(APP_VERSION))
}

if (!process.argv.includes('--no-sandbox')) app.enableSandbox()
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

  const ses = session.defaultSession
  ses.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(ALLOWED_PERMISSIONS.has(permission))
  })
  ses.setPermissionCheckHandler((_wc, permission) => ALLOWED_PERMISSIONS.has(permission))
  ses.setSpellCheckerEnabled(false)

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
