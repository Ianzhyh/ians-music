/**
 * @module IanMusic/ui
 * @description UI 交互 — 弹窗管理/按钮控制/Toast提示/防遮挡隐身
 * ⚠️ 全部还原自原始 index.html，确保功能100%一致
 */
window.IanMusic = window.IanMusic || {};

function toggleAIModal(show) { document.getElementById('ai-modal').classList.toggle('active', show); updateTopBtnsVisibility(); }
function toggleNetSearchModal(show) {
    document.getElementById('net-search-modal').classList.toggle('active', show);
    // 打开网络搜索时关闭 Library 抽屉，避免遮挡
    if (show && __playlistDrawer) {
        __playlistDrawer.classList.remove('lib-drawer--open');
        const overlay = document.getElementById('lib-overlay');
        if (overlay) overlay.classList.remove('lib-overlay--visible');
    }
    updateTopBtnsVisibility();
}
function togglePlaylistImportModal(show) {
    const m = document.getElementById('playlist-import-modal');
    if (!m) return;
    m.classList.toggle('active', show);
    if (show) document.getElementById('playlist-link-input').value = '';
    updateTopBtnsVisibility();
}

function mobileToggleLibrary() {
    // __playlistDrawer 是 togglePlaylist 内部创建的 JS 变量，不能通过 DOM id 访问
    // 直接用 togglePlaylist 切换，open 状态由 lib-drawer--open class 决定
    const isOpen = __playlistDrawer && __playlistDrawer.classList.contains('lib-drawer--open');
    if (isOpen) { togglePlaylist(false); }
    else { renderList(); togglePlaylist(true); }
}
function toggleMobileMore(show) {
    const drawer = document.getElementById('mobile-more-drawer'), sheet = document.getElementById('mobile-more-sheet');
    if(show) {
        drawer.style.display = 'flex';
        drawer.classList.add('open');
        const shuffleText = document.getElementById('mob-more-shuffle-text');
        if(shuffleText) shuffleText.textContent = isShuffle ? i18n[curLang].shuffleOn : i18n[curLang].shuffleOff;
        const repeatText = document.getElementById('mob-more-repeat-text');
        if(repeatText) {
            const modes = ['关闭','列表循环','单曲循环'];
            repeatText.textContent = repeatMode > 0 ? `循环: ${modes[repeatMode]}` : i18n[curLang].repeatOff;
        }
        const sleepText = document.getElementById('mob-more-sleep-text');
        if(sleepText) {
            const sleepBtn = document.getElementById('quick-sleep-btn');
            const sleepActive = sleepBtn && sleepBtn.classList.contains('active-timer');
            const countdown = document.getElementById('sleep-countdown');
            sleepText.textContent = sleepActive && countdown ? `睡眠定时: ${countdown.textContent}` : i18n[curLang].sleepOff;
        }
        requestAnimationFrame(() => { drawer.style.opacity = '1'; sheet.classList.add('open'); });
    } else {
        sheet.classList.remove('open');
        drawer.classList.remove('open');
        drawer.style.opacity = '0';
        setTimeout(() => { drawer.style.display = 'none'; }, 350);
    }
}

// 点击遮罩层关闭更多菜单
document.addEventListener('click', (e) => {
    const drawer = document.getElementById('mobile-more-drawer'), sheet = document.getElementById('mobile-more-sheet');
    const moreBtns = [document.getElementById('mobile-more-btn'), document.getElementById('mv-more-btn'), document.getElementById('more-btn-desktop')];
    if(drawer && drawer.classList.contains('open')) {
        const clickedOnBtn = moreBtns.some(btn => btn && btn.contains(e.target));
        if(clickedOnBtn) return;
        if(sheet && sheet.contains(e.target)) return;
        toggleMobileMore(false);
    }
});

