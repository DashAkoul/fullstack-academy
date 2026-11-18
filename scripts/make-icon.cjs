/**
 * Generates build/icon.png (1024×1024) used by electron-builder to derive
 * the Windows .ico, macOS .icns and Linux icons.
 *
 *   npx electron scripts/make-icon.cjs
 */
const { app, BrowserWindow } = require('electron')
const fs = require('node:fs')
const path = require('node:path')

app.disableHardwareAcceleration()

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#8b92ff"/>
      <stop offset="0.55" stop-color="#5b5bf0"/>
      <stop offset="1" stop-color="#312b8f"/>
    </linearGradient>
    <linearGradient id="cap" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset="1" stop-color="#dfe4ff"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="112" fill="url(#bg)"/>
  <circle cx="256" cy="256" r="176" fill="#ffffff" opacity="0.06"/>
  <g transform="translate(256 232)">
    <path d="M0 -104 L192 -28 L0 48 L-192 -28 Z" fill="url(#cap)"/>
    <path d="M-118 8 V82 C-118 82 -68 126 0 126 C68 126 118 82 118 82 V8 L0 56 Z" fill="#ffffff" opacity="0.92"/>
    <path d="M-118 8 V82" stroke="#312b8f" stroke-width="0" />
    <path d="M170 -26 V92" stroke="#ffffff" stroke-width="15" stroke-linecap="round"/>
    <circle cx="170" cy="108" r="19" fill="#ffffff"/>
  </g>
</svg>`

const html = `<!doctype html><html><head><style>
  html,body{margin:0;padding:0;overflow:hidden;background:transparent}
  svg{display:block;width:1024px;height:1024px}
</style></head><body>${svg.replace('width="1024" height="1024"', 'width="1024" height="1024"')}</body></html>`

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1024,
    height: 1024,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    webPreferences: { offscreen: true }
  })
  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
  await new Promise((r) => setTimeout(r, 600))
  const image = await win.webContents.capturePage()
  fs.mkdirSync(path.join(__dirname, '..', 'build'), { recursive: true })
  fs.writeFileSync(path.join(__dirname, '..', 'build', 'icon.png'), image.toPNG())
  console.log('icon written:', image.getSize())
  app.quit()
})
