window.IanMusic = window.IanMusic || {};

const LOGIN_ERRORS = {
    qr_expired:       { code: 'qr_expired',       message: '[!] 二维码已失效',         suggestion: '正在自动刷新...' },
    qr_timeout:       { code: 'qr_timeout',       message: '[!] 登录超时（180s）',     suggestion: '请点击刷新重试' },
    scan_cancelled:   { code: 'scan_cancelled',   message: '[!] 扫码已取消',           suggestion: '请在手机上重新扫码' },
    scan_timeout:     { code: 'scan_timeout',     message: '[!] 手机确认超时',         suggestion: '请重新扫码' },
    auth_rejected:    { code: 'auth_rejected',    message: '[!] 授权被拒绝',           suggestion: '请重新扫码' },
    network_error:    { code: 'network_error',    message: '[!] 网络连接失败',         suggestion: '请检查网络后重试' },
    api_unavailable:  { code: 'api_unavailable',  message: '[!] 本地 API 未启动',      suggestion: '请在应用端打开或启动本地 Meting 服务' },
    invalid_response: { code: 'invalid_response', message: '[!] 服务器返回异常',       suggestion: '请稍后重试' },
    rate_limited:     { code: 'rate_limited',     message: '[!] 请求过于频繁',         suggestion: '等待后自动重试...' },
    session_conflict: { code: 'session_conflict', message: '[!] 检测到并发登录冲突',   suggestion: '请重新扫码' },
    cookie_save_failed:{ code: 'cookie_save_failed', message: '[!] Cookie 保存失败',   suggestion: '请检查存储空间' },
    unknown:          { code: 'unknown',           message: '[?] {msg}',               suggestion: '请稍后重试' }
};

function formatError(key, extraMsg) {
    const e = LOGIN_ERRORS[key] || LOGIN_ERRORS['unknown'];
    const msg = e.message.replace('{msg}', extraMsg || '');
    return msg + ' — ' + e.suggestion;
}