function toggleSourceMenu() { document.getElementById('source-select').classList.toggle('open'); }
function setSource(val, text) {
    currentSource = val;
    localStorage.setItem('am_current_source', val); // 保存到 localStorage
    document.getElementById('current-source-text').innerText = text;
    document.querySelectorAll('.custom-option').forEach(el => el.classList.remove('selected'));
    event.currentTarget.classList.add('selected');
    toggleSourceMenu();
}
document.addEventListener('click', (e) => {
    if(!e.target.closest('.custom-select-container')) {
        document.querySelectorAll('.custom-select-container').forEach(el => el.classList.remove('open'));
        // 关闭歌曲信息弹窗的 fixed 下拉
        document.querySelectorAll('.song-info-server-dropdown').forEach(el => {
            el.style.opacity = '0';
            el.style.visibility = 'hidden';
            el.style.transform = 'translateY(-8px)';
            el.classList.remove('open');
        });
    }
});

// ====== 原始版本：防遮挡逻辑 —— 面板打开时右边三兄弟消失 ======
function updateTopBtnsVisibility() {
    const isAnyOpen =
        // 不再因歌单抽屉隐藏按钮
        document.getElementById('settings-modal')?.classList.contains('active') ||
        document.getElementById('search-modal')?.classList.contains('active') ||
        document.getElementById('move-modal')?.classList.contains('active') ||
        document.getElementById('ai-modal')?.classList.contains('active') ||
        document.getElementById('net-search-modal')?.classList.contains('active') ||
        document.getElementById('cover-modal')?.classList.contains('active') ||
        document.getElementById('offline-panel')?.style.display === 'block';

    const rightBtns = [
        document.getElementById('ai-translate-btn'),
        document.querySelector('.playlist-btn'),
        document.querySelector('.lyrics-btn')
    ];

    const leftBtns = [
        document.querySelector('.settings-btn'),
        document.querySelector('.sleep-btn'),
        document.querySelector('.offline-btn')
    ];

    const isOfflineOpen = document.getElementById('offline-panel')?.style.display === 'block';

    rightBtns.forEach(btn => {
        if(btn) {
            if(isAnyOpen) btn.classList.add('global-hidden');
            else btn.classList.remove('global-hidden');
        }
    });

    leftBtns.forEach(btn => {
        if(btn) {
            if(isOfflineOpen) btn.classList.add('global-hidden');
            else btn.classList.remove('global-hidden');
        }
    });
}

// ====== 所有弹窗toggle都必须调用updateTopBtnsVisibility ======
function toggleSettings(s) {
    if (s) {
        const neteaseInput = document.getElementById('netease-cookie-input');
        const qqmusicInput = document.getElementById('qqmusic-cookie-input');
        const kugouInput = document.getElementById('kugou-cookie-input');
        const localMetingInput = document.getElementById('local-meting-input');
        if (neteaseInput) neteaseInput.value = localStorage.getItem('am_netease_cookie') || '';
        if (qqmusicInput) qqmusicInput.value = localStorage.getItem('am_qqmusic_cookie') || '';
        if (kugouInput) kugouInput.value = localStorage.getItem('am_kugou_cookie') || '';
        if (localMetingInput) localMetingInput.value = localStorage.getItem('am_local_meting_api') || '';
    } else {
        const neteaseInput = document.getElementById('netease-cookie-input');
        const qqmusicInput = document.getElementById('qqmusic-cookie-input');
        const kugouInput = document.getElementById('kugou-cookie-input');
        if (neteaseInput && neteaseInput.value.trim()) saveNeteaseCookie(neteaseInput.value);
        if (qqmusicInput && qqmusicInput.value.trim()) saveQqmusicCookie(qqmusicInput.value);
        if (kugouInput && kugouInput.value.trim()) saveKugouCookie(kugouInput.value);
    }
    document.getElementById('settings-modal').classList.toggle('active', s);
    updateTopBtnsVisibility();
}
// ===== 歌单抽屉（单例模式：创建一次，CSS切换显隐）=====
let __playlistDrawer = null;

