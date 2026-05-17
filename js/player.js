/**
 * @module IanMusic/player
 * @description 核心播放器引擎 — 播放/暂停/上下曲/进度条/音量/拖拽排序/封面取色
 */
window.IanMusic = window.IanMusic || {};

// 防御：lyrics.js 可能未正确挂载到 window.IanMusic
function _isQrcLyric(data) {
    if (typeof data !== 'string' || !data.startsWith('[')) return false;
    try { const p = JSON.parse(data); return Array.isArray(p) && p.length > 0 && p[0].chars; }
    catch { return false; }
}
function _callRender(lrc) {
    // QRC 结构化数据 → 逐字渲染
    if (_isQrcLyric(lrc)) {
        const parsed = JSON.parse(lrc);
        if (window.IanMusic && typeof window.IanMusic.renderQrcLyrics === 'function') {
            window.IanMusic.renderQrcLyrics(parsed);
        } else if (typeof renderQrcLyrics === 'function') {
            renderQrcLyrics(parsed);
        }
        return;
    }
    if (window.IanMusic && typeof window.IanMusic.renderLyrics === 'function') {
        window.IanMusic.renderLyrics(lrc);
    } else if (typeof renderLyrics === 'function') {
        renderLyrics(lrc); // lyrics.js 在 player.js 之前加载，全局可用
    }
}

// ===== 播放控制 =====
const PLAY_ICON_SRC='./img/apple music icon_07.svg';
const PAUSE_ICON_SRC='./img/apple music icon_06.svg';

// 🎚️ 无感过渡播放（CeruMusic 风格 crossfade）
let _crossfadeEnabled = localStorage.getItem('am_crossfade') === 'true';
let _crossfadeDuration = parseFloat(localStorage.getItem('am_crossfade_dur')) || 3;
let _fadeAudio = null;    // 副 Audio 元素
let _fadeTargetIdx = -1;  // 正在淡入的目标 track 索引
let _fadeRAF = null;      // requestAnimationFrame id
let _fadeStartTime = 0;
let _userVol = prevVol;   // 用户实际音量

function _initFadeAudio() {
    if (_fadeAudio) return;
    _fadeAudio = new Audio();
    _fadeAudio.setAttribute('playsinline','');
    _fadeAudio.setAttribute('webkit-playsinline','');
    _fadeAudio.preload = 'auto';
}

function _cancelFade() {
    if (_fadeRAF) { cancelAnimationFrame(_fadeRAF); _fadeRAF = null; }
    if (_fadeAudio) {
        _fadeAudio.pause();
        _fadeAudio.src = '';
        _fadeAudio.load();
        _fadeAudio.volume = 0;
    }
    _fadeTargetIdx = -1;
}

function _startCrossfade(fromAudio, toAudio, targetIdx, duration) {
    _cancelFade();
    _initFadeAudio();

    const outAudio = fromAudio;
    const inAudio  = toAudio;
    const t = playlist[targetIdx];

    const outStartVol = outAudio.volume;
    inAudio.volume = 0;
    _fadeTargetIdx = targetIdx;
    _fadeStartTime = performance.now();

    let playPromise = inAudio.play();
    if (playPromise && playPromise.then) { playPromise.catch(() => {}); }

    // 更新全局索引
    curIdx = targetIdx;
    currentTrackId = t.id;
    localStorage.setItem('am_last_track', t.id);

    // 同步 UI
    setPlayIcons(true);
    document.getElementById('art').classList.remove('paused');
    _updateUIForTrack(t);
    window.IanMusic.setVisualizerPlaying && window.IanMusic.setVisualizerPlaying(true);

    // 加载封面和歌词
    loadTrackMetaOnly(targetIdx);

    function _fadeStep() {
        const elapsed = (performance.now() - _fadeStartTime) / 1000;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);

        outAudio.volume = Math.max(0, outStartVol * (1 - eased));
        inAudio.volume = Math.min(_userVol, _userVol * eased);

        if (progress < 1) {
            _fadeRAF = requestAnimationFrame(_fadeStep);
        } else {
            // 完成：主 Audio 接管，清理副 Audio
            outAudio.pause();
            outAudio.volume = _userVol;
            inAudio.volume = _userVol;

            // 将播放状态同步回主 audio（后续所有逻辑都用 audio）
            const curTime = inAudio.currentTime;
            audio.src = inAudio.src;
            audio.currentTime = curTime;
            audio.volume = _userVol;
            audio.play().catch(() => {});
            inAudio.pause();
            inAudio.src = '';
            inAudio.load();
            inAudio.volume = 0;

            _fadeRAF = null;
            _fadeTargetIdx = -1;

            // 预加载下一首
            _preloadNextTrack();
        }
    }
    _fadeRAF = requestAnimationFrame(_fadeStep);
}

