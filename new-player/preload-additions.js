/**
 * preload-additions.js
 * 在你现有的 preload.js 的 contextBridge.exposeInMainWorld 里
 * 追加以下字段（或合并到已有的 electronAPI 对象中）
 *
 * 完整示例：
 *
 *   const { contextBridge, ipcRenderer } = require('electron');
 *
 *   contextBridge.exposeInMainWorld('electronAPI', {
 *     // …你已有的其他方法…
 *
 *     // ── QQ音乐登录 ──────────────────────
 *     qqmusicStart  : ()       => ipcRenderer.invoke('qqmusic:start'),
 *     qqmusicPoll   : ()       => ipcRenderer.invoke('qqmusic:poll'),
 *     qqmusicCancel : ()       => ipcRenderer.invoke('qqmusic:cancel'),
 *
 *     // Cookie 持久化（如已有则保持原样）
 *     saveCookie    : (payload) => ipcRenderer.invoke('save-cookie', payload),
 *   });
 */

// 如果你的 preload.js 已有 contextBridge，直接把上面注释里的三行追加进去即可。
// 下面是独立文件写法，方便 require 后合并：

const { ipcRenderer } = require('electron');

module.exports = {
  qqmusicStart  : ()        => ipcRenderer.invoke('qqmusic:start'),
  qqmusicPoll   : ()        => ipcRenderer.invoke('qqmusic:poll'),
  qqmusicCancel : ()        => ipcRenderer.invoke('qqmusic:cancel'),
  saveCookie    : (payload) => ipcRenderer.invoke('save-cookie', payload),
};
