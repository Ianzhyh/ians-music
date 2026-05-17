/**
 * qqmusic-login-main.js
 * Electron 主进程侧 —— QQ音乐扫码登录完整实现
 * 在 electron-main.js 中 require 此文件并注册 IPC handlers
 *
 * 使用方式：
 *   const { registerQQMusicHandlers } = require('./qqmusic-login-main');
 *   registerQQMusicHandlers(ipcMain);
 */

'use strict';

const https = require('https');
const http  = require('http');
const url   = require('url');

// ─────────────────────────────────────────────
// 工具函数
// ─────────────────────────────────────────────

/**
 * 通用 HTTP/HTTPS 请求（返回 Promise<{ statusCode, headers, body }>）
 * @param {string} reqUrl
 * @param {{ method?, headers?, body?, timeout? }} opts
 */
function request(reqUrl, opts = {}) {
  return new Promise((resolve, reject) => {
    const parsed  = url.parse(reqUrl);
    const isHttps = parsed.protocol === 'https:';
    const lib     = isHttps ? https : http;

    const options = {
      hostname : parsed.hostname,
      port     : parsed.port || (isHttps ? 443 : 80),
      path     : parsed.path,
      method   : opts.method || 'GET',
      headers  : opts.headers || {},
      timeout  : opts.timeout || 10000,
    };

    const req = lib.request(options, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        resolve({
          statusCode : res.statusCode,
          headers    : res.headers,
          body       : Buffer.concat(chunks),
        });
      });
    });

    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout: ' + reqUrl)); });
    req.on('error',   reject);

    if (opts.body) req.write(opts.body);
    req.end();
  });
}

/**
 * 解析响应头 Set-Cookie 数组，返回 Map<name, value>
 * 同名 Cookie 后者覆盖前者（模拟浏览器行为）
 * @param {string[]|string|undefined} setCookieHeader
 * @param {Map<string,string>} existing  已有 Cookie Map（原地修改）
 */
function mergeSetCookie(setCookieHeader, existing = new Map()) {
  if (!setCookieHeader) return existing;
  const list = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
  for (const raw of list) {
    // Set-Cookie: name=value; Path=/; HttpOnly; ...
    const pair = raw.split(';')[0].trim();
    const eqIdx = pair.indexOf('=');
    if (eqIdx === -1) continue;
    const name  = pair.slice(0, eqIdx).trim();
    const value = pair.slice(eqIdx + 1).trim();
    if (name) existing.set(name, value);
  }
  return existing;
}

