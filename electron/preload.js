const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  dbQuery: (sql, params) => ipcRenderer.invoke('db-query', { sql, params }),
  login: (email, password) => ipcRenderer.invoke('auth-login', { email, password }),
  signup: (email, password, fullName) => ipcRenderer.invoke('auth-signup', { email, password, fullName }),
  verifyToken: (token) => ipcRenderer.invoke('auth-verify', { token }),
  changePassword: (userId, currentPassword, newPassword) => ipcRenderer.invoke('auth-change-password', { userId, currentPassword, newPassword }),
  createMember: (email, name, fatherName, phone, address, dob, joinDate) => ipcRenderer.invoke('auth-create-member', { email, name, fatherName, phone, address, dob, joinDate }),
});
