export const db = {
  getStats: () => window.api.getStats(),
  processList: (names) => window.api.processList(names),
  toggleStatus: (name, mobileCaptured, photographed, uploaded) => window.api.toggleStatus(name, mobileCaptured, photographed, uploaded),
  selectFolder: () => window.api.selectFolder(),
  getRootFolder: () => window.api.getRootFolder(),
  setRootFolder: (path) => window.api.setRootFolder(path),
  listCountries: () => window.api.listCountries(),
  listFactories: (country) => window.api.listFactories(country),
  listImages: (country, factory) => window.api.listImages(country, factory),
  saveList: (listData) => window.api.saveList(listData),
  getLists: (status) => window.api.getLists(status),
  deleteList: (id) => window.api.deleteList(id),
  getSuppliers: () => window.api.getSuppliers(),
  addSupplier: (name) => window.api.addSupplier(name),
  deleteSupplier: (id) => window.api.deleteSupplier(id)
}
