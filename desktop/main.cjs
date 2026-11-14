const { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, net, Notification, protocol, shell, Tray } = require('electron')
const fs = require('node:fs')
const path = require('node:path')
const { pathToFileURL } = require('node:url')
const updater = require('./updater.cjs')
const google = require('./google.cjs')
const { version } = require('./package.json')

// OnTrack's desktop shell: the app's web build (web/, from `expo export`) served over app://,
// with its data in a JSON file, payment reminders as system notifications (OnTrack keeps running
// in the background for them), reading text from screenshots (Tesseract) and PDFs (pdf.js via unpdf), and
// the updater (updater.cjs).

const WEB = path.join(__dirname, 'web')
const DATA = () => path.join(app.getPath('userData'), 'ontrack.json')
const REMINDERS = () => path.join(app.getPath('userData'), 'reminders.json')

protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }])

if (!app.requestSingleInstanceLock()) app.exit(0)

let win = null
let tray = null

function serveWeb() {
  protocol.handle('app', (req) => {
    const { pathname } = new URL(req.url)
    let file = path.normalize(path.join(WEB, decodeURIComponent(pathname)))
    if (!file.startsWith(WEB) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(WEB, 'index.html')
    return net.fetch(pathToFileURL(file).toString())
  })
}

// The title bar is hidden on macOS: leave room for the traffic lights and make the top draggable.
const MAC_CHROME_CSS = `
  #root { margin-top: 28px; height: calc(100% - 28px) !important; }
  #ontrack-drag { position: fixed; top: 0; left: 0; right: 0; height: 28px; -webkit-app-region: drag; z-index: 0; background: transparent; }
`

function createWindow() {
  win = new BrowserWindow({
    width: 1240,
    height: 820,
    minWidth: 420,
    minHeight: 600,
    title: 'OnTrack',
    backgroundColor: '#07060c',
    show: false,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    autoHideMenuBar: true,
    icon: process.platform === 'linux' ? path.join(__dirname, 'build/tray.png') : undefined,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, sandbox: false }
  })
  // `npm run dev` points the app at the Expo dev server (live reload) instead of the built web/.
  win.loadURL(process.env.ONTRACK_DEV_URL || 'app://ontrack/')
  win.once('ready-to-show', () => {
    if (!process.argv.includes('--hidden')) win.show()
  })
  win.webContents.on('did-finish-load', () => {
    // Slim scrollbars that sit on any theme.
    win.webContents.insertCSS(`
      ::-webkit-scrollbar { width: 10px; height: 10px; background: transparent; }
      ::-webkit-scrollbar-track { background: transparent; }
      ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.16); border-radius: 5px; border: 2px solid transparent; background-clip: padding-box; }
      ::-webkit-scrollbar-thumb:hover { background-color: rgba(255,255,255,0.28); }
    `)
  })
  if (process.platform === 'darwin') {
    win.webContents.on('did-finish-load', () => {
      win.webContents.insertCSS(MAC_CHROME_CSS)
      win.webContents.executeJavaScript(`if(!document.getElementById('ontrack-drag')){const d=document.createElement('div');d.id='ontrack-drag';document.body.prepend(d)}`)
    })
  }
  // Links open in the browser, never inside OnTrack.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('app://') && !(process.env.ONTRACK_DEV_URL && url.startsWith(process.env.ONTRACK_DEV_URL))) {
      e.preventDefault()
      if (/^https?:/.test(url)) void shell.openExternal(url)
    }
  })
  // Closing the window keeps OnTrack running for reminders (quit from the menu, dock or tray).
  win.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault()
      win.hide()
    }
  })
}

function showWindow() {
  if (!win) createWindow()
  else {
    win.show()
    win.focus()
  }
}

function createTray() {
  if (process.platform === 'darwin') return
  const icon = nativeImage.createFromPath(path.join(__dirname, 'build', 'tray.png')).resize({ width: 18, height: 18 })
  tray = new Tray(icon)
  tray.setToolTip('OnTrack')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Open OnTrack', click: showWindow },
      { type: 'separator' },
      { label: 'Quit', click: () => ((app.isQuitting = true), app.quit()) }
    ])
  )
  tray.on('click', showWindow)
}

// ── Data ─────────────────────────────────────────────────────────────────────────────────────

ipcMain.on('version', (e) => (e.returnValue = version))

ipcMain.handle('data:load', () => {
  for (const f of [DATA(), `${DATA()}.bak`]) {
    try {
      const text = fs.readFileSync(f, 'utf8')
      JSON.parse(text)
      return text
    } catch {}
  }
  return null
})

ipcMain.handle('data:save', (_e, json) => {
  const file = DATA()
  fs.mkdirSync(path.dirname(file), { recursive: true })
  if (fs.existsSync(file)) fs.copyFileSync(file, `${file}.bak`)
  fs.writeFileSync(`${file}.tmp`, json)
  fs.renameSync(`${file}.tmp`, file)
})

ipcMain.handle('file:save', async (_e, name, content) => {
  const { canceled, filePath } = await dialog.showSaveDialog(win, { defaultPath: path.join(app.getPath('downloads'), name) })
  if (canceled || !filePath) return false
  fs.writeFileSync(filePath, content)
  return true
})