// 导出 crossfade 设置给外部
function setCrossfadeEnabled(v) {
    _crossfadeEnabled = v;
    localStorage.setItem('am_crossfade', v);
}
function setCrossfadeDuration(v) {
    _crossfadeDuration = v;
    localStorage.setItem('am_crossfade_dur', v);
}

function setPlayIcons(pause) {
    const src=pause?PAUSE_ICON_SRC:PLAY_ICON_SRC;
    ['play-btn','mv-play-btn','mob-play-btn'].forEach(id=>{
        const el=document.getElementById(id);if(el){const img=el.querySelector('img');if(img)img.src=src;}
    });
    var playBtn = document.getElementById('play-btn');
    if(playBtn) playBtn.classList.toggle('playing', pause);
    var mvPlayBtn = document.getElementById('mv-play-btn');
    if(mvPlayBtn) mvPlayBtn.classList.toggle('playing', pause);
}

function togglePlay() {
    if (!audio.src || playlist.length === 0) return;
    if(audio.paused) {
        // 先取消任何正在进行的 crossfade
        _cancelFade();
        let playPromise = audio.play();
        if (playPromise !== undefined) {
            playPromise.then(() => {
                syncNativeMediaCard(null, null, null, true);
                document.getElementById('art').classList.remove('paused');
                setPlayIcons(true);
                updateListActiveState();
                window.IanMusic.setVisualizerPlaying && window.IanMusic.setVisualizerPlaying(true);
            }).catch(error => { console.log("Auto-play prevented or interrupted by fast switching"); });
        }
    } else {
        _cancelFade();
        audio.pause();
        syncNativeMediaCard(null, null, null, false);
        document.getElementById('art').classList.add('paused');
        setPlayIcons(false);
        updateListActiveState();
        window.IanMusic.setVisualizerPlaying && window.IanMusic.setVisualizerPlaying(false);
    }
}

function toggleShuffle() {
    isShuffle = !isShuffle; localStorage.setItem('am_shuffle', isShuffle);
    document.getElementById('btn-shuffle').classList.toggle('active', isShuffle);
    document.getElementById('mob-shuffle-btn').classList.toggle('active', isShuffle);
    document.getElementById('mv-shuffle-btn').classList.toggle('active', isShuffle);
    showToast(isShuffle ? i18n[curLang].shuffleOn : i18n[curLang].shuffleOff);
}
function toggleRepeat() {
    repeatMode = (repeatMode + 1) % 3; localStorage.setItem('am_repeat', repeatMode); updateRepeatUI();
    let msg = i18n[curLang].repeatOff;
    if (repeatMode === 1) msg = i18n[curLang].repeatAll;
    if (repeatMode === 2) msg = i18n[curLang].repeatOne;
    showToast(msg);
}

