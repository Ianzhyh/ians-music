/**
 * @module IanMusic/net-search
 * @description 网络搜歌 — Meting API 多平台搜索 + 播放 + 添加到播放列表
 */
window.IanMusic = window.IanMusic || {};

async function performNetSearch() {
    const query = document.getElementById('net-search-input').value.trim();
    const resBox = document.getElementById('net-search-results');
    if (!query) return;

    var goBtn = document.getElementById('net-search-go-btn');
    if(goBtn){goBtn.disabled=true;goBtn.textContent='...';}
    resBox.innerHTML = '<div class="spinner" style="margin-top:30px"></div>';

    const SINGLE_SPINNER = (label) => `<div style="text-align:center;padding:20px 0;">
        <div class="spinner" style="display:inline-block;"></div><div class="text-size-xs" style="opacity:0.7">搜索中...${label}</div></div>`;

    try {
        let data = [];

        // B站：独立 API
        if (currentSource === 'bilibili') {
            resBox.innerHTML = SINGLE_SPINNER('哔哩哔哩');
            data = await bilibiliSearch(query).catch(() => []);
            data = data.map(item => ({ ...item, _source: 'bilibili' }));
        } else if (currentSource === 'migu') {
            // 咪咕：直连 API
            resBox.innerHTML = SINGLE_SPINNER('咪咕');
            try {
                const r = await metingFetch(`/migu/search?id=${encodeURIComponent(query)}&limit=20`, 10000);
                const j = await r.json().catch(() => null);
                data = (j && j.data) ? j.data.map(item => ({ ...item, _source: 'migu' })) : [];
            } catch (e) { data = []; }
        } else {
            // 用户选了哪个平台就只搜哪个平台（netease / tencent / kugou / kuwo）
            const labelMap = { netease: '网易云', tencent: 'QQ音乐', kugou: '酷狗', kuwo: '酷我' };
            const label = labelMap[currentSource] || currentSource || '平台';
            resBox.innerHTML = SINGLE_SPINNER(label);
            try {
                const server = currentSource || 'kugou';
                const r = await metingFetch(`/search?server=${server}&id=${encodeURIComponent(query)}&limit=20`, 10000);
                const j = await r.json().catch(() => null);
                data = (j && j.success && j.data) ? j.data.map(item => ({ ...item, _source: server })) : [];
            } catch (e) { data = []; }
        }

        if (!data || !data.length) {
            resBox.innerHTML = `<div class="search-empty-hint">
                [WARN] 未找到 "${query}" 的相关歌曲<br>
                <button onclick="performNetSearch()" style="margin-top:12px;padding:8px 18px;background:var(--accent);border:none;border-radius:10px;color:white;cursor:pointer;">重试</button>
                <button onclick="setSource('bilibili','哔哩哔哩');document.getElementById('source-select').classList.remove('open');setTimeout(performNetSearch,100)"
                    style="margin-top:12px;margin-left:8px;padding:8px 16px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:10px;color:white;cursor:pointer;">切换 B 站</button>
            </div>`;
            return;
        }

        // 过滤 Live 版本
        const filtered = data.filter(item => !isLiveVersion(item.title || item.name || ''));

        if (!filtered.length) {
            resBox.innerHTML = `<div class="search-empty-hint">[ERR] 未找到"${query}"的相关歌曲</div>`;
            return;
        }

        const PLATFORM_TAGS = {
            netease: { label: '网易云', color: '#ec4141' },
            tencent: { label: 'QQ', color: '#2eaf6b' },
            kugou:  { label: '酷狗', color: '#2a9df4' },
            kuwo:   { label: '酷我', color: '#ff7f00' },
            migu:   { label: '咪咕', color: '#e040fb' },
            bilibili:{ label: 'B站', color: '#fb7299' },
        };

        resBox.innerHTML = '';

        // 显示当前平台名
        const tag = PLATFORM_TAGS[currentSource] || { label: currentSource || '平台' };
        const header = document.createElement('div');
        header.style.cssText = 'font-size:var(--text-2xs);font-weight:var(--weight-semibold);color:var(--accent);padding:6px 10px 4px;opacity:0.75;letter-spacing:0.3px;';
        header.textContent = `${tag.label} (${filtered.length}首)`;
        resBox.appendChild(header);

        const showCount = Math.min(filtered.length, 12);

        for (let i = 0; i < showCount; i++) {
            const item = filtered[i];
            const platform = item._source || currentSource || 'kugou';
            const tag = PLATFORM_TAGS[platform] || { label: platform, color: '#888' };
            const server = platform;

            const d = document.createElement('div'); d.className = 'list-item'; d.style.margin = '3px 0';
            d.dataset.server = server;
            d.dataset.itemId = item.id || item.songid || '';
            d.dataset.title = item.title || item.name || '';
            d.dataset.artist = (item.author || item.artist || item.singer || '').toString();
            d.dataset.pic = item.pic || item.album_id || '';
            d.dataset.lrc = item.lrc || item.lyric_id || '';
            d.dataset.bvid = item.bvid || '';

            const cover = d.dataset.pic || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23222'/%3E%3Ctext x='50' y='55' fill='%23555' font-size='28' text-anchor='middle'%3E[M]%3C/text%3E%3C/svg%3E";

            d.innerHTML = `<div class="list-thumb" style="background-image:url('${cover}')"><div style="position:absolute;bottom:0;left:0;right:0;padding:2px 4px;background:rgba(0,0,0,0.65);"><span class="search-result-badge" style="color:${tag.color};">${tag.label}</span></div></div>
            <div style="flex:1;overflow:hidden;min-width:0;"><div class="list-title search-result-title" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${item.title||item.name||''}</div><div class="list-artist search-result-artist" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${(item.author||item.artist||item.singer||'').toString().replace(/,/g,' / ')}</div></div>
            <div class="circle-btn" style="width:32px;height:32px;">\u25B6</div>`;

            d.onclick = _createSearchClickHandler();
            resBox.appendChild(d);
        }
    } catch(err) {
        console.error('聚合搜索异常:', err);
        resBox.innerHTML = `<div style="text-align:center;padding:20px;color:var(--accent);">[WARN] ${err.message}</div>`;
    }
    var goBtn2 = document.getElementById('net-search-go-btn');
    if(goBtn2){goBtn2.disabled=false;goBtn2.textContent='Go';}
}

