/**
 * @module IanMusic/playlist
 * @description 歌单管理 — 加载库/渲染列表/导入导出/删除/移动/搜索过滤
 * ⚠️ 全部还原自原始 index.html，确保功能100%一致
 */
window.IanMusic = window.IanMusic || {};

let _objectURLs = [];
const _db = localforage.createInstance({ name: 'ianmusic', storeName: 'playlist' });
const _coverDB = localforage.createInstance({ name: 'ianmusic', storeName: 'covers' });
window.IanMusicUtils._coverDB = _coverDB;

function _revokeObjectURL(url) {
    if (url && url.startsWith('blob:')) {
        URL.revokeObjectURL(url);
        const idx = _objectURLs.indexOf(url);
        if (idx !== -1) _objectURLs.splice(idx, 1);
    }
}

function _fmtTime(s) {
    if (!s) return '—';
    const n = parseInt(s);
    if (isNaN(n)) return s;
    const m = Math.floor(n / 60), sec = n % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
}

function _renderInfo(box, track, isLocal, extraHtml) {
    extraHtml = extraHtml || '';
    const labels = i18n[curLang] || {};
    const infoItems = [
        { label: labels.album || '专辑', value: track.album || '—' },
        { label: labels.artist || '歌手', value: track.artist || '—' },
        { label: labels.duration || '时长', value: track.duration ? _fmtTime(track.duration) : '—' },
        { label: labels.publishDate || '发行日期', value: track.publishDate || '—' },
        { label: labels.source || '来源', value: isLocal ? '本地文件' : (track.source || '网络') },
        { label: labels.group || '分组', value: track.group || labels.defaultGroup || '默认' },
    ];

    const rows = infoItems.map(item =>
        `<div style="display:flex;gap:12px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
            <span style="color:rgba(255,255,255,0.45);min-width:70px;">${item.label}</span>
            <span style="color:rgba(255,255,255,0.85);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escHtml(item.value)}</span>
        </div>`
    ).join('');

    const coverHtml = track.cover
        ? `<img src="${track.cover}" style="width:100%;max-width:200px;max-height:200px;border-radius:12px;margin:0 auto 14px;display:block;aspect-ratio:1/1;object-fit:cover;box-shadow:0 8px 32px rgba(0,0,0,0.4);" onerror="this.style.display='none'">`
        : '';

    box.innerHTML = `
        ${coverHtml}
        <div class="search-result-title" style="font-size:var(--text-md);margin-bottom:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escHtml(track.title || i18n[curLang].unknownSong)}</div>
        ${rows}
        ${extraHtml}
    `;
}

async function loadLibrary(){
    try {
        var _mOld = localStorage.getItem('am_online_tracks');
        if (_mOld) {
            await _db.setItem('online_tracks', JSON.parse(_mOld));
            localStorage.removeItem('am_online_tracks');
        }
    } catch(e) {}
    try {
        var _mKeys = [];
        for (var _mi = 0; _mi < localStorage.length; _mi++) {
            var _mk = localStorage.key(_mi);
            if (_mk && _mk.startsWith('am_cover_b64_')) _mKeys.push(_mk);
        }
        for (var _mj = 0; _mj < _mKeys.length; _mj++) {
            var _mval = localStorage.getItem(_mKeys[_mj]);
            if (_mval) await _coverDB.setItem(_mKeys[_mj], _mval);
            localStorage.removeItem(_mKeys[_mj]);
        }
    } catch(e) {}

    console.log('%c[loadLibrary] 开始加载...', 'color:#0a84ff;font-weight:bold');
    console.log('[loadLibrary] myTracks 长度:', myTracks?.length, '内容:', myTracks);

    _objectURLs.forEach(u => URL.revokeObjectURL(u));
    _objectURLs = [];

    let stored = [];
    try {
        await localforage.iterate((val, key) => {
            if (!val) return;
            if (val.blob) {
                try { const src = URL.createObjectURL(val.blob); _objectURLs.push(src); stored.push({...val, id: key, isLocal: true, src: src}); }
                catch(err) { /* skip corrupt entry */ }
            } else if (val.src) {
                stored.push({...val, id: key, isLocal: true});
            }
        });
    } catch(e) { console.error("读取本地歌曲失败:", e); }
    console.log('[loadLibrary] localforage 存储的歌曲数:', stored.length);

    let onlineStored = [];
    try {
        const onlineData = await _db.getItem('online_tracks');
        if (onlineData) {
            onlineStored = Array.isArray(onlineData) ? onlineData : JSON.parse(onlineData);
            onlineStored.forEach(t => {
                if (t.cover && (t.cover.startsWith('http') || t.cover.startsWith('data:'))) {
                    t.coverFetched = true;
                }
            });
        }
    } catch(e) { console.error("读取在线歌曲失败:", e); }
    console.log('[loadLibrary] 在线歌曲数:', onlineStored.length);

    let order = [], hiddenTracks = [];
    try { order = JSON.parse(localStorage.getItem('am_order') || '[]'); } catch(e) { localStorage.removeItem('am_order'); }
    try { hiddenTracks = JSON.parse(localStorage.getItem('am_hidden') || '[]'); } catch(e) { localStorage.removeItem('am_hidden'); }
    console.log('[loadLibrary] hiddenTracks:', hiddenTracks, 'order:', order);

    const availableDefaults = myTracks.filter(t => !hiddenTracks.includes(t.id)).map(t => ({...t, isLocal: false}));
    console.log('[loadLibrary] 过滤后的默认歌曲数:', availableDefaults.length);

    let combined = [...availableDefaults, ...stored, ...onlineStored];
    console.log('[loadLibrary] 合并后总歌曲数:', combined.length);

    // 🖼️ 恢复封面缓存（优先用 URL 缓存，其次 base64）
    // ⚠️ 先检查 URL 缓存，因为用户更换封面时会更新这个缓存
    // base64 缓存只是作为网络不可用时的备用
    for (const t of combined) {
        const savedCover = localStorage.getItem('am_cover_' + t.id);
        if (savedCover) { 
            t.cover = savedCover; 
            t.coverFetched = true;
            console.log('[loadLibrary] ✅ 恢复自定义封面:', t.id);
            continue;
        }

        const b64Cover = await _coverDB.getItem('am_cover_b64_' + t.id);
        if (b64Cover) { 
            t.cover = b64Cover; 
            t.coverFetched = true; 
            console.log('[loadLibrary] ✅ 恢复 base64 封面:', t.id);
            continue; 
        }

        const savedLrc = localStorage.getItem('am_lyric_' + t.id);
        if (savedLrc) t.savedLyrics = savedLrc;
    }

    // 🖼️ 异步补全缺失封面（自动搜索 → 转 base64 持久化）
    // ⚠️ 过滤条件：没有封面 或者 封面不是有效URL 且 没有被标记为已获取
    // 这样可以避免覆盖用户自定义的封面
    setTimeout(() => {
        const needsCover = combined.filter(t => {
            if (!t.cover) return true;
            if (t.coverFetched) return false;
            if (t.cover.startsWith('data:') || t.cover.startsWith('http')) return false;
            return true;
        });
        async function runWithConcurrency(tasks, maxConcurrency) {
            const results = [];
            let index = 0;
            async function worker() {
                while (index < tasks.length) {
                    const i = index++;
                    results[i] = await tasks[i]();
                }
            }
            const workers = Array(Math.min(maxConcurrency, tasks.length)).fill(null).map(() => worker());
            await Promise.all(workers);
            return results;
        }
        const coverTasks = needsCover.map(t => async () => {
            if (typeof fetchOnlineCover === 'function') {
                try {
                    const url = await fetchOnlineCover(t.title, t.artist);
                    if (url) {
                        t.cover = url;
                        t.coverFetched = true;
                        window.IanMusicUtils.cacheSet('am_cover_' + t.id, url);
                        if (typeof cacheCoverAsBase64 === 'function') {
                            const b64 = await cacheCoverAsBase64(url, t.id);
                            if (b64 && b64 !== url) {
                                t.cover = b64;
                                const el = document.querySelector(`.list-item[data-id="${t.id}"] .list-thumb`);
                                if (el) el.style.backgroundImage = `url('${b64}')`;
                                if (t.id === currentTrackId) {
                                    document.getElementById('art')?.style.setProperty('background-image', `url('${b64}')`);
                                }
                                return;
                            }
                        }
                        const el = document.querySelector(`.list-item[data-id="${t.id}"] .list-thumb`);
                        if (el) el.style.backgroundImage = `url('${url}')`;
                    }
                } catch(e) {
                    console.warn('[loadLibrary] 封面获取失败:', t.title, e);
                }
            }
        });
        runWithConcurrency(coverTasks, 3);
    }, 500);

    // 按保存的顺序排序
    if (order.length > 0) {
        const orderMap = new Map(order.map((id, index) => [id, index]));
        combined.sort((a, b) => {
            const oa = orderMap.has(a.id) ? orderMap.get(a.id) : Infinity;
            const ob = orderMap.has(b.id) ? orderMap.get(b.id) : Infinity;
            return oa - ob;
        });
    }

    playlist = combined;
    console.log('%c[loadLibrary] ✅ 最终 playlist 长度:', playlist.length, 'color:#30d158;font-weight:bold');
    renderList();
}

