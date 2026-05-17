const { app, BrowserWindow, Menu, Tray, nativeImage, dialog, ipcMain, net, session } = require('electron');
const path = require('path');
const { fork } = require('child_process');
const http = require('http');
const https = require('https');
const fs = require('fs');

app.commandLine.appendSwitch('js-flags', '--max-old-space-size=384');
app.commandLine.appendSwitch('disable-features', 'MediaRouter,DialMediaRouteProvider,TranslateUI,Translate,PrivateNetworkAccessRespectPreflightResults');
app.commandLine.appendSwitch('disable-background-timer-throttling');

const APP_VERSION = '2.2.0';
const PORT = 3300;

let mainWindow = null;
let splashWindow = null;
let serverProcess = null;
let tray = null;
let isQuitting = false;
let isMaximized = false;

const preloadPath = path.join(__dirname, 'preload.js');
const iconPath = path.join(__dirname, 'img', 'icon.png');

function startAPIServer() {
  return new Promise((resolve) => {
    let serverPath = path.join(__dirname, 'meting-api', 'server.js');
    if (!fs.existsSync(serverPath)) {
      serverPath = path.join(process.resourcesPath, 'meting-api', 'server.js');
    }
    if (!fs.existsSync(serverPath)) {
      console.error('[API] server.js not found');
      resolve(false);
      return;
    }

    let output = '';
    serverProcess = fork(serverPath, [], {
      env: { ...process.env, PORT: String(PORT), ELECTRON_RUN_AS_NODE: '1', USER_DATA_PATH: app.getPath('userData'), APP_STATIC_ROOT: __dirname },
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      silent: true
    });

    serverProcess.stdout.on('data', (d) => { output += d.toString(); });
    serverProcess.stderr.on('data', (d) => { output += d.toString(); });

    serverProcess.on('error', (err) => {
      console.error('[API] fork error:', err.message);
      resolve(false);
    });

    serverProcess.on('exit', (code) => {
      if (code !== 0 && !isQuitting) {
        console.error('[API] exited with code', code);
        console.error('[API] output:', output.slice(-500));
      }
    });

    const check = (retries = 30) => {
      const req = http.get(`http://127.0.0.1:${PORT}/health`, (res) => {
        if (res.statusCode === 200) { resolve(true); return; }
        if (retries > 0) setTimeout(() => check(retries - 1), 400);
        else resolve(false);
      });
      req.on('error', () => {
        if (retries > 0) setTimeout(() => check(retries - 1), 400);
        else resolve(false);
      });
      req.setTimeout(1500, () => {
        req.destroy();
        if (retries > 0) setTimeout(() => check(retries - 1), 400);
        else resolve(false);
      });
    };
    setTimeout(() => check(), 800);
  });
}

function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 400,
    height: 340,
    frame: false,
    transparent: false,
    backgroundColor: '#0a0a0a',
    resizable: false,
    center: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      devTools: false,
      backgroundThrottling: false,
      spellcheck: false
    }
  });

  splashWindow.setAlwaysOnTop(true, 'screen-saver');

  const splashHTML = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0a0a0a;display:flex;align-items:center;justify-content:center;height:100vh;font-family:'Segoe UI',system-ui,sans-serif;-webkit-app-region:drag}