/** 把 Cookie Map 序列化为 "k=v; k=v" 字符串 */
function cookieMapToStr(map) {
  return [...map.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
}

/**
 * ptHash33 —— 腾讯用于把 qrsig 转换成 ptqrtoken 的哈希算法
 * @param {string} str  qrsig 字符串
 * @returns {number}    ptqrtoken
 */
function ptHash33(str) {
  let e = 0;
  for (let i = 0; i < str.length; i++) {
    e += (e << 5) + str.charCodeAt(i);
  }
  return 2147483647 & e;
}

/**
 * 从响应文本中健壮地解析 ptuiCB(...) 调用参数
 * 腾讯返回格式: ptuiCB('code','','url','','','nickname')
 * @param {string} text
 * @returns {string[]|null}  参数数组（已去引号），null 表示解析失败
 */
function parsePtuiCB(text) {
  const match = text.match(/ptuiCB\s*\(([^)]*)\)/s);
  if (!match) return null;
  try {
    // 用 JSON.parse 安全解析，避免 split(',') 被参数内逗号干扰
    return JSON.parse('[' + match[1] + ']');
  } catch {
    // 降级：简单按逗号分割并去掉首尾引号
    return match[1].split(',').map((s) => s.trim().replace(/^['"]|['"]$/g, ''));
  }
}

// ─────────────────────────────────────────────
// 核心：跟随 302 重定向链，累积 Cookie
// ─────────────────────────────────────────────

/**
 * 跟随 HTTP 重定向链，每跳携带累积的 Cookie，最终返回完整 Cookie Map
 * @param {string}          startUrl   起始 URL
 * @param {Map<string,string>} initCookies  初始 Cookie Map
 * @param {number}          maxHops    最大跳数（默认 12）
 * @returns {Promise<Map<string,string>>}
 */
async function followRedirects(startUrl, initCookies = new Map(), maxHops = 12) {
  let cookieMap = new Map(initCookies);
  let nextUrl   = startUrl;

  for (let hop = 0; hop < maxHops; hop++) {
    const res = await request(nextUrl, {
      headers: {
        Cookie     : cookieMapToStr(cookieMap),
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    // 每跳都合并 Set-Cookie
    mergeSetCookie(res.headers['set-cookie'], cookieMap);

    const redirectCodes = [301, 302, 303, 307, 308];
    if (redirectCodes.includes(res.statusCode) && res.headers.location) {
      // 支持相对路径重定向
      nextUrl = url.resolve(nextUrl, res.headers.location);
      console.log(`[QQMusic] 重定向 hop=${hop + 1} → ${nextUrl}`);
    } else {
      // 非重定向：链路结束
      console.log(`[QQMusic] 重定向链终止，status=${res.statusCode}，共 ${hop + 1} 跳`);
      break;
    }
  }

  // 关键诊断：qm_keyst 必须存在
  if (!cookieMap.has('qm_keyst')) {
    console.warn('[QQMusic] ⚠️  qm_keyst 未获取到，当前 Cookie keys:', [...cookieMap.keys()]);
  } else {
    console.log('[QQMusic] ✅ qm_keyst 已获取');
  }

  return cookieMap;
}

// ─────────────────────────────────────────────
// Step 1：获取二维码
// ─────────────────────────────────────────────

/**
 * 向腾讯服务端请求二维码
 * @returns {Promise<{ qrsig: string, ptqrtoken: number, qrImgBase64: string }>}
 */
async function fetchQRCode() {
  const ts  = Date.now();
  const qrUrl = `https://ssl.ptlogin2.qq.com/ptqrshow?appid=716027609&e=2&l=M&s=3&d=72&v=4&t=${Math.random()}&daid=383&pt_3rd_aid=100497308`;

  const res = await request(qrUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      Referer     : 'https://y.qq.com/',
    },
  });

  // 从 Set-Cookie 提取 qrsig
  const cookieMap = mergeSetCookie(res.headers['set-cookie'], new Map());
  const qrsig     = cookieMap.get('qrsig');
  if (!qrsig) throw new Error('未能从 Set-Cookie 获取 qrsig');

  // 响应 body 就是二维码图片二进制
  if (res.statusCode !== 200) throw new Error(`ptqrshow 返回 ${res.statusCode}`);
  const qrImgBase64 = `data:image/png;base64,${res.body.toString('base64')}`;

  return {
    qrsig,
    ptqrtoken : ptHash33(qrsig),
    qrImgBase64,
  };
}

// ─────────────────────────────────────────────
// Step 2：单次轮询扫码状态
// ─────────────────────────────────────────────

/**
 * ptCode 状态含义
 *  0  登录成功
 * 65  二维码已失效
 * 66  等待扫码
 * 67  已扫码等待手机确认
 */
const PT_CODE = { SUCCESS: '0', EXPIRED: '65', WAITING: '66', SCANNED: '67' };

/**
 * 单次查询扫码状态
 * @param {{ ptqrtoken: number, qrsig: string }} param
 * @returns {Promise<{ ptCode: string, parts: string[]|null, rawBody: string }>}
 */
async function pollOnce({ ptqrtoken, qrsig }) {
  const ts      = Date.now();
  const pollUrl = [
    'https://ssl.ptlogin2.qq.com/ptqrlogin',
    `?ptqrtoken=${ptqrtoken}`,
    `&action=0-0-${ts}`,
    `&js_ver=21010623&js_type=1&login_sig=&pt_uistyle=40`,
    `&u1=https%3A%2F%2Fy.qq.com%2F&ptredirect=1`,
    `&daid=383&pt_3rd_aid=100497308`,
  ].join('');

  const res = await request(pollUrl, {
    headers: {
      Cookie     : `qrsig=${qrsig}`,
      Referer    : 'https://ssl.ptlogin2.qq.com/',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
  });

  const text  = res.body.toString('utf-8');
  const parts = parsePtuiCB(text);
  const ptCode = parts ? String(parts[0]) : null;

  return { ptCode, parts, rawBody: text };
}

// ─────────────────────────────────────────────
// Step 3：登录成功后获取完整 Cookie
// ─────────────────────────────────────────────

/**
 * 从 ptuiCB 参数提取登录后信息，跟随重定向链拿 qm_keyst
 * @param {string[]} parts      parsePtuiCB 返回的参数数组
 * @param {string}   qrsig      用于初始 Cookie
 * @param {string}   rawBody    ptqrlogin 响应原文（含 uin/skey 等）
 * @returns {Promise<{ cookieStr: string, nickname: string }>}
 */
async function extractFullCookie(parts, qrsig, rawBody) {
  // parts[2] = redirectUrl，parts[5] = 昵称
  const redirectUrl = parts[2];
  const nickname    = parts[5] || '';

  if (!redirectUrl) throw new Error('ptuiCB 中未找到 redirectUrl');

  // 从 ptqrlogin 响应体正则提取初始 Cookie 字段
  const pick = (key) => {
    const m = rawBody.match(new RegExp(`[&?;, ]${key}=([^&;, '"]+)`));
    return m ? m[1] : '';
  };

  const initMap = new Map();
  initMap.set('qrsig', qrsig);
  // 腾讯有时会在 ptqrlogin 响应体里内嵌这些字段
  ['uin', 'skey', 'p_skey', 'pt4_token', 'pt_guid_sig', 'ptcz'].forEach((k) => {
    const v = pick(k);
    if (v) initMap.set(k, v);
  });

  // 跟随重定向链（ptlogin → graph.qq.com → y.qq.com）
  const fullCookieMap = await followRedirects(redirectUrl, initMap);

  // 构造最终 Cookie 字符串（QQ音乐播放所需字段）
  const required = ['uin', 'skey', 'p_skey', 'pt4_token', 'qm_keyst'];
  const missing  = required.filter((k) => !fullCookieMap.has(k));
  if (missing.length > 0) {
    console.warn('[QQMusic] 缺少字段:', missing);
  }

  // qqmusic_key 和 qm_keyst 通常相同
  if (fullCookieMap.has('qm_keyst') && !fullCookieMap.has('qqmusic_key')) {
    fullCookieMap.set('qqmusic_key', fullCookieMap.get('qm_keyst'));
  }

  const cookieStr = cookieMapToStr(fullCookieMap);
  return { cookieStr, nickname, cookieMap: fullCookieMap };
}

// ─────────────────────────────────────────────
// 完整登录流程（供外部调用）
// ─────────────────────────────────────────────

/**
 * 登录状态类型：
 *  'qr_ready'  二维码就绪（含 base64 图片）
 *  'waiting'   等待扫码
 *  'scanned'   已扫码等待手机确认
 *  'success'   登录成功（含 cookieStr, nickname）
 *  'expired'   二维码过期，需重新调用
 *  'error'     发生错误（含 message）
 */

/**
 * 注册所有 IPC handlers 到 Electron ipcMain
 * @param {Electron.IpcMain} ipcMain
 */
function registerQQMusicHandlers(ipcMain) {
  // 当前登录会话状态（每次 start-qqmusic-login 重置）
  let session = null;

  /**
   * 渲染进程调用：开始登录，返回二维码
   * Returns: { qrImgBase64: string }
   */
  ipcMain.handle('qqmusic:start', async () => {
    try {
      const qrData = await fetchQRCode();
      session = {
        qrsig     : qrData.qrsig,
        ptqrtoken : qrData.ptqrtoken,
        startedAt : Date.now(),
      };
      console.log('[QQMusic] 二维码已生成，ptqrtoken:', qrData.ptqrtoken);
      return { ok: true, qrImgBase64: qrData.qrImgBase64 };
    } catch (e) {
      console.error('[QQMusic] 获取二维码失败:', e);
      return { ok: false, message: e.message };
    }
  });

  /**
   * 渲染进程调用：轮询一次状态
   * Returns:
   *   { status: 'waiting' | 'scanned' | 'expired' | 'error', message? }
   *   { status: 'success', cookieStr, nickname }
   */
  ipcMain.handle('qqmusic:poll', async () => {
    if (!session) return { status: 'error', message: '请先调用 qqmusic:start' };

    // 二维码有效期约 3 分钟
    if (Date.now() - session.startedAt > 3 * 60 * 1000) {
      session = null;
      return { status: 'expired' };
    }

    try {
      const { ptCode, parts, rawBody } = await pollOnce(session);

      if (ptCode === PT_CODE.SUCCESS) {
        const { cookieStr, nickname } = await extractFullCookie(parts, session.qrsig, rawBody);
        session = null;
        return { status: 'success', cookieStr, nickname };
      }

      if (ptCode === PT_CODE.EXPIRED) {
        session = null;
        return { status: 'expired' };
      }

      if (ptCode === PT_CODE.SCANNED) return { status: 'scanned' };

      // PT_CODE.WAITING 或其他
      return { status: 'waiting' };
    } catch (e) {
      console.error('[QQMusic] 轮询失败:', e);
      return { status: 'error', message: e.message };
    }
  });

  /**
   * 渲染进程调用：取消当前登录会话
   */
  ipcMain.handle('qqmusic:cancel', () => {
    session = null;
    return { ok: true };
  });

  console.log('[QQMusic] IPC handlers 已注册：qqmusic:start / qqmusic:poll / qqmusic:cancel');
}

module.exports = { registerQQMusicHandlers };