async function refreshLibrary() {
    const btn = document.querySelector('.ai-btn[onclick="refreshLibrary()"]');
    if(btn) btn.classList.add('loading');
    await loadLibrary();
    if(btn) btn.classList.remove('loading');
    showToast(i18n[curLang].refreshed, 'success');
}

function saveOrder() { localStorage.setItem('am_order', JSON.stringify(playlist.map(t => t.id))); }

function filterLibrary(query) {
    const q = query.toLowerCase();
    document.querySelectorAll('.list-item').forEach(item => {
        const txt = item.dataset.searchtext || '';
        item.style.display = txt.includes(q) ? 'flex' : 'none';
    });
}

function renderList() {
    const box = document.getElementById('list-container');
    if (!box) return; // drawer not created yet
    // 清空列表容器，防止重复渲染
    box.innerHTML = '';
    const groups = {};

    playlist.forEach((t, i) => {
        const g = t.group || i18n[curLang].defaultGroup;
        if (!groups[g]) groups[g] = [];
        groups[g].push({...t, idx: i});
    });

    Object.keys(groups).sort((a, b) => {
        if(a === i18n[curLang].defaultGroup) return -1;
        if(b === i18n[curLang].defaultGroup) return 1;
        return a.localeCompare(b);
    }).forEach(gName => {
        const items = groups[gName];
        if(items.length === 0) return;

        // 组标题（可折叠）+ 操作按钮
        const details = document.createElement('details');
        details.open = true;
        details.dataset.group = gName;
        const summary = document.createElement('summary');
        const escGName = escHtml(gName);
        summary.innerHTML = `<span class="folder-group" onclick="event.stopPropagation()">
            <span class="folder-edit" onclick="renameGroup('${escGName}')"><svg class="lib-icon-xs" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></span>
            ${escGName}
            <span class="folder-del" onclick="event.stopPropagation();delGroup('${escGName}')" title="删除整个文件夹">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
            </span>
        </span>`;
        summary.style.cssText = 'font-weight:var(--weight-bold);font-family:var(--font-display);color:rgba(255,255,255,0.9);cursor:pointer;padding:15px 20px;display:flex;align-items:center;justify-content:space-between;';
        details.appendChild(summary);

        items.forEach(t => {
            const cover = t.cover || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23333'/%3E%3Cpath d='M70 25L38 33v34c-2-.5-4.5-1-7-1-8.3 0-15 5.8-15 13s6.7 13 15 13 15-5.8 15-13V41l24-6v23c-2-.5-4.5-1-7-1-8.3 0-15 5.8-15 13s6.7 13 15 13 15-5.8 15-13V25z' fill='%23555'/%3E%3C/svg%3E";
            const d = document.createElement('div');
            d.className = 'list-item';
            d.dataset.id = t.id;
            d.dataset.idx = t.idx;
            d.dataset.searchtext = (t.title + ' ' + t.artist + ' ' + gName).toLowerCase();

            if(currentTrackId === t.id) d.classList.add('active');

            const heart = t.isLiked ? '<svg style="color:#ff2d55;margin-right:6px;width:12px;height:12px;vertical-align:-1px" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>' : '';
            const escTitle = escHtml(t.title || i18n[curLang].unknownSong);
            const escArtist = escHtml((t.artist || i18n[curLang].unknownSinger).toString().replace(/,/g, ' / '));
            d.innerHTML =
`<div class="list-thumb" style="background-image:url('${cover}')">
    <div class="playing-anim"><div class="bar"></div><div class="bar"></div><div class="bar"></div></div>
</div>
<div style="flex:1;overflow:hidden;">
    <div class="list-title">${heart}${escTitle}</div>
    <div class="list-artist">${escArtist}</div>
</div>
<div class="item-actions">
    <button class="circle-btn" onclick="event.stopPropagation();openMoveMenu(event,'${t.id}')" title="Move"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M7 17L17 7"/><path d="M7 7h10v10"/></svg></button>
    <button class="circle-btn" style="color:#fa2d48;" onclick="event.stopPropagation();delTrack(event,'${t.id}')" title="Delete">X</button>
</div>`;

            d.onclick = (e) => {
                if(e.target.closest('.item-actions') || e.target.closest('.circle-btn')) return;
                loadTrack(t.idx, true);
            };
            d.draggable = true;
            d.ondragstart = handleDragStart;
            d.ondragover = handleDragOver;
            d.ondrop = handleDrop;
            details.appendChild(d);
        });
        box.appendChild(details);
    });

    updateTopBtnsVisibility();

    // 恢复搜索框值并过滤
    const searchVal = document.getElementById('lib-search');
    if(searchVal && searchVal.value) filterLibrary(searchVal.value);
}

