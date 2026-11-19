const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  dbQuery: (sql, params, actor) => ipcRenderer.invoke('db-query', { sql, params, actor }),
  login: (email, password) => ipcRenderer.invoke('auth-login', { email, password }),
  verifyToken: (token) => ipcRenderer.invoke('auth-verify', { token }),
  updateAccount: (details) => ipcRenderer.invoke('auth-update-account', details),
  backupDatabase: () => ipcRenderer.invoke('db-backup'),
  restoreDatabase: () => ipcRenderer.invoke('db-restore'),
  shareWhatsApp: (text, phone) => ipcRenderer.invoke('share-whatsapp', { text, phone }),
  openingTemplate: (cutoverDate, currency, absenceFine) => ipcRenderer.invoke('opening-template', { cutoverDate, currency, absenceFine }),
  openingRead: () => ipcRenderer.invoke('opening-read'),
  openingImport: (payload) => ipcRenderer.invoke('opening-import', payload),
  openingRemove: (actor) => ipcRenderer.invoke('opening-remove', { actor }),
  clearRecords: (actor) => ipcRenderer.invoke('records-clear', { actor }),
});