function updateRepeatUI() {
    ['btn-repeat', 'mob-repeat-btn', 'mv-repeat-btn'].forEach(id => {
        const el = document.getElementById(id); if (!el) return;
        el.classList.toggle('active', repeatMode > 0);
        const icons = [
            '<svg class="icon" viewBox="0 0 1024 1024" width="18" height="18" fill="currentColor"><path d="M361.5 727.8c-119.1 0-215.9-96.9-215.9-215.9 0-119.1 96.9-215.9 215.9-215.9 2.3 0 4.6-0.2 6.8-0.6v58.3c0 12.3 14 19.4 23.9 12.1l132.6-97.6c8.1-6 8.1-18.2 0-24.2l-132.6-97.6c-9.9-7.3-23.9-0.2-23.9 12.1v58.1c-2.2-0.4-4.5-0.6-6.8-0.6-39.8 0-78.5 7.9-115 23.4-35.2 15-66.8 36.3-94 63.5s-48.6 58.8-63.5 94c-15.5 36.5-23.4 75.2-23.4 115s7.9 78.5 23.4 115c15 35.2 36.3 66.8 63.5 94s58.8 48.6 94 63.5c36.5 15.5 75.2 23.4 115 23.4 22.1 0 40-17.9 40-40s-17.9-40-40-40zM938.2 396.9c-15-35.2-36.3-66.8-63.5-94s-58.8-48.6-94-63.5c-36.5-15.5-75.2-23.4-115-23.4-22.1 0-40 17.9-40 40s17.9 40 40 40c119.1 0 215.9 96.9 215.9 215.9 0 119.1-96.9 215.9-215.9 215.9-4.1 0-8.1 0.6-11.8 1.8v-60.8c0-12.3-14-19.4-23.9-12.1l-132.6 97.6c-8.1 6-8.1 18.2 0 24.2L629.9 876c9.9 7.3 23.9 0.2 23.9-12.1V806c3.7 1.2 7.7 1.8 11.8 1.8 39.8 0 78.5-7.9 115-23.4 35.2-15 66.8-36.3 94-63.5s48.6-58.8 63.5-94c15.5-36.5 23.4-75.2 23.4-115s-7.8-78.5-23.3-115z"/></svg>',
            '<svg viewBox="0 0 1024 1024" width="18" height="18" fill="currentColor"><path d="M361.5 727.8c-119.1 0-215.9-96.9-215.9-215.9 0-119.1 96.9-215.9 215.9-215.9 2.3 0 4.6-0.2 6.8-0.6v58.3c0 12.3 14 19.4 23.9 12.1l132.6-97.6c8.1-6 8.1-18.2 0-24.2l-132.6-97.6c-9.9-7.3-23.9-0.2-23.9 12.1v58.1c-2.2-0.4-4.5-0.6-6.8-0.6-39.8 0-78.5 7.9-115 23.4-35.2 15-66.8 36.3-94 63.5s-48.6 58.8-63.5 94c-15.5 36.5-23.4 75.2-23.4 115s7.9 78.5 23.4 115c15 35.2 36.3 66.8 63.5 94s58.8 48.6 94 63.5c36.5 15.5 75.2 23.4 115 23.4 22.1 0 40-17.9 40-40s-17.9-40-40-40zM938.2 396.9c-15-35.2-36.3-66.8-63.5-94s-58.8-48.6-94-63.5c-36.5-15.5-75.2-23.4-115-23.4-22.1 0-40 17.9-40 40s17.9 40 40 40c119.1 0 215.9 96.9 215.9 215.9 0 119.1-96.9 215.9-215.9 215.9-4.1 0-8.1 0.6-11.8 1.8v-60.8c0-12.3-14-19.4-23.9-12.1l-132.6 97.6c-8.1 6-8.1 18.2 0 24.2L629.9 876c9.9 7.3 23.9 0.2 23.9-12.1V806c3.7 1.2 7.7 1.8 11.8 1.8 39.8 0 78.5-7.9 115-23.4 35.2-15 66.8-36.3 94-63.5s48.6-58.8 63.5-94c15.5-36.5 23.4-75.2 23.4-115s-7.8-78.5-23.3-115z"/></svg>',
            '<svg viewBox="0 0 1024 1024" width="18" height="18" fill="currentColor"><path d="M361.5 727.8c-119.1 0-215.9-96.9-215.9-215.9 0-119.1 96.9-215.9 215.9-215.9 2.3 0 4.6-0.2 6.8-0.6v58.3c0 12.3 14 19.4 23.9 12.1l132.6-97.6c8.1-6 8.1-18.2 0-24.2l-132.6-97.6c-9.9-7.3-23.9-0.2-23.9 12.1v58.1c-2.2-0.4-4.5-0.6-6.8-0.6-39.8 0-78.5 7.9-115 23.4-35.2 15-66.8 36.3-94 63.5s-48.6 58.8-63.5 94c-15.5 36.5-23.4 75.2-23.4 115s7.9 78.5 23.4 115c15 35.2 36.3 66.8 63.5 94s58.8 48.6 94 63.5c36.5 15.5 75.2 23.4 115 23.4 22.1 0 40-17.9 40-40s-17.9-40-40-40zM938.2 396.9c-15-35.2-36.3-66.8-63.5-94s-58.8-48.6-94-63.5c-36.5-15.5-75.2-23.4-115-23.4-22.1 0-40 17.9-40 40s17.9 40 40 40c119.1 0 215.9 96.9 215.9 215.9 0 119.1-96.9 215.9-215.9 215.9-4.1 0-8.1 0.6-11.8 1.8v-60.8c0-12.3-14-19.4-23.9-12.1l-132.6 97.6c-8.1 6-8.1 18.2 0 24.2L629.9 876c9.9 7.3 23.9 0.2 23.9-12.1V806c3.7 1.2 7.7 1.8 11.8 1.8 39.8 0 78.5-7.9 115-23.4 35.2-15 66.8-36.3 94-63.5s48.6-58.8 63.5-94c15.5-36.5 23.4-75.2 23.4-115s-7.8-78.5-23.3-115z"/><path d="M512.8 660.6c22.1-0.1 39.9-18.1 39.8-40.2l-1.2-214.1c-0.1-22-18-39.8-40-39.8h-0.2c-22.1 0.1-39.9 18.1-39.8 40.2l1.2 214.1c0.1 22 18 39.8 40 39.8h0.2z"/></svg>'
        ];
        el.innerHTML = icons[repeatMode];
    });
}

function _updateUIForTrack(t) {
    if (!t) return;
    document.title = '[M] ' + t.title;
    const titleEl = document.getElementById('title');
    if(titleEl) titleEl.innerText = t.title;
    const artistEl = document.getElementById('artist');
    if(artistEl) artistEl.innerText = t.artist;
    const mvTitle = document.getElementById('mv-title');
    if(mvTitle) mvTitle.innerText = t.title;
    const mvArtist = document.getElementById('mv-artist');
    if(mvArtist) mvArtist.innerText = t.artist;
    const noLyricT = document.getElementById('no-lyric-title');
    if(noLyricT) noLyricT.innerText = t.title;
    const noLyricA = document.getElementById('no-lyric-artist');
    if(noLyricA) noLyricA.innerText = t.artist;
    updateListActiveState();
}