function addTrackDOM(track, groupIdx, trackIdx) {
    const box = document.getElementById('list-container');
    if (!box) return;
    const gName = track.group || i18n[curLang].defaultGroup;
    let details = null;
    box.querySelectorAll('details').forEach(d => {
        if (d.dataset.group === gName) details = d;
    });
    if (!details) {
        details = document.createElement('details');
        details.open = true;
        details.dataset.group = gName;
        const summary = document.createElement('summary');
        const escGName = escHtml(gName);
        summary.innerHTML = `<span class="folder-group" onclick="event.stopPropagation()">
            <span class="folder-edit" onclick="renameGroup('${escGName}')"><svg class="lib-icon-xs" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></span>
            ${escGName}
            <span class="folder-del" onclick="event.stopPropagation();delGroup('${escGName}')" title="删除整个文件夹">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
            </span>
        </span>`;
        summary.style.cssText = 'font-weight:var(--weight-bold);font-family:var(--font-display);color:rgba(255,255,255,0.9);cursor:pointer;padding:15px 20px;display:flex;align-items:center;justify-content:space-between;';
        details.appendChild(summary);
        const existingDetails = [...box.querySelectorAll('details')];
        let inserted = false;
        if (gName === i18n[curLang].defaultGroup) {
            box.insertBefore(details, box.firstChild);
            inserted = true;
        } else {
            for (const ed of existingDetails) {
                const edGroup = ed.dataset.group;
                if (edGroup === i18n[curLang].defaultGroup) continue;
                if (gName.localeCompare(edGroup) < 0) {
                    box.insertBefore(details, ed);
                    inserted = true;
                    break;
                }
            }
        }
        if (!inserted) box.appendChild(details);
    }
    const cover = track.cover || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23333'/%3E%3Cpath d='M70 25L38 33v34c-2-.5-4.5-1-7-1-8.3 0-15 5.8-15 13s6.7 13 15 13 15-5.8 15-13V41l24-6v23c-2-.5-4.5-1-7-1-8.3 0-15 5.8-15 13s6.7 13 15 13 15-5.8 15-13V25z' fill='%23555'/%3E%3C/svg%3E";
    const d = document.createElement('div');
    d.className = 'list-item';
    d.dataset.id = track.id;
    d.dataset.idx = trackIdx;
    d.dataset.searchtext = (track.title + ' ' + track.artist + ' ' + gName).toLowerCase();
    if(currentTrackId === track.id) d.classList.add('active');
    const heart = track.isLiked ? '<svg style="color:#ff2d55;margin-right:6px;width:12px;height:12px;vertical-align:-1px" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>' : '';
    const escTitle = escHtml(track.title || i18n[curLang].unknownSong);
    const escArtist = escHtml((track.artist || i18n[curLang].unknownSinger).toString().replace(/,/g, ' / '));
    d.innerHTML =
`<div class="list-thumb" style="background-image:url('${cover}')">
    <div class="playing-anim"><div class="bar"></div><div class="bar"></div><div class="bar"></div></div>
</div>
<div style="flex:1;overflow:hidden;">
    <div class="list-title">${heart}${escTitle}</div>
    <div class="list-artist">${escArtist}</div>
</div>
<div class="item-actions">
    <button class="circle-btn" onclick="event.stopPropagation();openMoveMenu(event,'${track.id}')" title="Move"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M7 17L17 7"/><path d="M7 7h10v10"/></svg></button>
    <button class="circle-btn" style="color:#fa2d48;" onclick="event.stopPropagation();delTrack(event,'${track.id}')" title="Delete">X</button>
</div>`;
    d.onclick = (e) => {
        if(e.target.closest('.item-actions') || e.target.closest('.circle-btn')) return;
        loadTrack(parseInt(d.dataset.idx), true);
    };
    d.draggable = true;
    d.ondragstart = handleDragStart;
    d.ondragover = handleDragOver;
    d.ondrop = handleDrop;
    details.appendChild(d);
    const searchVal = document.getElementById('lib-search');
    if(searchVal && searchVal.value) {
        const q = searchVal.value.toLowerCase();
        if(!d.dataset.searchtext.includes(q)) d.style.display = 'none';
    }
    updateTopBtnsVisibility();
}

function removeTrackDOM(groupIdx, trackIdx) {
    const box = document.getElementById('list-container');
    if (!box) return;
    const el = box.querySelector(`.list-item[data-idx="${trackIdx}"]`);
    if (!el) return;
    const details = el.parentElement;
    details.removeChild(el);
    if (details.querySelectorAll('.list-item').length === 0) {
        box.removeChild(details);
    }
    box.querySelectorAll('.list-item').forEach(item => {
        const idx = parseInt(item.dataset.idx);
        if (idx > trackIdx) {
            item.dataset.idx = idx - 1;
            item.onclick = (e) => {
                if(e.target.closest('.item-actions') || e.target.closest('.circle-btn')) return;
                loadTrack(parseInt(item.dataset.idx), true);
            };
        }
        item.classList.toggle('active', item.dataset.id === currentTrackId);
    });
    updateTopBtnsVisibility();
}

