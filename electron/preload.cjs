const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  dbQuery: (sql, params, actor) => ipcRenderer.invoke('db-query', { sql, params, actor }),
  login: (email, password) => ipcRenderer.invoke('auth-login', { email, password }),
  verifyToken: (token) => ipcRenderer.invoke('auth-verify', { token }),
  changePassword: (userId, currentPassword, newPassword) => ipcRenderer.invoke('auth-change-password', { userId, currentPassword, newPassword }),
  backupDatabase: () => ipcRenderer.invoke('db-backup'),
  restoreDatabase: () => ipcRenderer.invoke('db-restore'),
});