function togglePlaylist(s) {
    if (s) {
        // 已存在则直接显示
        if (__playlistDrawer && __playlistDrawer.parentNode) {
            __playlistDrawer.classList.add('lib-drawer--open');
            const overlay = document.getElementById('lib-overlay');
            if (overlay) overlay.classList.add('lib-overlay--visible');
            renderList();
            updateTopBtnsVisibility();
            return;
        }
        
        // 首次创建
        __playlistDrawer = document.createElement('div');
        __playlistDrawer.className = 'lib-drawer';
        
        // 遮罩层（点击关闭）
        const overlay = document.createElement('div');
        overlay.className = 'lib-overlay';
        overlay.id = 'lib-overlay';
        overlay.onclick = function() { togglePlaylist(false); };
        
        // 抽屉内容面板
        const panel = document.createElement('div');
        panel.className = 'lib-panel';
        
        panel.innerHTML =
            '<div class="lib-header">' +
                '<span class="lib-title"><svg class="lib-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg> <span id="txt-library">Library</span></span>' +
                '<div class="lib-actions">' +
                    '<button onclick="refreshLibrary()" title="刷新"><svg width="18" height="18" viewBox="0 0 1024 1024" fill="currentColor"><path d="M721.066667 725.333333c-59.733333 55.466667-132.266667 85.333333-209.066667 85.333334-157.866667 0-290.133333-123.733333-298.666667-281.6l12.8 12.8c8.533333 8.533333 17.066667 12.8 29.866667 12.8s21.333333-4.266667 29.866667-12.8c17.066667-17.066667 17.066667-42.666667 0-59.733334l-85.333334-85.333333c-17.066667-17.066667-42.666667-17.066667-59.733333 0l-85.333333 85.333333c-17.066667 17.066667-17.066667 42.666667 0 59.733334s42.666667 17.066667 59.733333 0l12.8-12.8c8.533333 204.8 179.2 366.933333 384 366.933333 98.133333 0 192-38.4 268.8-110.933333 17.066667-17.066667 17.066667-42.666667 0-59.733334-12.8-17.066667-42.666667-17.066667-59.733333 0zM968.533333 482.133333c-17.066667-17.066667-42.666667-17.066667-59.733333 0l-12.8 12.8C887.466667 290.133333 716.8 128 512 128c-98.133333 0-192 38.4-268.8 110.933333-17.066667 17.066667-17.066667 42.666667 0 59.733334 17.066667 17.066667 42.666667 17.066667 59.733333 0 59.733333-55.466667 132.266667-85.333333 209.066667-85.333334 157.866667 0 290.133333 123.733333 298.666667 281.6l-12.8-12.8c-17.066667-17.066667-42.666667-17.066667-59.733334 0s-17.066667 42.666667 0 59.733334l85.333334 85.333333c8.533333 8.533333 21.333333 12.8 29.866666 12.8s21.333333-4.266667 29.866667-12.8l85.333333-85.333333c17.066667-17.066667 17.066667-42.666667 0-59.733334z"/></svg></button> ' +
                    '<button id="txt-drawer-done" onclick="togglePlaylist(false)">DONE</button>' +
                '</div>' +
            '</div>' +
            '<div class="lib-search-wrap">' +
                '<input type="text" id="lib-search" placeholder="搜索歌曲..." oninput="filterLibrary(this.value)" />' +
            '</div>' +
            '<div class="lib-actions-row">' +
                '<button class="liquid-btn" id="txt-add-file-btn" onclick="document.getElementById(\'file-up\').click()">+ 文件</button>' +
                '<button class="liquid-btn primary" id="txt-add-folder-btn" onclick="document.getElementById(\'folder-up\').click()">+ 文件夹</button>' +
                '<input type="file" id="file-up" multiple style="display:none" onchange="importFiles(this.files)">' +
                '<input type="file" id="folder-up" webkitdirectory directory style="display:none" onchange="importFiles(this.files)">' +
                '<button class="liquid-btn" id="txt-net-search-btn" onclick="toggleNetSearchModal(true)" style="width:auto;padding:0 12px;background:var(--glass-border);"><svg class="lib-icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg> 网络搜索</button>' +
            '</div>' +
            '<div id="list-container" class="lib-list"></div>' +
            '<div class="playlist-empty" id="playlist-empty-hint" style="display:none;">' + i18n[curLang].emptyLibrary + '</div>';
        
        __playlistDrawer.appendChild(overlay);
        __playlistDrawer.appendChild(panel);
        document.body.appendChild(__playlistDrawer);
        
        // 触发动画
        requestAnimationFrame(() => {
            __playlistDrawer.classList.add('lib-drawer--open');
            overlay.classList.add('lib-overlay--visible');
        });
        
        // 渲染歌单
        renderList();
    } else {
        if (__playlistDrawer && __playlistDrawer.parentNode) {
            __playlistDrawer.classList.remove('lib-drawer--open');
            const overlay = document.getElementById('lib-overlay');
            if (overlay) overlay.classList.remove('lib-overlay--visible');
            // 不销毁DOM，保留复用
        }
    }
    updateTopBtnsVisibility();
}
function toggleSearchModal(s) { document.getElementById('search-modal').classList.toggle('active', s); updateTopBtnsVisibility(); }
function toggleMoveModal(s) { document.getElementById('move-modal').classList.toggle('active', s); updateTopBtnsVisibility(); }
function toggleCoverModal(s) { document.getElementById('cover-modal').classList.toggle('active', s); updateTopBtnsVisibility(); }