// ====== 网络搜歌添加到列表 ======
// ⚠️ 此 addNetTrack 是完整版（带 localforage 存储、关闭弹窗、toast）
// net-search.js 中也有一个简化版定义，以最后一个加载的为准。
// 完整版在此处定义，确保功能完整：
async function addNetTrack(t, opts = {}){
    const newId = t.id || (Date.now().toString());
    const groupName = (t.customGroup != null && t.customGroup !== '') ? t.customGroup : i18n[curLang].onlineGroup;
    
    // 去重：如果已存在相同ID的歌曲，跳过
    if(!opts.allowDup && playlist.findIndex(tr => tr.id === newId) !== -1){
        console.log('[addNetTrack] 跳过重复歌曲:', t.title, 'id=', newId);
        return false;
    }

    const newTrack = {
        id: newId,
        src: t.src,
        title: t.title || i18n[curLang].unknownSong,
        artist: t.artist || i18n[curLang].unknownSinger,
        cover: t.cover || '',
        coverFetched: !!t.cover,
        group: groupName,
        savedLyrics: t.lrc || '',
        isBilibili: !!t.isBilibili,
        bvid: t.bvid || '',
        isLocal: false,
        source: t.source || 'tencent'
    };
    playlist.push(newTrack);
    saveOrder();
    addTrackDOM(newTrack, -1, playlist.length - 1);
    await saveOnlineTracks();

    if(t.isLocal){ await localforage.setItem(newId, newTrack); }

    // 静默模式：只添加不关闭弹窗不播放（批量导入用）
    if(!opts.silent){
        toggleNetSearchModal(false);
        loadTrack(playlist.length - 1, true);
        showToast(i18n[curLang].playingTitle + t.title, 'success');
    }
    return true;
}

// Persist online tracks to localStorage (survives refresh)
async function saveOnlineTracks() {
    try {
        const online = playlist.filter(t => !t.isLocal);
        await _db.setItem('online_tracks', online);
    } catch(e) { console.warn('saveOnlineTracks failed:', e); }
}

// Restore online tracks from localStorage on page load
async function restoreOnlineTracks() {
    try {
        const stored = await _db.getItem('online_tracks');
        if (!stored) return [];
        const tracks = Array.isArray(stored) ? stored : JSON.parse(stored);
        tracks.forEach(t => {
            if (t.cover && (t.cover.startsWith('http') || t.cover.startsWith('data:'))) {
                t.coverFetched = true;
            }
        });
        return tracks;
    } catch(e) { return []; }
}

// ====== 导入文件（含 jsmediatags 元数据提取）======
async function importFiles(files) {
    let newTracks = [];
    for(let f of files) {
        if(f.name.startsWith('.')) continue;

        let grp = "Imported";
        if(f.webkitRelativePath) {
            const p = f.webkitRelativePath.split('/');
            if(p.length > 1) grp = p[0];
        }

        let tag = {};
        try {
            if(jsmediatags) tag = await new Promise(r => jsmediatags.read(f, {onSuccess: t=>r(t), onError: ()=>r({})}));
        } catch(e) {}

        let cover = null;
        if(tag.tags?.picture) {
            let data = tag.tags.picture.data, base64 = "";
            for(let i = 0; i < data.length; i++) base64 += String.fromCharCode(data[i]);
            cover = "data:" + tag.tags.picture.format + ";base64," + btoa(base64);
        }

        const meta = {
            title: tag.tags?.title || f.name.replace(/\.[^.]+$/, ""),
            artist: tag.tags?.artist || "Unknown",
            group: grp,
            blob: f,
            cover: cover
        };

        const id = 'u_' + Date.now() + '_' + Math.random().toString(36).substring(2, 11);
        await localforage.setItem(id, meta);
        const objUrl = URL.createObjectURL(f);
        _objectURLs.push(objUrl);
        newTracks.push({...meta, id: id, isLocal: true, src: objUrl});
    }
    var existingIds = new Set(playlist.map(function(tr) { return tr.id; }));
    var uniqueTracks = newTracks.filter(function(tr) { return !existingIds.has(tr.id); });
    if (uniqueTracks.length < newTracks.length) {
        var skipped = newTracks.length - uniqueTracks.length;
        if (typeof showToast === 'function') showToast('跳过 ' + skipped + ' 首重复歌曲');
    }
    playlist.push(...uniqueTracks);
    saveOrder();
    document.getElementById('file-up').value = '';
    document.getElementById('folder-up').value = '';
    renderList();
}

// ====== 删除歌曲（精准ID定位）======
async function delTrack(e, id) {
    e.stopPropagation();
    if(!await showConfirm(i18n[curLang].deleteTrack, i18n[curLang].confirmDelete, i18n[curLang].deleteLabel, i18n[curLang].cancelLabel)) return;

    const idx = playlist.findIndex(t => t.id === id);
    if(idx === -1) return;

    const itemToDelete = playlist[idx];

    _revokeObjectURL(itemToDelete.src);

    if(itemToDelete.isLocal) {
        await localforage.removeItem(itemToDelete.id);
    } else {
        const hidden = JSON.parse(localStorage.getItem('am_hidden') || '[]');
        hidden.push(itemToDelete.id);
        localStorage.setItem('am_hidden', JSON.stringify(hidden));
    }

    const wasPlaying = itemToDelete.id === currentTrackId;

    playlist.splice(idx, 1);
    saveOrder();
    await saveOnlineTracks();

    // 处理播放状态与刷新界面
    if(wasPlaying) {
        currentTrackId = null;
        audio.pause();
        if(playlist.length > 0) loadTrack(idx % playlist.length);
        else showHint();
    } else {
        curIdx = playlist.findIndex(t => t.id === currentTrackId);
    }

    removeTrackDOM(-1, idx);
}

// ====== 一键删除整个文件夹 ======
async function delGroup(groupName) {
    const count = playlist.filter(t => (t.group || i18n[curLang].defaultGroup) === groupName).length;
    if(count === 0) return;
    const delMsg = i18n[curLang].confirmDeleteFolder + ' "' + groupName + (curLang==='zh'?`" 中的 ${count} 首歌曲？此操作不可撤销。`:`" (${count} tracks)? This cannot be undone.`);
    if(!await showConfirm(i18n[curLang].deleteFolder, delMsg, i18n[curLang].deleteLabel, i18n[curLang].cancelLabel)) return;

    // 收集要删除的歌曲
    const toDelete = [];
    for(const t of playlist){
        if((t.group || i18n[curLang].defaultGroup) === groupName) toDelete.push(t);
    }

    let wasPlayingInGroup = false;
    const hidden = JSON.parse(localStorage.getItem('am_hidden') || '[]');
    for(const item of toDelete){
        if(item.id === currentTrackId) wasPlayingInGroup = true;
        _revokeObjectURL(item.src);
        if(item.isLocal) {
            await localforage.removeItem(item.id);
        } else {
            if(!hidden.includes(item.id)) hidden.push(item.id);
        }
        const idx = playlist.findIndex(t => t.id === item.id);
        if(idx !== -1) playlist.splice(idx, 1);
    }
    localStorage.setItem('am_hidden', JSON.stringify(hidden));

    saveOrder();
    await saveOnlineTracks();

    if(wasPlayingInGroup){
        currentTrackId = null;
        audio.pause();
        if(playlist.length > 0) loadTrack(0);
        else showHint();
    } else {
        curIdx = playlist.findIndex(t => t.id === currentTrackId);
    }

    renderList();
    showToast(i18n[curLang].folderDeleted + ': ' + groupName);
}

