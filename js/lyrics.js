/**
 * @module IanMusic/lyrics
 * @description 全网瀑布流歌词引擎 — 智能匹配/多源备援/LRC解析/高亮滚动
 */
window.IanMusic = window.IanMusic || {};

// 歌词高亮缓存 + PoloMusic 位移系统
let _lastDesktopActive = null;
let _lastDeskActiveIdx = -1;
let _deskScrollY = 0;
let _lastMobActiveIdx = -1;
let _mobScrollY = 0;
let _lyricLeftAlign = localStorage.getItem('am_lyric_align') === 'left';
let _userScrolling = false;
let _scrollResumeTimer = null;
let _cachedLines = [];
let _cachedMobLines = [];
let _cachedLineChars = new Map();
let _cachedMobLineChars = new Map();
let _cachedQrcChars = new Map();

// ===== 全网瀑布流智能聚合歌词引擎 =====
async function fetchLyrics(t, a) {
    _cachedLines=[]; _cachedMobLines=[]; _cachedLineChars.clear(); _cachedMobLineChars.clear(); _cachedQrcChars.clear();
    const box = document.getElementById('desktop-lyrics-box');
    if(box){box.innerHTML = `<div style="display:flex; flex-direction:column; align-items:center; gap:15px;"><div class="spinner"></div><div id="lyric-status" class="search-result-title" style="color:var(--accent);">正在全网节点匹配歌词...</div></div>`;box.classList.add('centered-overlay');}

    const myReqId = ++lyricReqId;
    // 🔒 记录当前歌曲ID，防止异步请求完成时已经切歌，导致保存到错误歌曲
    const targetTrackId = currentTrackId;
    const targetTrackIdx = curIdx;
    const query = `${t} ${a}`;

    // 🔥 第一优先：localStorage 缓存（切歌/刷新都不需要重新请求）
    if(targetTrackId){
        const cachedLRC=localStorage.getItem('am_lyric_'+targetTrackId);
        if(cachedLRC){
            // QRC 结构化数据缓存（JSON数组）
            if(cachedLRC.startsWith('[')){
                try{
                    const parsed=JSON.parse(cachedLRC);
                    if(Array.isArray(parsed)&&parsed.length>0&&parsed[0].chars){
                        if(myReqId===lyricReqId){ applyFetchedLyrics(parsed, targetTrackId, targetTrackIdx); return; }
                    }
                }catch(e){}
            }
            // 普通LRC缓存
            if(cachedLRC.includes('[00:')){
                if(myReqId===lyricReqId){ applyFetchedLyrics(cachedLRC, targetTrackId, targetTrackIdx); return; }
            }
        }
    }

    // 第二优先：用上次已知 lrc URL 缓存复用（同一首歌的连续请求）
    if (_lastLrcUrl) {
        try {
            const lrcText = await fetchLRCWithGBKFallback(_lastLrcUrl);
            let lrcContent = '';
            try { const lrcJson = JSON.parse(lrcText); lrcContent = lrcJson.lyric || lrcJson.text || ''; }
            catch { lrcContent = lrcText.trim(); }
            if (lrcContent.includes('[00:') && myReqId === lyricReqId) {
                applyFetchedLyrics(lrcContent, targetTrackId, targetTrackIdx);
                return;
            }
        } catch (_) {}
    }

    // 智能最佳匹配算法（优先精确匹配，降级时取第一个结果）
    const pickBestMatch = (data, song, artist) => {
        if (!data || data.length === 0) return null;
        const nonLive = data.filter(item => !isLiveVersion(item.title));
        const liveOnly = data.filter(item => isLiveVersion(item.title));
        const pickFrom = (arr) => {
            if (!arr || arr.length === 0) return null;
            // 1. 精确匹配：歌手+歌名都匹配
            const strict = arr.find(item =>
                item.author && item.title &&
                (item.author.includes(artist) || artist.includes(item.author)) &&
                (item.title.includes(song) || song.includes(item.title))
            );
            if (strict) return strict;
            // 2. 歌名相似（去掉括号内容后比较）
            const byTitle = arr.find(item => {
                if (!item.title) return false;
                const t = item.title.toLowerCase();
                const s = song.toLowerCase();
                const tClean = t.replace(/[（(][^)）]*[)）]/g, '').trim();
                const sClean = s.replace(/[（(][^)）]*[)）]/g, '').trim();
                if (tClean === sClean || tClean.includes(sClean) || sClean.includes(tClean)) return true;
                // 模糊匹配：关键词重叠
                const sWords = sClean.split(/\s+/).filter(w => w.length > 1);
                return sWords.some(w => tClean.includes(w)) && sWords.filter(w => tClean.includes(w)).length >= Math.ceil(sWords.length / 2);
            });
            if (byTitle) return byTitle;
            // 3. 歌手匹配 + 歌名部分匹配
            const byBoth = arr.find(item => {
                if (!item.author || !item.title) return false;
                const artistOk = item.author.includes(artist) || artist.includes(item.author);
                if (!artistOk) return false;
                const t = item.title.toLowerCase().replace(/[（(][^)）]*[)）]/g, '').trim();
                const s = song.toLowerCase().replace(/[（(][^)）]*[)）]/g, '').trim();
                return t.includes(s) || s.includes(t) || t === s;
            });
            if (byBoth) return byBoth;
            // 4. 降级：返回第一个有歌词ID的结果
            return arr.find(item => item.lyric_id || item.id || item.url_id) || arr[0];
        };
        return pickFrom(nonLive) || pickFrom(liveOnly);
    };

    // 歌词搜索策略（QQ音乐QRC优先 → 网易云 → 酷我 → LRCLIB）
    const strategies = [
        async () => {
            // QQ音乐 QRC 逐字歌词（需本地API+Cookie在cookies.json已配置）
            const localMeting = (window.IanMusic && window.IanMusic.localMetingApi) || '';
            const qqCookie = (window.IanMusic && window.IanMusic.qqmusicCookie) || '';

            // 🚀 metingFetch 优先用 localhost:3300，后端 cookies.json 有 Cookie 即可
            // 不需要前端额外配置 localMetingApi / qqmusicCookie 也能用
            console.log('[Lyrics] 🎵 开始QQ音乐QRC歌词搜索:', query);

            try {
                const res = await metingFetch(`/search?server=tencent&id=${encodeURIComponent(query)}`);

                // 验证响应状态
                if (!res || !res.ok) {
                    console.warn('[Lyrics] ⚠️ QQ音乐搜索失败:', res ? res.status : '无响应');
                    throw new Error(`QQ音乐搜索请求失败 (HTTP ${res ? res.status : '无响应'})`);
                }

                // 安全解析JSON
                let json;
                try {
                    json = await res.json();
                } catch (jsonErr) {
                    console.error('[Lyrics] ❌ QQ音乐搜索响应解析失败:', jsonErr.message);
                    // 尝试获取原始文本以便调试
                    const text = await res.text().catch(() => '');
                    console.error('[Lyrics] 原始响应:', text.slice(0, 300));
                    throw new Error('QQ音乐搜索返回非JSON格式数据（可能API服务未启动或网络问题）');
                }

                const data = json.data || json;
                if (!data || data.length === 0) {
                    console.log('[Lyrics] ℹ️ QQ音乐未找到歌曲');
                    throw new Error("QQ音乐未找到");
                }

                const target = pickBestMatch(data, t, a);
                if (!target) {
                    console.log('[Lyrics] ℹ️ QQ音乐未找到精确匹配');
                    throw new Error("QQ音乐未找到匹配");
                }
                const songId = target.id || target.url_id || target.lyric_id || '';
                const songMid = target.url_id || '';
                if (!songId) {
                    console.warn('[Lyrics] ⚠️ QQ音乐歌曲缺少ID字段');
                    throw new Error("QQ音乐无ID");
                }

                console.log('[Lyrics] ✅ 找到歌曲，ID:', songId, 'Mid:', songMid);

                const lrcRes = await metingFetch(`/tencent/lyric-raw?id=${encodeURIComponent(songId)}&songmid=${encodeURIComponent(songMid)}`, 15000);

                // 验证歌词响应
                if (!lrcRes || !lrcRes.ok) {
                    console.warn('[Lyrics] ⚠️ QRC歌词请求失败:', lrcRes ? lrcRes.status : '无响应');
                    throw new Error(`QRC歌词请求失败 (HTTP ${lrcRes ? lrcRes.status : '无响应'})`);
                }

                // 安全解析歌词JSON
                let lrcJson;
                try {
                    lrcJson = await lrcRes.json();
                } catch (jsonErr) {
                    console.error('[Lyrics] ❌ QRC歌词响应解析失败:', jsonErr.message);
                    // 尝试获取原始文本
                    const text = await lrcRes.text().catch(() => '');
                    console.error('[Lyrics] QRC原始响应:', text.slice(0, 500));
                    throw new Error('QRC歌词返回非JSON格式（可能后端解密失败或服务异常）\n提示: 请检查控制台详细错误信息');
                }

                // 验证歌词数据结构
                if (!lrcJson.success) {
                    console.error('[Lyrics] ❌ QRC歌词API返回失败:', lrcJson.message || lrcJson);
                    throw new Error(lrcJson.message || 'QRC歌词API返回失败');
                }

                // 优先使用结构化逐字歌词数据
                if (lrcJson.lyrics && lrcJson.lyrics.length > 0) {
                    console.log('[Lyrics] 🎉 获取到QRC逐字歌词，行数:', lrcJson.lyrics.length);
                    // 如果后端同时返回了翻译，注入到 QRC 结构中
                    if (lrcJson.trans && lrcJson.trans.length > 0) {
                        console.log('[Lyrics] 🌐 获取到官方翻译，长度:', lrcJson.trans.length);
                        _injectTransToQrc(lrcJson.lyrics, lrcJson.trans);
                    }
                    return lrcJson.lyrics;
                }

                // QRC无歌词 → fallback到QQ音乐普通LRC
                console.log('[Lyrics] ℹ️ QQ音乐无QRC歌词，fallback到普通LRC');
                throw new Error("QQ音乐无QRC歌词");
            } catch (err) {
                console.error('[Lyrics] ❌ QQ音乐QRC策略失败:', err.message);

                // QRC失败 → fallback到QQ音乐普通LRC
                try {
                    console.log('[Lyrics] 🔄 QQ音乐fallback到普通LRC...');
                    const res = await metingFetch(`/search?server=tencent&id=${encodeURIComponent(query)}`);
                    const json = await res.json();
                    const data = json.data || json;
                    const target = pickBestMatch(data, t, a);
                    if (!target || !target.lyric_id) throw new Error("QQ LRC无歌词ID");
                    const lrcRes = await metingFetch(`/lyric?server=tencent&id=${target.lyric_id}`);
                    const lrcJson = await lrcRes.json();
                    const lyricContent = (lrcJson.data && lrcJson.data.lyric) || (lrcJson.data && lrcJson.data.text) || lrcJson.lyric || lrcJson.text || '';
                    if (lyricContent.includes('[00:')) {
                        console.log('[Lyrics] ✅ QQ音乐普通LRC获取成功');
                        return lyricContent;
                    }
                } catch (lrcErr) {
                    console.error('[Lyrics] ❌ QQ音乐普通LRC也失败:', lrcErr.message);
                }

                throw err;
            }
        },
        async () => {
            const res = await metingFetch(`/search?server=netease&id=${encodeURIComponent(query)}`);
            const json = await res.json();
            const data = json.data || json;
            if (!data || data.length === 0) throw new Error("网易云未找到");
            const target = pickBestMatch(data, t, a);
            if (!target.lyric_id) throw new Error("网易云无歌词ID");
            const lrcRes = await metingFetch(`/lyric?server=netease&id=${target.lyric_id}`);
            const lrcJson = await lrcRes.json();
            const lyricContent = (lrcJson.data && lrcJson.data.lyric) || (lrcJson.data && lrcJson.data.text) || lrcJson.lyric || lrcJson.text || '';
            if (lyricContent.includes('[00:')) { _lastLrcUrl = target.lyric_id; return lyricContent; }
            throw new Error("网易云无滚动");
        },
        async () => {
            const res = await metingFetch(`/search?server=kuwo&id=${encodeURIComponent(query)}`);
            const json = await res.json();
            const data = json.data || json;
            if (!data || data.length === 0) throw new Error("酷我未找到");
            const target = pickBestMatch(data, t, a);
            if (!target.lyric_id) throw new Error("酷我无歌词ID");
            const lrcRes = await metingFetch(`/lyric?server=kuwo&id=${target.lyric_id}`);
            const lrcJson = await lrcRes.json();
            const lyricContent = (lrcJson.data && lrcJson.data.lyric) || (lrcJson.data && lrcJson.data.text) || lrcJson.lyric || lrcJson.text || '';
            if (lyricContent.includes('[00:')) { _lastLrcUrl = target.lyric_id; return lyricContent; }
            throw new Error("酷我无滚动");
        },
        async () => {
            const res = await fetch(`https://lrclib.net/api/get?artist_name=${encodeURIComponent(a)}&track_name=${encodeURIComponent(t)}`);
            if (!res.ok) throw new Error("LRCLIB未找到");
            const data = await res.json();
            if (data.syncedLyrics && data.syncedLyrics.includes('[00:')) return data.syncedLyrics;
            throw new Error("LRCLIB无滚动");
        },
        async () => {
            const res = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(query)}`);
            const data = await res.json();
            if (!data || data.length === 0) throw new Error("lrclib搜索未找到");
            for (const item of data) { if (item.syncedLyrics && item.syncedLyrics.includes('[00:')) return item.syncedLyrics; }
            throw new Error("lrclib搜索无滚动歌词");
        }
    ];

    const strategyConfigs = [
        { name: 'qrc', fn: strategies[0], timeout: 10000, priority: 1 },
        { name: 'netease', fn: strategies[1], timeout: 5000, priority: 2 },
        { name: 'kuwo', fn: strategies[2], timeout: 5000, priority: 3 },
        { name: 'lrclib', fn: strategies[3], timeout: 8000, priority: 4 },
        { name: 'lrclib-search', fn: strategies[4], timeout: 8000, priority: 5 },
    ];

    const withTimeout = (promise, ms) => Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))
    ]);

    const promises = strategyConfigs.map(s =>
        withTimeout(s.fn(), s.timeout)
            .then(r => ({ lyrics: r, source: s.name, priority: s.priority }))
    );

    try {
        const first = await Promise.any(promises);
        if (first && first.lyrics && myReqId === lyricReqId) {
            applyFetchedLyrics(first.lyrics, targetTrackId, targetTrackIdx);
            _tryUpgradeLyrics(promises, first.priority, myReqId, targetTrackId, targetTrackIdx);
            return;
        }
    } catch(e) {
        console.log("全网彻底未找到有效滚动歌词", e?.message || '');
    }

    if (myReqId === lyricReqId) {
        showManualSearchBtn();
        showToast(i18n[curLang].noLyricsOnline, 'warn');
    }
}

async function _tryUpgradeLyrics(promises, currentPriority, myReqId, targetTrackId, targetTrackIdx) {
    const results = await Promise.allSettled(promises);
    for (const r of results) {
        if (r.status === 'fulfilled' && r.value && r.value.lyrics && r.value.priority < currentPriority) {
            if (myReqId === lyricReqId) {
                applyFetchedLyrics(r.value.lyrics, targetTrackId, targetTrackIdx);
            }
            return;
        }
    }
}

async function applyFetchedLyrics(lrcText, targetTrackId, targetTrackIdx) {
    // 🔒 使用传入的目标歌曲ID和索引，防止异步完成后已经切歌导致保存到错误歌曲
    const saveId = targetTrackId || currentTrackId;
    const saveIdx = (targetTrackIdx >= 0 && playlist[targetTrackIdx]) ? targetTrackIdx : curIdx;
    if(saveId === null || saveIdx < 0 || !playlist[saveIdx]) return;
    if (playlist[saveIdx]?.isBilibili) lrcText = cleanBilibiliLyrics(lrcText);
    playlist[saveIdx].savedLyrics = lrcText;
    window.IanMusicUtils.cacheSet('am_lyric_' + saveId, typeof lrcText === 'object' ? JSON.stringify(lrcText) : lrcText);
    if(playlist[saveIdx].isLocal) await updateLocalMeta(saveId, {savedLyrics: lrcText});

    // 只有当前正在播放这首歌时才渲染，否则只保存不渲染
    if(saveId !== currentTrackId) return;

    // 结构化数据（服务端已解析好的 QRC）→ 直接渲染
    if (Array.isArray(lrcText) && lrcText.length > 0 && lrcText[0].chars) {
        renderQrcLyrics(lrcText);
        return;
    }

    // 字符串：检测 QRC 格式
    const isQrcFormat = typeof lrcText === 'string' && (
        /LyricContent=|^\[(\d+),\d+\]/.test(lrcText) ||
        /\(\d+,\d+,\d+\)/.test(lrcText)
    );

    if (isQrcFormat) {
        try { renderQrcLyrics(lrcText); } catch (qrcErr) {
            console.error('[Lyrics] ❌ QRC渲染失败:', qrcErr.message);
            const plainText = lrcText.replace(/\[\d+,\d+\]/g, '').replace(/\(\d+,\d+,\d+\)/g, '').trim();
            if (plainText.includes('[00:')) renderLyrics(plainText);
            else { showManualSearchBtn(); showToast(i18n[curLang].qrcParseFailed, 'warn'); }
        }
    } else {
        renderLyrics(lrcText);
    }
}

function renderLyrics(lrc) {
    var lb=document.getElementById('desktop-lyrics-box');if(lb)lb.classList.remove('centered-overlay');
    const box = document.getElementById('desktop-lyrics-box');
    const mobBox = document.getElementById('mv-lyric-rows');
    if(box){box.innerHTML='';if(mobBox)mobBox.innerHTML='';}
    else{if(mobBox)mobBox.innerHTML='';}
    if(mobBox&&box&&box.classList.contains('hide-trans')) mobBox.classList.add('hide-trans');
    if(!lrc){showManualSearchBtn();return;}

    // 应用对齐偏好（桌面 + 移动端容器）
    if(box) {
        box.classList.toggle('left-align', _lyricLeftAlign);
        if(mobBox) mobBox.classList.toggle('left-align', _lyricLeftAlign);
        const btn=document.getElementById('lyric-align-btn');
        if(btn) btn.innerText=_lyricLeftAlign ? i18n[curLang].lyricsCenter : i18n[curLang].lyricsLeft;
        const mobAlignText=document.getElementById('mob-more-align-text');
        if(mobAlignText) mobAlignText.textContent=_lyricLeftAlign ? i18n[curLang].lyricsCenter : i18n[curLang].lyricsLeft;
    }

    let parsedLines = [];
    lrc.split('\n').forEach(line => {
        const timestamps = [];
        let remaining = line;
        let match;
        while ((match = remaining.match(/^\[(\d{2}):(\d{2}[.:]\d{2,3})\]/))) {
            const min = parseInt(match[1]);
            const sec = parseFloat(match[2].replace(':', '.'));
            timestamps.push(min * 60 + sec);
            remaining = remaining.slice(match[0].length);
        }
        const text = remaining.trim();
        if (timestamps.length > 0 && text !== '') {
            for (const t of timestamps) {
                parsedLines.push({ time: t, text });
            }
        }
    });
    parsedLines.sort((a, b) => a.time - b.time);

    let _lineIdx=0;
    parsedLines.forEach(({ time, text: lineText }) => {
        const p=document.createElement('p');
        p.className='lyric-line'+(_lyricLeftAlign?' left-align':'');
        p.dataset.time=time;
        p.dataset.lineIndex=_lineIdx;

        let rawText = lineText;
        let transText = '';
        const transMatch = rawText.match(/<span class="trans-line"[^>]*>([\s\S]*?)<\/span>/);
        if (transMatch) {
            transText = transMatch[1];
            rawText = rawText.replace(/<span class="trans-line"[^>]*>[\s\S]*?<\/span>/, '').trim();
        }

        let text = rawText;
        text = text.replace(/([a-z])([A-Z])/g, '$1 $2');
        text = text.replace(/(\w)'(\w)/g, "$1' $2");

        const words = text.split(' ');
        p.innerHTML = words.map((word, wi) => {
            const chars = word.split('').map(c => {
                if (c === ' ') return '\u00A0';
                return `<span class="lyric-char">${c}</span>`;
            }).join('');
            return `<span class="lyric-word">${chars}</span>`;
        }).join(' ');

        if (transText) { var ts = document.createElement('span'); ts.className = 'trans-line'; ts.textContent = transText; p.appendChild(ts); }

        p.onclick=()=>audio.currentTime=p.dataset.time;
        box.appendChild(p);

        if(mobBox){
            const pm=document.createElement('p');
            pm.className='lyric-line'+(_lyricLeftAlign?' left-align':'');
            pm.dataset.time=p.dataset.time;
            pm.dataset.lineIndex=_lineIdx;
            pm.innerHTML = p.innerHTML;
            pm.onclick=()=>audio.currentTime=pm.dataset.time;
            mobBox.appendChild(pm);
        }
        _lineIdx++;
    });
    _cachedLines=Array.from(box.querySelectorAll('.lyric-line'));
    _cachedMobLines=Array.from(document.querySelectorAll('#mv-lyric-rows .lyric-line,#mobile-lyrics-box .lyric-line'));
    _cachedLineChars.clear(); _cachedMobLineChars.clear(); _cachedQrcChars.clear();
    _cachedLines.forEach(l=>_cachedLineChars.set(l,Array.from(l.querySelectorAll('.lyric-char'))));
    _cachedMobLines.forEach(l=>_cachedMobLineChars.set(l,Array.from(l.querySelectorAll('.lyric-char'))));
    if(!box||box.children.length===0){showManualSearchBtn();return;}

    // ⚠️ 切歌时重置所有歌词状态，防止旧 track 的索引残留导致不同步
    _lastDesktopActive=null;
    _lastDeskActiveIdx=-1;
    _lastMobActiveIdx=-1;
    _deskScrollY=0;
    _mobScrollY=0;

    setTimeout(()=>{
        const deskLs=_cachedLines;
        const mobLs=_cachedMobLines;
        if(deskLs.length>0 && _lastDeskActiveIdx < 0){
            const dc=document.getElementById('desktop-lyrics-box');
            const parentH=dc?dc.parentElement.clientHeight:500;
            _deskScrollY=-(deskLs[0].offsetTop-parentH*0.125)+40;
            deskLs.forEach(l=>l.style.setProperty('--scroll-y',_deskScrollY+'px'));
        }
        if(mobLs.length>0 && _lastMobActiveIdx < 0){
            const mc=document.getElementById('mv-body');
            if(mc){_mobScrollY=-(mobLs[0].offsetTop-mc.clientHeight*0.125);mobLs.forEach(l=>l.style.setProperty('--scroll-y',_mobScrollY+'px'));}
        }
        _setupLyricScroll();
    },150);
}

function _setupLyricScroll() {
    const dc = document.getElementById('desktop-lyrics-box');
    if (!dc || dc.dataset.scrollSetup) return;
    dc.dataset.scrollSetup = '1';

    dc.addEventListener('wheel', function(e) {
        if (_userScrolling) {
            clearTimeout(_scrollResumeTimer);
        } else {
            _userScrolling = true;
        }

        _deskScrollY -= e.deltaY * 0.6;
        _cachedLines.forEach(function(l) { l.style.setProperty('--scroll-y', _deskScrollY + 'px'); });

        _scrollResumeTimer = setTimeout(function() {
            _userScrolling = false;
            var active = _lastDesktopActive;
            if (active) {
                var parentH = dc.parentElement.clientHeight || 500;
                var targetOffset = parentH * 0.125 + 40;
                var newScrollY = -(active.offsetTop - targetOffset);
                _deskScrollY = newScrollY;
                _cachedLines.forEach(function(l) { l.style.setProperty('--scroll-y', _deskScrollY + 'px'); });
            }
        }, 3000);
    }, { passive: true });
}

function toggleLyricAlign(){
    _lyricLeftAlign=!_lyricLeftAlign;
    localStorage.setItem('am_lyric_align',_lyricLeftAlign?'left':'center');

    // 桌面端 — 容器 + 所有歌词行
    const box=document.getElementById('desktop-lyrics-box');
    if(box) box.classList.toggle('left-align',_lyricLeftAlign);
    _cachedLines.forEach(l=>l.classList.toggle('left-align',_lyricLeftAlign));

    _cachedMobLines.forEach(l=>l.classList.toggle('left-align',_lyricLeftAlign));
    ['#mv-lyric-rows','#mobile-lyrics-box'].forEach(sel=>{
        const mobBox=document.querySelector(sel);
        if(mobBox) mobBox.classList.toggle('left-align',_lyricLeftAlign);
    });

    // 按钮文字
    const btn=document.getElementById('lyric-align-btn');
    if(btn) btn.innerText=_lyricLeftAlign ? i18n[curLang].lyricsCenter : i18n[curLang].lyricsLeft;
    const mobAlignText=document.getElementById('mob-more-align-text');
    if(mobAlignText) mobAlignText.textContent=_lyricLeftAlign ? i18n[curLang].lyricsCenter : i18n[curLang].lyricsLeft;
}

function showManualSearchBtn(){
    _cachedLines=[]; _cachedMobLines=[]; _cachedLineChars.clear(); _cachedMobLineChars.clear(); _cachedQrcChars.clear();
    const html=`<div class="no-lyrics-container"><div style="margin-bottom:15px;opacity:0.8;">${i18n[curLang].notfound}</div><div class="no-lyrics-actions"><button class="secondary-btn" onclick="fetchLyrics(playlist[curIdx].title,playlist[curIdx].artist)">${i18n[curLang].retry}</button><button class="secondary-btn" onclick="openSearchModal()">${i18n[curLang].manual}</button></div></div>`;
    const dc=document.getElementById('desktop-lyrics-box'); if(dc){dc.innerHTML=html;dc.classList.add('centered-overlay');}
    const mobBox=document.getElementById('mv-lyric-rows')||document.getElementById('mobile-lyrics-box');
    if(mobBox) mobBox.innerHTML=html;
}
function renderPlainLyrics(text){
    var lb=document.getElementById('desktop-lyrics-box');if(lb)lb.classList.remove('centered-overlay');
    _cachedLines=[]; _cachedMobLines=[]; _cachedLineChars.clear(); _cachedMobLineChars.clear(); _cachedQrcChars.clear();
    const dc=document.getElementById('desktop-lyrics-box'); if(dc) dc.innerHTML=`<div class="plain-lyrics">${text}</div>`;
    const mobBox=document.getElementById('mv-lyric-rows')||document.getElementById('mobile-lyrics-box');
    if(mobBox) mobBox.innerHTML=`<div class="plain-lyrics">${text}</div>`;
}

// ===== 歌词高亮事件监听 =====
audio.ontimeupdate = ()=>{
    if(audio.duration){
        const seek=document.getElementById('seek');if(seek){seek.value=(audio.currentTime/audio.duration)*100;updateRangeUI(seek);}
        document.getElementById('curr').innerText=fmt(audio.currentTime);document.getElementById('dur').innerText=fmt(audio.duration);
        const pct=(audio.currentTime/audio.duration)*100;
        const fill=document.getElementById('mv-seek-fill');if(fill) fill.style.width=pct+'%';
        const thumb=document.getElementById('mv-seek-thumb');if(thumb) thumb.style.left=pct+'%';
    }
    const mvCurr=document.getElementById('mv-curr');if(mvCurr) mvCurr.innerText=fmt(audio.currentTime);
    const mvDur=document.getElementById('mv-dur');if(mvDur) mvDur.innerText=fmt(audio.duration||0);

    // ===== 歌词高亮（桌面+移动端 PoloMusic 位移系统）=====
    const ls=_cachedLines;
    if(ls.length>0){
        let activeLine=null;let newActiveIdx=-1;
        for(let i=0;i<ls.length;i++){if(audio.currentTime>=ls[i].dataset.time){activeLine=ls[i];newActiveIdx=i;}else{break;}}
        if(activeLine&&activeLine!==_lastDesktopActive){
            const isBackward = _lastDeskActiveIdx >= 0 && newActiveIdx < _lastDeskActiveIdx;
            // 旧行：标记 sung + data-sung-dist（越远越淡）
            // 🔄 关键：重置逐字进度为0%，让已读完的歌词从白色变回灰色
            if(_lastDesktopActive!==null){
                _lastDesktopActive.classList.remove('highlight');
                _lastDesktopActive.classList.add('sung');
                _lastDesktopActive.dataset.sungDist='1';
                (_cachedLineChars.get(_lastDesktopActive)||[])
                    .forEach(c => c.style.setProperty('--char-pct', '0%'));
            }
            // 新行前所有行：按距高亮行的距离设 data-sung-dist
            for(let i=0;i<newActiveIdx;i++){
                ls[i].classList.add('sung');
                ls[i].dataset.sungDist=String(newActiveIdx-i);
            }
            // 回退时：清除回退区域的 sung 状态，让这些行重新可唱
            if(isBackward){
                for(let i=newActiveIdx+1;i<=_lastDeskActiveIdx;i++){
                    ls[i].classList.remove('sung');
                    (_cachedLineChars.get(ls[i])||[]).forEach(c=>c.style.setProperty('--char-pct','0%'));
                }
            }
            // 当前行：取消 sung，恢复 highlight，清 data-sung-dist
            activeLine.classList.remove('sung');
            activeLine.classList.add('highlight');
            delete activeLine.dataset.sungDist;
            (_cachedLineChars.get(activeLine)||[]).forEach(c => c.style.setProperty('--char-pct', '0%'));
            _lastDesktopActive=activeLine;

            if(newActiveIdx!==_lastDeskActiveIdx){
                const dc=document.getElementById('desktop-lyrics-box');
                if(dc&&ls[newActiveIdx]){
                    if(_userScrolling){_lastDeskActiveIdx=newActiveIdx;}else{
                    const parentH=dc.parentElement.clientHeight||500;
                    const targetOffset=parentH*0.125+40;
                    const activeTop=ls[newActiveIdx].offsetTop;
                    const newScrollY=-(activeTop-targetOffset);
                    if(Math.abs(newScrollY-_deskScrollY)>2){_deskScrollY=newScrollY;ls.forEach(line=>line.style.setProperty('--scroll-y',_deskScrollY+'px'));}
                    }
                }
                _lastDeskActiveIdx=newActiveIdx;
            }

            const mobLs=_cachedMobLines;
            if(newActiveIdx>=0&&mobLs.length>0&&newActiveIdx!==_lastMobActiveIdx){
                const isMobBackward = _lastMobActiveIdx >= 0 && newActiveIdx < _lastMobActiveIdx;

                // 📱 移动端旧行：移除 active + 重置逐字变灰
                if(_lastMobActiveIdx>=0&&mobLs[_lastMobActiveIdx]){
                    mobLs[_lastMobActiveIdx].classList.remove('active');
                    (_cachedMobLineChars.get(mobLs[_lastMobActiveIdx])||[])
                        .forEach(c=>c.style.setProperty('--char-pct','0%'));
                }
                // 📱 新激活行：重置逐字进度，再标记 active
                mobLs[newActiveIdx].classList.add('active');
                (_cachedMobLineChars.get(mobLs[newActiveIdx])||[])
                    .forEach(c=>c.style.setProperty('--char-pct','0%'));
                _lastMobActiveIdx=newActiveIdx;
                const container=document.getElementById('mv-body');
                const activeEl=mobLs[newActiveIdx];
                if(container&&activeEl){
                    const targetOffset=container.clientHeight*0.125;const activeTop=activeEl.offsetTop;
                    const newScrollY=-(activeTop-targetOffset);
                    if(Math.abs(newScrollY-_mobScrollY)>1){_mobScrollY=newScrollY;mobLs.forEach(line=>line.style.setProperty('--scroll-y',_mobScrollY+'px'));}
                }
            }
        }
    }
};
audio.onended=()=>next(true);
audio.onseeked=function(){if('mediaSession'in navigator&&navigator.mediaSession.setPositionState&&isFinite(audio.duration)){navigator.mediaSession.setPositionState({duration:audio.duration,playbackRate:audio.playbackRate,position:audio.currentTime});}};

// ===== 逐字进度 RAF 循环（独立于 ontimeupdate，保证 60fps 流畅）— 桌面端 + 移动端 =====
let _rafActive = null;
function _startCharRAF() {
    if (_rafActive) return;
    _rafActive = requestAnimationFrame(_updateCharRAF);
}
function _stopCharRAF() {
    if (_rafActive) { cancelAnimationFrame(_rafActive); _rafActive = null; }
}
function _updateCharRAF(){
    if(audio.duration && audio.currentTime >= 0 && !audio.paused){
        // ---- 桌面端：当前 highlight 行逐字 ----
        const deskActive = _lastDesktopActive;
        if(deskActive && deskActive.classList.contains('highlight')){
            _updateLineCharProgress(deskActive);
        }

        // ---- 📱 移动端：当前 active 行逐字 ----
        const mobLs=_cachedMobLines.filter(l=>l.classList.contains('active'));
        if(mobLs.length>0){
            mobLs.forEach(mobLine => _updateLineCharProgress(mobLine));
        }
    }
    _rafActive=requestAnimationFrame(_updateCharRAF);
}

/**
 * 通用逐字进度更新函数（桌面+移动共用）
 * @param {HTMLElement} lineEl 歌词行元素
 */
function _updateLineCharProgress(lineEl){
    const lineTime=parseFloat(lineEl.dataset.time);
    if(isNaN(lineTime)) return;

    const isDesk = _cachedLineChars.has(lineEl);
    if (isDesk && !lineEl.classList.contains('highlight')) return;
    if (!isDesk && !lineEl.classList.contains('active')) return;

    const lineChars = isDesk ? _cachedLineChars.get(lineEl) : _cachedMobLineChars.get(lineEl);

    if(audio.currentTime<lineTime) {
        (lineChars||[]).forEach(c => c.style.setProperty('--char-pct', '0%'));
        return;
    }

    let nextTime=audio.duration;
    const allLines = isDesk ? _cachedLines : _cachedMobLines;
    const idx = parseInt(lineEl.dataset.lineIndex);
    if(idx>=0&&idx<allLines.length-1) nextTime=parseFloat(allLines[idx+1].dataset.time);

    const chars = (lineEl.dataset.qrc === '1' && isDesk) ? (_cachedQrcChars.get(idx) || []) : (lineChars || []);
    if(chars.length===0) return;

    // 🎯 QRC 模式：按每字符精确时间戳分配进度
    if(lineEl.dataset.qrc === '1'){
        for(let i=0,len=chars.length;i<len;i++){
            const charStart=parseFloat(chars[i].dataset.qrcStart);
            const charDur=parseFloat(chars[i].dataset.qrcDur);
            if(isNaN(charStart)||isNaN(charDur)){
                // fallback to even distribution
                const avg=(nextTime-lineTime)/len;
                const s=i*avg; const e=(i+1)*avg;
                const elapsed=audio.currentTime-lineTime;
                if(elapsed>=e) chars[i].style.setProperty('--char-pct','100%');
                else if(elapsed<=s) chars[i].style.setProperty('--char-pct','0%');
                else chars[i].style.setProperty('--char-pct',((elapsed-s)/avg*100).toFixed(1)+'%');
                continue;
            }
            const charEnd=charStart+charDur;
            if(audio.currentTime>=charEnd){
                chars[i].style.setProperty('--char-pct','100%');
            } else if(audio.currentTime<=charStart){
                chars[i].style.setProperty('--char-pct','0%');
            } else {
                const p=((audio.currentTime-charStart)/charDur*100).toFixed(1);
                chars[i].style.setProperty('--char-pct',p+'%');
            }
        }
        return;
    }

    // 普通模式：等分时间
    const elapsed=audio.currentTime-lineTime;
    const total=Math.max(0.1,nextTime-lineTime);
    const avg=total/chars.length;
    for(let i=0,len=chars.length;i<len;i++){
        const s=i*avg;
        const e=(i+1)*avg;
        if(elapsed>=e){
            chars[i].style.setProperty('--char-pct','100%');
        } else if(elapsed<=s){
            chars[i].style.setProperty('--char-pct','0%');
        } else {
            const p=((elapsed-s)/avg*100).toFixed(1);
            chars[i].style.setProperty('--char-pct',p+'%');
        }
    }
}
_startCharRAF();

audio.addEventListener('play', _startCharRAF);
audio.addEventListener('pause', _stopCharRAF);
audio.addEventListener('ended', _stopCharRAF);

// ===== 将后端返回的 LRC 翻译注入到 QRC 结构化数据中 =====
function _injectTransToQrc(qrcLines, transLrc) {
    if (!transLrc) return;

    console.log('[Lyrics] _injectTransToQrc trans原文(首400字):', transLrc.substring(0, 400));

    var transTexts = [];

    // 策略1：QRC XML LyricContent="..." 属性
    var attrMatch = transLrc.match(/LyricContent="([^"]*)"/g);
    if (attrMatch && attrMatch.length > 0) {
        for (var ai = 0; ai < attrMatch.length; ai++) {
            var val = attrMatch[ai].replace(/^LyricContent="/, '').replace(/"$/, '');
            val = val.replace(/^\/\/\s?/, '').trim();
            if (val) transTexts.push(val);
        }
        console.log('[Lyrics] _injectTransToQrc: 从属性提取到', transTexts.length, '条');
    }

    // 策略2：标准 LRC [mm:ss.xx]文本
    var transMap = {};
    if (transTexts.length === 0) {
        transLrc.split('\n').forEach(function(line) {
            var m = line.match(/^\[(\d{1,2}):(\d{1,2}[.:]\d{2,3})\](.*)/);
            if (m && m[3].trim()) {
                var time = parseInt(m[1]) * 60 + parseFloat(m[2].replace(':', '.'));
                var cleanText = m[3].trim().replace(/^\/\/\s?/, '').trim();
                if (cleanText) transMap[time] = cleanText;
            }
        });
        console.log('[Lyrics] _injectTransToQrc: LRC时间戳模式，解析到', Object.keys(transMap).length, '条');
    }

    // 策略3：纯文本按行序
    if (transTexts.length === 0 && Object.keys(transMap).length === 0) {
        var stripped = transLrc.replace(/<[^>]+>/g, '').replace(/&[a-z]+;/g, '');
        stripped.split('\n').forEach(function(l) {
            l = l.trim();
            l = l.replace(/^\/\/\s?/, '');
            if (l.length > 0 && !/^\[(ti|ar|al|by|offset|length|language):/i.test(l) &&
                !/^\d+$/.test(l) && !/^[vV]ersion/i.test(l) &&
                !/^\<?\??xml/i.test(l) && !/^QrcInfo/i.test(l)) {
                transTexts.push(l);
            }
        });
        // 去重
        var deduped = [];
        for (var di = 0; di < transTexts.length; di++) {
            if (di === 0 || transTexts[di] !== transTexts[di-1]) deduped.push(transTexts[di]);
        }
        transTexts = deduped;
        console.log('[Lyrics] _injectTransToQrc: 纯文本模式，解析到', transTexts.length, '条');
    }

    var injected = 0;
    var plainIdx = 0;

    if (transTexts.length > 0) {
        qrcLines.forEach(function(line) {
            if (line.time != null && plainIdx < transTexts.length) {
                line.trans = transTexts[plainIdx];
                plainIdx++; injected++;
            }
        });
    } else {
        qrcLines.forEach(function(line) {
            if (line.time != null && transMap[line.time] != null) {
                line.trans = transMap[line.time];
                injected++;
            } else if (line.time != null) {
                var t = line.time;
                for (var offset = 0.01; offset <= 0.5; offset += 0.01) {
                    if (transMap[t + offset] != null) { line.trans = transMap[t + offset]; injected++; break; }
                    if (transMap[t - offset] != null) { line.trans = transMap[t - offset]; injected++; break; }
                }
            }
        });
    }

    console.log('[Lyrics] 翻译注入完成(QRC):', injected, '/', qrcLines.length, '行');
}

// ===== 将后端返回的翻译文本注入到普通 LRC 文本中 =====
// 支持：QRC XML LyricContent 属性 / 标准LRC时间戳 / QRC逐字 / 纯文本按行序
// 同时兼容 source 是 LRC 字符串或 JSON 字符串（QRC数组序列化）
function _injectTransToLrc(lrcText, transLrc) {
    if (!transLrc || !lrcText) return lrcText;

    console.log('[Lyrics] trans 原文(首600字):', transLrc.substring(0, 600));
    console.log('[Lyrics] source 类型:', typeof lrcText, '前100字:', String(lrcText).substring(0, 100));

    // ── 检查 source 是否是 JSON（QRC数组序列化）──
    var srcIsJson = false;
    var srcJson = null;
    if (lrcText.charAt(0) === '[' && /^\s*\[\s*\{/.test(lrcText)) {
        try { srcJson = JSON.parse(lrcText); srcIsJson = true; }
        catch(e) {}
    }

    // ── 提取 source 歌词行 ──
    var srcLines = [];
    if (srcIsJson && Array.isArray(srcJson)) {
        srcJson.forEach(function(line) {
            if (line.time != null) {
                // 从 QRC chars 重建文本
                var text = '';
                if (line.chars) {
                    line.chars.forEach(function(c) { text += c.c; });
                }
                if (text.trim()) srcLines.push({ time: line.time, text: text.trim() });
            }
        });
        console.log('[Lyrics] source 是 JSON(QRC), 提取到', srcLines.length, '行');
    } else {
        lrcText.split('\n').forEach(function(line) {
            var m = line.match(/^(\[\d{1,2}:\d{1,2}[.:]\d{2,3}\])(.*)/);
            if (m && m[2].trim()) srcLines.push({ time: m[1], text: m[2].trim() });
        });
    }

    // ── 提取 trans 翻译文本 ──
    var transTexts = [];

    // 策略1：QRC XML LyricContent="..." 属性
    var attrMatch = transLrc.match(/LyricContent="([^"]*)"/g);
    if (attrMatch && attrMatch.length > 0) {
        console.log('[Lyrics] ✅ 策略1(QRC属性) 命中，提取到', attrMatch.length, '条');
        for (var ai = 0; ai < attrMatch.length; ai++) {
            var val = attrMatch[ai].replace(/^LyricContent="/, '').replace(/"$/, '');
            val = val.replace(/^\/\/\s?/, '').trim();
            if (val) transTexts.push(val);
        }
    }

    // 策略2：标准 LRC [mm:ss.xx]文本
    if (transTexts.length === 0) {
        transLrc.split('\n').forEach(function(line) {
            var m = line.match(/^\[(\d{1,2}):(\d{1,2}[.:]\d{2,3})\](.*)/);
            if (m && m[3].trim()) {
                var t = parseInt(m[1]) * 60 + parseFloat(m[2].replace(':', '.'));
                var cleanText = m[3].trim().replace(/^\/\/\s?/, '').trim();
                if (cleanText) transTexts.push({ time: t, text: cleanText });
            }
        });
        if (transTexts.length > 0) console.log('[Lyrics] ✅ 策略2(LRC时间戳) 命中，', transTexts.length, '行');
    }

    // 策略3：QRC逐字 [row,col]文本(时长)
    if (transTexts.length === 0) {
        var chunks = transLrc.match(/\[\d+,\d+\][^(]+\(\d+,\d+\)/g);
        if (chunks) {
            var seen = {};
            for (var ci = 0; ci < chunks.length; ci++) {
                var cm = chunks[ci].match(/^\[\d+,\d+\](.*?)\(\d+,\d+\)$/);
                if (cm && cm[1] && !seen[cm[1]]) { seen[cm[1]] = true; transTexts.push({ time: null, text: cm[1].trim().replace(/^\/\/\s?/, '') }); }
            }
            if (transTexts.length > 0) console.log('[Lyrics] ✅ 策略3(QRC逐字) 命中，', transTexts.length, '条');
        }
    }

    // 策略4：纯文本按行序
    if (transTexts.length === 0) {
        var stripped = transLrc.replace(/<[^>]+>/g, '').replace(/&[a-z]+;/g, '');
        var plainLines = [];
        stripped.split('\n').forEach(function(l) {
            l = l.trim();
            l = l.replace(/^\/\/\s?/, '');
            if (l.length > 0 && !/^\[(ti|ar|al|by|offset|length|language):/i.test(l) &&
                !/^\d+$/.test(l) && !/^[vV]ersion/i.test(l) &&
                !/^\<?\??xml/i.test(l) && !/^QrcInfo/i.test(l)) {
                plainLines.push(l);
            }
        });
        if (plainLines.length > 0) {
            var deduped = [];
            for (var di = 0; di < plainLines.length; di++) {
                if (di === 0 || plainLines[di] !== plainLines[di-1]) deduped.push(plainLines[di]);
            }
            var maxTake = Math.min(deduped.length, Math.max(srcLines.length, 1));
            for (var dk = 0; dk < maxTake; dk++) transTexts.push({ time: null, text: deduped[dk] });
            console.log('[Lyrics] ✅ 策略4(纯文本) 命中，', maxTake, '/', deduped.length, '行');
        }
    }

    if (transTexts.length === 0) {
        console.warn('[Lyrics] ❌ 4种策略全部失败！');
        return lrcText;
    }

    // ── HTML 转义 ──
    function esc(s) {
        return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // ── 构建时间戳查找表 ──
    var timeMap = {};
    var plainList = [];
    transTexts.forEach(function(item) {
        if (item.time != null) timeMap[Math.round(item.time * 100) / 100] = item.text;
        else plainList.push(item.text);
    });

    // ── 生成结果 ──
    var injectedCount = 0;
    var plainIdx = 0;
    var result = '';

    if (srcIsJson) {
        // source 是 QRC JSON — 直接把翻译注入到行的 trans 属性，然后返回原 JSON 字符串（保持数组格式）
        srcJson.forEach(function(line) {
            if (line.time != null) {
                var t = Math.round(line.time * 100) / 100;
                var transText = timeMap[t];
                if (!transText) {
                    for (var off = 0.01; off <= 0.5; off += 0.01) {
                        if (timeMap[Math.round((t + off) * 100) / 100]) { transText = timeMap[Math.round((t + off) * 100) / 100]; break; }
                        if (timeMap[Math.round((t - off) * 100) / 100]) { transText = timeMap[Math.round((t - off) * 100) / 100]; break; }
                    }
                }
                if (!transText && plainIdx < plainList.length) { transText = plainList[plainIdx]; plainIdx++; }
                if (transText) { line.trans = esc(transText); injectedCount++; }
            }
        });
        console.log('[Lyrics] _injectTransToLrc(QRC→trans属性): ✅ 注入', injectedCount, '/', srcLines.length, '行');
        // 返回标记过的 JSON 字符串
        return JSON.stringify(srcJson);
    }

    // source 是 LRC 字符串
    lrcText.split('\n').forEach(function(line) {
        var m = line.match(/^(\[\d{1,2}:\d{1,2}[.:]\d{2,3}\])(.*)/);
        if (m && m[2].trim()) {
            var text = m[2].trim();
            var time = 0;
            try {
                var mm = m[1].match(/\[(\d{1,2}):/);
                var ss = m[1].match(/:(\d{1,2}[.:]\d{2,3})\]/);
                if (mm && ss) time = parseInt(mm[1]) * 60 + parseFloat(ss[1].replace(':', '.'));
                time = Math.round(time * 100) / 100;
            } catch(e) {}

            var transText = timeMap[time];
            if (!transText) {
                for (var off2 = 0.01; off2 <= 0.5; off2 += 0.01) {
                    if (timeMap[Math.round((time + off2) * 100) / 100]) { transText = timeMap[Math.round((time + off2) * 100) / 100]; break; }
                    if (timeMap[Math.round((time - off2) * 100) / 100]) { transText = timeMap[Math.round((time - off2) * 100) / 100]; break; }
                }
            }
            if (!transText && plainIdx < plainList.length) { transText = plainList[plainIdx]; plainIdx++; }

            if (transText && transText !== text) {
                result += m[1] + text + '<span class="trans-line">' + esc(transText) + '</span>\n';
                injectedCount++;
            } else {
                result += line + '\n';
            }
        } else {
            result += line + '\n';
        }
    });

    console.log('[Lyrics] _injectTransToLrc(LRC→LRC): ✅ 注入', injectedCount, '/', srcLines.length, '行');
    return result;
}

// ===== QRC 逐字歌词渲染 (服务端已解析为结构化数据 [{time, chars: [{c, t, d}]}]) =====

function renderQrcLyrics(lyrics) {
    var lb=document.getElementById('desktop-lyrics-box');if(lb)lb.classList.remove('centered-overlay');
    if (!lyrics || !lyrics.length) {
        showManualSearchBtn();
        showToast(i18n[curLang].qrcEmpty, 'warn');
        return;
    }

    const box = document.getElementById('desktop-lyrics-box');
    const mobBox = document.getElementById('mv-lyric-rows');

    if (!box && !mobBox) return;

    if (box) { box.innerHTML = ''; if (mobBox) mobBox.innerHTML = ''; }
    else { if (mobBox) mobBox.innerHTML = ''; }
    if (mobBox && box && box.classList.contains('hide-trans')) mobBox.classList.add('hide-trans');

    if (box) {
        box.classList.toggle('left-align', _lyricLeftAlign);
        if (mobBox) mobBox.classList.toggle('left-align', _lyricLeftAlign);
        const btn = document.getElementById('lyric-align-btn');
        if (btn) btn.innerText = _lyricLeftAlign ? i18n[curLang].lyricsCenter : i18n[curLang].lyricsLeft;
        const mobAlignText = document.getElementById('mob-more-align-text');
        if (mobAlignText) mobAlignText.textContent = _lyricLeftAlign ? i18n[curLang].lyricsCenter : i18n[curLang].lyricsLeft;
    }

    let _lineIdx=0;
    lyrics.forEach(line => {
        if (!line.chars || !line.chars.length) return;
        const p = document.createElement('p');
        p.className = 'lyric-line' + (_lyricLeftAlign ? ' left-align' : '');
        p.dataset.time = line.time;
        p.dataset.qrc = '1';
        p.dataset.lineIndex = _lineIdx;

        let html = '';
        let charIdx = 0;
        for (const ch of line.chars) {
            if (ch.c === ' ') { html += ' '; continue; }
            html += `<span class="lyric-word"><span class="lyric-char" data-qrc-start="${ch.t}" data-qrc-dur="${ch.d}" data-char-index="${charIdx}">${ch.c}</span></span>`;
            charIdx++;
        }
        p.innerHTML = html;
        if (line.trans) {
            var transSpan = document.createElement('span');
            transSpan.className = 'trans-line';
            transSpan.textContent = line.trans;
            p.appendChild(transSpan);
        }
        p.onclick = () => audio.currentTime = p.dataset.time;
        if (box) box.appendChild(p);

        if (mobBox) {
            const pm = document.createElement('p');
            pm.className = 'lyric-line' + (_lyricLeftAlign ? ' left-align' : '');
            pm.dataset.time = p.dataset.time;
            pm.dataset.qrc = '1';
            pm.dataset.lineIndex = _lineIdx;
            pm.innerHTML = p.innerHTML;
            pm.onclick = () => audio.currentTime = pm.dataset.time;
            mobBox.appendChild(pm);
        }
        _lineIdx++;
    });

    _cachedLines=Array.from(box.querySelectorAll('.lyric-line'));
    _cachedMobLines=Array.from(document.querySelectorAll('#mv-lyric-rows .lyric-line,#mobile-lyrics-box .lyric-line'));
    _cachedLineChars.clear(); _cachedMobLineChars.clear(); _cachedQrcChars.clear();
    _cachedLines.forEach(l=>_cachedLineChars.set(l,Array.from(l.querySelectorAll('.lyric-char'))));
    _cachedMobLines.forEach(l=>_cachedMobLineChars.set(l,Array.from(l.querySelectorAll('.lyric-char'))));
    _cachedLines.forEach((l,i)=>{ if(l.dataset.qrc==='1') _cachedQrcChars.set(i,Array.from(l.querySelectorAll('.lyric-char'))); });

    if ((!box || box.children.length === 0) && (!mobBox || mobBox.children.length === 0)) {
        showManualSearchBtn();
        return;
    }

    _lastDesktopActive = null; _lastDeskActiveIdx = -1; _lastMobActiveIdx = -1;
    _deskScrollY = 0; _mobScrollY = 0;

    // 保存结构化数据到当前歌曲（JSON序列化）
    // 注意：此函数通常在 applyFetchedLyrics 中调用，已确认是当前播放歌曲
    if (currentTrackId != null && playlist[curIdx]) {
        const json = JSON.stringify(lyrics);
        playlist[curIdx].savedLyrics = json;
        window.IanMusicUtils.cacheSet('am_lyric_' + currentTrackId, json);
    }

    setTimeout(() => {
        const deskLs = _cachedLines;
        const mobLs = _cachedMobLines;
        if (deskLs.length > 0 && _lastDeskActiveIdx < 0) {
            const dc = document.getElementById('desktop-lyrics-box');
            const parentH = dc ? dc.parentElement.clientHeight : 500;
            _deskScrollY = -(deskLs[0].offsetTop - parentH * 0.125) + 40;
            deskLs.forEach(l => l.style.setProperty('--scroll-y', _deskScrollY + 'px'));
        }
        if (mobLs.length > 0 && _lastMobActiveIdx < 0) {
            const mc = document.getElementById('mv-body');
            if (mc) {
                _mobScrollY = -(mobLs[0].offsetTop - mc.clientHeight * 0.125);
                mobLs.forEach(l => l.style.setProperty('--scroll-y', _mobScrollY + 'px'));
            }
        }
        _setupLyricScroll();
    }, 150);
}

window.IanMusic.fetchLyrics=fetchLyrics;window.IanMusic.applyFetchedLyrics=applyFetchedLyrics;
window.IanMusic.renderLyrics=renderLyrics;window.IanMusic.renderQrcLyrics=renderQrcLyrics;
window.IanMusic.renderPlainLyrics=renderPlainLyrics;window.IanMusic.showManualSearchBtn=showManualSearchBtn;
window.IanMusic.toggleLyricAlign=toggleLyricAlign;