function _swapAudioRole(newIdx) {}  // 已废弃，逻辑已移至 _startCrossfade 内部

function loadTrackMetaOnly(i) {
    if (i < 0 || i >= playlist.length) return;
    const t = playlist[i];

    const savedCover = localStorage.getItem('am_cover_' + t.id);
    let coverUrl = savedCover || t.cover;
    if (savedCover) { t.cover = savedCover; t.coverFetched = true; }
    if (coverUrl && !coverUrl.startsWith('http') && !coverUrl.startsWith('data:') && !t.coverFetched) {
        window.IanMusic.fetchSongPic(t.source || 'tencent', coverUrl, 600).then(resolvedUrl => {
            if (resolvedUrl && currentTrackId === t.id) applyCover(resolvedUrl, t.id, true);
        });
        coverUrl = '';
    }
    if (!coverUrl && !t.coverFetched) {
        window.IanMusic.fetchOnlineCover(t.title, t.artist).then(onlineCover => {
            if (onlineCover) { t.cover = onlineCover; t.coverFetched = true; localStorage.setItem('am_cover_' + t.id, onlineCover); if (currentTrackId === t.id) applyCover(onlineCover, t.id, true); }
        });
    }
    applyCover(coverUrl, null);

    const cachedLRC = localStorage.getItem('am_lyric_' + t.id);
    if (!t.savedLyrics && cachedLRC && (cachedLRC.includes('[00:') || _isQrcLyric(cachedLRC))) { t.savedLyrics = cachedLRC; }
    if (t.savedLyrics) {
        if (t.savedLyrics.startsWith('http')) {
            fetch(t.savedLyrics).then(r => r.json()).then(lrcJson => {
                let realLrc = lrcJson.lyric || lrcJson.text || '';
                if (realLrc && realLrc.includes('[00:') && currentTrackId === t.id) {
                    if (t.isBilibili) realLrc = cleanBilibiliLyrics(realLrc);
                    playlist[i].savedLyrics = realLrc;
                    localStorage.setItem('am_lyric_' + t.id, realLrc);
                    _callRender(realLrc);
                }
            }).catch(() => window.IanMusic.fetchLyrics(t.title, t.artist));
        } else {
            const rawLrc = t.isBilibili ? cleanBilibiliLyrics(t.savedLyrics) : t.savedLyrics;
            _callRender(rawLrc);
        }
    } else {
        window.IanMusic.fetchLyrics(t.title, t.artist);
    }
    syncNativeMediaCard(t.title || '', t.artist || '', coverUrl, false);
}

function _preloadNextTrack() {
    if (!_crossfadeEnabled || playlist.length <= 1 || repeatMode === 2) return;
    _initFadeAudio();
    let nextIdx;
    if (isShuffle) {
        nextIdx = Math.floor(Math.random() * playlist.length);
        if (nextIdx === curIdx && playlist.length > 1) nextIdx = (nextIdx + 1) % playlist.length;
    } else {
        nextIdx = (curIdx + 1) % playlist.length;
    }
    if (nextIdx === curIdx) return;
    const t = playlist[nextIdx];
    if (!t || !t.src) return;
    _fadeAudio.src = t.src;
    _fadeAudio.load();
    _fadeTargetIdx = nextIdx;
}

function next(fromEnded) {
    if (playlist.length <= 1 && fromEnded) { audio.currentTime = 0; return; }
    let nextIdx;
    if (isShuffle) {
        nextIdx = Math.floor(Math.random() * playlist.length);
        if (nextIdx === curIdx && playlist.length > 1) nextIdx = (nextIdx + 1) % playlist.length;
    } else { nextIdx = (curIdx + 1) % playlist.length; }

    // 单曲循环时不用 crossfade
    if (fromEnded && repeatMode === 2) { audio.currentTime = 0; audio.play(); return; }

    // 🎚️ 无感过渡：交叉淡入淡出模式
    if (_crossfadeEnabled && _fadeAudio && _fadeAudio.src && !_fadeAudio.paused && _fadeTargetIdx === nextIdx) {
        _startCrossfade(audio, _fadeAudio, nextIdx, _crossfadeDuration);
        return;
    }

    // 正常模式：直接加载
    loadTrack(nextIdx, true);
}
function prev() {
    if (!audio.paused && audio.currentTime > 3) { audio.currentTime = 0; return; }
    let prevIdx = (curIdx - 1 + playlist.length) % playlist.length;
    loadTrack(prevIdx, true);
}