async function resetLib() {
    if(await showConfirm(i18n[curLang].resetLib, i18n[curLang].confirmReset, i18n[curLang].resetLabel, i18n[curLang].cancelLabel)) {
        await localforage.clear();
        await _db.clear();
        await _coverDB.clear();
        localStorage.removeItem('am_hidden');
        localStorage.removeItem('am_order');
        location.reload();
    }
}

async function exportData() {
    const d = [];
    await localforage.iterate((v, k) => d.push({...v, _type: 'local', _key: k}));
    const onlineTracks = await _db.getItem('online_tracks');
    if (onlineTracks) {
        const online = Array.isArray(onlineTracks) ? onlineTracks : JSON.parse(onlineTracks);
        online.forEach(t => d.push({...t, _type: 'online'}));
    }
    const b = new Blob([JSON.stringify(d)], {type:"application/json"});
    const a = document.createElement('a');
    const url = URL.createObjectURL(b);
    a.href = url;
    a.download = "liquid-music-backup.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
}

async function importData(input) {
    const file = input.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if(await showConfirm(i18n[curLang].importBackup, i18n[curLang].confirmImport, i18n[curLang].importLabel, i18n[curLang].cancelLabel)) {
                await localforage.clear();
                await _db.clear();
                await _coverDB.clear();
                localStorage.removeItem('am_hidden');
                localStorage.removeItem('am_order');
                const onlineItems = data.filter(item => item._type === 'online');
                const localItems = data.filter(item => item._type !== 'online');
                for(const item of localItems) {
                    const clean = {...item};
                    delete clean._type;
                    delete clean._key;
                    await localforage.setItem('u_' + Date.now() + '_' + Math.random(), clean);
                }
                if (onlineItems.length > 0) {
                    const cleanOnline = onlineItems.map(item => {
                        const clean = {...item};
                        delete clean._type;
                        delete clean._key;
                        return clean;
                    });
                    await _db.setItem('online_tracks', cleanOnline);
                }
                location.reload();
            }
        } catch(err) {
            showToast('[!] ' + i18n[curLang].invalidJson, 'error');
        }
    };
    reader.readAsText(file);
    input.value = '';
}

