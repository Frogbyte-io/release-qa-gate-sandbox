const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('orbitApi', {
  readBest: () => ipcRenderer.invoke('score:read'),
  saveBest: (score) => ipcRenderer.invoke('score:save', score),
});
