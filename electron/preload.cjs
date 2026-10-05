const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  dbQuery: (sql, params, actor) => ipcRenderer.invoke('db-query', { sql, params, actor }),
  login: (email, password) => ipcRenderer.invoke('auth-login', { email, password }),
  verifyToken: (token) => ipcRenderer.invoke('auth-verify', { token }),
  changePassword: (userId, currentPassword, newPassword) => ipcRenderer.invoke('auth-change-password', { userId, currentPassword, newPassword }),
  updateAccount: (details) => ipcRenderer.invoke('auth-update-account', details),
  backupDatabase: () => ipcRenderer.invoke('db-backup'),
  restoreDatabase: () => ipcRenderer.invoke('db-restore'),
  shareWhatsApp: (text, phone) => ipcRenderer.invoke('share-whatsapp', { text, phone }),
  shareFileWhatsApp: (filename, data, text, phone) => ipcRenderer.invoke('share-file-whatsapp', { filename, data, text, phone }),
  shareFilesWhatsApp: (files, text, phone) => ipcRenderer.invoke('share-files-whatsapp', { files, text, phone }),
  showSharedFile: (file) => ipcRenderer.invoke('show-shared-file', { file }),
  openingTemplate: (cutoverDate, currency, absenceFine) => ipcRenderer.invoke('opening-template', { cutoverDate, currency, absenceFine }),
  openingRead: () => ipcRenderer.invoke('opening-read'),
  openingImport: (payload) => ipcRenderer.invoke('opening-import', payload),
  openingRemove: (actor) => ipcRenderer.invoke('opening-remove', { actor }),
  clearRecords: (actor) => ipcRenderer.invoke('records-clear', { actor }),
});
