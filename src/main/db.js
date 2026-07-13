const fs = require('fs');
const path = require('path');
const { app } = require('electron');

// Ensure data is stored in userData folder for production safety
const dataPath = path.join(app.getPath('userData'), 'photography_data.json');

// Initial data structure
const initialState = {
  products: [],
  lists: [],
  suppliers: [],
  config: {
    rootFolderPath: null,
    collectionFolderPath: null,
    mobileUploadPath: null
  }
};

function ensureDataFile() {
  if (!fs.existsSync(dataPath)) {
    fs.writeFileSync(dataPath, JSON.stringify(initialState, null, 2));
  }
}

function getData() {
  ensureDataFile();
  try {
    const content = fs.readFileSync(dataPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error('Error reading data file:', error);
    return initialState;
  }
}

function saveData(data) {
  try {
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error saving data file:', error);
  }
}

function getStats() {
  const data = getData();
  const today = new Date().toISOString().split('T')[0];
  
  const newPhotosToday = data.products.filter(p => 
    p.photographed && p.date_photographed === today
  ).length;

  const uploadedToday = data.products.filter(p => 
    p.uploaded && p.date_uploaded === today
  ).length;

  return {
    newPhotos: newPhotosToday,
    uploaded: uploadedToday,
  };
}

// Logic for checklists
function processProductList(names) {
  const data = getData();
  return names.map(name => {
    const existing = data.products.find(p => p.name === name);
    return existing || { name, mobileCaptured: false, photographed: false, uploaded: false };
  });
}

function toggleProductStatus(name, mobileCaptured, photographed, uploaded) {
  const data = getData();
  let product = data.products.find(p => p.name === name);
  const today = new Date().toISOString().split('T')[0];

  if (product) {
    // Update mobileCaptured status and date
    if (mobileCaptured !== undefined && mobileCaptured !== product.mobileCaptured) {
      product.mobileCaptured = mobileCaptured;
      if (mobileCaptured) product.date_mobile_captured = today;
    }

    // Update photographed status and date
    if (photographed !== undefined && photographed !== product.photographed) {
      product.photographed = photographed;
      if (photographed) product.date_photographed = today;
    }
    
    // Update uploaded status and date
    if (uploaded !== undefined && uploaded !== product.uploaded) {
      product.uploaded = uploaded;
      if (uploaded) product.date_uploaded = today;
    }
  } else {
    product = {
      name,
      mobileCaptured: mobileCaptured || false,
      photographed: photographed || false,
      uploaded: uploaded || false,
      date_added: today,
      date_mobile_captured: mobileCaptured ? today : null,
      date_photographed: photographed ? today : null,
      date_uploaded: uploaded ? today : null
    };
    data.products.push(product);
  }

  saveData(data);
  return product;
}

function getRootFolder() {
  const data = getData();
  return data.config?.rootFolderPath || null;
}

function setRootFolder(path) {
  const data = getData();
  if (!data.config) data.config = {};
  data.config.rootFolderPath = path;
  saveData(data);
  return path;
}

function getCollectionFolder() {
  const data = getData();
  return data.config?.collectionFolderPath || null;
}

function setCollectionFolder(path) {
  const data = getData();
  if (!data.config) data.config = {};
  data.config.collectionFolderPath = path;
  saveData(data);
  return path;
}

function getMobileUploadPath() {
  const data = getData();
  return data.config?.mobileUploadPath || null;
}

function setMobileUploadPath(path) {
  const data = getData();
  if (!data.config) data.config = {};
  data.config.mobileUploadPath = path;
  saveData(data);
  return path;
}

function listSubFolders(parentPath) {
  if (!parentPath || typeof parentPath !== 'string') return [];
  try {
    if (!fs.existsSync(parentPath)) return [];
    
    return fs.readdirSync(parentPath, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);
  } catch (error) {
    console.error('Error listing folders:', error);
    return [];
  }
}

function listImageFiles(parentPath) {
  if (!parentPath || typeof parentPath !== 'string') return [];
  let results = [];
  try {
    if (!fs.existsSync(parentPath)) return [];
    
    const extensions = ['.jpg', '.jpeg', '.png', '.webp'];
    const items = fs.readdirSync(parentPath, { withFileTypes: true });
    
    for (const item of items) {
      const fullPath = path.join(parentPath, item.name);
      if (item.isDirectory()) {
        // Recursive dive into subdirectories
        results = results.concat(listImageFiles(fullPath));
      } else if (item.isFile()) {
        const ext = path.extname(item.name).toLowerCase();
        if (extensions.includes(ext)) {
          results.push(path.parse(item.name).name); // Strip extension
        }
      }
    }
  } catch (error) {
    console.error('Error listing images recursively:', error);
  }
  // Return unique filenames to avoid duplicates in autocomplete
  return [...new Set(results)];
}

function listImagesInFactory(country, factory) {
  const root = getRootFolder();
  if (!root || !country || !factory) return [];
  
  // Robust check for 'الكل' (All) option
  const isAll = typeof factory === 'string' && factory.trim() === 'الكل';
  
  if (isAll) {
    const factories = listFactoriesInCountry(country);
    let allImages = [];
    for (const f of factories) {
      const searchPath = path.join(root, country, f);
      const images = listImageFiles(searchPath);
      allImages = allImages.concat(images.map(name => ({ name, factory: f })));
    }
    // Return unique by name, but keeping factory info
    const seen = new Set();
    return allImages.filter(img => {
      if (seen.has(img.name)) return false;
      seen.add(img.name);
      return true;
    });
  } else {
    const searchPath = path.join(root, country, factory);
    const images = listImageFiles(searchPath);
    return images.map(name => ({ name, factory }));
  }
}

function listImagesInCountry(country) {
  const root = getRootFolder();
  if (!root || !country) return [];
  const searchPath = path.join(root, country);
  if (!fs.existsSync(searchPath)) return [];
  const images = listImageFiles(searchPath);
  return [...new Set(images.map(name => ({ name, factory: '' })))];
}

function listFactoriesInCountry(country) {
  const root = getRootFolder();
  if (!root || !country) return [];
  const fullPath = path.join(root, country);
  return listSubFolders(fullPath);
}

function listCountries() {
  const root = getRootFolder();
  if (!root) return [];
  return listSubFolders(root);
}

function saveList(listData) {
  const data = getData();
  if (!data.lists) data.lists = [];
  
  const index = data.lists.findIndex(l => l.id === listData.id);
  const timestamp = new Date().toISOString();
  
  if (index !== -1) {
    data.lists[index] = { ...data.lists[index], ...listData, updatedAt: timestamp };
  } else {
    data.lists.push({ ...listData, createdAt: timestamp, updatedAt: timestamp });
  }
  
  saveData(data);
  return listData;
}

function getLists(status) {
  const data = getData();
  if (!data.lists) return [];
  if (!status) return data.lists;
  return data.lists.filter(l => l.status === status);
}

function deleteList(id) {
  const data = getData();
  if (!data.lists) return;
  data.lists = data.lists.filter(l => l.id !== id);
  saveData(data);
}

// Suppliers Logic
function getSuppliers() {
  const data = getData();
  return data.suppliers || [];
}

function addSupplier(name) {
  const data = getData();
  if (!data.suppliers) data.suppliers = [];
  const newSupplier = { id: Date.now(), name };
  data.suppliers.push(newSupplier);
  saveData(data);
  return newSupplier;
}

function deleteSupplier(id) {
  const data = getData();
  if (!data.suppliers) return;
  data.suppliers = data.suppliers.filter(s => s.id !== id);
  saveData(data);
}

module.exports = {
  getStats,
  getData,
  saveData,
  processProductList,
  toggleProductStatus,
  getRootFolder,
  setRootFolder,
  listSubFolders,
  listImageFiles,
  listImagesInFactory,
  listImagesInCountry,
  listFactoriesInCountry,
  listCountries,
  saveList,
  getLists,
  deleteList,
  getSuppliers,
  addSupplier,
  deleteSupplier,
  getCollectionFolder,
  setCollectionFolder,
  getMobileUploadPath,
  setMobileUploadPath
};