const QRLogin = {
    _pollTimers: {},
    _refreshTimers: {},
    _countdownTimers: {},
    _localApiBase: '',
    _state: {},
    _loginLock: {},

    MAX_REFRESH: 5,
    QR_TIMEOUT: 180,

    get localApiBase() {
        if (this._localApiBase) return this._localApiBase;
        const saved = localStorage.getItem('am_local_meting_api');
        if (saved) { this._localApiBase = saved.replace(/\/+$/, ''); return this._localApiBase; }
        this._localApiBase = 'http://127.0.0.1:3300';
        return this._localApiBase;
    },

    async _fetch(path) {
        const url = `${this.localApiBase}${path}`;
        try {
            const res = await fetch(url, { method: 'GET' });
            const json = await res.json();
            if (res.ok || json.success) return json;
            throw new Error(json.message || 'API错误(' + res.status + ')');
        } catch (e) {
            if (window.appRuntime && window.appRuntime.qrLoginRequest) {
                try {
                    const ipcRes = await window.appRuntime.qrLoginRequest({ url });
                    if (ipcRes.success && ipcRes.data) return ipcRes.data;
                } catch (e2) {}
            }
            throw new Error('无法连接到本地API: ' + e.message);
        }
    },

    ptHash33(str) {
        return window.IanMusicUtils.ptHash33(str);
    },

    _isNetworkError(e) {
        const m = (e.message || '').toLowerCase();
        return m.includes('failed to fetch') || m.includes('networkerror') || m.includes('typeerror');
    },

    _renderQR(matrix, size) {
        if (!matrix || !size) return '';
        try {
            const canvas = document.createElement('canvas');
            const margin = 2;
            const total = size + margin * 2;
            const canvasSize = 200;
            const scale = Math.floor(canvasSize / total);
            const actualSize = scale * total;
            canvas.width = actualSize;
            canvas.height = actualSize;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, actualSize, actualSize);
            ctx.fillStyle = '#000000';
            const stride = Math.ceil(size / 32);
            for (let r = 0; r < size; r++) {
                const base = r * stride;
                for (let c = 0; c < size; c++) {
                    const word = matrix[base + Math.floor(c / 32)] || 0;
                    if (word & (1 << (c % 32))) {
                        ctx.fillRect((c + margin) * scale, (r + margin) * scale, scale, scale);
                    }
                }
            }
            return canvas.toDataURL('image/png');
        } catch (e) {
            console.warn('[QRLogin] Canvas:', e.message);
            return '';
        }
    },

    _showQR(onQRReady, data) {
        const qrimg = this._renderQR(data.qrmatrix, data.qrsize);
        if (!qrimg) throw new Error('QR渲染失败');
        onQRReady(qrimg);
    },

    _startCountdown(platform) {
        this._stopCountdown(platform);
        const s = this._state[platform];
        if (!s) return;
        s.countdownRemaining = this.QR_TIMEOUT;

        const bar = document.getElementById('qr-countdown-bar');
        const text = document.getElementById('qr-countdown-text');
        if (bar) bar.style.width = '100%';
        if (text) text.textContent = this.QR_TIMEOUT + 's';

        this._countdownTimers[platform] = setInterval(() => {
            const st = this._state[platform];
            if (!st) { this._stopCountdown(platform); return; }
            st.countdownRemaining--;
            const remaining = st.countdownRemaining;
            const pct = Math.max(0, (remaining / this.QR_TIMEOUT) * 100);

            if (bar) {
                bar.style.width = pct + '%';
                if (remaining <= 30) bar.classList.add('qr-countdown-warn');
                else bar.classList.remove('qr-countdown-warn');
            }
            if (text) text.textContent = remaining + 's';

            if (remaining <= 0) {
                this._stopCountdown(platform);
                const st2 = this._state[platform];
                if (st2) {
                    if (typeof st2._onTimeout === 'function') st2._onTimeout();
                }
            }
        }, 1000);
    },

    _stopCountdown(platform) {
        if (this._countdownTimers[platform]) {
            clearInterval(this._countdownTimers[platform]);
            delete this._countdownTimers[platform];
        }
        const bar = document.getElementById('qr-countdown-bar');
        const text = document.getElementById('qr-countdown-text');
        if (bar) { bar.style.width = '0%'; bar.classList.remove('qr-countdown-warn'); }
        if (text) text.textContent = '';
    },

    _acquireLock(platform) {
        if (this._loginLock[platform]) return false;
        this._loginLock[platform] = true;
        return true;
    },

    _releaseLock(platform) {
        delete this._loginLock[platform];
    },

    stopPolling(platform) {
        if (this._pollTimers[platform]) {
            clearInterval(this._pollTimers[platform]);
            clearTimeout(this._pollTimers[platform]);
            delete this._pollTimers[platform];
        }
        if (this._refreshTimers[platform]) {
            clearTimeout(this._refreshTimers[platform]);
            delete this._refreshTimers[platform];
        }
        this._stopCountdown(platform);
        delete this._state[platform];
        this._releaseLock(platform);
    },

    stopAllPolling() {
        Object.keys(this._pollTimers).forEach(k => this.stopPolling(k));
    },

    _autoRefresh(platform, startFn) {
        this._refreshTimers[platform] = setTimeout(() => startFn(), 1200);
    },

    _checkTimeout(platform, onError, onFallback) {
        const s = this._state[platform];
        if (!s) return false;
        if (Date.now() - s.startTime > this.QR_TIMEOUT * 1000) {
            this.stopPolling(platform);
            const err = LOGIN_ERRORS['qr_timeout'];
            onError(err.message + ' — ' + err.suggestion);
            if (onFallback) onFallback();
            return true;
        }
        return false;
    },

    _handleExpired(platform, startFn, onStatus, onError, onFallback) {
        const s = this._state[platform];
        if (!s) return;
        if (s.refreshCount >= this.MAX_REFRESH) {
            this.stopPolling(platform);
            const err = LOGIN_ERRORS['qr_expired'];
            onError('[!] 二维码已多次失效（' + this.MAX_REFRESH + '次），请在应用端打开网页登录');
            if (onFallback) onFallback();
            return;
        }
        s.refreshCount++;
        const err = LOGIN_ERRORS['qr_expired'];
        onStatus(err.message + '，正在自动刷新 (' + s.refreshCount + '/' + this.MAX_REFRESH + ')...');
        this._autoRefresh(platform, startFn);
    },

    _handleNetworkError(platform, pollFn, onStatus, onError) {
        const s = this._state[platform];
        if (!s) return;
        s.networkErrors = (s.networkErrors || 0) + 1;
        if (s.networkErrors >= 3) {
            this.stopPolling(platform);
            const err = LOGIN_ERRORS['network_error'];
            onError(err.message + ' — ' + err.suggestion);
            return;
        }
        clearInterval(this._pollTimers[platform]);
        clearTimeout(this._pollTimers[platform]);
        const err = LOGIN_ERRORS['network_error'];
        onStatus(err.message + '，正在重试 (' + s.networkErrors + '/3)...');
        this._pollTimers[platform] = setTimeout(() => pollFn(), 10000);
    },

    _saveCookie(platform, cookie) {
        if (!cookie) return false;
        try {
            const fnMap = { 'netease': 'saveNeteaseCookie', 'qqmusic': 'saveQqmusicCookie', 'kugou': 'saveKugouCookie' };
            const fnName = fnMap[platform];
            if (fnName && typeof window[fnName] === 'function') {
                window[fnName](cookie);
            }
            return true;
        } catch (e) {
            console.warn('[QRLogin] Cookie save failed:', e.message);
            return false;
        }
    },

    // ===== 网易云 =====
    async startNeteaseLogin(onQRReady, onStatus, onSuccess, onError, onFallback) {
        if (!this._acquireLock('netease')) { onStatus('[*] 登录已在进行中'); return; }
        this.stopPolling('netease');
        this._state['netease'] = { step: 'init', startTime: Date.now(), refreshCount: 0, networkErrors: 0 };

        const hasBrowserLogin = !!(window.appRuntime && window.appRuntime.qqmusicBrowserLogin);
        const fb = hasBrowserLogin ? onFallback : null;

        if (window.appRuntime && window.appRuntime.qrNeteaseStart) {
            var self = this;
            onStatus('正在连接网易云...');
            try {
                var startResult = await window.appRuntime.qrNeteaseStart();
                if (!startResult.success || !startResult.data?.unikey) {
                    onError(formatError('api_unavailable'));
                    self._releaseLock('netease');
                    return;
                }
                var key = startResult.data.unikey;
                self._showQR(onQRReady, startResult.data);
                onStatus('[*] 请打开"网易云音乐"APP -> 扫一扫');
                self._state['netease'].step = 'waiting';
                self._startCountdown('netease');
                self._state['netease']._onTimeout = function() {
                    if (!self._state['netease']) return;
                    self._checkTimeout('netease', onError, fb);
                };

                var doPoll = function() {
                    if (!self._state['netease'] || self._state['netease'].step === 'done') return;
                    if (self._checkTimeout('netease', onError, fb)) return;

                    window.appRuntime.qrNeteasePoll(key).then(function(result) {
                        if (!self._state['netease'] || self._state['netease'].step === 'done') return;
                        if (!result.success) { console.warn('[QRLogin] Netease IPC poll !success:', result); self._pollTimers['netease'] = setTimeout(doPoll, 3000); return; }
                        var c = result.data;
                        var s = self._state['netease'];
                        if (!s) return;
                        s.networkErrors = 0;
                        if (c.code === 800) {
                            self._handleExpired('netease',
                                function() { self.startNeteaseLogin(onQRReady, onStatus, onSuccess, onError, onFallback); },
                                onStatus, onError, fb);
                        } else if (c.code === 802 && s.step !== 'scanned') {
                            s.step = 'scanned';
                            onStatus('[*] 已扫描，请在手机上确认');
                            self._pollTimers['netease'] = setTimeout(doPoll, 3000);
                        } else if (c.code === 803) {
                            self.stopPolling('netease');
                            var cookie = c.cookie || (c.data && c.data.cookie) || '';
                            if (cookie) {
                                self._saveCookie('netease', cookie);
                                onStatus('[OK] 登录成功');
                                onSuccess('netease', cookie);
                            } else {
                                onError(formatError('cookie_save_failed'));
                            }
                        } else if (c.code === 801 && s.step === 'init') {
                            s.step = 'waiting';
                            onStatus('[*] 等待扫码...');
                            self._pollTimers['netease'] = setTimeout(doPoll, 3000);
                        } else {
                            self._pollTimers['netease'] = setTimeout(doPoll, 3000);
                        }
                    }).catch(function(e) {
                        console.warn('[QRLogin] Netease IPC poll error:', e.message);
                        if (self._state['netease'] && self._state['netease'].step !== 'done') {
                            self._pollTimers['netease'] = setTimeout(doPoll, 3000);
                        }
                    });
                };
                self._pollTimers['netease'] = setTimeout(doPoll, 3000);
            } catch (e) {
                console.warn('[QRLogin] Netease IPC start failed, falling back to local API:', e.message);
                self._startNeteaseLocal(onQRReady, onStatus, onSuccess, onError, fb);
            }
            return;
        }

        this._startNeteaseLocal(onQRReady, onStatus, onSuccess, onError, fb);
    },

    _startNeteaseLocal(onQRReady, onStatus, onSuccess, onError, fb) {
        var self = this;
        onStatus('正在连接网易云...');
        this.stopPolling('netease');
        this._acquireLock('netease');
        this._state['netease'] = { step: 'init', startTime: Date.now(), refreshCount: 0, networkErrors: 0 };

        this._fetch('/netease/qr/key?ts=' + Date.now()).then(function(keyRes) {
            if (!keyRes.success || !keyRes.data?.unikey) {
                var err = LOGIN_ERRORS['api_unavailable'];
                onError(err.message + ' — ' + err.suggestion);
                self._releaseLock('netease');
                return;
            }
            var key = keyRes.data.unikey;
            self._showQR(onQRReady, keyRes.data);
            onStatus('[*] 请打开"网易云音乐"APP -> 扫一扫');
            self._state['netease'].step = 'waiting';
            self._startCountdown('netease');
            self._state['netease']._onTimeout = function() {
                if (!self._state['netease']) return;
                self._checkTimeout('netease', onError, fb);
            };

            var pollFn = function() {
                self._pollTimers['netease'] = setInterval(async function() {
                    try {
                        if (self._checkTimeout('netease', onError, fb)) return;
                        var c = await self._fetch('/netease/qr/check?key=' + key + '&ts=' + Date.now());
                        if (!c.success) { console.warn('[QRLogin] Netease check !success:', c); return; }
                        var s = self._state['netease'];
                        if (!s) return;
                        s.networkErrors = 0;
                        if (c.code === 800) {
                            self._handleExpired('netease',
                                function() { self.startNeteaseLogin(onQRReady, onStatus, onSuccess, onError, onFallback); },
                                onStatus, onError, fb);
                        } else if (c.code === 802 && s.step !== 'scanned') {
                            s.step = 'scanned';
                            onStatus('[*] 已扫描，请在手机上确认');
                        } else if (c.code === 803) {
                            self.stopPolling('netease');
                            var cookie = c.cookie || (c.data && c.data.cookie) || '';
                            if (cookie) {
                                self._saveCookie('netease', cookie);
                                onStatus('[OK] 登录成功');
                                onSuccess('netease', cookie);
                            } else {
                                onError(formatError('cookie_save_failed'));
                            }
                        } else if (c.code === 801 && s.step === 'init') {
                            s.step = 'waiting';
                            onStatus('[*] 等待扫码...');
                        }
                    } catch (e) {
                        console.warn('[QRLogin] Netease poll error:', e.message);
                        if (self._isNetworkError(e)) {
                            self._handleNetworkError('netease', pollFn, onStatus, onError);
                        }
                    }
                }, 3000);
            };
            pollFn();
        }).catch(function(e) {
            var msg = (e.message || '').toLowerCase();
            if (msg.includes('fetch') || msg.includes('无法连接到本地api') || msg.includes('failed to fetch')) {
                var err = LOGIN_ERRORS['api_unavailable'];
                onStatus(err.message + ' — ' + err.suggestion);
                onError(err.message);
            } else {
                onError(formatError('unknown', e.message));
            }
            self._releaseLock('netease');
        });
    },

    // ===== QQ音乐 =====
    async startQQMusicLogin(onQRReady, onStatus, onSuccess, onError, onFallback) {
        console.log('[QQLogin] START - platform:', 'qqmusic', 'electron:', !!window.appRuntime);

        if (!this._acquireLock('qqmusic')) { onStatus('[*] 登录已在进行中'); return; }
        this.stopPolling('qqmusic');
        this._state['qqmusic'] = { step: 'init', startTime: Date.now(), refreshCount: 0, networkErrors: 0 };

        const hasBrowserLogin = !!(window.appRuntime && window.appRuntime.qqmusicBrowserLogin);
        const fb = hasBrowserLogin ? onFallback : null;

        if (window.appRuntime && window.appRuntime.qqmusicStart) {
            var self = this;
            onStatus('正在连接QQ音乐...');
            try {
                var startResult = await window.appRuntime.qqmusicStart();
                if (!startResult.ok) {
                    onError(formatError('unknown', startResult.message));
                    self._releaseLock('qqmusic');
                    return;
                }
                onQRReady(startResult.qrImgBase64);
                self._state['qqmusic'].step = 'polling';
                onStatus('[*] 请使用QQ扫描二维码');
                self._startCountdown('qqmusic');
                self._state['qqmusic']._onTimeout = function() {
                    if (!self._state['qqmusic']) return;
                    self._checkTimeout('qqmusic', onError, fb);
                };

                var pollCount = 0;
                var doPoll = function() {
                    if (!self._state['qqmusic'] || self._state['qqmusic'].step === 'done') return;
                    if (self._checkTimeout('qqmusic', onError, fb)) return;

                    pollCount++;
                    window.appRuntime.qqmusicPoll().then(function(result) {
                        if (!self._state['qqmusic'] || self._state['qqmusic'].step === 'done') return;

                        var s = self._state['qqmusic'];
                        switch (result.status) {
                            case 'waiting':
                                self._pollTimers['qqmusic'] = setTimeout(doPoll, 2500);
                                break;
                            case 'scanned':
                                if (s.step !== 'scanned') { s.step = 'scanned'; onStatus('[*] 已扫描，请在手机上确认'); }
                                self._pollTimers['qqmusic'] = setTimeout(doPoll, 2500);
                                break;
                            case 'success':
                                self.stopPolling('qqmusic');
                                if (result.cookieStr) {
                                    self._saveCookie('qqmusic', result.cookieStr);
                                    onStatus('[OK] 登录成功' + (result.nickname ? ' (' + result.nickname + ')' : ''));
                                    onSuccess('qqmusic', result.cookieStr);
                                } else {
                                    onError(formatError('cookie_save_failed'));
                                }
                                break;
                            case 'expired':
                                self._handleExpired('qqmusic',
                                    function() { self.startQQMusicLogin(onQRReady, onStatus, onSuccess, onError, onFallback); },
                                    onStatus, onError, fb);
                                break;
                            case 'error':
                                if (pollCount > 5) {
                                    self.stopPolling('qqmusic');
                                    onError(formatError('network_error'));
                                } else {
                                    self._pollTimers['qqmusic'] = setTimeout(doPoll, 2500);
                                }
                                break;
                        }
                    }).catch(function(e) {
                        console.warn('[QQLogin] IPC poll error:', e.message);
                        if (self._state['qqmusic'] && self._state['qqmusic'].step !== 'done') {
                            self._pollTimers['qqmusic'] = setTimeout(doPoll, 2500);
                        }
                    });
                };
                self._pollTimers['qqmusic'] = setTimeout(doPoll, 2500);
            } catch (e) {
                console.warn('[QQLogin] IPC start failed, falling back to local API:', e.message);
                self._startQQMusicLocal(onQRReady, onStatus, onSuccess, onError, fb);
            }
            return;
        }

        this._startQQMusicLocal(onQRReady, onStatus, onSuccess, onError, fb);
    },

    _startQQMusicLocal(onQRReady, onStatus, onSuccess, onError, fb) {
        var self = this;
        onStatus('正在连接QQ音乐...');
        this.stopPolling('qqmusic');
        this._acquireLock('qqmusic');
        this._state['qqmusic'] = { step: 'init', startTime: Date.now(), refreshCount: 0, networkErrors: 0 };

        this._fetch('/tencent/qr/show?t=' + Date.now()).then(function(showRes) {
            if (!showRes.success || !showRes.base64) {
                var err = LOGIN_ERRORS['api_unavailable'];
                onError(err.message + ' — ' + err.suggestion);
                self._releaseLock('qqmusic');
                return;
            }
            onQRReady(showRes.base64);
            var sessionId = showRes.session_id || '';
            var qrsig = showRes.qrsig || '';
            var ptqrtoken = showRes.ptqrtoken || '';
            var ptLoginSig = showRes.ptLoginSig || '';
            var cookies = showRes.cookies || '';
            if (!ptqrtoken || !qrsig) {
                onStatus('[!] 未获取到qrsig，请关闭后重试');
                self._releaseLock('qqmusic');
                return;
            }
            onStatus('[*] 请使用QQ扫描二维码');
            self._startCountdown('qqmusic');
            self._state['qqmusic']._onTimeout = function() {
                if (!self._state['qqmusic']) return;
                self._checkTimeout('qqmusic', onError, fb);
            };

            var pollFn = function() {
                self._pollTimers['qqmusic'] = setInterval(function() {
                    try {
                        if (self._checkTimeout('qqmusic', onError, fb)) return;
                        var params = new URLSearchParams({ ptqrtoken: ptqrtoken, t: Date.now() });
                        if (sessionId) {
                            params.set('session_id', sessionId);
                        } else {
                            params.set('qrsig', qrsig);
                            if (ptLoginSig) params.set('pt_login_sig', ptLoginSig);
                            if (cookies) params.set('cookies', cookies);
                        }
                        self._fetch('/tencent/qr/check?' + params).then(function(c) {
                            if (!c.success) { console.warn('[QRLogin] QQMusic check !success:', c); return; }
                            var ptCode = c.code || '';
                            console.log('[QQLogin] POLL:', ptCode, 'text:', c.data || '');
                            var text = c.data || '';
                            var s = self._state['qqmusic'];
                            if (!s) return;
                            s.networkErrors = 0;
                            if (ptCode === '65') {
                                self._handleExpired('qqmusic',
                                    function() { self.startQQMusicLogin(onQRReady, onStatus, onSuccess, onError, onFallback); },
                                    onStatus, onError, fb);
                            } else if (ptCode === '67' && s.step !== 'scanned') {
                                s.step = 'scanned';
                                onStatus('[*] 已扫描，请在手机上确认');
                            } else if (ptCode === '0') {
                                self.stopPolling('qqmusic');
                                var cookie = c.cookie || '';
                                if (cookie) {
                                    self._saveCookie('qqmusic', cookie);
                                    onStatus('[OK] 登录成功');
                                    onSuccess('qqmusic', cookie);
                                    return;
                                }
                                if (c.uin && c.skey) {
                                    cookie = 'uin=o' + c.uin + '; skey=' + c.skey;
                                    self._saveCookie('qqmusic', cookie);
                                    onStatus('[OK] 登录成功');
                                    onSuccess('qqmusic', cookie);
                                    return;
                                }
                                var uin = text.match(/uin=([^;"'&\s]+)/);
                                var skey = text.match(/skey=([^;"'&\s]+)/);
                                var pskey = text.match(/p_skey=([^;"'&\s]+)/);
                                var pt4 = text.match(/pt4_token=([^;"'&\s]+)/);
                                var parts = [];
                                if (uin) parts.push('uin=' + uin[1]);
                                if (skey) parts.push('skey=' + skey[1]);
                                if (pskey) parts.push('p_skey=' + pskey[1]);
                                if (pt4) parts.push('pt4_token=' + pt4[1]);
                                if (pskey) parts.push('qqmusic_key=' + pskey[1]);
                                var fallbackCookie = parts.join('; ');
                                if (fallbackCookie && uin) {
                                    self._saveCookie('qqmusic', fallbackCookie);
                                    onStatus('[OK] 登录成功');
                                    onSuccess('qqmusic', fallbackCookie);
                                } else {
                                    onError(formatError('cookie_save_failed'));
                                }
                            } else if (ptCode === '66') {
                                if (s.step === 'init') { s.step = 'polling'; onStatus('[*] 等待扫码...'); }
                            } else if (ptCode) {
                                onStatus('[?] ' + (text || ptCode));
                            }
                        }).catch(function(e) {
                            console.warn('[QRLogin] QQMusic poll error:', e.message);
                            if (self._isNetworkError(e)) {
                                self._handleNetworkError('qqmusic', pollFn, onStatus, onError);
                            }
                        });
                    } catch (e) {
                        console.warn('[QRLogin] QQMusic poll error (outer):', e.message);
                    }
                }, 3000);
            };
            pollFn();
        }).catch(function(e) {
            var msg = (e.message || '').toLowerCase();
            if (msg.includes('fetch') || msg.includes('无法连接到本地api') || msg.includes('failed to fetch')) {
                var err = LOGIN_ERRORS['api_unavailable'];
                onStatus(err.message + ' — ' + err.suggestion);
                onError(err.message);
            } else {
                onError(formatError('unknown', e.message));
            }
            self._releaseLock('qqmusic');
        });
    },

    // ===== 酷狗 =====
    async startKugouLogin(onQRReady, onStatus, onSuccess, onError, onFallback) {
        if (!this._acquireLock('kugou')) { onStatus('[*] 登录已在进行中'); return; }
        this.stopPolling('kugou');
        this._state['kugou'] = { step: 'init', startTime: Date.now(), refreshCount: 0, networkErrors: 0 };

        const hasBrowserLogin = !!(window.appRuntime && window.appRuntime.qqmusicBrowserLogin);
        const fb = hasBrowserLogin ? onFallback : null;

        if (window.appRuntime && window.appRuntime.qrKugouStart) {
            var self = this;
            onStatus('正在连接酷狗...');
            try {
                var startResult = await window.appRuntime.qrKugouStart();
                if (!startResult.success || !startResult.data?.key) {
                    onError(formatError('api_unavailable'));
                    self._releaseLock('kugou');
                    return;
                }
                var key = startResult.data.key;
                self._showQR(onQRReady, startResult.data);
                onStatus('[*] 请使用酷狗音乐APP扫描二维码');
                self._startCountdown('kugou');
                self._state['kugou']._onTimeout = function() {
                    if (!self._state['kugou']) return;
                    self._checkTimeout('kugou', onError, fb);
                };

                var doPoll = function() {
                    if (!self._state['kugou'] || self._state['kugou'].step === 'done') return;
                    if (self._checkTimeout('kugou', onError, fb)) return;

                    window.appRuntime.qrKugouPoll(key).then(function(result) {
                        if (!self._state['kugou'] || self._state['kugou'].step === 'done') return;
                        if (!result.success) { console.warn('[QRLogin] Kugou IPC poll !success:', result); self._pollTimers['kugou'] = setTimeout(doPoll, 3000); return; }
                        var c = result.data;
                        var st = c.status;
                        var s = self._state['kugou'];
                        if (!s) return;
                        s.networkErrors = 0;
                        if (st === 0) {
                            self._handleExpired('kugou',
                                function() { self.startKugouLogin(onQRReady, onStatus, onSuccess, onError, onFallback); },
                                onStatus, onError, fb);
                        } else if (st === 2 && s.step !== 'scanned') {
                            s.step = 'scanned';
                            onStatus('[*] 已扫描，请在手机上确认');
                            self._pollTimers['kugou'] = setTimeout(doPoll, 3000);
                        } else if (st === 4) {
                            self.stopPolling('kugou');
                            var cookie = c.cookie || result.data.cookie || '';
                            if (cookie) {
                                self._saveCookie('kugou', cookie);
                                onStatus('[OK] 登录成功');
                                onSuccess('kugou', cookie);
                            } else {
                                onError(formatError('cookie_save_failed'));
                            }
                        } else {
                            self._pollTimers['kugou'] = setTimeout(doPoll, 3000);
                        }
                    }).catch(function(e) {
                        console.warn('[QRLogin] Kugou IPC poll error:', e.message);
                        if (self._state['kugou'] && self._state['kugou'].step !== 'done') {
                            self._pollTimers['kugou'] = setTimeout(doPoll, 3000);
                        }
                    });
                };
                self._pollTimers['kugou'] = setTimeout(doPoll, 3000);
            } catch (e) {
                console.warn('[QRLogin] Kugou IPC start failed, falling back to local API:', e.message);
                self._startKugouLocal(onQRReady, onStatus, onSuccess, onError, fb);
            }
            return;
        }

        this._startKugouLocal(onQRReady, onStatus, onSuccess, onError, fb);
    },

    _startKugouLocal(onQRReady, onStatus, onSuccess, onError, fb) {
        var self = this;
        onStatus('正在连接酷狗...');
        this.stopPolling('kugou');
        this._acquireLock('kugou');
        this._state['kugou'] = { step: 'init', startTime: Date.now(), refreshCount: 0, networkErrors: 0 };

        this._fetch('/kugou/qr/get?ts=' + Date.now()).then(function(qrRes) {
            if (!qrRes.success || !qrRes.data?.key) {
                var err = LOGIN_ERRORS['api_unavailable'];
                onError(err.message + ' — ' + err.suggestion);
                self._releaseLock('kugou');
                return;
            }
            var key = qrRes.data.key;
            self._showQR(onQRReady, qrRes.data);
            onStatus('[*] 请使用酷狗音乐APP扫描二维码');
            self._startCountdown('kugou');
            self._state['kugou']._onTimeout = function() {
                if (!self._state['kugou']) return;
                self._checkTimeout('kugou', onError, fb);
            };

            var pollFn = function() {
                self._pollTimers['kugou'] = setInterval(async function() {
                    try {
                        if (self._checkTimeout('kugou', onError, fb)) return;
                        var c = await self._fetch('/kugou/qr/check?key=' + encodeURIComponent(key) + '&ts=' + Date.now());
                        if (!c.success) { console.warn('[QRLogin] Kugou check !success:', c); return; }
                        var st = c.data?.status;
                        var s = self._state['kugou'];
                        if (!s) return;
                        s.networkErrors = 0;
                        if (st === 0) {
                            self._handleExpired('kugou',
                                function() { self.startKugouLogin(onQRReady, onStatus, onSuccess, onError, onFallback); },
                                onStatus, onError, fb);
                        } else if (st === 2 && s.step !== 'scanned') {
                            s.step = 'scanned';
                            onStatus('[*] 已扫描，请在手机上确认');
                        } else if (st === 4) {
                            self.stopPolling('kugou');
                            var cookie = c.cookie || '';
                            if (cookie) {
                                self._saveCookie('kugou', cookie);
                                onStatus('[OK] 登录成功');
                                onSuccess('kugou', cookie);
                            } else {
                                onError(formatError('cookie_save_failed'));
                            }
                        }
                    } catch (e) {
                        console.warn('[QRLogin] Kugou poll error:', e.message);
                        if (self._isNetworkError(e)) {
                            self._handleNetworkError('kugou', pollFn, onStatus, onError);
                        }
                    }
                }, 3000);
            };
            pollFn();
        }).catch(function(e) {
            var msg = (e.message || '').toLowerCase();
            if (msg.includes('fetch') || msg.includes('无法连接到本地api') || msg.includes('failed to fetch')) {
                var err = LOGIN_ERRORS['api_unavailable'];
                onStatus(err.message + ' — ' + err.suggestion);
                onError(err.message);
            } else {
                onError(formatError('unknown', e.message));
            }
            self._releaseLock('kugou');
        });
    },
};

window.IanMusic.QRLogin = QRLogin;
window.IanMusic.LOGIN_ERRORS = LOGIN_ERRORS;
window.IanMusic.formatError = formatError;

function toggleManualCookie() {
    var body = document.getElementById('qr-manual-body');
    var container = document.getElementById('qr-manual-cookie');
    if (!body || !container) return;
    if (body.style.display === 'none') {
        body.style.display = 'flex';
        container.classList.add('open');
    } else {
        body.style.display = 'none';
        container.classList.remove('open');
    }
}

function submitManualCookie() {
    var textarea = document.getElementById('qr-manual-textarea');
    var status = document.getElementById('txt-qr-fetching');
    if (!textarea) return;
    var cookie = textarea.value.trim();
    if (!cookie) {
        if (status) { status.textContent = '[!] 请先粘贴 Cookie'; status.className = 'qr-login-status error'; }
        return;
    }
    try {
        if (typeof saveQqmusicCookie === 'function') {
            saveQqmusicCookie(cookie);
        }
        var qqInput = document.getElementById('qqmusic-cookie-input');
        if (qqInput) qqInput.value = cookie;
        if (status) { status.textContent = '[OK] Cookie 已保存！'; status.className = 'qr-login-status success'; }
        setTimeout(function() {
            if (typeof closeQRLogin === 'function') closeQRLogin();
        }, 1500);
    } catch (e) {
        console.warn('[QRLogin] Manual cookie error:', e.message);
        if (status) { status.textContent = '[!] Cookie 保存失败: ' + e.message; status.className = 'qr-login-status error'; }
    }
}