// 搜索结果点击处理工厂
function _createSearchClickHandler() {
    return async function () {
        this.classList.add('loading-search');
        const server = this.dataset.server, itemId = this.dataset.itemId, title = this.dataset.title,
              artist = this.dataset.artist, pic = this.dataset.pic, lrcUrl = this.dataset.lrc, bvid = this.dataset.bvid;
        let songUrl = '', lyrics = '', coverUrl = '', urlData = null;
        try {
            // 1. 歌词（不阻塞播放）
            if (lrcUrl) { _lastLrcUrl = lrcUrl; try { lyrics = await fetchLRCWithGBKFallback(lrcUrl); } catch (_) {}
                if (!lyrics && server === 'migu' && itemId) {
                    try {
                        const lrcRes = await metingFetch(`/migu/lyric?id=${itemId}`, 5000);
                        const lrcJson = await lrcRes.json().catch(() => null);
                        if (lrcJson?.success && lrcJson.lyric) lyrics = lrcJson.lyric;
                    } catch (_) {}
                }
                let lrcContent = ''; try { const lrcJson = JSON.parse(lyrics); lrcContent = lrcJson.lyric || lrcJson.text || ''; } catch { lrcContent = lyrics.trim(); } lyrics = lrcContent; }

            // 2. 获取播放地址（B站独立 / Meting通用）
            if (!songUrl) {
                if (server === 'bilibili' && bvid) {
                    songUrl = await Promise.race([bilibiliGetUrl(bvid), new Promise((_, r) => setTimeout(() => r(null), 10000))]);
                    if (!songUrl) throw new Error('B站音频获取超时');
                } else if (server === 'migu') {
                    urlData = await Promise.race([
                        metingFetch(`/migu/url?id=${itemId}`, 8000).then(r => r.json()).catch(() => ({})),
                        new Promise(r => setTimeout(() => r({}), 9000))
                    ]);
                    songUrl = urlData.url || '';
                } else {
                    // 优先尝试最高码率(999)，部分QQ音乐歌曲只有高码率链接
                    const tryBitrate = async (br) => {
                        const d = await Promise.race([
                            metingFetch(`/url?server=${server}&id=${itemId}&r=${br}`, 8000).then(r => r.json()).catch(() => ({})),
                            new Promise(r => setTimeout(() => r({}), 9000))
                        ]);
                        console.log(`[url] r=${br}, itemId=${itemId}, data:`, d);
                        return d.data?.url || '';
                    };
                    songUrl = await tryBitrate(999);
                    if (!songUrl) songUrl = await tryBitrate(320);
                    console.log('[url] final songUrl:', songUrl);
                }
            }

            if (!songUrl) {
                let hint = (urlData && urlData.message) || '版权限制，无法获取播放链接';
                if (server !== 'tencent' && (!urlData || !urlData.message)) {
                    hint += '\n[TIP] 当前仅配置了 QQ音乐 的 Cookie';
                }
                throw new Error(hint);
            }

            // 3. 封面URL
            if (pic && !pic.startsWith('http') && server !== 'bilibili') {
                try {
                    const picRes = await metingFetch(`/pic?server=${server}&id=${pic}&size=2000`, 8000);
                    if (picRes.redirected && picRes.url) coverUrl = picRes.url;
                    else {
                        const picJson = await picRes.json().catch(() => null);
                        if (picJson?.success && picJson?.data) {
                            const u = typeof picJson.data === 'string' ? picJson.data : (picJson.data.url || picJson.data);
                            if (u) coverUrl = u;
                        }
                    }
                } catch (_) {}
            } else if (pic) { coverUrl = pic; }

            addNetTrack({ id: itemId, src: songUrl, title: title, artist: artist, cover: coverUrl, lrc: lyrics, bvid: bvid, isBilibili: !!bvid, source: server });
        } catch (err) {
            console.error('播放失败:', err);
            showToast(i18n[curLang].playError + ': ' + (err.message || 'Unknown'), 'error');
        } finally {
            this.classList.remove('loading-search');
        }
    };
}