let toastTimer = null;
let toastHideTimer = null;
function showToast(msg, type) {
    const t = document.getElementById('toast');
    if(!t) return;
    type = type || '';
    clearTimeout(toastTimer);
    clearTimeout(toastHideTimer);
    t.classList.remove('hide');
    t.className = 'toast ' + type;
    t.innerText = msg;
    t.classList.add('show');
    toastTimer = setTimeout(() => {
        t.classList.add('hide');
        toastHideTimer = setTimeout(() => {
            t.classList.remove('show', 'hide');
            t.className = 'toast';
        }, 350);
    }, 2500);
}

window.IanMusic.toggleAIModal = toggleAIModal;
window.IanMusic.toggleNetSearchModal = toggleNetSearchModal;
window.IanMusic.togglePlaylistImportModal = togglePlaylistImportModal;
window.IanMusic.mobileToggleLibrary = mobileToggleLibrary;
window.IanMusic.toggleMobileMore = toggleMobileMore;
window.IanMusic.toggleSourceMenu = toggleSourceMenu;
window.IanMusic.setSource = setSource;
window.IanMusic.toggleSettings = toggleSettings;
window.IanMusic.togglePlaylist = togglePlaylist;
window.IanMusic.toggleSearchModal = toggleSearchModal;
window.IanMusic.toggleMoveModal = toggleMoveModal;
window.IanMusic.toggleCoverModal = toggleCoverModal;
window.IanMusic.updateTopBtnsVisibility = updateTopBtnsVisibility;
window.IanMusic.showToast = showToast;

function showConfirm(title, msg, okLabel, cancelLabel) {
    return new Promise((resolve) => {
        const modal = document.getElementById('confirm-dialog-modal');
        document.getElementById('confirm-dialog-title').textContent = title || i18n[curLang].confirmLabel;
        document.getElementById('confirm-dialog-msg').textContent = msg || '';
        document.getElementById('confirm-dialog-ok-btn').textContent = okLabel || i18n[curLang].confirmLabel;
        document.getElementById('confirm-dialog-cancel-btn').textContent = cancelLabel || i18n[curLang].cancelLabel;

        const cleanup = () => {
            modal.classList.remove('active');
            document.getElementById('confirm-dialog-ok-btn').onclick = null;
            document.getElementById('confirm-dialog-cancel-btn').onclick = null;
            document.removeEventListener('keydown', _onKey);
        };

        var _onKey = function(e) {
            if (e.key === 'Enter') { cleanup(); resolve(true); }
            if (e.key === 'Escape') { cleanup(); resolve(false); }
        };
        document.addEventListener('keydown', _onKey);

        document.getElementById('confirm-dialog-ok-btn').onclick = () => { cleanup(); resolve(true); };
        document.getElementById('confirm-dialog-cancel-btn').onclick = () => { cleanup(); resolve(false); };
        modal.onclick = (e) => { if (e.target === modal) { cleanup(); resolve(false); } };

        modal.classList.add('active');
    });
}

