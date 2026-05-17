const { contextBridge, ipcRenderer } = require('electron');

let statusCallback = null;

ipcRenderer.on('window-state', (_, state) => {
  document.body.setAttribute('data-window-state', state);
});

contextBridge.exposeInMainWorld('appRuntime', {
  platform: process.platform,
  isElectron: true,

  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  fullscreen: () => ipcRenderer.send('window-fullscreen'),
  close: () => ipcRenderer.send('window-close'),

  onStatusUpdate: (cb) => { statusCallback = cb; },

  qrLoginRequest: (opts) => ipcRenderer.invoke('qr-login-request', opts),
  qrLoginGetImage: (url) => ipcRenderer.invoke('qr-login-get-image', url),
  qqmusicBrowserLogin: () => ipcRenderer.invoke('qqmusic-browser-login'),

  qqmusicStart: () => ipcRenderer.invoke('qqmusic:start'),
  qqmusicPoll: () => ipcRenderer.invoke('qqmusic:poll'),
  qqmusicCancel: () => ipcRenderer.invoke('qqmusic:cancel'),

  saveCookie: (opts) => ipcRenderer.invoke('save-cookie', opts),
  readCookie: (platform) => ipcRenderer.invoke('read-cookie', platform),
});

ipcRenderer.on('splash-status', (_, msg) => {
  if (statusCallback) statusCallback(msg);
});