// ===== 进度条 + 音量 =====
function updateRangeUI(el) {
    const pct = el.value / el.max * 100;
    el.style.setProperty('--progress', pct + '%');
    // 更新自定义 fill div
    if (el.id === 'seek') {
        const fill = document.getElementById('seek-fill');
        if (fill) fill.style.width = pct + '%';
    } else if (el.id === 'vol') {
        const fill = document.getElementById('vol-fill');
        if (fill) fill.style.width = pct + '%';
    }
}
function updateVolume(el) {
    const vol = el.value / 100;
    audio.volume = vol;
    _userVol = vol;
    prevVol = vol;
    updateRangeUI(el);
    const fill = document.getElementById('vol-fill');
    if (fill) fill.style.width = (el.value / el.max * 100) + '%';
}
function fmt(s) { const m = Math.floor(s / 60), sec = Math.floor(s % 60).toString().padStart(2,'0'); return `${m}:${sec}`; }

// ===== 拖拽排序（原始版本：数组重排序）=====
function handleDragStart(e, idx) {
    draggedItemIdx = idx;
    e.target.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
}
function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
}
function handleDrop(e, dropIdx) {
    e.preventDefault();
    document.querySelectorAll('.dragging').forEach(el => el.classList.remove('dragging'));
    if(draggedItemIdx === null || draggedItemIdx === dropIdx) return;
    const item = playlist.splice(draggedItemIdx, 1)[0];
    playlist.splice(dropIdx, 0, item);
    curIdx = playlist.findIndex(t => t.id === currentTrackId);
    saveOrder();
    renderList();
    showToast(i18n[curLang].playlistSorted);
}

