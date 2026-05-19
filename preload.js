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

  qrNeteaseStart: () => ipcRenderer.invoke('qr-netease-start'),
  qrNeteasePoll: (key) => ipcRenderer.invoke('qr-netease-poll', key),
  qrKugouStart: () => ipcRenderer.invoke('qr-kugou-start'),
  qrKugouPoll: (key) => ipcRenderer.invoke('qr-kugou-poll', key),

  saveCookie: (opts) => ipcRenderer.invoke('save-cookie', opts),
  readCookie: (platform) => ipcRenderer.invoke('read-cookie', platform),

  onApiError: (cb) => { ipcRenderer.on('api-error', (_, msg) => cb(msg)); },
  onSystemThemeChanged: (cb) => { ipcRenderer.on('system-theme-changed', (_, isDark) => cb(isDark)); },
  onPlayerAction: (cb) => { ipcRenderer.on('player-action', (_, action) => cb(action)); },

  getUserDataPath: () => ipcRenderer.invoke('get-user-data-path'),
  openPathInExplorer: (path) => ipcRenderer.invoke('open-path-in-explorer', path),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  songsGetDir: () => ipcRenderer.invoke('songs:get-dir'),
  songsSave: (opts) => ipcRenderer.invoke('songs:save', opts),
  songsList: () => ipcRenderer.invoke('songs:list'),
  songsReadAudio: (audioPath) => ipcRenderer.invoke('songs:read-audio', audioPath),
  songsDelete: (id) => ipcRenderer.invoke('songs:delete', id),
  songsUpdateMeta: (opts) => ipcRenderer.invoke('songs:update-meta', opts),
});

ipcRenderer.on('splash-status', (_, msg) => {
  if (statusCallback) statusCallback(msg);
});
