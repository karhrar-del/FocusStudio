const { app, shell, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const { electronApp, optimizer, is } = require('@electron-toolkit/utils')
const db = require('./db')
const server = require('./server')
const updater = require('./updater')

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    title: 'FocusStudio',
    autoHideMenuBar: true,
    icon: path.join(__dirname, '../../assets/icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
  return mainWindow
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.fstudio.erp')

  // Data Migration Logic (Safe transition from KH1 System or product-photography-app)
  const fs = require('fs')
  const newUserData = app.getPath('userData')
  const newDbPath = path.join(newUserData, 'photography_data.json')
  
  if (!fs.existsSync(newDbPath)) {
    const oldPossiblePaths = [
      path.join(app.getPath('appData'), 'KH1 System', 'photography_data.json'),
      path.join(app.getPath('appData'), 'product-photography-app', 'photography_data.json')
    ]
    
    for (const oldPath of oldPossiblePaths) {
      if (fs.existsSync(oldPath)) {
        try {
          if (!fs.existsSync(newUserData)) fs.mkdirSync(newUserData, { recursive: true })
          fs.copyFileSync(oldPath, newDbPath)
          console.log(`Migrated data from ${oldPath} to ${newDbPath}`)
          break 
        } catch (err) {
          console.error(`Failed to migrate data from ${oldPath}:`, err)
        }
      }
    }
  }

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC handlers for Database (JSON matched)
  ipcMain.handle('db:get-stats', async () => {
    return db.getStats()
  })

  ipcMain.handle('db:process-list', async (_, names) => {
    return db.processProductList(names)
  })

  ipcMain.handle('db:toggle-status', async (_, { name, mobileCaptured, photographed, uploaded }) => {
    return db.toggleProductStatus(name, mobileCaptured, photographed, uploaded)
  })

  ipcMain.handle('dialog:openDirectory', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openDirectory']
    })
    if (canceled) return null
    return filePaths[0]
  })

  ipcMain.handle('db:get-root-folder', async () => {
    return db.getRootFolder()
  })

  ipcMain.handle('db:set-root-folder', async (_, folderPath) => {
    return db.setRootFolder(folderPath)
  })

  ipcMain.handle('db:get-collection-folder', async () => {
    return db.getCollectionFolder()
  })

  ipcMain.handle('db:set-collection-folder', async (_, folderPath) => {
    return db.setCollectionFolder(folderPath)
  })
  
  ipcMain.handle('db:get-mobile-upload-path', async () => {
    return db.getMobileUploadPath()
  })

  ipcMain.handle('db:set-mobile-upload-path', async (_, folderPath) => {
    return db.setMobileUploadPath(folderPath)
  })

  ipcMain.handle('fs:collect-images-process', async (_, { listName, country, factory, products, collectionPath }) => {
    const fs = require('fs')
    const root = db.getRootFolder()
    const baseCollection = collectionPath || db.getCollectionFolder()

    console.log('[Collect] Starting process...', { listName, collectionPath: baseCollection })

    if (!root || !baseCollection) {
      throw new Error('Paths not configured. Please set root and collection folders in Settings.')
    }

    // 1. Determine target folder name (handling duplicates)
    let targetName = (listName || 'New Collection').replace(/[\\/:*?"<>|]/g, '_')
    let targetPath = path.join(baseCollection, targetName)
    let counter = 1
    
    while (fs.existsSync(targetPath)) {
      targetPath = path.join(baseCollection, `${targetName}_${counter}`)
      counter++
    }

    // 2. Create folder
    try {
      fs.mkdirSync(targetPath, { recursive: true })
    } catch (err) {
      console.error('[Collect] Failed to create directory:', err)
      throw new Error(`Failed to create directory: ${err.message}`)
    }

    // 3. Find and copy images
    const extensions = ['.jpg', '.jpeg', '.png', '.webp']
    const searchBase = (!factory || factory === 'الكل') 
      ? path.join(root, country) 
      : path.join(root, country, factory)

    const results = {
      success: 0,
      total: products.length,
      path: targetPath
    }

    // Helper to find file with extension
    const findImage = (dir, name) => {
      if (!fs.existsSync(dir)) return null
      try {
        const items = fs.readdirSync(dir, { withFileTypes: true })
        for (const item of items) {
          const fullPath = path.join(dir, item.name)
          if (item.isDirectory()) {
            const found = findImage(fullPath, name)
            if (found) return found
          } else {
            const ext = path.extname(item.name).toLowerCase()
            if (extensions.includes(ext) && path.parse(item.name).name === name) {
              return fullPath
            }
          }
        }
      } catch (err) {
        console.error(`[Collect] Error reading directory ${dir}:`, err)
      }
      return null
    }

    for (let i = 0; i < products.length; i++) {
      const productName = products[i].value || products[i].name
      if (!productName) continue

      const sourcePath = findImage(searchBase, productName)
      if (sourcePath) {
        try {
          const ext = path.extname(sourcePath)
          const destPath = path.join(targetPath, `${i + 1}${ext}`)
          fs.copyFileSync(sourcePath, destPath)
          results.success++
          console.log(`[Collect] Copied: ${productName} -> ${i + 1}${ext}`)
        } catch (err) {
          console.error(`[Collect] Failed to copy ${productName}:`, err)
        }
      } else {
        console.warn(`[Collect] Image not found: ${productName}`)
      }
    }

    console.log('[Collect] Process completed.', results)
    return results
  })

  ipcMain.handle('open-external-image', async (_, { fullPath, country, imageName }) => {
    const fs = require('fs')
    const extensions = ['.jpg', '.jpeg', '.png', '.webp']
    
    // 1. Try the direct path provided
    if (fullPath && fs.existsSync(fullPath)) {
      try {
        await shell.openPath(fullPath)
        return { success: true }
      } catch (err) {
        return { success: false, error: err.message }
      }
    }

    // 2. Fallback: Search in the country folder if country and imageName are provided
    if (country && imageName) {
      const root = db.getRootFolder()
      if (root) {
        const countryPath = path.join(root, country)
        
        // Helper to find file recursively
        const findImage = (dir, name) => {
          if (!fs.existsSync(dir)) return null
          try {
            const items = fs.readdirSync(dir, { withFileTypes: true })
            for (const item of items) {
              const currentPath = path.join(dir, item.name)
              if (item.isDirectory()) {
                const found = findImage(currentPath, name)
                if (found) return found
              } else {
                const ext = path.extname(item.name).toLowerCase()
                if (extensions.includes(ext) && path.parse(item.name).name === name) {
                  return currentPath
                }
              }
            }
          } catch (err) {}
          return null
        }

        const fallbackPath = findImage(countryPath, imageName)
        if (fallbackPath) {
          try {
            await shell.openPath(fallbackPath)
            return { success: true }
          } catch (err) {
            return { success: false, error: err.message }
          }
        }
      }
    }

    return { success: false, error: 'File not found' }
  })

  ipcMain.handle('fs:list-countries', async () => {
    return db.listCountries()
  })

  ipcMain.handle('fs:list-factories', async (_, country) => {
    return db.listFactoriesInCountry(country)
  })

  ipcMain.handle('fs:list-images', async (_, { country, factory }) => {
    return factory ? db.listImagesInFactory(country, factory) : db.listImagesInCountry(country)
  })
  
  ipcMain.handle('db:save-list', async (_, listData) => {
    return db.saveList(listData)
  })

  ipcMain.handle('db:get-lists', async (_, status) => {
    return db.getLists(status)
  })

  ipcMain.handle('db:delete-list', async (_, id) => {
    return db.deleteList(id)
  })
  
  ipcMain.handle('db:get-suppliers', async () => {
    return db.getSuppliers()
  })

  ipcMain.handle('db:add-supplier', async (_, name) => {
    return db.addSupplier(name)
  })

  ipcMain.handle('db:delete-supplier', async (_, id) => {
    return db.deleteSupplier(id)
  })

  ipcMain.handle('db:get-server-url', async () => {
    const ip = server.getLocalIp()
    return `http://${ip}:3000/app`
  })

  ipcMain.on('app:restart', () => {
    console.log('[Restart] Relaunching application...')
    app.relaunch()
    app.exit(0)
  })

  ipcMain.handle('app:check-and-update', async () => {
    try {
      const result = await updater.checkForUpdate()
      if (!result.hasUpdate) {
        return { status: 'uptodate', version: result.currentVersion }
      }
      await updater.downloadAndInstall()
      setTimeout(() => {
        app.relaunch()
        app.exit(0)
      }, 2000)
      return { status: 'success', version: result.remoteVersion }
    } catch (error) {
      console.error('[Updater IPC]', error.message)
      return { status: 'error', message: error.message }
    }
  })

  const mainWindow = createWindow()
  server.startServer(mainWindow)

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