.splash{text-align:center}
.logo{width:72px;height:72px;border-radius:50%;background:linear-gradient(135deg,#fa2d48,#e0283c);margin:0 auto 24px;display:flex;align-items:center;justify-content:center;animation:pulse 2s ease-in-out infinite;box-shadow:0 0 48px rgba(250,45,72,0.3)}
.logo span{font-size:36px;font-weight:800;color:#fff;letter-spacing:-1px}
.title{font-size:22px;font-weight:700;color:#fff;letter-spacing:-0.3px;margin-bottom:6px}
.subtitle{font-size:11px;color:rgba(255,255,255,0.35);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:32px}
.loader{display:flex;gap:4px;justify-content:center}
.loader .dot{width:6px;height:6px;border-radius:50%;background:#fa2d48;animation:bounce 1.2s ease-in-out infinite}
.loader .dot:nth-child(2){animation-delay:0.15s}
.loader .dot:nth-child(3){animation-delay:0.3s}
.status{font-size:10px;color:rgba(255,255,255,0.25);margin-top:20px}
@keyframes pulse{0%,100%{transform:scale(1);box-shadow:0 0 48px rgba(250,45,72,0.3)}50%{transform:scale(1.05);box-shadow:0 0 64px rgba(250,45,72,0.5)}}
@keyframes bounce{0%,80%,100%{transform:translateY(0);opacity:0.3}40%{transform:translateY(-8px);opacity:1}}
</style></head><body>
<div class="splash">
  <div class="logo"><span>I</span></div>
  <div class="title">IAN'S MUSIC</div>
  <div class="subtitle">Starting up</div>
  <div class="loader"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>
  <div class="status" id="status">Waking the music engine...</div>
</div>
<script>
window.appRuntime.onStatusUpdate((msg) => {
  document.getElementById('status').textContent = msg;
});
</script>
</body></html>`;

  splashWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(splashHTML));
  splashWindow.show();
}

function createTrayIcon() {
  const trayIconPath = path.join(__dirname, 'img', 'tray-icon.png');
  if (!fs.existsSync(trayIconPath)) return;
  const icon = nativeImage.createFromPath(trayIconPath).resize({ width: 16, height: 16 });
  tray = new Tray(icon);
  tray.setToolTip("IAN'S MUSIC");

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show Window', click: () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } } },
    { type: 'separator' },
    { label: 'Previous', click: () => { if (mainWindow) mainWindow.webContents.executeJavaScript('if(typeof prev==="function")prev()'); } },
    { label: 'Play / Pause', click: () => { if (mainWindow) mainWindow.webContents.executeJavaScript('if(typeof togglePlay==="function")togglePlay()'); } },
    { label: 'Next', click: () => { if (mainWindow) mainWindow.webContents.executeJavaScript('if(typeof next==="function")next()'); } },
    { type: 'separator' },
    { label: 'Quit', click: () => { isQuitting = true; app.quit(); } }
  ]);

  tray.setContextMenu(contextMenu);
  tray.on('double-click', () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } });
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 520,
    title: "IAN'S MUSIC",
    backgroundColor: '#0a0a0a',
    show: false,
    center: true,
    frame: false,
    thickFrame: true,
    icon: iconPath,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      devTools: false,
      backgroundThrottling: false,
      spellcheck: false,
      webSecurity: true
    }
  });

  Menu.setApplicationMenu(null);

  mainWindow.loadFile('index.html');

  mainWindow.once('ready-to-show', () => {
    if (splashWindow) {
      splashWindow.close();
      splashWindow = null;
    }
    mainWindow.show();
    mainWindow.focus();
  });

  mainWindow.on('maximize', () => { isMaximized = true; mainWindow.webContents.send('window-state', 'maximized'); });
  mainWindow.on('unmaximize', () => { isMaximized = false; mainWindow.webContents.send('window-state', 'normal'); });
  mainWindow.on('enter-full-screen', () => { mainWindow.webContents.send('window-state', 'fullscreen'); });
  mainWindow.on('leave-full-screen', () => { mainWindow.webContents.send('window-state', isMaximized ? 'maximized' : 'normal'); });

  mainWindow.on('close', (e) => {
    if (!isQuitting && tray) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => { mainWindow = null; });

  mainWindow.webContents.on('before-input-event', (_, input) => {
    if (input.control && input.key === 'r') input.preventDefault();
    if (input.control && input.key === 'f5') input.preventDefault();
    if (input.control && input.shift && input.key === 'I') input.preventDefault();
    if (input.key === 'Escape' && mainWindow.isFullScreen()) {
      mainWindow.setFullScreen(false);
    }
  });
}

ipcMain.on('window-minimize', () => { if (mainWindow) mainWindow.minimize(); });
ipcMain.on('window-maximize', () => {
  if (!mainWindow) return;
  if (isMaximized) mainWindow.unmaximize();
  else mainWindow.maximize();
});
ipcMain.on('window-fullscreen', () => {
  if (!mainWindow) return;
  const goingFS = !mainWindow.isFullScreen();
  mainWindow.setFullScreen(goingFS);
});
ipcMain.on('window-close', () => { if (mainWindow) mainWindow.close(); });

function _fetchJSON(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const mod = parsedUrl.protocol === 'https:' ? https : http;
    const reqOpts = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method || 'GET',
      headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', ...options.headers },
    };
    const req = mod.request(reqOpts, (res) => {
      let body = '';
      const cookies = res.headers['set-cookie'] || [];
      res.on('data', (d) => { body += d; });
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          resolve({ status: res.statusCode, data: json, cookies, rawHeaders: res.headers });
        } catch (_) {
          resolve({ status: res.statusCode, data: body, cookies, rawHeaders: res.headers });
        }
      });
    });
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

function _isUrlAllowed(url) {
  const ALLOWED_DOMAINS = [
    'ssl.ptlogin2.qq.com',
    'xui.ptlogin2.qq.com',
    'graph.qq.com',
    'open.weixin.qq.com',
    'music.163.com',
    'login.kuwo.cn',
    'logintwo.kugou.com',
    'mobileauth.kugou.com'
  ];

  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname;

    const isAllowed = ALLOWED_DOMAINS.some(domain => hostname === domain || hostname.endsWith('.' + domain));
    if (!isAllowed) return false;

    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0') return false;
    if (hostname.startsWith('10.')) return false;
    if (hostname.startsWith('192.168.')) return false;
    if (hostname.startsWith('169.254.')) return false;
    if (hostname.startsWith('172.')) {
      const second = parseInt(hostname.split('.')[1], 10);
      if (second >= 16 && second <= 31) return false;
    }

    return true;
  } catch (_) {
    return false;
  }
}

ipcMain.handle('qr-login-request', async (_, { url, method, headers, body }) => {
  if (!_isUrlAllowed(url)) {
    return { error: 'URL blocked by security policy' };
  }
  try {
    const result = await _fetchJSON(url, { method: method || 'GET', headers: headers || {}, body });
    return { success: true, ...result };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('save-cookie', async (_, { platform, cookie }) => {
  try {
    const cookieDir = app.getPath('userData');
    const cookiePath = path.join(cookieDir, 'cookies.json');
    let cookies = {};
    if (fs.existsSync(cookiePath)) {
      try { cookies = JSON.parse(fs.readFileSync(cookiePath, 'utf-8')); } catch (_) {}
    }
    cookies[platform] = cookie;
    fs.writeFileSync(cookiePath, JSON.stringify(cookies, null, 2));
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('read-cookie', async (_, platform) => {
  try {
    const cookiePath = path.join(app.getPath('userData'), 'cookies.json');
    if (!fs.existsSync(cookiePath)) return { success: true, cookie: '' };
    const cookies = JSON.parse(fs.readFileSync(cookiePath, 'utf-8'));
    return { success: true, cookie: cookies[platform] || '' };
  } catch (e) {
    return { success: false, error: e.message, cookie: '' };
  }
});

ipcMain.handle('qr-login-get-image', async (_, url) => {
  if (!_isUrlAllowed(url)) {
    return { error: 'URL blocked by security policy' };
  }
  return new Promise((resolve) => {
    const parsedUrl = new URL(url);
    const mod = parsedUrl.protocol === 'https:' ? https : http;
    mod.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      const chunks = [];
      res.on('data', (d) => chunks.push(d));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        const base64 = buf.toString('base64');
        const ct = res.headers['content-type'] || 'image/png';
        resolve({ success: true, base64: `data:${ct};base64,${base64}` });
      });
    }).on('error', (e) => resolve({ success: false, error: e.message }));
  });
});

ipcMain.handle('qqmusic-browser-login', async () => {
  return new Promise((resolve) => {
    const loginUrl = 'https://xui.ptlogin2.qq.com/cgi-bin/xlogin?proxy_url=https%3A%2F%2Fqzs.qq.com%2Fqzone%2Fv6%2Fportal%2Fproxy.html&daid=383&hide_title_bar=1&low_login=0&qlogin_auto_login=1&no_verifyimg=1&link_target=blank&appid=716027609&style=22&target=self&s_url=https%3A%2F%2Fy.qq.com%2F&pt_qr_app=%E6%89%8B%E6%9C%BAQQ&pt_qr_link=https%3A%2F%2Fz.qzone.com%2Fdownload.html&self_regurl=https%3A%2F%2Fqzs.qq.com%2Fqzone%2Fv6%2Freg%2Findex.html&pt_qr_help_link=https%3A%2F%2Fz.qzone.com%2Fdownload.html&pt_no_auth=0&pt_3rd_aid=100497308';

    const loginSes = session.fromPartition('qqmusic-login');
    const loginWin = new BrowserWindow({
      width: 480,
      height: 600,
      title: "QQ Music - Login",
      backgroundColor: '#1a1a2e',
      autoHideMenuBar: true,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        session: loginSes,
      }
    });

    let resolved = false;
    const done = (result) => {
      if (resolved) return;
      resolved = true;
      try { loginWin.close(); } catch (_) {}
      resolve(result);
    };

    const extractCookies = async () => {
      if (resolved) return;
      try {
        const cookies = await loginSes.cookies.get({ domain: '.y.qq.com' });
        const qqCookies = await loginSes.cookies.get({ domain: '.qq.com' });
        const allCookies = [...cookies, ...qqCookies];

        const cookieMap = {};
        for (const c of allCookies) {
          cookieMap[c.name] = c.value;
        }

        const uin = cookieMap.uin || cookieMap.wxuin || '';
        const cleanUin = uin.replace(/\D/g, '');
        const pSkey = cookieMap.p_skey || '';
        const skey = cookieMap.skey || '';
        const pt4Token = cookieMap.pt4_token || '';
        const qmKeyst = cookieMap.qm_keyst || '';
        const qqmusicKey = cookieMap.qqmusic_key || pSkey;

        if (cleanUin && (pSkey || qmKeyst || qqmusicKey)) {
          const parts = [];
          parts.push(`uin=${cleanUin}`);
          if (skey) parts.push(`skey=${skey}`);
          if (pSkey) parts.push(`p_skey=${pSkey}`);
          if (pt4Token) parts.push(`pt4_token=${pt4Token}`);
          if (qqmusicKey) parts.push(`qqmusic_key=${qqmusicKey}`);
          if (qmKeyst) parts.push(`qm_keyst=${qmKeyst}`);

          const cookieStr = parts.join('; ');
          console.log('[QQMusic/BrowserLogin] Cookie extracted, uin:', cleanUin);
          done({ success: true, cookie: cookieStr });
        }
      } catch (e) {
        console.warn('[QQMusic/BrowserLogin] Cookie extraction error:', e.message);
      }
    };

    loginWin.webContents.on('did-navigate', async (event, url) => {
      if (resolved) return;
      if (url.includes('y.qq.com') && !url.includes('ptlogin2')) {
        await new Promise(r => setTimeout(r, 1500));
        await extractCookies();
      }
    });

    loginWin.webContents.on('did-navigate-in-page', async (event, url) => {
      if (resolved) return;
      if (url.includes('y.qq.com') && !url.includes('ptlogin2')) {
        await new Promise(r => setTimeout(r, 1500));
        await extractCookies();
      }
    });

    loginWin.on('closed', () => {
      if (!resolved) done({ success: false, error: 'Window closed by user' });
    });

    loginWin.loadURL(loginUrl);
  });
});

function sendSplashStatus(msg) {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.webContents.executeJavaScript(`
      var el = document.getElementById('status');
      if (el) el.textContent = '${msg.replace(/'/g, "\\'")}';
    `);
  }
}

// ====================================================================
// QQ音乐扫码登录（主进程 Node.js — 无 CORS 限制，完整 Set-Cookie 可读）
// ====================================================================

function _qqRequest(reqUrl, opts = {}) {
  return new Promise((resolve, reject) => {
    const parsed = require('url').parse(reqUrl);
    const lib = parsed.protocol === 'https:' ? https : http;
    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.path,
      method: opts.method || 'GET',
      headers: opts.headers || {},
      timeout: opts.timeout || 10000,
    };
    const req = lib.request(options, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout: ' + reqUrl)); });
    req.on('error', reject);
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

function _qqMergeSetCookie(setCookieHeader, existing) {
  const map = existing || new Map();
  if (!setCookieHeader) return map;
  const list = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
  for (const raw of list) {
    const pair = raw.split(';')[0].trim();
    const eqIdx = pair.indexOf('=');
    if (eqIdx === -1) continue;
    const name = pair.slice(0, eqIdx).trim();
    const value = pair.slice(eqIdx + 1).trim();
    if (name) map.set(name, value);
  }
  return map;
}

function _qqCookieMapToStr(map) {
  return [...map.entries()].map(([k, v]) => k + '=' + v).join('; ');
}

function _qqPtHash33(str) {
  var e = 0;
  for (var i = 0; i < str.length; i++) { e += (e << 5) + str.charCodeAt(i); }
  return 2147483647 & e;
}

function _qqParsePtuiCB(text) {
  var match = text.match(/ptuiCB\s*\(([^)]*)\)/);
  if (!match) return null;
  try {
    return JSON.parse('[' + match[1] + ']');
  } catch (e) {
    return match[1].split(',').map(function(s) { return s.trim().replace(/^['"]|['"]$/g, ''); });
  }
}

async function _qqFollowRedirects(startUrl, initCookies, maxHops) {
  maxHops = maxHops || 12;
  var cookieMap = new Map(initCookies || []);
  var nextUrl = startUrl;
  for (var hop = 0; hop < maxHops; hop++) {
    var res = await _qqRequest(nextUrl, {
      headers: { Cookie: _qqCookieMapToStr(cookieMap), 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    _qqMergeSetCookie(res.headers['set-cookie'], cookieMap);
    if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
      nextUrl = require('url').resolve(nextUrl, res.headers.location);
      console.log('[QQMusic] redirect hop=' + (hop + 1) + ' -> ' + nextUrl);
    } else {
      console.log('[QQMusic] redirect chain ended, status=' + res.statusCode + ', hops=' + (hop + 1));
      break;
    }
  }
  if (!cookieMap.has('qm_keyst')) {
    console.warn('[QQMusic] WARNING: qm_keyst not found, cookie keys:', [...cookieMap.keys()]);
  } else {
    console.log('[QQMusic] qm_keyst obtained');
  }
  return cookieMap;
}

async function _qqFetchQRCode() {
  var ts = Date.now();
  var qrUrl = 'https://ssl.ptlogin2.qq.com/ptqrshow?appid=716027609&e=2&l=M&s=3&d=72&v=4&t=' + Math.random() + '&daid=383&pt_3rd_aid=100497308';
  var res = await _qqRequest(qrUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', Referer: 'https://y.qq.com/' }
  });
  var cookieMap = _qqMergeSetCookie(res.headers['set-cookie'], new Map());
  var qrsig = cookieMap.get('qrsig');
  if (!qrsig) throw new Error('Failed to get qrsig from Set-Cookie');
  if (res.statusCode !== 200) throw new Error('ptqrshow returned ' + res.statusCode);
  var qrImgBase64 = 'data:image/png;base64,' + res.body.toString('base64');
  return { qrsig: qrsig, ptqrtoken: _qqPtHash33(qrsig), qrImgBase64: qrImgBase64 };
}

async function _qqPollOnce(session) {
  var ts = Date.now();
  var pollUrl = 'https://ssl.ptlogin2.qq.com/ptqrlogin?ptqrtoken=' + session.ptqrtoken + '&action=0-0-' + ts + '&js_ver=21010623&js_type=1&login_sig=&pt_uistyle=40&u1=https%3A%2F%2Fy.qq.com%2F&ptredirect=1&daid=383&pt_3rd_aid=100497308';
  var res = await _qqRequest(pollUrl, {
    headers: { Cookie: 'qrsig=' + session.qrsig, Referer: 'https://ssl.ptlogin2.qq.com/', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
  });
  var text = res.body.toString('utf-8');
  var parts = _qqParsePtuiCB(text);
  var ptCode = parts ? String(parts[0]) : null;
  return { ptCode: ptCode, parts: parts, rawBody: text };
}

async function _qqExtractFullCookie(parts, qrsig, rawBody) {
  var redirectUrl = parts[2];
  var nickname = parts[5] || '';
  if (!redirectUrl) throw new Error('redirectUrl not found in ptuiCB');
  function pick(key) {
    var m = rawBody.match(new RegExp('[&?;, ]' + key + '=([^&;, \'"]+)'));
    return m ? m[1] : '';
  }
  var initMap = new Map();
  initMap.set('qrsig', qrsig);
  ['uin', 'skey', 'p_skey', 'pt4_token', 'pt_guid_sig', 'ptcz'].forEach(function(k) {
    var v = pick(k);
    if (v) initMap.set(k, v);
  });
  var fullCookieMap = await _qqFollowRedirects(redirectUrl, initMap);
  var required = ['uin', 'skey', 'p_skey', 'pt4_token', 'qm_keyst'];
  var missing = required.filter(function(k) { return !fullCookieMap.has(k); });
  if (missing.length > 0) console.warn('[QQMusic] missing fields:', missing);
  if (fullCookieMap.has('qm_keyst') && !fullCookieMap.has('qqmusic_key')) {
    fullCookieMap.set('qqmusic_key', fullCookieMap.get('qm_keyst'));
  }
  var cookieStr = _qqCookieMapToStr(fullCookieMap);
  return { cookieStr: cookieStr, nickname: nickname, cookieMap: fullCookieMap };
}

var _qqSession = null;

function registerQQMusicHandlers() {
  ipcMain.handle('qqmusic:start', async function() {
    try {
      var qrData = await _qqFetchQRCode();
      _qqSession = { qrsig: qrData.qrsig, ptqrtoken: qrData.ptqrtoken, startedAt: Date.now() };
      console.log('[QQMusic] QR generated, ptqrtoken:', qrData.ptqrtoken);
      return { ok: true, qrImgBase64: qrData.qrImgBase64 };
    } catch (e) {
      console.error('[QQMusic] QR generation failed:', e);
      return { ok: false, message: e.message };
    }
  });
  ipcMain.handle('qqmusic:poll', async function() {
    if (!_qqSession) return { status: 'error', message: 'Session not started' };
    if (Date.now() - _qqSession.startedAt > 3 * 60 * 1000) { _qqSession = null; return { status: 'expired' }; }
    try {
      var result = await _qqPollOnce(_qqSession);
      var ptCode = result.ptCode;
      if (ptCode === '0') {
        var data = await _qqExtractFullCookie(result.parts, _qqSession.qrsig, result.rawBody);
        _qqSession = null;
        return { status: 'success', cookieStr: data.cookieStr, nickname: data.nickname };
      }
      if (ptCode === '65') { _qqSession = null; return { status: 'expired' }; }
      if (ptCode === '67') return { status: 'scanned' };
      return { status: 'waiting' };
    } catch (e) {
      console.error('[QQMusic] poll failed:', e);
      return { status: 'error', message: e.message };
    }
  });
  ipcMain.handle('qqmusic:cancel', function() { _qqSession = null; return { ok: true }; });
  console.log('[QQMusic] IPC handlers registered: qqmusic:start / qqmusic:poll / qqmusic:cancel');
}

app.whenReady().then(async () => {
  const ses = session.defaultSession;
  let lastVersion = null;
  try {
    const v = fs.readFileSync(path.join(app.getPath('userData'), '.app_version'), 'utf8').trim();
    if (v) lastVersion = v;
  } catch (_) {}

  if (lastVersion !== APP_VERSION) {
    console.log(`[Cache] version ${lastVersion || '(new)'} -> ${APP_VERSION}, clearing cache...`);
    try {
      await ses.clearCache();
      await ses.clearStorageData({
        storages: ['cache', 'serviceworkers'],
        origins: []
      });
      fs.writeFileSync(path.join(app.getPath('userData'), '.app_version'), APP_VERSION);
      console.log('[Cache] done');
    } catch (e) {
      console.warn('[Cache] failed:', e.message);
    }
  }

  registerQQMusicHandlers();

  createSplashWindow();
  sendSplashStatus('Starting music API server...');

  const serverReady = await startAPIServer();

  if (!serverReady) {
    if (splashWindow) splashWindow.close();
    dialog.showErrorBox('Startup Failed', 'Unable to start the music API server.\n\nPlease make sure meting-api dependencies are installed:\ncd meting-api && npm install');
    app.quit();
    return;
  }

  sendSplashStatus('Music engine ready. Loading app...');
  setTimeout(() => createMainWindow(), 300);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
    else if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  isQuitting = true;
  if (tray) { tray.destroy(); tray = null; }
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
});