async function playMetingTrack(item, el){
    el?.classList.add('loading-search');
    const src=item.url||item.src;if(!src){showToast(i18n[curLang].noAudioUrl, 'error');el?.classList.remove('loading-search');return;}
    const server = item.source || item.server || 'tencent';
    const songId = item.id || item.songid || '';

    // 优先用搜索结果已有的字段（/album/duration等），/song 只用于补全缺失字段
    let extraInfo = {
        album: item.album || '',
        cover: item.pic || item.cover || '',
        albumId: item.album_id || '',
        lyricId: item.lyric_id || '',
        duration: item.duration || 0,
        publishDate: item.publishDate || item.publish_time || ''
    };
    if (songId && window.IanMusic?.fetchSongDetail) {
        try {
            // 把搜索结果 item 直接传进去，避免 /song 字段不全的问题
            const detail = await window.IanMusic.fetchSongDetail(server, songId, item);
            if (detail) {
                extraInfo.album      = detail.album      || extraInfo.album;
                extraInfo.cover      = detail.pic        || extraInfo.cover;
                extraInfo.albumId    = detail.albumId   || extraInfo.albumId;
                extraInfo.lyricId    = detail.lyricId   || extraInfo.lyricId;
                extraInfo.duration   = detail.duration  || extraInfo.duration;
                extraInfo.publishDate= detail.publishDate || extraInfo.publishDate;
                if (!extraInfo.cover && detail.pic) {
                    extraInfo.cover = await window.IanMusic.fetchSongPic(server, detail.pic) || extraInfo.cover;
                }
            }
        } catch(e) { /* 静默失败，用搜索结果已有数据 */ }
    }

    const newId=item.id||(Date.now().toString());const newTrack={
        id:newId,src:src,title:(item.title||item.name||i18n[curLang].unknownSong),
        artist:(item.author||item.artist||i18n[curLang].unknownSinger).toString(),
        cover:extraInfo.cover,
        album: extraInfo.album,
        duration: extraInfo.duration,
        publishDate: extraInfo.publishDate,
        group:i18n[curLang].onlineGroup,savedLyrics:'',
        isBilibili:!!(item.source==='bilibili'),bvid:item.bvid||'',isLocal:false,
        source: server
    };
    playlist.push(newTrack);loadTrack(playlist.length-1,true);
    el?.classList.remove('loading-search');
}

window.IanMusic.performNetSearch = performNetSearch;

