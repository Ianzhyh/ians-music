/**
 * qqmusic-login-renderer.js
 * 渲染进程侧 —— 负责 UI 控制和 IPC 通信
 * 替换原来的 qr-login.js 中 QQ音乐相关逻辑
 *
 * 依赖：window.electronAPI（由 preload.js 暴露）
 */

'use strict';

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

const POLL_INTERVAL_MS = 2500; // 轮询间隔（毫秒）

// ─────────────────────────────────────────────
// 状态机
// ─────────────────────────────────────────────

const State = {
  IDLE    : 'idle',
  LOADING : 'loading',   // 正在获取二维码
  WAITING : 'waiting',   // 等待用户扫码
  SCANNED : 'scanned',   // 已扫码等待手机确认
  SUCCESS : 'success',
  EXPIRED : 'expired',
  ERROR   : 'error',
};

// ─────────────────────────────────────────────
// QQMusicLogin 类
// ─────────────────────────────────────────────

class QQMusicLogin {
  /**
   * @param {{
   *   onQRReady:   (base64: string) => void,
   *   onScanned:   () => void,
   *   onSuccess:   (cookieStr: string, nickname: string) => void,
   *   onExpired:   () => void,
   *   onError:     (msg: string) => void,
   * }} callbacks
   */
  constructor(callbacks) {
    this._cb        = callbacks;
    this._state     = State.IDLE;
    this._pollTimer = null;
    this._pollCount = 0;
  }

  /** 开始登录流程 */
  async start() {
    if (this._state === State.LOADING || this._state === State.WAITING) {
      console.warn('[QQMusicLogin] 已在登录中，忽略重复调用');
      return;
    }
    this._setState(State.LOADING);
    this._stopPolling();

    try {
      const result = await window.electronAPI.qqmusicStart();

      if (!result.ok) {
        this._setState(State.ERROR);
        this._cb.onError(result.message || '获取二维码失败');
        return;
      }

      this._cb.onQRReady(result.qrImgBase64);
      this._setState(State.WAITING);
      this._startPolling();
    } catch (e) {
      this._setState(State.ERROR);
      this._cb.onError(e.message);
    }
  }

  /** 取消登录 */
  async cancel() {
    this._stopPolling();
    this._setState(State.IDLE);
    await window.electronAPI.qqmusicCancel().catch(() => {});
  }

  // ── 私有方法 ──────────────────────────────

  _setState(s) {
    this._state = s;
  }

  _startPolling() {
    this._pollCount = 0;
    // 立刻先轮询一次，之后每隔 POLL_INTERVAL_MS 再轮
    this._doPoll();
  }

  _stopPolling() {
    if (this._pollTimer) {
      clearTimeout(this._pollTimer);
      this._pollTimer = null;
    }
  }

  async _doPoll() {
    if (this._state !== State.WAITING && this._state !== State.SCANNED) return;

    this._pollCount++;

    try {
      const result = await window.electronAPI.qqmusicPoll();

      switch (result.status) {
        case 'waiting':
          this._scheduleNext();
          break;

        case 'scanned':
          if (this._state !== State.SCANNED) {
            this._setState(State.SCANNED);
            this._cb.onScanned();
          }
          this._scheduleNext();
          break;

        case 'success':
          this._stopPolling();
          this._setState(State.SUCCESS);
          // 持久化 Cookie
          this._saveCookie(result.cookieStr);
          this._cb.onSuccess(result.cookieStr, result.nickname);
          break;

        case 'expired':
          this._stopPolling();
          this._setState(State.EXPIRED);
          this._cb.onExpired();
          break;

        case 'error':
          // 网络抖动不立即放弃，最多容忍 5 次连续错误
          console.warn('[QQMusicLogin] 轮询出错:', result.message);
          if (this._pollCount > 5) {
            this._stopPolling();
            this._setState(State.ERROR);
            this._cb.onError(result.message);
          } else {
            this._scheduleNext();
          }
          break;
      }
    } catch (e) {
      console.error('[QQMusicLogin] IPC 调用失败:', e);
      this._scheduleNext();
    }
  }

  _scheduleNext() {
    this._pollTimer = setTimeout(() => this._doPoll(), POLL_INTERVAL_MS);
  }

  /** 三层持久化 */
  async _saveCookie(cookieStr) {
    try {
      // 层 1：内存 + localStorage
      if (window.IanMusic) window.IanMusic.qqmusicCookie = cookieStr;
      localStorage.setItem('am_qqmusic_cookie', cookieStr);

      // 层 2：同步 Meting-API
      await fetch('http://localhost:3300/api/cookie', {
        method  : 'POST',
        headers : { 'Content-Type': 'application/json' },
        body    : JSON.stringify({ platform: 'tencent', cookie: cookieStr }),
      }).catch((e) => console.warn('[QQMusicLogin] Meting-API 同步失败（可忽略）:', e));

      // 层 3：Electron 主进程持久化
      await window.electronAPI.saveCookie({ platform: 'tencent', cookie: cookieStr })
                              .catch((e) => console.warn('[QQMusicLogin] Electron 持久化失败:', e));

      console.log('[QQMusicLogin] ✅ Cookie 已三层持久化');
    } catch (e) {
      console.error('[QQMusicLogin] Cookie 持久化出错:', e);
    }
  }
}

// ─────────────────────────────────────────────
// 导出
// ─────────────────────────────────────────────

export default QQMusicLogin;

// ─────────────────────────────────────────────
// 使用示例（在你的登录弹窗组件里）
// ─────────────────────────────────────────────
/*
import QQMusicLogin from './qqmusic-login-renderer.js';

const login = new QQMusicLogin({
  onQRReady(base64) {
    document.getElementById('qr-img').src = base64;
    showStatus('请用手机QQ扫描二维码');
  },
  onScanned() {
    showStatus('扫码成功，请在手机上确认登录');
  },
  onSuccess(cookieStr, nickname) {
    showStatus(`欢迎，${nickname}！`);
    closeLoginModal();
  },
  onExpired() {
    showStatus('二维码已过期');
    showRefreshButton();          // 点击后调用 login.start() 刷新
  },
  onError(msg) {
    showStatus(`登录失败：${msg}`);
  },
});

// 点击"QQ音乐登录"按钮
document.getElementById('btn-qqmusic-login').addEventListener('click', () => {
  login.start();
});

// 点击"取消"按钮
document.getElementById('btn-cancel').addEventListener('click', () => {
  login.cancel();
});
*/
