const { app, BrowserWindow, ipcMain } = require('electron');
const { join } = require('node:path');
const { readBest, saveBest } = require('./score.cjs');

app.setAppUserModelId('io.frogbyte.orbit-orchard');

function createWindow() {
  const window = new BrowserWindow({
    title: 'Orbit Orchard',
    width: 860,
    height: 760,
    minWidth: 620,
    minHeight: 650,
    backgroundColor: '#10142b',
    webPreferences: {
      preload: join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  window.loadFile(join(__dirname, 'index.html'));
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  // Only one process may update the best-score file; IPC writes are synchronous within it.
  ipcMain.handle('score:read', () => readBest(app.getPath('userData')));
  ipcMain.handle('score:save', (_event, score) => saveBest(app.getPath('userData'), score));
  app.on('second-instance', () => {
    const window = BrowserWindow.getAllWindows()[0];
    if (window?.isMinimized()) window.restore();
    window?.focus();
  });
  app.whenReady().then(() => {
    createWindow();
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
  });
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
}