function setLanguage(lang) {
    curLang = lang;
    localStorage.setItem('am_lang', lang);
    const t = i18n[lang];
    const titlebarKeys = ['minimize', 'maximize', 'fullscreen', 'exitFullscreen', 'closeWin'];
    for(let k in t) {
        if (titlebarKeys.includes(k)) continue;
        const els = document.querySelectorAll('#txt-' + k);
        if(els.length > 0) els.forEach(el => el.innerText = t[k]);
    }
    document.querySelectorAll('[id^="txt-done"]').forEach(el => el.innerText = t.done);
    document.querySelectorAll('[id^="txt-cancel"]').forEach(el => el.innerText = t.cancel);

    const libSearchEl = document.getElementById('lib-search');
    if (libSearchEl) libSearchEl.placeholder = t.searchLibPlaceholder;
    const aiBtnText = document.getElementById('ai-btn-text');
    if (aiBtnText) aiBtnText.innerText = t.aiTranslate;
    document.getElementById('lang-en').className = lang === 'en' ? 'segment-opt active' : 'segment-opt';
    document.getElementById('lang-zh').className = lang === 'zh' ? 'segment-opt active' : 'segment-opt';

    // Blur Low/High
    const blurLow = document.getElementById('blur-low');
    const blurHigh = document.getElementById('blur-high');
    if (blurLow) blurLow.textContent = t.blurLow;
    if (blurHigh) blurHigh.textContent = t.blurHigh;

    // Settings 面板里用 hyphen-id 的项（camel key 对不上）
    const el = id => document.getElementById(id);
    if (el('txt-theme-color')) el('txt-theme-color').textContent = t.themeColor;
    if (el('txt-ai-theme-gen')) el('txt-ai-theme-gen').textContent = t.aiThemeGen;
    if (el('txt-blur-label')) el('txt-blur-label').textContent = t.blur;
    if (el('txt-lyrics-size')) el('txt-lyrics-size').textContent = t.lyricsSize;
    if (el('txt-sleep-timer')) el('txt-sleep-timer').textContent = t.sleepTimer;
    if (el('txt-custom-min')) el('txt-custom-min').textContent = t.customMin;
    if (el('txt-settings')) el('txt-settings').textContent = t.settings;
    if (el('txt-api-key')) el('txt-api-key').textContent = t.apiKey;
    if (el('txt-base-url')) el('txt-base-url').textContent = t.baseUrl;
    if (el('txt-model')) el('txt-model').textContent = t.modelName;
    if (el('txt-proxy-hint')) el('txt-proxy-hint').textContent = t.proxyHint;

    // Sleep Timer
    const sleepOff = document.getElementById('sleep-off');
    if (sleepOff) sleepOff.textContent = t.sleepOff;
    const sleepSetBtn = document.getElementById('txt-sleep-set-btn');
    if (sleepSetBtn) sleepSetBtn.textContent = t.sleepSet;
    const exportBtn = document.getElementById('txt-export-btn');
    const importBtn = document.getElementById('txt-import-btn');
    if (exportBtn) exportBtn.textContent = t.export;
    if (importBtn) importBtn.textContent = t.import;
    const resetLibBtn = document.getElementById('txt-reset-lib-btn');
    if (resetLibBtn) resetLibBtn.textContent = t.resetLib;
    const aiGoBtn = document.getElementById('txt-ai-go-btn');
    if (aiGoBtn) aiGoBtn.textContent = t.go;
    const doneBtn = document.getElementById('txt-done-btn');
    if (doneBtn) doneBtn.textContent = t.done;

    // Library 抽屉（动态创建，需要单独更新）
    const libTitle = document.querySelector('#txt-library');
    if (libTitle) libTitle.textContent = t.library;
    const drawerDone = document.getElementById('txt-drawer-done');
    if (drawerDone) drawerDone.textContent = t.drawerDone;
    const libSearch = document.getElementById('lib-search');
    if (libSearch) libSearch.placeholder = t.searchPlaceholder;
    const addFileBtn = document.getElementById('txt-add-file-btn');
    if (addFileBtn) addFileBtn.textContent = t.addFile;
    const addFolderBtn = document.getElementById('txt-add-folder-btn');
    if (addFolderBtn) addFolderBtn.textContent = t.addFolder;
    const netSearchBtn = document.getElementById('txt-net-search-btn');
    if (netSearchBtn) netSearchBtn.innerHTML = `<svg class="lib-icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg> ${t.netSearchLib}`;

    // 歌曲信息弹窗
    const songInfoTitle = document.getElementById('txt-song-info-title');
    if (songInfoTitle) songInfoTitle.textContent = t.songInfoTitle || '歌曲信息';
    const songInfoDone = document.getElementById('txt-song-info-done');
    if (songInfoDone) songInfoDone.textContent = t.done || 'Done';
    const songInfoBtn = document.getElementById('txt-song-info-btn');
    if (songInfoBtn) songInfoBtn.textContent = t.songInfoTitle || '歌曲信息';

    // First-time modal
    if (el('txt-welcome-title')) el('txt-welcome-title').textContent = t.welcome;
    if (el('txt-app-disclaimer-sub')) el('txt-app-disclaimer-sub').textContent = t.appDisclaimer;
    if (el('txt-disclaimer-1')) el('txt-disclaimer-1').textContent = t.disclaimer1;
    if (el('txt-disclaimer-2')) el('txt-disclaimer-2').textContent = t.disclaimer2;
    if (el('txt-disclaimer-3')) el('txt-disclaimer-3').textContent = t.disclaimer3;
    if (el('txt-disclaimer-4')) el('txt-disclaimer-4').textContent = t.disclaimer4;
    if (el('txt-i-understand-btn')) el('txt-i-understand-btn').textContent = t.iUnderstand;

    // Modals
    if (el('txt-ai-title-modal')) el('txt-ai-title-modal').textContent = t.aiTitle;
    if (el('txt-powered-by-badge')) el('txt-powered-by-badge').textContent = t.poweredBy;
    if (el('txt-net-search-title-modal')) el('txt-net-search-title-modal').textContent = t.netSearchTitle;
    if (el('txt-search-cover-title')) el('txt-search-cover-title').textContent = t.searchOnlineCoverTitle;
    if (el('txt-import-playlist-title')) el('txt-import-playlist-title').textContent = t.importPlaylistTitle;

    // Settings group titles
    if (el('txt-ai-api-group')) el('txt-ai-api-group').textContent = t.aiApiGroup;
    if (el('txt-music-api-group')) el('txt-music-api-group').textContent = t.musicApiGroup;
    if (el('txt-theme-display-group')) el('txt-theme-display-group').textContent = t.themeDisplayGroup;
    if (el('txt-sleep-timer-group')) el('txt-sleep-timer-group').textContent = t.sleepTimerGroup;

    // Placeholders via data-i18n attribute
    document.querySelectorAll('[data-i18n-placeholder]').forEach(function(input) {
        var key = input.getAttribute('data-i18n-placeholder');
        if (t[key] !== undefined) input.placeholder = t[key];
    });

    // QR login
    if (el('txt-qr-login-close')) el('txt-qr-login-close').textContent = t.cancel;
    if (el('txt-qr-expired')) el('txt-qr-expired').textContent = t.qrExpired;
    if (el('txt-qr-refresh')) el('txt-qr-refresh').textContent = t.clickRefresh;
    if (el('txt-qr-fetching')) el('txt-qr-fetching').textContent = t.fetchingQR;
    if (el('txt-qr-no-cookie')) el('txt-qr-no-cookie').textContent = t.noCookieManual;
    if (el('txt-qr-confirm-paste')) el('txt-qr-confirm-paste').textContent = t.confirmPaste;

    // Album buttons
    if (el('txt-search-online-img-btn')) el('txt-search-online-img-btn').textContent = t.searchOnlineImg;
    if (el('txt-local-upload-btn')) el('txt-local-upload-btn').textContent = t.localUpload;

    // Control buttons
    if (el('txt-import-local-lrc-btn')) el('txt-import-local-lrc-btn').textContent = t.importLocalLrc;

    // Confirm/prompt
    if (el('txt-confirm-cancel')) el('txt-confirm-cancel').textContent = t.cancelLabel;
    if (el('txt-confirm-ok')) el('txt-confirm-ok').textContent = t.okLabel;
    if (el('txt-prompt-cancel')) el('txt-prompt-cancel').textContent = t.cancelLabel;
    if (el('txt-prompt-ok')) el('txt-prompt-ok').textContent = t.okLabel;

    // Mobile buttons
    if (el('txt-mv-translate-btn')) el('txt-mv-translate-btn').textContent = t.aiTranslate;
    if (el('txt-mv-word-btn')) el('txt-mv-word-btn').textContent = t.lyricsStyleShort;
    if (el('txt-search-lyrics-mobile')) el('txt-search-lyrics-mobile').textContent = t.searchLyricsMobile;
    if (el('txt-song-insight-mobile')) el('txt-song-insight-mobile').textContent = t.songInsightMobile;
    if (el('txt-settings-mobile')) el('txt-settings-mobile').textContent = t.settings;
    if (el('txt-import-playlist-mobile')) el('txt-import-playlist-mobile').textContent = t.importPlaylistMobile;

    // Title bar buttons
    if (el('txt-minimize')) el('txt-minimize').title = t.minimize;
    if (el('txt-maximize')) el('txt-maximize').title = t.maximize;
    if (el('txt-close-win')) el('txt-close-win').title = t.closeWin;

    // Fullscreen button title based on current state
    var tbFs = document.getElementById('txt-fullscreen');
    if (tbFs) {
        var isFs = document.body.getAttribute('data-window-state') === 'fullscreen';
        tbFs.title = isFs ? t.exitFullscreen : t.fullscreen;
    }

    renderList();
}

function loadSettings() {
    setLanguage(localStorage.getItem('am_lang') || 'en');

    ThemeManager.init();

    setBlur(localStorage.getItem('am_blur') || '120px');
    setSize(localStorage.getItem('am_size') || 'medium');

    repeatMode = parseInt(localStorage.getItem('am_repeat') || '1');
    isShuffle = localStorage.getItem('am_shuffle') === 'true';
    updateRepeatUI();
    document.getElementById('btn-shuffle').classList.toggle('active', isShuffle);
    document.getElementById('mob-shuffle-btn').classList.toggle('active', isShuffle);
    document.getElementById('mv-shuffle-btn').classList.toggle('active', isShuffle);

    // 🎚️ 交叉淡入淡出状态恢复
    if (typeof _updateCrossfadeUI === 'function') _updateCrossfadeUI();
}

