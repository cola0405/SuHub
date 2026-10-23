import { app, BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { tmpdir } from 'os'
import { existsSync, mkdirSync } from 'fs'
import { initDb } from './db'
import { initFfmpeg } from './services/ffmpeg'
import { registerMediaProtocol } from './protocol'
import { registerIpc } from './ipc'
import { registerMediaScheme } from './protocol'
import { setMainWindow } from './bus'
import { kickQueue, verifyAssets } from './services/library'
import { runSmokeTest } from './smoke'

const isSmoke = process.argv.includes('--smoke-test')

registerMediaScheme()

if (isSmoke) {
  app.setPath('userData', join(tmpdir(), `sucai-smoke-${Date.now()}`))
}

function createWindow(): void {
  const devIcon = join(__dirname, '../../build/icon.png')
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: '#17181d',
    autoHideMenuBar: true,
    show: false,
    icon: existsSync(devIcon) ? devIcon : undefined,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true
    }
  })

  win.once('ready-to-show', () => win.show())
  win.on('closed', () => setMainWindow(null))
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) void shell.openExternal(url)
    return { action: 'deny' }
  })

  setMainWindow(win)

  if (process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

void app.whenReady().then(() => {
  initDb()
  initFfmpeg()
  registerMediaProtocol()
  registerIpc()

  if (isSmoke) {
    runSmokeTest()
      .then((code) => app.exit(code))
      .catch((err) => {
        console.error(err)
        app.exit(1)
      })
    return
  }

  createWindow()
  mkdirSync(join(app.getPath('userData')), { recursive: true })
  verifyAssets()
  kickQueue()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  app.quit()
})