ipcMain.on('open-external', (_e, url) => {
  if (/^https?:\/\//.test(url)) void shell.openExternal(url)
})

// ── Reminders ────────────────────────────────────────────────────────────────────────────────

let reminders = []
let fired = new Set()

function loadReminders() {
  try {
    const saved = JSON.parse(fs.readFileSync(REMINDERS(), 'utf8'))
    reminders = saved.reminders ?? []
    fired = new Set(saved.fired ?? [])
  } catch {}
}

function saveReminders() {
  const live = new Set(reminders.map((r) => r.id))
  fs.writeFileSync(REMINDERS(), JSON.stringify({ reminders, fired: [...fired].filter((id) => live.has(id)) }))
}

function notify(title, body) {
  if (!Notification.isSupported()) return
  const n = new Notification({ title, body, silent: false })
  n.on('click', showWindow)
  n.show()
}

/** Shows reminders that are due (or were missed in the last day while OnTrack wasn't running). */
function fireDue() {
  const now = Date.now()
  let changed = false
  for (const r of reminders) {
    if (r.at <= now && r.at > now - 24 * 3600_000 && !fired.has(r.id)) {
      fired.add(r.id)
      changed = true
      notify(r.title, r.body)
    }
  }
  if (changed) saveReminders()
}

ipcMain.on('reminders:set', (_e, list) => {
  reminders = Array.isArray(list) ? list : []
  saveReminders()
  fireDue()
})
ipcMain.on('notify', (_e, title, body) => notify(title, body))

// ── Reading text ─────────────────────────────────────────────────────────────────────────────

let ocrWorker = null
ipcMain.handle('ocr', async (_e, dataUrl) => {
  const { createWorker } = require('tesseract.js')
  if (!ocrWorker) ocrWorker = await createWorker('eng', 1, { cachePath: path.join(app.getPath('userData'), 'tesseract') })
  const image = Buffer.from(String(dataUrl).replace(/^data:[^,]+,/, ''), 'base64')
  const { data } = await ocrWorker.recognize(image)
  return data.text
})

ipcMain.handle('pdf:text', async (_e, base64) => {
  const { getDocumentProxy } = await import('unpdf')
  const doc = await getDocumentProxy(new Uint8Array(Buffer.from(base64, 'base64')))
  const lines = []
  for (let p = 1; p <= Math.min(doc.numPages, 60); p++) {
    const page = await doc.getPage(p)
    const content = await page.getTextContent()
    // Group the text pieces into lines by their vertical position.
    const rows = new Map()
    for (const item of content.items) {
      if (!('str' in item) || !item.str.trim()) continue
      const y = Math.round(item.transform[5] / 3) * 3
      rows.set(y, [...(rows.get(y) ?? []), { x: item.transform[4], s: item.str }])
    }
    for (const y of [...rows.keys()].sort((a, b) => b - a)) {
      lines.push(rows.get(y).sort((a, b) => a.x - b.x).map((i) => i.s).join('  '))
    }
  }
  return lines.join('\n')
})

// ── Sync with Google ─────────────────────────────────────────────────────────────────────────

ipcMain.on('google:configured', (e) => (e.returnValue = google.configured()))
ipcMain.handle('google:sign-in', () => google.signIn())
ipcMain.handle('google:sign-out', () => google.signOut())
ipcMain.handle('google:fetch', (_e, url, init) => google.authFetch(url, init))

// ── Updates ──────────────────────────────────────────────────────────────────────────────────

ipcMain.handle('update:status', () => updater.updateStatus())
ipcMain.handle('update:check', (_e, quiet) => updater.checkForUpdates(Boolean(quiet)))
ipcMain.handle('update:download', () => updater.downloadUpdate())
ipcMain.handle('update:install', () => updater.installUpdate())
ipcMain.on('update:auto', (_e, enabled) => updater.setAuto(enabled))

// ── App ──────────────────────────────────────────────────────────────────────────────────────

app.on('second-instance', showWindow)
app.on('activate', showWindow)
app.on('before-quit', () => (app.isQuitting = true))
app.on('window-all-closed', () => {})

app.whenReady().then(() => {
  app.setAppUserModelId('app.ontrack.subscriptions')
  serveWeb()
  loadReminders()
  createWindow()
  createTray()
  setInterval(fireDue, 30_000)
  updater.startUpdater((status) => win?.webContents.send('update:status', status))
  if (process.env.ONTRACK_SHOTS) void screenshots(process.env.ONTRACK_SHOTS)
})

/** Test hook: ONTRACK_SHOTS=<dir> [ONTRACK_SHOT_STEPS="name:click text,…"] saves screenshots, then quits. */
async function screenshots(dir) {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms))
  fs.mkdirSync(dir, { recursive: true })
  await wait(4000)
  const steps = (process.env.ONTRACK_SHOT_STEPS || 'home:,calendar:Calendar,settings:Settings').split(',')
  for (const step of steps) {
    const [name, ...clicks] = step.split(':')
    for (const text of clicks.filter(Boolean)) {
      if (text.startsWith('@')) {
        await win.webContents.executeJavaScript(`(() => { const el = [...document.querySelectorAll('[aria-label=${JSON.stringify(text.slice(1))}]')].pop(); el && el.click() })()`)
        await wait(900)
        continue
      }
      await win.webContents.executeJavaScript(`(() => { const els = [...document.querySelectorAll('div,span')].filter(e => e.childElementCount === 0 && e.textContent.trim() === ${JSON.stringify(text)}); const el = els[els.length - 1]; el && el.click(); return !!el })()`)
      await wait(900)
    }
    await wait(1200)
    console.log('shot', name, await win.webContents.executeJavaScript('JSON.stringify([innerWidth, innerHeight, document.documentElement.scrollWidth, document.body.scrollWidth, devicePixelRatio])'))
    const img = await win.webContents.capturePage()
    fs.writeFileSync(path.join(dir, `${name}.png`), img.toPNG())
  }
  app.isQuitting = true
  app.quit()
}