// ====== 移动分组菜单（原始版本：用 targetMoveIdx）======
function openMoveMenu(e, id) {
    e.stopPropagation();
    targetMoveIdx = playlist.findIndex(t => t.id === id);
    if(targetMoveIdx === -1) return;

    const groups = [...new Set(playlist.map(t => t.group || "Default"))];
    const list = document.getElementById('move-list');
    list.innerHTML = '';

    groups.sort().forEach(g => {
        let displayName = g;
        if(g === "Default") displayName = i18n[curLang].defaultGroup;
        if(g === "Imported") displayName = i18n[curLang].importedGroup;
        if(g === "Online") displayName = i18n[curLang].onlineGroup;

        const item = document.createElement('div');
        item.className = 'move-option';
        item.innerHTML = `<span>${escHtml(displayName)}</span>`;
        if(playlist[targetMoveIdx].group === g) item.innerHTML += `<span>✓</span>`;
        item.onclick = () => performMove(g);
        list.appendChild(item);
    });

    const createBtn = document.createElement('div');
    createBtn.className = 'move-option create';
    createBtn.innerText = i18n[curLang].create;
    createBtn.onclick = async () => {
        const newG = await showPrompt(i18n[curLang].newFolderPrompt, i18n[curLang].newFolderPrompt, '');
        if(newG) performMove(newG);
    };
    list.appendChild(createBtn);
    toggleMoveModal(true);
}

async function renameGroup(oldName) {
    const newName = await showPrompt(i18n[curLang].renamePrompt, i18n[curLang].newName, oldName);
    if(!newName || newName === oldName) return;

    let targetGroup = oldName;
    if(oldName === i18n.zh.defaultGroup) targetGroup = "Default";
    if(oldName === i18n.zh.importedGroup) targetGroup = "Imported";
    if(oldName === i18n.zh.onlineGroup) targetGroup = "Online";

    const updates = [];
    playlist.forEach(t => {
        if(t.group === targetGroup) { t.group = newName; if(t.isLocal) updates.push(t.id); }
    });

    for(let id of updates) await updateLocalMeta(id, {group: newName});
    renderList();
}

async function performMove(newGroup) {
    const t = playlist[targetMoveIdx];
    t.group = newGroup;
    if(t.isLocal) await updateLocalMeta(t.id, {group: newGroup});
    toggleMoveModal(false);
    renderList();
}

// ====== 根据歌名+歌手搜索补全本地歌曲信息 ======
const LOCAL_LOOKUP_SERVERS = ['netease', 'kugou', 'tencent', 'kuwo'];

async function lookupLocalSongInfo(title, artist, server = 'netease') {
    if (!title || !window.IanMusic?.metingFetch) return null;

    // 归一化歌名（去掉括号内容、-live 等干扰词）
    const normTitle = (t) => (t || '').replace(/\s*[\(（\[].*?[\)）\]]/g, '').replace(/[-_]?(live|版|现场)/gi, '').trim().toLowerCase();

    const tryServer = async (srv) => {
        try {
            const searchRes = await window.IanMusic.metingFetch(
                `/search?server=${srv}&id=${encodeURIComponent(title + ' ' + (artist || ''))}&limit=8`,
                12000
            );
            const searchJson = await searchRes.json();
            const results = searchJson?.data || [];
            if (!results.length) return null;

            const nt = normTitle(title);
            // 优先找歌名完全一致的结果，其次包含匹配
            const match = results.find(r => {
                const rt = normTitle(r.name || r.title || '');
                return rt === nt || nt.length > 3 && rt.includes(nt);
            }) || results[0];
            return { match, server: srv };
        } catch(e) { return null; }
    };

    // 优先用指定平台
    let result = await tryServer(server);
    // 如果指定平台没结果，轮询其他平台
    if (!result && LOCAL_LOOKUP_SERVERS.length > 1) {
        for (const srv of LOCAL_LOOKUP_SERVERS) {
            if (srv === server) continue;
            result = await tryServer(srv);
            if (result) break;
        }
    }

    if (!result) return null;

    // 使用实际搜索成功的平台获取详情
    const detail = await window.IanMusic.fetchSongDetail(result.server, result.match.id || result.match.songid || '', result.match);
    return detail;
}

// ====== 歌曲信息弹窗 ======
const SONG_INFO_SERVERS = [
    { name: 'kugou',   label: '酷狗' },
    { name: 'netease', label: '网易云' },
    { name: 'tencent', label: 'QQ音乐' },
    { name: 'kuwo',    label: '酷我' },
];
const SONG_INFO_DEFAULT_SERVER = 'kugou';

function toggleSongInfoModal(show) {
    const modal = document.getElementById('song-info-modal');
    if (!modal) return;
    modal.classList.toggle('active', show);
}