function showPrompt(title, placeholder, defaultValue) {
    return new Promise((resolve) => {
        const modal = document.getElementById('prompt-dialog-modal');
        document.getElementById('prompt-dialog-title').textContent = title || '';
        const input = document.getElementById('prompt-dialog-input');
        input.placeholder = placeholder || '';
        input.value = defaultValue || '';
        input.focus();
        input.select();

        const cleanup = () => {
            modal.classList.remove('active');
            document.getElementById('prompt-dialog-ok-btn').onclick = null;
            document.getElementById('prompt-dialog-cancel-btn').onclick = null;
        };

        document.getElementById('prompt-dialog-ok-btn').onclick = () => { cleanup(); resolve(input.value); };
        document.getElementById('prompt-dialog-cancel-btn').onclick = () => { cleanup(); resolve(null); };
        modal.onclick = (e) => { if (e.target === modal) { cleanup(); resolve(null); } };

        input.onkeydown = (e) => { if (e.key === 'Enter') { cleanup(); resolve(input.value); } };

        modal.classList.add('active');
    });
}

window.IanMusic.showConfirm = showConfirm;
window.IanMusic.showPrompt = showPrompt;

let _currentQRPlatform = null;

const QR_PLATFORM_INFO = {
    netease: { title: '网易云音乐 · 扫码登录', hint: '[!] 请打开网易云音乐 APP → 左上角 ≡ → 扫一扫（请勿用手机摄像头/浏览器扫码）', inputId: 'netease-cookie-input' },
    qqmusic: { title: 'QQ音乐 · 扫码登录', hint: '请使用 QQ 扫描二维码', inputId: 'qqmusic-cookie-input' },
    kugou: { title: '酷狗音乐 · 扫码登录', hint: '请打开酷狗音乐 APP → 扫一扫', inputId: 'kugou-cookie-input' },
};