// ==============================================
// [Link] Load playlist / song from link
// ==============================================
async function performPlaylistFromLink() {
    const input = document.getElementById('playlist-link-input');
    const resultsBox = document.getElementById('playlist-import-results');
    const link = (input?.value || '').trim();

    if (!link) {
        resultsBox.innerHTML = '<div class="search-loading-hint">' + i18n[curLang].pasteLinkFirst + '</div>';
        return;
    }

    resultsBox.innerHTML = '<div class="search-loading-hint">' + i18n[curLang].loadingText + '</div>';

    try {
        // Detect platform + extract ID
        const parsed = parseLink(link);
        if (!parsed) {
            resultsBox.innerHTML = '<div class="search-loading-hint">' + i18n[curLang].unsupportedLink + '</div>';
            return;
        }

        const { server, id } = parsed;

        // Fetch playlist or song detail
        let items = [];
        let playlistName = null; // 歌单名称，用于自动创建同名分组
        if (link.includes('/playlist') || link.includes('playlist')) {
            const r = await metingFetch(`/playlist?server=${server}&id=${id}`, 12000);
            const j = await r.json().catch(() => ({}));
            items = (j.data || []).filter(i => !isLiveVersion(i.name || ''));
            // 尝试从API返回中提取歌单名称
            playlistName = j.name || j.title || j.playlist_name || null;
        } else {
            // Single song
            const r = await metingFetch(`/song?server=${server}&id=${id}`, 8000);
            const j = await r.json().catch(() => ({}));
            if (j.success && j.data) {
                const d = Array.isArray(j.data) ? j.data[0] : j.data;
                items = [d];
            }
        }

        if (items.length === 0) {
            resultsBox.innerHTML = '<div class="search-loading-hint">' + i18n[curLang].noPlayableSongs + '</div>';
            return;
        }

        resultsBox.innerHTML = '';

        const header = document.createElement('div');
        header.style.cssText = 'font-size:var(--text-2xs);font-weight:var(--weight-semibold);color:var(--accent);padding:6px 8px 2px;opacity:0.8';
        header.textContent = playlistName ? `[List] ${playlistName} (${items.length} songs)` : '[List] ' + i18n[curLang].playlistSongsFmt.replace('{count}', items.length);
        resultsBox.appendChild(header);

        const addAllBtn = document.createElement('button');
        addAllBtn.style.cssText = 'width:100%;margin-bottom:8px;padding:8px;background:var(--accent);border:none;border-radius:8px;color:white;font-size:var(--text-xs);font-family:var(--font-body);font-weight:var(--weight-semibold);cursor:pointer;';
        addAllBtn.textContent = playlistName ? `Add all to "${playlistName}"` : i18n[curLang].addAllSongsFmt.replace('{count}', items.length);
        addAllBtn.onclick = async () => {
            addAllBtn.disabled = true;
            addAllBtn.textContent = i18n[curLang].importingText;
            let addedCount = 0;
            for (const item of items) {
                const ok = await addItemToPlaylist(item, server, playlistName, { silent: true });
                if(ok) addedCount++;
            }
            renderList();
            saveOnlineTracks();
            togglePlaylistImportModal(false);
            if(addedCount > 0) loadTrack(playlist.length - addedCount, true);
            showToast(playlistName ? i18n[curLang].importedFmt.replace('{count}', addedCount) : i18n[curLang].addedFmt.replace('{count}', addedCount), 'success');
            addAllBtn.disabled = false;
        };
        resultsBox.appendChild(addAllBtn);

        for (const item of items) {
            const d = document.createElement('div');
            d.className = 'list-item';
            d.style.margin = '3px 0';
            d.dataset.server = server;
            d.dataset.itemId = item.id || item.songid || '';
            d.dataset.title = item.name || item.title || '';
            d.dataset.artist = (item.author || item.artist || '').toString();
            d.dataset.lrc = item.lyric_id || '';
            d.dataset.picId = item.pic_id || item.pic || '';
            d.dataset.bvid = '';

            const placeholder = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23222'/%3E%3Ctext x='50' y='52' fill='%23444' font-size='24' text-anchor='middle' dominant-baseline='middle'%3E[M]%3C/text%3E%3C/svg%3E";
            d.innerHTML = `
            <div class="list-thumb" style="background-image:url('${placeholder}');background-size:cover;background-position:center;"></div>
            <div style="flex:1;overflow:hidden;"><div class="list-title search-result-title" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${item.name||item.title||''}</div><div class="list-artist search-result-hint" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${(item.author||item.artist||[]).toString().replace(/,/g,' / ')}</div></div>
            <div class="circle-btn" style="width:32px;height:32px;flex:none;">\u25B6</div>`;

            // Load cover directly from platform CDN
            const picId = item.pic_id || item.pic || '';
            const thumb = d.querySelector('.list-thumb');
            if (picId && thumb) {
                let coverUrl = null;
                if (server === 'tencent') {
                    coverUrl = `https://y.gtimg.cn/music/photo_new/T002R800x800M000${picId}.jpg`;
                } else if (server === 'netease') {
                    coverUrl = `https://p1.music.126.net/${picId}/${picId}.jpg?param=800y800`;
                }
                if (coverUrl) {
                    thumb.style.backgroundImage = `url('${coverUrl}')`;
                }
            }

            d.onclick = async function () {
                this.classList.add('loading-search');
                await addItemToPlaylist({
                    name: this.dataset.title,
                    author: this.dataset.artist,
                    pic: this.dataset.picId,
                    lyric_id: this.dataset.lrc,
                    id: this.dataset.itemId,
                    source: server
                }, server, playlistName);
                this.classList.remove('loading-search');
            };
            resultsBox.appendChild(d);
        }

    } catch(err) {
        console.error('Playlist load failed:', err);
        resultsBox.innerHTML = `<div class="search-loading-hint">[WARN] ${err.message}</div>`;
    }
}