// ===== 加载歌曲（核心函数）=====
async function loadTrack(i, autoPlay = false) {
    if(i < 0 || i >= playlist.length) { if(playlist.length > 0) i = 0; else { showHint(); return; } }
    curIdx = i; const t = playlist[i]; currentTrackId = t.id;

    localStorage.setItem('am_last_track', t.id);

    const lyricsBox=document.getElementById('desktop-lyrics-box');
    if(lyricsBox) lyricsBox.innerHTML='';
    // ⚠️ 切换歌曲时必须重置歌词高亮状态，防止旧 DOM 引用残留导致不同步
    _lastDesktopActive=null;
    _lastDeskActiveIdx=-1;
    audio.src = t.src; audio.load();
    
    // 更新标题和艺术家信息
    const titleEl = document.getElementById('title');
    if(titleEl) titleEl.innerText = t.title;
    
    const artistEl = document.getElementById('artist');
    if(artistEl) artistEl.innerText = t.artist;
    
    // 移动端标题/歌手
    const mvTitle = document.getElementById('mv-title');
    if(mvTitle) mvTitle.innerText = t.title;
    
    const mvArtist = document.getElementById('mv-artist');
    if(mvArtist) mvArtist.innerText = t.artist;
    
    // 无歌词模式面板
    const noLyricT = document.getElementById('no-lyric-title');
    if(noLyricT) noLyricT.innerText = t.title;
    
    const noLyricA = document.getElementById('no-lyric-artist');
    if(noLyricA) noLyricA.innerText = t.artist;
    
    // 更新浏览器标签页标题
    document.title = `[M] ${t.title}`;
    console.log('[loadTrack] ✅ 已更新所有标题元素:', t.title);

    // 重置 AI 翻译状态
    const aiBtn=document.getElementById('ai-translate-btn');if(aiBtn)aiBtn.classList.remove('active');
    const dlBox2=document.getElementById('desktop-lyrics-box');if(dlBox2)dlBox2.classList.remove('hide-trans');

    // 移动端歌词显隐重置
    isLyricVisible = true;
    const lyricRows = document.getElementById('mv-lyric-rows');
    const noLyric = document.getElementById('mv-no-lyric');
    if (lyricRows) lyricRows.style.display = '';
    if (noLyric) noLyric.classList.remove('show');
    // 恢复顶部栏（防止之前隐藏后残留）
    const mobTopRow = document.querySelector('.mv-top-row');
    if(mobTopRow){ mobTopRow.classList.remove('mv-hidden'); mobTopRow.style.removeProperty('display'); }
    const mvTransBtn = document.getElementById('mv-trans-btn');
    if(mvTransBtn){ mvTransBtn.classList.remove('mv-hidden'); mvTransBtn.style.removeProperty('display'); }
    const mvWordBtn = document.getElementById('mv-word-btn');
    if(mvWordBtn){ mvWordBtn.classList.remove('mv-hidden'); mvWordBtn.style.removeProperty('display'); }

    // 封面处理（优先缓存，兜底 Meting API /pic + iTunes）
    console.log('[loadTrack] ===== 开始处理封面 =====');
    console.log('[loadTrack] t.id:', t.id);
    console.log('[loadTrack] t.cover:', t.cover ? '已设置 (' + t.cover.substring(0, 50) + '...)' : '未设置');
    console.log('[loadTrack] t.coverFetched:', t.coverFetched);
    
    // ⚠️ 优先顺序：
    // 1. localStorage 中的自定义封面（用户更换过的）- 最高优先级
    // 2. 歌曲对象中的封面
    // 3. 原始 pic_id（需要解析）
    const savedCover = localStorage.getItem('am_cover_' + t.id);
    let coverUrl = savedCover || t.cover;
    console.log('[loadTrack] 缓存封面:', savedCover ? '有' : '无');
    console.log('[loadTrack] coverUrl:', coverUrl ? '已获取 (' + coverUrl.substring(0, 50) + '...)' : '未获取');
    
    // 如果有自定义封面，更新歌曲对象并标记为已获取
    if (savedCover) {
        t.cover = savedCover;
        t.coverFetched = true;
        console.log('[loadTrack] ✅ 使用缓存的自定义封面');
    } else {
        console.log('[loadTrack] ℹ️ 没有自定义封面缓存');
    }
    
    // 如果 cover 是 pic_id（纯数字/字符串，非 URL），用 Meting API 实时解析
    // ⚠️ 必须同时满足：不是有效URL && coverFetched 为 false（未从缓存恢复）
    // 防止覆盖用户自定义的封面
    if (coverUrl && !coverUrl.startsWith('http') && !coverUrl.startsWith('data:') && !t.coverFetched) {
        console.log('[loadTrack] coverUrl 是 pic_id，开始解析...');
        const server = t.source || 'tencent';
        window.IanMusic.fetchSongPic(server, coverUrl, 2000).then(resolvedUrl => {
            if (resolvedUrl && currentTrackId === t.id) {
                applyCover(resolvedUrl, t.id, true);
            }
        });
        coverUrl = ''; // 强制走 fetchOnlineCover
    }
    
    console.log('[loadTrack] 最终 coverUrl:', coverUrl ? '有值' : '空');
    console.log('[loadTrack] 是否需要重新获取:', !coverUrl && !t.coverFetched);
    
    // 只有当没有封面且没有从缓存恢复时才去获取
    if (!coverUrl && !t.coverFetched) {
        console.log('[loadTrack] 开始重新获取封面...');
        window.IanMusic.fetchOnlineCover(t.title, t.artist).then(onlineCover => {
            if (onlineCover) {
                t.cover = onlineCover; 
                t.coverFetched = true;
                localStorage.setItem('am_cover_' + t.id, onlineCover);
                const itemInList = document.querySelector(`.list-item[data-id="${t.id}"]`);
                if(itemInList) itemInList.querySelector('.list-thumb').style.backgroundImage = `url('${onlineCover}')`;
                if(t.isLocal) updateLocalMeta(t.id, {cover: onlineCover, coverFetched: true});
                if (currentTrackId === t.id) {
                    applyCover(onlineCover, t.id, true);
                }
            }
        });
    }

    // 立即设置封面（快速响应），异步获取完成后会替换
    // 使用 null 作为 trackId 强制更新所有元素
    // 第三个参数不传（默认为 null），让 applyCover 根据自动模式决定是否提取主题色
    applyCover(coverUrl, null);
    
    // 更新浏览器标签页图标
    if (typeof refreshFavicon === 'function' && coverUrl) {
        refreshFavicon(coverUrl).catch(e => console.error('[loadTrack] favicon 更新失败:', e));
    }

    // 更新移动端标题/艺术家（封面由 applyCover 统一处理）
    const topTitle=document.getElementById('mv-title'); if(topTitle) topTitle.textContent=t.title||'未播放';
    const topArtist=document.getElementById('mv-artist'); if(topArtist) topArtist.textContent=t.artist||'—';
    const noLyricTitle=document.getElementById('no-lyric-title'); if(noLyricTitle) noLyricTitle.textContent=t.title||'未播放';
    const noLyricArtist=document.getElementById('no-lyric-artist'); if(noLyricArtist) noLyricArtist.textContent=t.artist||'—';

    updateListActiveState();

    if(autoPlay){togglePlay();} else{document.getElementById('art').classList.add('paused'); setPlayIcons(false);}

    // 歌词加载（支持 URL 和纯文本 + localStorage 缓存优先）
    const cachedLRC=localStorage.getItem('am_lyric_'+t.id);
    if(!t.savedLyrics&&cachedLRC&&(cachedLRC.includes('[00:')||_isQrcLyric(cachedLRC))){
        t.savedLyrics=cachedLRC; // 从缓存恢复
    }
    if(t.savedLyrics){
        if(t.savedLyrics.startsWith('http')){
            try{
                const lrcRes=await fetch(t.savedLyrics); const lrcJson=await lrcRes.json();
                let realLrc=lrcJson?.lyric||lrcJson?.text||'';
                if(realLrc&&realLrc.includes('[00:')){
                    if(t.isBilibili) realLrc=cleanBilibiliLyrics(realLrc);
                    playlist[curIdx].savedLyrics=realLrc; localStorage.setItem('am_lyric_'+t.id,realLrc); _callRender(realLrc);
                } else{window.IanMusic.fetchLyrics(t.title,t.artist);}
            } catch{window.IanMusic.fetchLyrics(t.title,t.artist);}
        } else{const rawLrc=t.isBilibili?cleanBilibiliLyrics(t.savedLyrics):t.savedLyrics;_callRender(rawLrc);}
    } else{window.IanMusic.fetchLyrics(t.title,t.artist);}

    syncNativeMediaCard(t.title||'未知歌曲',t.artist||'未知歌手',coverUrl,false);

    // 🎚️ 预加载下一首（交叉淡入淡出用）
    if (autoPlay) {
        setTimeout(() => _preloadNextTrack(), 500);
    }
}

