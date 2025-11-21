import { app, BrowserWindow, shell, ipcMain } from 'electron'
import { join } from 'path'
import { setupIpcHandlers } from './ipc/handlers'

// The built directory structure
//
// ├─┬ dist
// │ └─┬ main
// │   └─┬ main.js
// │     └─┬ preload.js
// │       └─┬ renderer
// │         └─┬ index.html
//           └─┬ ...
//               └─┬ ...
process.env.DIST = join(__dirname, '../')
process.env.VITE_PUBLIC = process.env.VITE_DEV_SERVER_URL
  ? undefined
  : join(process.env.DIST, '../public')

let win: BrowserWindow | null = null
let splash: BrowserWindow | null = null

function createSplashWindow(): void {
  splash = new BrowserWindow({
    width: 500,
    height: 300,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    splash.loadURL(`${process.env.VITE_DEV_SERVER_URL}/src/renderer/splash.html`)
  } else {
    splash.loadFile(join(process.env.DIST || '', '../renderer/splash.html'))
  }

  splash.center()
}

function createWindow(): void {
  // Create the browser window
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    show: false, // Don't show until ready
    autoHideMenuBar: true,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    icon: process.env.NODE_ENV === 'development'
      ? join(__dirname, '../../assets/icon.png')
      : join(__dirname, '../assets/icon.png'),
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

    // Store window reference globally for services to access
    ; (global as any).mainWindow = win

  // Wait for the app to be ready before showing
  ipcMain.on('app-ready', () => {
    if (win && !win.isVisible()) {
      win.show()
      if (splash) {
        splash.close()
        splash = null
      }
    }
  })

  // Safety timeout: show window after 10s if app-ready never comes
  setTimeout(() => {
    if (win && !win.isVisible()) {
      console.log('App ready timeout reached, showing window')
      win.show()
      if (splash) {
        splash.close()
        splash = null
      }
    }
  }, 10000)

  // Also handle ready-to-show as a fallback or for initial setup if needed, 
  // but we primarily rely on app-ready for the visual switch
  win.once('ready-to-show', () => {
    // We don't show here anymore, we wait for app-ready
    // unless we want to show a blank window (which we don't)
  })

  win.on('closed', () => {
    ; (global as any).mainWindow = null
  })

  // Make all links open with the browser, not with the application
  win.webContents.setWindowOpenHandler(({ url }: { url: string }) => {
    if (url.startsWith('https:')) shell.openExternal(url)
    return { action: 'deny' }
  })

  // Load the app
  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL)
    // win.webContents.openDevTools()
  } else {
    win.loadFile(join(process.env.DIST || '', '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.whenReady().then(() => {
  // Set app user model id for windows
  app.setAppUserModelId('com.termul.ssh-client')

  // Set up IPC handlers
  setupIpcHandlers()

  createSplashWindow()
  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed
app.on('window-all-closed', () => {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') app.quit()
})

// In this file you can include the rest of your app's main process
// code. You can also put them in separate files and require them here.