function showSongInfo() {
    const modal = document.getElementById('song-info-modal');
    const box = document.getElementById('song-info-content');
    if (!box) return;

    modal?.classList.add('active');

    if (playlist.length === 0) {
        box.innerHTML = `<div style="text-align:center;opacity:0.6;padding:20px;">${i18n[curLang].noTrackPlaying}</div>`;
        return;
    }

    const t = playlist[curIdx];
    const isLocal = t.isLocal;

    const cacheKey = `am_song_info_${t.id}`;
    const cachedInfo = JSON.parse(localStorage.getItem(cacheKey) || '{}');
    if (cachedInfo.album && !t.album) t.album = cachedInfo.album;
    if (cachedInfo.duration && !t.duration) t.duration = cachedInfo.duration;
    if (cachedInfo.publishDate && !t.publishDate) t.publishDate = cachedInfo.publishDate;
    if (cachedInfo.cover && !t.cover) t.cover = cachedInfo.cover;

    const defaultServer = t.source || SONG_INFO_DEFAULT_SERVER;

    const needSearchBar = isLocal || !t.album || !t.duration || !t.publishDate;
    
    // 初始渲染：带平台选择器和搜索按钮（仅在需要时显示）
    const searchBarHtml = needSearchBar
        ? `<div style="display:flex;gap:8px;align-items:center;margin-top:14px;width:100%;box-sizing:border-box;">
               <div class="custom-select-container" id="song-info-server-select" style="flex:1;min-width:0;max-width:calc(100% - 80px);">
                   <div class="custom-select-trigger" id="song-info-server-trigger">
                       <span>${SONG_INFO_SERVERS.find(s=>s.name===defaultServer)?.label || '网易云'}</span>
                       <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
                   </div>
               </div>
               <button id="song-info-search-btn" onclick="window.IanMusic.doSongInfoLookup()" style="background:var(--accent);border:none;border-radius:8px;padding:7px 16px;color:#fff;font-size:var(--text-sm);cursor:pointer;white-space:nowrap;font-weight:var(--weight-semibold);font-family:var(--font-body);flex-shrink:0;">
                   ${i18n[curLang].searchLabel}
               </button>
           </div>
           <div id="song-info-lookup-msg" class="search-result-artist" style="text-align:center;margin-top:8px;"></div>`
        : '';

    _renderInfo(box, t, isLocal, searchBarHtml);

    // 构建下拉选项并绑定事件
    setTimeout(() => {
        const container = document.getElementById('song-info-server-select');
        const trigger = document.getElementById('song-info-server-trigger');
        if (!container || !trigger) return;

        const defaultServer = t.source || SONG_INFO_DEFAULT_SERVER;

        // 移除旧选项
        container.querySelectorAll('.custom-options').forEach(el => el.remove());

        // 创建下拉选项 - 向上展开避免超出屏幕底部
        const optionsEl = document.createElement('div');
        optionsEl.className = 'custom-options song-info-server-dropdown';
        optionsEl.id = 'song-info-server-select-options';
        // 向上展开：bottom: 100% + marginBottom
        optionsEl.style.bottom = 'calc(100% + 8px)';
        optionsEl.style.top = 'auto';
        optionsEl.style.maxHeight = '180px';
        optionsEl.style.overflowY = 'auto';
        optionsEl.innerHTML = SONG_INFO_SERVERS.map(s =>
            `<div class="custom-option ${s.name === defaultServer ? 'selected' : ''}" data-value="${s.name}">${s.label}</div>`
        ).join('');
        container.appendChild(optionsEl);

        // 绑定点击切换
        trigger.onclick = (e) => {
            e.stopPropagation();
            const isOpen = container.classList.contains('open');
            if (isOpen) {
                container.classList.remove('open');
            } else {
                // 先关其他所有下拉
                document.querySelectorAll('.custom-select-container.open').forEach(c => c.classList.remove('open'));
                container.classList.add('open');
            }
        };

        // 选项点击
        optionsEl.querySelectorAll('.custom-option').forEach(opt => {
            opt.onclick = (e) => {
                e.stopPropagation();
                optionsEl.querySelectorAll('.custom-option').forEach(o => {
                    o.classList.remove('selected');
                });
                opt.classList.add('selected');
                trigger.querySelector('span').textContent = opt.textContent;
                container.classList.remove('open');
            };
        });

        // 自动搜索：如果需要搜索栏且没有缓存，才自动执行搜索
        const hasCachedInfo = cachedInfo.album || cachedInfo.duration;
        if (needSearchBar && !hasCachedInfo) {
            setTimeout(() => {
                window.IanMusic.doSongInfoLookup();
            }, 300);
        }
    }, 0);
}
window.IanMusic = window.IanMusic || {};
window.IanMusic.doSongInfoLookup = async function () {
    const box = document.getElementById('song-info-content');
    // 从自定义下拉的 fixed 下拉读取选中值（直接找有 selected class 的那个）
    const selectedOpt = document.querySelector('#song-info-server-select-options .custom-option.selected');
    const server = selectedOpt?.dataset.value || 'tencent';
    const msg = document.getElementById('song-info-lookup-msg');
    const btn = document.getElementById('song-info-search-btn');

    if (playlist.length === 0) return;
    const t = playlist[curIdx];
    const isLocal = t.isLocal;

    if (btn) { btn.disabled = true; btn.textContent = i18n[curLang].searchingText; }
    if (msg) msg.textContent = i18n[curLang].searchingMsg;

    try {
        const detail = await lookupLocalSongInfo(t.title, t.artist, server);
        if (!detail) throw new Error('no result');

        const changed = {};
        if (!t.album && detail.album) { changed.album = detail.album; t.album = detail.album; }
        if (!t.duration && detail.duration) { changed.duration = detail.duration; t.duration = detail.duration; }
        if (!t.publishDate && detail.publishDate) { changed.publishDate = detail.publishDate; t.publishDate = detail.publishDate; }
        if (!t.cover && detail.pic) {
            const picUrl = await window.IanMusic.fetchSongPic(server, detail.pic) || '';
            if (picUrl) { changed.cover = picUrl; t.cover = picUrl; }
        }

        // 持久化到 localforage（本地歌曲）
        if (isLocal && t.id && Object.keys(changed).length > 0) {
            if (window.updateLocalMeta) await window.updateLocalMeta(t.id, changed);
        }
        
        // 缓存专辑信息到 localStorage（所有歌曲）
        if (t.id && detail.album) {
            const cacheKey = `am_song_info_${t.id}`;
            const cached = JSON.parse(localStorage.getItem(cacheKey) || '{}');
            window.IanMusicUtils.cacheSet(cacheKey, JSON.stringify({
                ...cached,
                album: detail.album,
                duration: detail.duration || cached.duration,
                publishDate: detail.publishDate || cached.publishDate,
                cover: t.cover || cached.cover,
                updatedAt: Date.now()
            }));
        }

        if (msg) msg.textContent = i18n[curLang].playlistFound + (detail.album || '') + (detail.duration ? ' ' + _fmtTime(detail.duration) : '');
        if (changed.album || changed.duration) {
            setTimeout(() => _renderInfo(document.getElementById('song-info-content'), t, isLocal, ''), 1200);
        }
    } catch(e) {
        if (msg) msg.textContent = i18n[curLang].playlistNotFound;
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = i18n[curLang].searchLabel; }
    }
};

window.IanMusic.loadLibrary = loadLibrary;
window.IanMusic.refreshLibrary = refreshLibrary;
window.IanMusic.renderList = renderList;
window.IanMusic.importFiles = importFiles;
window.IanMusic.delTrack = delTrack;
window.IanMusic.delGroup = delGroup;
window.IanMusic.resetLib = resetLib;
window.IanMusic.exportData = exportData;
window.IanMusic.importData = importData;
window.IanMusic.setLanguage = setLanguage;
window.IanMusic.loadSettings = loadSettings;
window.IanMusic.openMoveMenu = openMoveMenu;
window.IanMusic.performMove = performMove;
window.IanMusic.addNetTrack = addNetTrack;
window.IanMusic.showSongInfo = showSongInfo;
window.IanMusic.toggleSongInfoModal = toggleSongInfoModal;