audio.onloadedmetadata=function(){
    if(curIdx>=0&&playlist[curIdx]){
        const t=playlist[curIdx]; const cv=t.cover||localStorage.getItem('am_cover_'+t.id)||'';
        syncNativeMediaCard(t.title||'未知歌曲',t.artist||'未知歌手',cv,!audio.paused);
    }
};

function showHint(){
    const dlBox=document.getElementById('desktop-lyrics-box');if(dlBox)dlBox.innerHTML=`<div class="lyrics-hint">${i18n[curLang].hint}</div>`;
    const titleEl=document.getElementById('title');if(titleEl)titleEl.innerText="IAN'S MUSIC";
    const artistEl=document.getElementById('artist');if(artistEl)artistEl.innerText="Liquid Ultimate";
    const artEl=document.getElementById('art');if(artEl)artEl.style.backgroundImage='none';
    const mvTitle=document.getElementById('mv-title'); if(mvTitle) mvTitle.textContent="IAN'S MUSIC";
    const mvArtist=document.getElementById('mv-artist'); if(mvArtist) mvArtist.textContent="—";
}
function updateListActiveState(){
    const items=document.querySelectorAll('.list-item');
    items.forEach((item)=>{
        const id=item.dataset.id;
        if(id===currentTrackId){
            item.classList.add('active'); item.scrollIntoView({behavior:'smooth',block:'nearest'});
            if(!audio.paused)item.classList.add('playing'); else item.classList.remove('playing');
        } else{item.classList.remove('active','playing');}
    });
}

async function toggleLike(){if(!currentTrackId)return;const t=playlist[curIdx];t.isLiked=!t.isLiked;document.querySelectorAll('.like-btn').forEach(b=>b.classList.toggle('active',t.isLiked));if(t.isLocal)updateLocalMeta(t.id,{isLiked:t.isLiked});renderList();showToast(t.isLiked?i18n[curLang].liked:i18n[curLang].unliked);}
async function updateLocalMeta(id,changes){try{const item=await localforage.getItem(id);if(item)await localforage.setItem(id,{...item,...changes});}catch(e){}}

