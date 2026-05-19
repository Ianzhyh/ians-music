/**
 * @module IanMusic/download
 * @description 音乐下载 + 离线播放 — 磁盘文件存储 (songs/) + IndexedDB 降级
 */
(function() {
    'use strict';

    var downloadsDB = null;
    var _isElectron = !!(window.appRuntime && window.appRuntime.isElectron);
    var _songsDir = null;

    function _openDB() {
        if (downloadsDB) return Promise.resolve(downloadsDB);
        return new Promise(function(resolve, reject) {
            var req = indexedDB.open('ianmusic_downloads', 1);
            req.onupgradeneeded = function(e) {
                var db = e.target.result;
                if (!db.objectStoreNames.contains('files')) {
                    db.createObjectStore('files', { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains('meta')) {
                    db.createObjectStore('meta', { keyPath: 'id' });
                }
            };
            req.onsuccess = function(e) { downloadsDB = e.target.result; resolve(downloadsDB); };
            req.onerror = function(e) { reject(e.target.error); };
        });
    }

    async function _getSongsDir() {
        if (_songsDir) return _songsDir;
        if (_isElectron && window.appRuntime && window.appRuntime.songsGetDir) {
            try {
                _songsDir = await window.appRuntime.songsGetDir();
                return _songsDir;
            } catch(e) {
                console.warn('[download] songsGetDir failed:', e);
            }
        }
        return null;
    }

    async function downloadTrack(track, quality) {
        var btn = document.getElementById('download-btn');
        var prog = document.getElementById('download-progress');
        if (btn) { btn.disabled = true; btn.style.opacity = '0.5'; }
        if (prog) prog.style.display = 'block';

        var entry = null;
        try {
            var qualityBitrate = 128;
            var qualityLabel = quality || '标准';
            switch(quality) {
                case 'SQ': qualityBitrate = 999; break;
                case 'HQ': qualityBitrate = 320; break;
                case 'AAC': qualityBitrate = 256; break;
                default: qualityBitrate = 128; break;
            }

            var url = track.src || track.url || track.audioUrl;
            var server = track.source || track._source || '';
            var songId = track._songId || track.id || '';

            if (server && songId && typeof window.IanMusicUtils !== 'undefined' && window.IanMusicUtils.tryBitrate && typeof metingFetch === 'function') {
                var bitrateList = [qualityBitrate];
                if (qualityBitrate !== 128) bitrateList.push(128);
                try {
                    if (typeof showToast === 'function') showToast('正在获取 ' + qualityLabel + ' 音质链接...', '');
                    var fetchedUrl = await window.IanMusicUtils.tryBitrate(server, songId, bitrateList, metingFetch);
                    if (fetchedUrl) {
                        url = fetchedUrl;
                    } else if (qualityBitrate !== 128) {
                        if (typeof showToast === 'function') showToast(qualityLabel + ' 音质不可用，已降级为标准音质', 'warn');
                        qualityLabel = '标准';
                    }
                } catch(e) {
                    console.warn('[downloadTrack] 音质URL获取失败，使用原始URL:', e.message);
                }
            }

            if (!url) throw new Error('No audio URL');

            var resp = await fetch(url);
            if (!resp.ok) throw new Error('HTTP ' + resp.status);
            var total = parseInt(resp.headers.get('content-length') || '0');
            var reader = resp.body.getReader();
            var chunks = [];
            var received = 0;

            while (true) {
                var result = await reader.read();
                if (result.done) break;
                chunks.push(result.value);
                received += result.value.length;
                if (total > 0 && prog) {
                    var pct = Math.round((received / total) * 100);
                    prog.style.width = pct + '%';
                }
            }

            var blob = new Blob(chunks);
            var trackId = track.id || ('dl_' + Date.now());

            var songsDir = await _getSongsDir();
            if (songsDir && window.appRuntime && window.appRuntime.songsSave) {
                var arrayBuffer = await blob.arrayBuffer();
                var saveResult = await window.appRuntime.songsSave({
                    id: trackId,
                    title: track.title || track.name || 'Unknown',
                    artist: track.artist || track.author || '',
                    album: track.album || '',
                    cover: track.cover || '',
                    format: qualityLabel,
                    audioData: arrayBuffer
                });
                if (saveResult) {
                    entry = {
                        id: trackId,
                        title: track.title || track.name || 'Unknown',
                        artist: track.artist || track.author || '',
                        album: track.album || '',
                        cover: track.cover || '',
                        format: qualityLabel,
                        size: saveResult.size || blob.size,
                        downloadedAt: Date.now(),
                        audioPath: saveResult.audioPath || '',
                        _storage: 'disk',
                        lyric: '',
                        tlyric: ''
                    };
                }
            }

            if (!entry) {
                var blobUrl = URL.createObjectURL(blob);
                var db = await _openDB();
                var tx = db.transaction('files', 'readwrite');
                var store = tx.objectStore('files');
                entry = {
                    id: trackId,
                    title: track.title || track.name || 'Unknown',
                    artist: track.artist || track.author || '',
                    album: track.album || '',
                    cover: track.cover || '',
                    blobUrl: blobUrl,
                    audioBlob: blob,
                    format: qualityLabel,
                    size: blob.size,
                    downloadedAt: Date.now(),
                    _storage: 'indexeddb',
                    lyric: '',
                    tlyric: ''
                };
                await new Promise(function(resolve, reject) {
                    var req = store.put(entry);
                    req.onsuccess = function() { resolve(); };
                    req.onerror = function(e) { reject(e.target.error); };
                });
            }

            var cached = localStorage.getItem('am_lyric_' + entry.id);
            if (cached) {
                entry.lyric = cached;
                if (entry._storage === 'disk' && window.appRuntime && window.appRuntime.songsUpdateMeta) {
                    await window.appRuntime.songsUpdateMeta({ id: entry.id, lyric: cached });
                } else if (entry._storage === 'indexeddb') {
                    var db2 = await _openDB();
                    var tx2 = db2.transaction('files', 'readwrite');
                    var store2 = tx2.objectStore('files');
                    await new Promise(function(resolve, reject) {
                        var putReq = store2.put(entry);
                        putReq.onsuccess = function() { resolve(); };
                        putReq.onerror = function(e) { reject(e.target.error); };
                    });
                }
            }

            if (window.IanMusic && window.IanMusic.fetchLyrics) {
                window.IanMusic.fetchLyrics(entry.title, entry.artist);
            }

            return entry;
        } catch(err) {
            if (typeof showToast === 'function') {
                showToast('下载失败: ' + (err.message || '未知错误'), 'error');
            }
            throw err;
        } finally {
            if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
            if (prog) { prog.style.display = 'none'; prog.style.width = '0%'; }
            if (entry && typeof showToast === 'function') {
                showToast('已下载: ' + (track.title || track.name) + ' [' + (entry.format || quality || '标准') + '] ' + formatSize(entry.size) + (entry.lyric ? ' (含歌词)' : ''));
            }
        }
    }

    async function getDownloadedTracks() {
        var songsDir = await _getSongsDir();
        if (songsDir && window.appRuntime && window.appRuntime.songsList) {
            try {
                var diskTracks = await window.appRuntime.songsList();
                if (diskTracks && diskTracks.length > 0) {
                    return diskTracks.map(function(t) {
                        t._storage = 'disk';
                        return t;
                    });
                }
            } catch(e) {
                console.warn('[getDownloadedTracks] songsList failed:', e);
            }
        }

        var db = await _openDB();
        var tracks = await new Promise(function(resolve, reject) {
            var tx = db.transaction('files', 'readonly');
            var store = tx.objectStore('files');
            var req = store.getAll();
            req.onsuccess = function() { resolve(req.result || []); };
            req.onerror = function(e) { reject(e.target.error); };
        });
        tracks.forEach(function(t) {
            if (t.audioBlob instanceof Blob) {
                if (t.blobUrl) {
                    try { URL.revokeObjectURL(t.blobUrl); } catch(e) {}
                }
                t.blobUrl = URL.createObjectURL(t.audioBlob);
                delete t.audioBlob;
            }
            t._storage = t._storage || 'indexeddb';
        });
        var db2 = await _openDB();
        var tx2 = db2.transaction('files', 'readwrite');
        var store2 = tx2.objectStore('files');
        tracks.forEach(function(t) {
            try { store2.put(t); } catch(e) {}
        });
        return tracks;
    }

    async function _readDiskAudio(audioPath) {
        if (!audioPath || !window.appRuntime || !window.appRuntime.songsReadAudio) return null;
        try {
            var buffer = await window.appRuntime.songsReadAudio(audioPath);
            if (buffer) {
                var blob = new Blob([buffer]);
                return URL.createObjectURL(blob);
            }
        } catch(e) {
            console.warn('[readDiskAudio] failed:', e);
        }
        return null;
    }

    async function deleteDownloadedTrack(id) {
        var diskDeleted = false;
        var idbDeleted = false;

        // 尝试从磁盘删除
        if (window.appRuntime && window.appRuntime.songsDelete) {
            try {
                diskDeleted = await window.appRuntime.songsDelete(id);
            } catch(e) {
                console.warn('[deleteDownloadedTrack] 磁盘删除失败:', e);
            }
        }

        // 始终尝试从IndexedDB删除（歌曲可能因数字ID bug存在此处）
        try {
            var db = await _openDB();
            var tx = db.transaction('files', 'readwrite');
            var store = tx.objectStore('files');

            // 尝试字符串键
            await new Promise(function(resolve) {
                var req = store.delete(String(id));
                req.onsuccess = function() { idbDeleted = true; resolve(); };
                req.onerror = function() { resolve(); };
            });

            // 如果ID看起来像数字，也尝试数字键
            var numId = Number(id);
            if (!isNaN(numId) && String(numId) === String(id)) {
                try {
                    var tx2 = db.transaction('files', 'readwrite');
                    var store2 = tx2.objectStore('files');
                    await new Promise(function(resolve) {
                        var req = store2.delete(numId);
                        req.onsuccess = function() { idbDeleted = true; resolve(); };
                        req.onerror = function() { resolve(); };
                    });
                } catch(_) {}
            }

            // 清理可能存在的blobUrl
            try {
                var getReq = store.get(id);
                // 也可以尝试数字键
            } catch(_) {}
        } catch(e) {
            console.warn('[deleteDownloadedTrack] IndexedDB删除失败:', e);
        }

        if (diskDeleted || idbDeleted) {
            if (typeof showToast === 'function') showToast('已删除');
        } else {
            if (typeof showToast === 'function') showToast('删除失败，未找到文件', 'error');
        }
    }

    async function updateDownloadLyric(id, lyric, tlyric) {
        if (window.appRuntime && window.appRuntime.songsUpdateMeta) {
            try {
                var updated = await window.appRuntime.songsUpdateMeta({ id: id, lyric: lyric, tlyric: tlyric });
                if (updated) return;
            } catch(e) {}
        }
        var db = await _openDB();
        var tx = db.transaction('files', 'readwrite');
        var store = tx.objectStore('files');
        return new Promise(function(resolve, reject) {
            var getReq = store.get(id);
            getReq.onsuccess = function() {
                var entry = getReq.result;
                if (entry) {
                    entry.lyric = lyric || '';
                    entry.tlyric = tlyric || '';
                    var putReq = store.put(entry);
                    putReq.onsuccess = function() { resolve(); };
                    putReq.onerror = function(e) { reject(e.target.error); };
                } else {
                    resolve();
                }
            };
            getReq.onerror = function(e) { reject(e.target.error); };
        });
    }

    function formatSize(bytes) {
        if (!bytes) return '0 B';
        var units = ['B', 'KB', 'MB', 'GB'];
        var i = 0;
        while (bytes >= 1024 && i < units.length - 1) { bytes /= 1024; i++; }
        return bytes.toFixed(1) + ' ' + units[i];
    }

    async function renderOfflinePanel() {
        var container = document.getElementById('offline-list');
        if (!container) return;
        var tracks = await getDownloadedTracks().catch(function() { return []; });
        var totalSize = 0;
        tracks.forEach(function(t) { totalSize += t.size || 0; });
        var sizeStr = formatSize(totalSize);

        container.innerHTML = '';
        if (tracks.length === 0) {
            container.innerHTML = '<div style="text-align:center;padding:40px 20px;opacity:0.5;">No downloaded music yet<br><small>' + sizeStr + '</small></div>';
            return;
        }

        var header = document.createElement('div');
        header.style.cssText = 'font-size:11px;color:rgba(255,255,255,0.3);padding:8px 12px;';
        header.textContent = tracks.length + ' tracks \u00b7 ' + sizeStr;
        container.appendChild(header);

        tracks.forEach(function(t) {
            var row = document.createElement('div');
            row.className = 'offline-track-row';
            var hasLyric = t.lyric && t.lyric.length > 20;
            row.innerHTML =
                '<div class="offline-track-cover" style="background-image:url(' + (t.cover || '') + ')"></div>' +
                '<div class="offline-track-info">' +
                    '<div class="offline-track-title">' + escHtmlFn(t.title) + '</div>' +
                    '<div class="offline-track-artist">' + escHtmlFn(t.artist) + ' \u00b7 ' + (t.format || '标准') + ' \u00b7 ' + formatSize(t.size) + '</div>' +
                '</div>' +
                '<div class="offline-track-actions">' +
                    (hasLyric ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" class="offline-lyric-icon has-lyric" data-id="' + t.id + '"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>' : '') +
                    '<span class="offline-play-btn" data-id="' + t.id + '">Play</span>' +
                    '<span class="offline-delete-btn" data-id="' + t.id + '">Del</span>' +
                '</div>';
            container.appendChild(row);
        });

        container.querySelectorAll('.offline-play-btn').forEach(function(btn) {
            btn.onclick = async function() {
                var id = this.dataset.id;
                var tracks = await getDownloadedTracks();
                var t = tracks.find(function(x) { return x.id === id; });
                if (!t) return;

                var audioSrc = null;
                if (t._storage === 'disk' && t.audioPath) {
                    audioSrc = await _readDiskAudio(t.audioPath);
                }
                if (!audioSrc && t.audioBlob instanceof Blob) {
                    if (t.blobUrl) { try { URL.revokeObjectURL(t.blobUrl); } catch(e) {} }
                    audioSrc = URL.createObjectURL(t.audioBlob);
                    delete t.audioBlob;
                }
                if (!audioSrc && t.blobUrl) {
                    audioSrc = t.blobUrl;
                }

                if (audioSrc) {
                    var offlineTrack = {
                        id: t.id,
                        title: t.title,
                        artist: t.artist,
                        album: t.album || '',
                        cover: t.cover || '',
                        src: audioSrc,
                        isOffline: true,
                        isLocal: true,
                        lyric: t.lyric || '',
                        tlyric: t.tlyric || ''
                    };

                    if (typeof window.IanMusic.appendToPlaylist === 'function') {
                        window.IanMusic.appendToPlaylist(offlineTrack);
                    }
                    if (typeof window.IanMusic.loadOfflineTrack === 'function') {
                        window.IanMusic.loadOfflineTrack(offlineTrack);
                    } else {
                        if (typeof playlist !== 'undefined') {
                            playlist.push(offlineTrack);
                            if (typeof loadTrack === 'function') {
                                loadTrack(playlist.length - 1, true);
                            }
                        }
                    }
                    if (typeof toggleOfflinePanel === 'function') toggleOfflinePanel();
                } else {
                    if (typeof showToast === 'function') showToast('无法读取离线音频文件', 'error');
                }
            };
        });

        container.querySelectorAll('.offline-delete-btn').forEach(function(btn) {
            btn.onclick = async function() {
                var id = this.dataset.id;
                await deleteDownloadedTrack(id);
                renderOfflinePanel();
            };
        });

        container.querySelectorAll('.offline-lyric-icon').forEach(function(icon) {
            icon.onclick = async function() {
                var id = this.dataset.id;
                var tracks = await getDownloadedTracks();
                var t = tracks.find(function(x) { return x.id === id; });
                if (t && t.lyric && t.lyric.length > 20) {
                    showLyricModal(t.title, t.lyric);
                } else {
                    if (typeof showToast === 'function') showToast('Lyrics not available offline');
                }
            };
        });

        var storageInfo = document.getElementById('offline-storage-info');
        if (storageInfo) {
            var storagePath = 'IndexedDB: ianmusic_downloads';
            if (tracks.length > 0 && tracks[0]._storage === 'disk') {
                storagePath = await _getSongsDir() || 'songs/';
            } else if (window.IanMusic && window.IanMusic.getStoragePath) {
                storagePath = window.IanMusic.getStoragePath();
            }
            storageInfo.innerHTML =
                '<div class="offline-storage-path" style="cursor:pointer;" onclick="window.IanMusic.openStoragePath()">' +
                    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0;opacity:0.5;"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>' +
                    '<span>' + escHtmlFn(storagePath) + '</span>' +
                '</div>' +
                '<div class="offline-storage-size">' + tracks.length + ' 首歌曲 \u00b7 ' + sizeStr + '</div>';
        }
    }

    function showLyricModal(title, lyric) {
        var overlay = document.createElement('div');
        overlay.className = 'offline-lyric-modal-overlay';
        overlay.innerHTML =
            '<div class="offline-lyric-modal">' +
                '<div class="offline-lyric-modal-title">' + escHtmlFn(title) + '</div>' +
                '<div class="offline-lyric-modal-body">' + escHtmlFn(lyric) + '</div>' +
                '<button class="offline-lyric-modal-close">Close</button>' +
            '</div>';
        overlay.querySelector('.offline-lyric-modal-close').onclick = function() {
            overlay.remove();
        };
        overlay.onclick = function(e) {
            if (e.target === overlay) overlay.remove();
        };
        document.body.appendChild(overlay);
    }

    function showDownloadQualityPicker() {
        if (typeof playlist === 'undefined' || typeof curIdx === 'undefined' || !playlist[curIdx]) {
            if (typeof showToast === 'function') showToast('No track selected');
            return;
        }
        var track = playlist[curIdx];
        var currentQ = 'std';
        try { currentQ = localStorage.getItem('am_quality') || 'std'; } catch(e) {}

        var qualityMap = { sq: 'SQ', hq: 'HQ', aac: 'AAC', std: '标准' };

        var overlay = document.createElement('div');
        overlay.className = 'download-quality-overlay';
        overlay.innerHTML =
            '<div class="download-quality-modal">' +
                '<div class="download-quality-title">选择下载音质</div>' +
                '<div class="download-quality-track">' + escHtmlFn(track.title || track.name || '') + ' — ' + escHtmlFn(track.artist || track.author || '') + '</div>' +
                '<div class="download-quality-options">' +
                    '<div class="download-quality-opt' + (currentQ === 'sq' ? ' active' : '') + '" data-q="sq"><span class="dq-name">SQ 无损</span><span class="dq-desc">>800kbps · 最高音质</span></div>' +
                    '<div class="download-quality-opt' + (currentQ === 'hq' ? ' active' : '') + '" data-q="hq"><span class="dq-name">HQ 高品质</span><span class="dq-desc">320kbps · 推荐平衡</span></div>' +
                    '<div class="download-quality-opt' + (currentQ === 'aac' ? ' active' : '') + '" data-q="aac"><span class="dq-name">AAC</span><span class="dq-desc">256kbps · 较小体积</span></div>' +
                    '<div class="download-quality-opt' + (currentQ === 'std' ? ' active' : '') + '" data-q="std"><span class="dq-name">标准</span><span class="dq-desc">128kbps · 最小体积</span></div>' +
                '</div>' +
                '<div class="download-quality-hint">若所选音质不可用，将自动降级至可用音质</div>' +
                '<div class="download-quality-actions">' +
                    '<button class="dq-cancel-btn">取消</button>' +
                    '<button class="dq-confirm-btn">确认下载</button>' +
                '</div>' +
            '</div>';

        var selectedQ = currentQ;
        overlay.querySelectorAll('.download-quality-opt').forEach(function(opt) {
            opt.onclick = function() {
                overlay.querySelectorAll('.download-quality-opt').forEach(function(o) { o.classList.remove('active'); });
                opt.classList.add('active');
                selectedQ = opt.dataset.q;
            };
        });

        overlay.querySelector('.dq-cancel-btn').onclick = function() { overlay.remove(); };
        overlay.querySelector('.dq-confirm-btn').onclick = function() {
            var label = qualityMap[selectedQ] || '标准';
            overlay.remove();
            downloadTrack(track, label);
        };

        overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };
        document.body.appendChild(overlay);
    }

    function escHtmlFn(s) { var d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

    window.IanMusic.downloadTrack = downloadTrack;
    window.IanMusic.showDownloadQualityPicker = showDownloadQualityPicker;
    window.IanMusic.getDownloadedTracks = getDownloadedTracks;
    window.IanMusic.deleteDownloadedTrack = deleteDownloadedTrack;
    window.IanMusic.updateDownloadLyric = updateDownloadLyric;
    window.IanMusic.renderOfflinePanel = renderOfflinePanel;
    window.IanMusic.formatSize = formatSize;
})();