function openQRLogin(platform) {
    _currentQRPlatform = platform;
    const info = QR_PLATFORM_INFO[platform];
    if (!info) return;

    const modal = document.getElementById('qr-login-modal');
    const title = document.getElementById('qr-login-title');
    const status = document.getElementById('txt-qr-fetching');
    const hint = document.getElementById('qr-login-platform-hint');
    const img = document.getElementById('qr-code-img');
    const spinner = document.getElementById('qr-code-spinner');
    const expired = document.getElementById('qr-code-expired');

    title.textContent = info.title;
    status.className = 'qr-login-status';
    hint.textContent = info.hint;
    img.style.display = 'none';
    img.src = '';
    spinner.style.display = 'flex';
    expired.style.display = 'none';

    modal.classList.add('active');

    if (location.protocol === 'file:' && !window.appRuntime) {
        status.textContent = i18n[curLang].qrLoginFileProtocol;
        status.className = 'qr-login-status error';
        return;
    }

    status.textContent = i18n[curLang].fetchingQR;

    const QRL = window.IanMusic.QRLogin;
    if (!QRL) {
        status.textContent = i18n[curLang].qrLoginModuleNotLoaded;
        status.className = 'qr-login-status error';
        return;
    }

    const onQRReady = (src) => {
        img.src = src;
        img.style.display = 'block';
        spinner.style.display = 'none';
    };
    const onStatus = (msg) => {
        status.textContent = msg;
        status.className = 'qr-login-status';
        updateQRStatus('idle');
    };
    const onSuccess = (plat, cookie) => {
        status.textContent = i18n[curLang].loginSuccess;
        status.className = 'qr-login-status success';
        updateQRStatus('success');
        const input = document.getElementById(info.inputId);
        if (input) input.value = cookie;
        setTimeout(() => closeQRLogin(), 2000);
    };
    const onError = (msg) => {
        status.textContent = msg;
        status.className = 'qr-login-status error';
        updateQRStatus('error');
        expired.style.display = 'flex';
    };
    const onFallback = () => {
        const footer = document.getElementById('qr-login-footer');
        if (!footer) return;
        const btn = document.createElement('button');
        btn.className = 'liquid-btn secondary liquid-btn--compact';
        btn.textContent = i18n[curLang].openWebLogin;
        btn.onclick = async () => {
            btn.disabled = true;
            btn.textContent = i18n[curLang].openingText;
            status.textContent = i18n[curLang].openingQQLogin;
            status.className = 'qr-login-status';
            try {
                const result = await window.appRuntime.qqmusicBrowserLogin();
                if (result && result.success && result.cookie) {
                    status.textContent = '[OK] ' + i18n[curLang].loginSuccess;
                    status.className = 'qr-login-status success';
                    const input = document.getElementById(info.inputId);
                    if (input) input.value = result.cookie;
                    setTimeout(() => closeQRLogin(), 2000);
                } else {
                    status.textContent = '[!] ' + i18n[curLang].loginFailed + ': ' + (result ? result.error : '未知错误');
                    status.className = 'qr-login-status error';
                }
            } catch (e) {
                status.textContent = '[!] ' + i18n[curLang].loginFailed + ': ' + e.message;
                status.className = 'qr-login-status error';
            }
            btn.disabled = false;
            btn.textContent = i18n[curLang].openWebLogin;
        };
        footer.innerHTML = '';
        footer.appendChild(btn);
    };

    if (platform === 'netease') QRL.startNeteaseLogin(onQRReady, onStatus, onSuccess, onError, onFallback);
    else if (platform === 'qqmusic') QRL.startQQMusicLogin(onQRReady, onStatus, onSuccess, onError, onFallback);
    else if (platform === 'kugou') QRL.startKugouLogin(onQRReady, onStatus, onSuccess, onError, onFallback);
}

function closeQRLogin() {
    const modal = document.getElementById('qr-login-modal');
    modal.classList.remove('active');
    if (window.IanMusic.QRLogin) window.IanMusic.QRLogin.stopAllPolling();
    _currentQRPlatform = null;
    const footer = document.getElementById('qr-login-footer');
    if (footer) footer.innerHTML = '';
    const bar = document.getElementById('qr-countdown-bar');
    const text = document.getElementById('qr-countdown-text');
    if (bar) { bar.style.width = '0%'; bar.classList.remove('qr-countdown-warn'); }
    if (text) text.textContent = '';
}

function refreshQRLogin() {
    if (_currentQRPlatform) openQRLogin(_currentQRPlatform);
}

function updateQRStatus(state) {
    const panel = document.getElementById('qr-status-panel');
    const icon = document.getElementById('qr-status-icon');
    const text = document.getElementById('qr-status-text');
    if (!panel) return;
    panel.className = 'qr-status-panel';
    panel.style.display = 'none';
    if (icon) icon.className = 'qr-status-icon';
    if (state === 'success') {
        panel.className = 'qr-status-panel success';
        panel.style.display = 'flex';
        if (text) text.textContent = i18n[curLang].loginSuccess;
    } else if (state === 'error') {
        panel.className = 'qr-status-panel error';
        panel.style.display = 'flex';
        if (text) text.textContent = i18n[curLang].loginFailed;
    }
}

window.IanMusic.openQRLogin = openQRLogin;
window.IanMusic.closeQRLogin = closeQRLogin;
window.IanMusic.refreshQRLogin = refreshQRLogin;
window.IanMusic.updateQRStatus = updateQRStatus;