// 🌟 统一应用封面 + 主题色的辅助函数（所有封面更新都走这里）
// @param {string|null} coverUrl - 封面 URL，为空时使用默认 SVG
// @param {string|null} trackId - 歌曲ID，用于检查是否为当前播放歌曲
// @param {boolean} extractAccent - 是否提取主题色（默认根据自动模式决定）
function applyCover(coverUrl, trackId, extractAccent = null) {
    if (extractAccent === null) {
        extractAccent = ThemeManager.isAutoMode();
    }
    console.log('[applyCover] 开始更新封面, trackId:', trackId, 'currentTrackId:', currentTrackId);
    
    if (!coverUrl) {
        coverUrl = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI2MDAiIGhlaWdodD0iNjAwIiB2aWV3Qm94PSIwIDAgMTAwIDEwMCI+PGRlZnM+PGxpbmVhckdyYWRpZW50IGlkPSJnIiB4MT0iMCUiIHkxPSIwJSIgeDI9IjEwMCUiIHkyPSIxMDAlIj48c3RvcCBvZmZzZXQ9IjAlIiBzdG9wLWNvbG9yPSIjMmEyYTM1Ii8+PHN0b3Agb2Zmc2V0PSIxMDAlIiBzdG9wLWNvbG9yPSIjMTAxMDE2Ii8+PC9saW5lYXJHcmFkaWVudD48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9InVybCgjZykiLz48dGV4dCB4PSI1MCIgeT0iNTMiIGZvbnQtc2l6ZT0iNDAiIGZpbGw9IiNmZmZmZmYiIG9wYWNpdHk9IjAuMSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSI+8J+NtzwvdGV4dD48L3N2Zz4=';
    }
    
    // ⚠️ trackId 检查只在异步获取封面时使用，同步更新时允许更新所有元素
    // 当 trackId 为 null 时（同步调用），强制更新所有元素
    if (trackId !== null && currentTrackId !== trackId) {
        console.log('[applyCover] trackId 不匹配，跳过更新');
        return;
    }

    console.log('[applyCover] 更新封面:', coverUrl.substring(0, 50) + '...');

    // 1. 更新播放器大封面
    const art = document.getElementById('art');
    if (art) {
        art.style.transition = 'opacity 0.4s ease';
        art.style.opacity = '0';
        setTimeout(() => {
            art.style.backgroundImage = `url('${coverUrl}')`;
            art.style.opacity = '1';
        }, 200);
        console.log('[applyCover] ✅ 更新播放器封面');
    }

    // 2. 更新移动端封面
    const mvArt = document.getElementById('mv-art');
    if (mvArt) {
        mvArt.style.transition = 'opacity 0.4s ease';
        mvArt.style.opacity = '0';
        setTimeout(() => {
            mvArt.src = coverUrl;
            if (mvArt.parentElement) mvArt.parentElement.style.backgroundImage = `url('${coverUrl}')`;
            mvArt.style.opacity = '1';
        }, 200);
        console.log('[applyCover] ✅ 更新移动端封面');
    }

    // 3. 更新无歌词模式封面
    const noLyricArt = document.getElementById('no-lyric-art');
    if (noLyricArt) {
        noLyricArt.style.transition = 'opacity 0.4s ease';
        noLyricArt.style.opacity = '0';
        setTimeout(() => {
            noLyricArt.style.backgroundImage = `url('${coverUrl}')`;
            noLyricArt.style.opacity = '1';
        }, 200);
        console.log('[applyCover] ✅ 更新无歌词模式封面');
    }

    // 4. 更新桌面端背景
    const desktopBg = document.getElementById('desktop-bg');
    if (desktopBg) {
        desktopBg.style.backgroundImage = `url('${coverUrl}')`;
        console.log('[applyCover] ✅ 更新桌面端背景');
    }

    // 5. 更新移动端背景
    const mobileBg = document.getElementById('mobile-bg');
    if (mobileBg) {
        if (!coverUrl.startsWith('http') && !coverUrl.startsWith('data:')) {
            mobileBg.style.backgroundImage = 'none';
            mobileBg.style.backgroundColor = '#fa2d48';
        } else {
            mobileBg.style.backgroundImage = `url('${coverUrl}')`;
        }
        console.log('[applyCover] ✅ 更新移动端背景');
    }

    // 6. 更新 Apple Music 风格背景
    const amBg = document.getElementById('apple-music-bg');
    if (amBg) {
        if (!coverUrl.startsWith('http') && !coverUrl.startsWith('data:')) {
            amBg.classList.remove('fade-in');
            void amBg.offsetWidth;
            amBg.style.backgroundImage = 'linear-gradient(135deg,#1a0a2e 0%,#16213e 25%,#0f3460 50%,#1a1a2e 75%,#162447 100%)';
        } else {
            amBg.classList.remove('fade-in');
            void amBg.offsetWidth;
            amBg.style.backgroundImage = `url('${coverUrl}')`;
            amBg.classList.add('fade-in');
        }
        console.log('[applyCover] ✅ 更新 Apple Music 背景');
    }

    // 7. 更新浏览器标签页图标（favicon）
    // ⚠️ 使用时间戳强制刷新浏览器缓存
    // 更新所有 rel 包含 icon 的标签（可能有多个：icon, shortcut icon, apple-touch-icon 等）
    const iconLinks = document.querySelectorAll("link[rel*='icon']");
    const faviconUrl = coverUrl + (coverUrl.includes('?') ? '&' : '?') + 't=' + Date.now();
    
    if (iconLinks.length > 0) {
        iconLinks.forEach(link => {
            link.href = faviconUrl;
        });
        console.log('[applyCover] ✅ 更新所有 favicon 标签 (' + iconLinks.length + '个)');
    } else {
        // 如果没有找到，创建一个新的
        const newLink = document.createElement('link');
        newLink.rel = 'icon';
        newLink.href = faviconUrl;
        document.head.appendChild(newLink);
        console.log('[applyCover] ✅ 创建新的 favicon 标签');
    }
    console.log('[applyCover] ✅ favicon URL:', faviconUrl.substring(0, 50) + '...');

    // 8. 更新主题色（如果启用自动颜色或显式请求了提取）
    if (extractAccent) {
        const tid = trackId || currentTrackId;
        console.log('[applyCover] 触发主题色提取, trackId:', tid);
        ThemeManager.extractAndApply(coverUrl, tid);
    }

    // 9. 更新可视化背景
    if (window.IanMusic.setVisualizerCover && typeof window.IanMusic.setVisualizerCover === 'function') {
        window.IanMusic.setVisualizerCover(coverUrl);
        console.log('[applyCover] ✅ 更新可视化背景');
    }

    console.log('[applyCover] ✅ 所有封面元素更新完成');
}

window.IanMusic.togglePlay=togglePlay;window.IanMusic.next=next;window.IanMusic.prev=prev;
window.IanMusic.loadTrack=loadTrack;window.IanMusic.showHint=showHint;
window.IanMusic.setCrossfadeEnabled=setCrossfadeEnabled;
window.IanMusic.setCrossfadeDuration=setCrossfadeDuration;
window.IanMusic.updateRangeUI=updateRangeUI;window.IanMusic.updateVolume=updateVolume;
