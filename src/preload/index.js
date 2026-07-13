const { contextBridge, ipcRenderer } = require('electron')

// Custom APIs for renderer
const api = {
  getStats: () => ipcRenderer.invoke('db:get-stats'),
  processList: (names) => ipcRenderer.invoke('db:process-list', names),
  toggleStatus: (name, mobileCaptured, photographed, uploaded) => ipcRenderer.invoke('db:toggle-status', { name, mobileCaptured, photographed, uploaded }),
  selectFolder: () => ipcRenderer.invoke('dialog:openDirectory'),
  getRootFolder: () => ipcRenderer.invoke('db:get-root-folder'),
  setRootFolder: (path) => ipcRenderer.invoke('db:set-root-folder', path),
  listCountries: () => ipcRenderer.invoke('fs:list-countries'),
  listFactories: (country) => ipcRenderer.invoke('fs:list-factories', country),
  listImages: (country, factory) => ipcRenderer.invoke('fs:list-images', { country, factory }),
  saveList: (listData) => ipcRenderer.invoke('db:save-list', listData),
  getLists: (status) => ipcRenderer.invoke('db:get-lists', status),
  deleteList: (id) => ipcRenderer.invoke('db:delete-list', id),
  getSuppliers: () => ipcRenderer.invoke('db:get-suppliers'),
  addSupplier: (name) => ipcRenderer.invoke('db:add-supplier', name),
  deleteSupplier: (id) => ipcRenderer.invoke('db:delete-supplier', id),
  getCollectionFolder: () => ipcRenderer.invoke('db:get-collection-folder'),
  setCollectionFolder: (path) => ipcRenderer.invoke('db:set-collection-folder', path),
  collectImagesProcess: (data) => ipcRenderer.invoke('fs:collect-images-process', data),
  openExternalImage: (path) => ipcRenderer.invoke('open-external-image', path),
  getServerUrl: () => ipcRenderer.invoke('db:get-server-url'),
  getMobileUploadPath: () => ipcRenderer.invoke('db:get-mobile-upload-path'),
  setMobileUploadPath: (path) => ipcRenderer.invoke('db:set-mobile-upload-path', path),
  restartApp: () => ipcRenderer.send('app:restart'),
  checkAndUpdate: () => ipcRenderer.invoke('app:check-and-update')
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', {
      ipcRenderer: {
        send: (channel, data) => ipcRenderer.send(channel, data),
        on: (channel, func) => ipcRenderer.on(channel, (event, ...args) => func(...args))
      }
    })
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  window.electron = { ipcRenderer }
  window.api = api
}