// Parse platform + ID from various link formats
function parseLink(link) {
    // Tencent playlist: https://y.qq.com/n/ryqq_v2/playlist/9698708241
    // Tencent song: https://y.qq.com/n/ryqq/songDetail/0039MnYb0qxYhV
    // Netease playlist: https://music.163.com/playlist?id=123456
    // Netease song: https://music.163.com/song?id=123456
    // Kugou/kuwo: just ID

    try {
        const url = new URL(link);

        if (url.host.includes('qq.com') || url.host.includes('tencent')) {
            if (link.includes('/playlist')) {
                const m = link.match(/\/playlist\/(\d+)/);
                return m ? { server: 'tencent', id: m[1] } : null;
            }
            const m = link.match(/[?&]id=([^&]+)/) || link.match(/\/songDetail\/([^/?]+)/);
            return m ? { server: 'tencent', id: m[1] } : null;
        }
        if (url.host.includes('music.163.com')) {
            const m = link.match(/[?&]id=(\d+)/);
            return m ? { server: 'netease', id: m[1] } : null;
        }
        // Fallback: just return the string as-is if it looks like an ID
        if (/^\d+$/.test(link)) {
            return { server: 'tencent', id: link };
        }
        // If it looks like a Meting ID format (no slashes, alphanumeric)
        if (/^[a-zA-Z0-9]+$/.test(link)) {
            return { server: 'tencent', id: link };
        }
    } catch(_) {}

    // Plain ID fallback
    if (/^\d+$/.test(link) || /^[a-zA-Z0-9]{5,}$/.test(link)) {
        return { server: 'tencent', id: link };
    }
    return null;
}

// Add a single item to playlist (reuses existing play logic)
async function addItemToPlaylist(item, server, groupName, opts) {
    const songId = item.id || item.songid || '';
    if (!songId) return false;

    let songUrl = '';
    try {
        const tryBitrate = async (br) => {
            const d = await Promise.race([
                metingFetch(`/url?server=${server}&id=${songId}&r=${br}`, 8000).then(r => r.json()).catch(() => ({})),
                new Promise(r => setTimeout(() => r({}), 9000))
            ]);
            return d.data?.url || '';
        };
        songUrl = await tryBitrate(999);
        if (!songUrl) songUrl = await tryBitrate(320);
    } catch(_) {}

    let lyrics = '';
    try {
        if (songId) {
            const lrcRes = await metingFetch(`/lyric?server=${server}&id=${songId}`, 6000);
            const lrcJson = await lrcRes.json().catch(() => ({}));
            const raw = lrcJson.lrc?.lyric || lrcJson.lyric || '';
            if (raw) {
                // Debug: log raw & decoded lyrics
                console.log('[lyrics] Raw lyrics:', JSON.stringify(raw.slice(0, 300)));
                const decoded = decodeHtmlEntities(raw);
                console.log('[lyrics] Decoded:', JSON.stringify(decoded.slice(0, 300)));
                lyrics = decoded;
            }
        }
    } catch(_) {}

    // Build cover URL from pic_id
    let coverUrl = item.pic || '';
    const picId = item.pic_id || item.pic || '';
    if (picId && !coverUrl.startsWith('http')) {
        if (server === 'tencent') {
            coverUrl = `https://y.gtimg.cn/music/photo_new/T002R800x800M000${picId}.jpg`;
        } else if (server === 'netease') {
            coverUrl = `https://p1.music.126.net/${picId}/${picId}.jpg?param=800y800`;
        }
    }

    return addNetTrack({
        id: songId,
        src: songUrl,
        title: item.name || item.title || 'Unknown',
        artist: (item.author || item.artist || '').toString(),
        cover: coverUrl,
        lrc: lyrics,
        bvid: '',
        isBilibili: false,
        source: server,
        customGroup: groupName || ''
    }, opts);
}

// Decode HTML entities in lyrics (handles &#xHHHH; &#DDDD; etc.)
function decodeHtmlEntities(str) {
    return str.replace(/&#(x[0-9a-fA-F]+|\d+);/g, (_, code) => {
        const c = code.startsWith('x') ? parseInt(code.slice(1), 16) : parseInt(code, 10);
        return isFinite(c) ? String.fromCharCode(c) : _;
    });
}

window.IanMusic.performPlaylistFromLink = performPlaylistFromLink;
