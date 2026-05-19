/**
 * @module IanMusic/app
 * @description 主入口 — 设置/封面/歌词搜索/键盘快捷键/MediaCard/初始化
 */
window.IanMusic = window.IanMusic || {};

// ===== 模糊度 + 歌词大小 =====
function setBlur(v){document.documentElement.style.setProperty('--blur-val',v);localStorage.setItem('am_blur',v);
    document.getElementById('blur-low')?.classList.toggle('active',v==='80px');
    document.getElementById('blur-high')?.classList.toggle('active',v==='120px');
}
function setSize(s){
    const v=s==='small'?'24px':(s==='large'?'40px':'28px');document.documentElement.style.setProperty('--lyric-size',v);localStorage.setItem('am_size',s);
    document.getElementById('size-s')?.classList.toggle('active',s==='small');
    document.getElementById('size-m')?.classList.toggle('active',s==='medium');
    document.getElementById('size-l')?.classList.toggle('active',s==='large');
}

// ===== 交叉淡入淡出（CeruMusic 无感过渡）=====
function toggleCrossfade(){
    const cur = localStorage.getItem('am_crossfade') === 'true';
    const next = !cur;
    localStorage.setItem('am_crossfade', next);
    window.IanMusic.setCrossfadeEnabled(next);
    document.getElementById('cf-off')?.classList.toggle('active', !next);
    if (!next) {
        // 关闭时清除所有 cf-X 的 active
        ['cf-2','cf-3','cf-5','cf-8'].forEach(id=>document.getElementById(id)?.classList.remove('active'));
    }
    showToast(next ? i18n[curLang].crossfadeOn : i18n[curLang].crossfadeOff, next ? 'success' : '');
    _updateCrossfadeUI();
}
function setCrossfadeDur(sec){
    localStorage.setItem('am_crossfade', 'true');
    localStorage.setItem('am_crossfade_dur', sec);
    window.IanMusic.setCrossfadeEnabled(true);
    window.IanMusic.setCrossfadeDuration(sec);
    ['cf-2','cf-3','cf-5','cf-8'].forEach(id=>document.getElementById(id)?.classList.remove('active'));
    document.getElementById('cf-off')?.classList.remove('active');
    document.getElementById('cf-'+sec)?.classList.add('active');
    showToast(i18n[curLang].crossfadeSec + sec + 's', 'success');
}
function _updateCrossfadeUI(){
    const enabled = localStorage.getItem('am_crossfade') === 'true';
    const dur = parseFloat(localStorage.getItem('am_crossfade_dur')) || 3;
    document.getElementById('cf-off')?.classList.toggle('active', !enabled);
    if (enabled) {
        document.getElementById('cf-'+dur)?.classList.add('active');
    }
}

// ===== 睡眠定时 =====
const sleepTimes=[0,15,30,60];let currentSleepIdx=0;
function cycleSleepTimer(){currentSleepIdx=(currentSleepIdx+1)%sleepTimes.length;setSleep(sleepTimes[currentSleepIdx]);}
function setCustomSleep(){const val=parseInt(document.getElementById('custom-sleep-val').value);if(val>0){setSleep(val);toggleSettings(false);}}

function setSleep(min){
    clearInterval(sleepInterval);const btn=document.getElementById('quick-sleep-btn'),txt=document.getElementById('quick-sleep-text');
    document.querySelectorAll('.segment-opt[onclick*="setSleep"]').forEach(e=>e.classList.remove('active'));
    if(min===0){
        clearInterval(sleepInterval); sleepInterval = null;
        btn.classList.remove('active-timer');btn.style.background='rgba(255,255,255,0.03)';txt.style.display='none';txt.innerText='';
        showToast(i18n[curLang].sleepOff);document.getElementById('sleep-off')?.classList.add('active');sleepTargetTime=0;
        document.getElementById('sleep-countdown').innerText=''; currentSleepIdx=0;
    } else{
        clearInterval(sleepInterval);
        btn.classList.add('active-timer');btn.style.background='var(--accent)';txt.style.display='inline';
        showToast(i18n[curLang].sleepSet+min+"m");sleepTargetTime=Date.now()+min*60*1000;const display=`${min}:00`;txt.innerText=display;
        document.getElementById('sleep-countdown').innerText=display;
        sleepInterval=setInterval(()=>{
            const now=Date.now();const remaining=Math.ceil((sleepTargetTime-now)/1000);
            if(remaining<=0){
                clearInterval(sleepInterval); sleepInterval = null;
                audio.pause();document.getElementById('art')?.classList.add('paused');
                setPlayIcons(false);
                updateListActiveState();showToast(i18n[curLang].sleepReached);btn.classList.remove('active-timer');
                btn.style.background='rgba(255,255,255,0.03)';txt.style.display='none';txt.innerText='';
                document.getElementById('sleep-countdown').innerText='';currentSleepIdx=0;
            } else{
                const display=`${Math.floor(remaining/60)}:${(remaining%60).toString().padStart(2,'0')}`;
                if(document.getElementById('quick-sleep-text'))document.getElementById('quick-sleep-text').innerText=display;
                if(document.getElementById('sleep-countdown'))document.getElementById('sleep-countdown').innerText=display;
            }
        },1000);
    }
}

// ===== 封面替换 =====
function openCoverSearchModal(){
    if(playlist.length===0)return;const t=playlist[curIdx];
    document.getElementById('search-cover-input').value=`${t.title} ${t.artist}`;document.getElementById('cover-results').innerHTML='';
    toggleCoverModal(true);performCoverSearch();
}

/**
 * 📦 将图片 URL 转为 base64 Data URI 并缓存到 localStorage
 * 通过 Canvas 压缩到最大 800px (JPEG 0.85)，大幅降低内存占用
 * @param {string} url 图片 URL
 * @param {string} trackId 歌曲ID（用于生成缓存key）
 * @returns {Promise<string>} base64 Data URI
 */
async function cacheCoverAsBase64(url, trackId) {
    if (!url || !trackId) return url;
    const cacheKey = 'am_cover_b64_' + trackId;

    const existing = window.IanMusicUtils._coverDB ? await window.IanMusicUtils._coverDB.getItem(cacheKey) : localStorage.getItem(cacheKey);
    if (existing) return existing;

    try {
        let fetchUrl = url;
        if (url.startsWith('http://') || url.startsWith('https://')) {
            fetchUrl = 'http://localhost:3300/proxy-image?url=' + encodeURIComponent(url);
        }
        const resp = await fetch(fetchUrl);
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        const blob = await resp.blob();

        return new Promise((resolve) => {
            const img = new Image();
            const objectUrl = URL.createObjectURL(blob);
            img.onload = () => {
                URL.revokeObjectURL(objectUrl);
                const MAX = 800;
                var w = img.naturalWidth || img.width;
                var h = img.naturalHeight || img.height;
                if (w > MAX || h > MAX) {
                    var ratio = Math.min(MAX / w, MAX / h);
                    w = Math.round(w * ratio);
                    h = Math.round(h * ratio);
                }
                var canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                var ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, w, h);
                var b64 = canvas.toDataURL('image/jpeg', 0.85);
                canvas.width = 0; canvas.height = 0; canvas = null;
                try {
                    window.IanMusicUtils.cacheSet(cacheKey, b64);
                    console.log('[cacheCoverAsBase64] \u2705 ' + trackId + ' cached (' + Math.round(b64.length/1024) + 'KB)');
                } catch(e) {
                    console.warn('[cacheCoverAsBase64] storage fail:', e.message);
                }
                resolve(b64);
            };
            img.onerror = () => {
                URL.revokeObjectURL(objectUrl);
                resolve(url);
            };
            img.src = objectUrl;
        });
    } catch(e) {
        console.warn('[cacheCoverAsBase64] fetch fail:', e.message);
        return url;
    }
}
function cleanupStorageCache() {
    try {
        var keys = [];
        for (var i = 0; i < localStorage.length; i++) {
            var k = localStorage.key(i);
            if (k && k.startsWith('am_cover_b64_')) keys.push(k);
        }
        if (keys.length === 0) return;
        var entries = keys.map(function(k) {
            return { key: k, size: localStorage.getItem(k).length };
        }).sort(function(a, b) { return b.size - a.size; });

        var removed = 0;
        var totalSize = entries.reduce(function(s, e) { return s + e.size; }, 0);
        var MAX_TOTAL = 8 * 1024 * 1024;

        for (var ei = 0; ei < entries.length; ei++) {
            var e = entries[ei];
            if (e.size > 250 * 1024 || totalSize > MAX_TOTAL) {
                localStorage.removeItem(e.key);
                totalSize -= e.size;
                removed++;
                console.log('[cleanupStorageCache] removed large entry: ' + e.key + ' (' + Math.round(e.size/1024) + 'KB)');
            }
        }
        if (removed > 0) console.log('[cleanupStorageCache] cleaned ' + removed + ' entries, saved ~' + Math.round((entries.reduce(function(s, e) { return s + e.size; }, 0) - totalSize) / 1024) + 'KB');
    } catch(e) {
        console.warn('[cleanupStorageCache] error:', e.message);
    }
}
async function performCoverSearch(){
    const query=document.getElementById('search-cover-input').value.trim();const box=document.getElementById('cover-results');if(!query)return;
    var goBtn=document.getElementById('cover-search-go-btn');
    if(goBtn){goBtn.disabled=true;goBtn.textContent = i18n[curLang].searchLabel;}
    box.innerHTML=`<div style="grid-column:1/-1;text-align:center;padding:30px;"><div class="spinner"></div></div>`;
    try{
        const res=await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&limit=15`);
        const data=await res.json();box.innerHTML='';
        if(!data.results||data.results.length===0){box.innerHTML=`<div style="grid-column:1/-1;text-align:center;opacity:0.6;padding:20px;">${i18n[curLang].noCoverFound}</div>`;return;}
        const seen=new Set();
        data.results.forEach(item=>{
            const imgUrl=item.artworkUrl100.replace('100x100bb','600x600bb').replace('100x100','600x600');
            if(seen.has(imgUrl))return;seen.add(imgUrl);
            const div=document.createElement('div');div.className='cover-result-item';div.style.backgroundImage=`url('${imgUrl}')`;div.title=item.collectionName||item.trackName;
            div.onclick=()=>{applyNewCover(imgUrl);toggleCoverModal(false);};box.appendChild(div);
        });
    } catch(e){box.innerHTML=`<div style="grid-column:1/-1;text-align:center;opacity:0.6;padding:20px;">网络错误，请稍后重试</div>`;}
    var goBtn2=document.getElementById('cover-search-go-btn');
    if(goBtn2){goBtn2.disabled=false;goBtn2.textContent = i18n[curLang].searchLabel;}
}
async function applyNewCover(imgUrl){
    if(currentTrackId===null){
        console.error('[applyNewCover] ❌ currentTrackId 为空');
        return;
    }
    const t=playlist[curIdx];
    if(!t){
        console.error('[applyNewCover] ❌ playlist[curIdx] 为空');
        return;
    }
    
    console.log('[applyNewCover] ===== 开始更新封面 =====');
    console.log('[applyNewCover] currentTrackId:', currentTrackId);
    console.log('[applyNewCover] playlist[curIdx].id:', t.id);
    console.log('[applyNewCover] 原始URL:', imgUrl);
    
    // ⚠️ 强制使用歌曲对象的 id，不能使用 currentTrackId
    // 因为 currentTrackId 是动态生成的，而 t.id 是歌曲的永久标识
    const songId = t.id;
    if (!songId) {
        console.error('[applyNewCover] ❌ 歌曲 id 为空，无法保存封面');
        return;
    }
    
    // 2. 如果是网络URL，转为 base64 缓存（刷新后立即可用）
    let finalUrl = imgUrl;
    
    if (imgUrl.startsWith('http') && typeof cacheCoverAsBase64 === 'function') {
        console.log('[applyNewCover] 开始转换为 base64...');
        const b64 = await cacheCoverAsBase64(imgUrl, songId);
        if (b64 && b64 !== imgUrl) { 
            finalUrl = b64; 
            console.log('[applyNewCover] ✅ 转换成功');
        }
    }
    
    // 1. 保存封面到 localStorage（使用最终的 URL，可能是 base64）
    // ⚠️ 必须保存 finalUrl，而不是 imgUrl，确保刷新后加载的是同一封面
    window.IanMusicUtils.cacheSet('am_cover_'+songId, finalUrl);
    console.log('[applyNewCover] ✅ 已保存封面到 am_cover_'+songId);
    
    // 更新歌曲对象的封面
    t.cover = finalUrl;
    t.coverFetched = true;
    console.log('[applyNewCover] ✅ 已更新歌曲对象封面');
    
    // 3. 更新本地歌曲元数据（如果是本地歌曲）
    if(t.isLocal){
        await updateLocalMeta(songId, {cover: finalUrl, coverFetched: true});
        console.log('[applyNewCover] ✅ 已更新本地元数据');
    }
    
    // 4. 同步更新列表中的缩略图
    const listItem = document.querySelector(`.list-item[data-id="${songId}"]`);
    if(listItem){
        const thumb = listItem.querySelector('.list-thumb');
        if(thumb){
            thumb.style.backgroundImage = `url('${finalUrl}')`;
            console.log('[applyNewCover] ✅ 已更新列表缩略图');
        }
    }
    
    // 5. 更新所有封面元素（使用 null 作为 trackId 强制更新）
    if (typeof applyCover === 'function') {
        // 第三个参数不传（默认为 null），让 applyCover 根据自动模式决定是否提取主题色
        applyCover(finalUrl, null);
        console.log('[applyNewCover] ✅ 已调用 applyCover 更新所有UI元素');
    }
    
    // 6. 同步更新浏览器标签页标题和图标
    document.title = `♪ ${t.title}`;
    console.log('[applyNewCover] ✅ 已更新浏览器标签页标题:', document.title);
    
    // 强制刷新浏览器标签页图标（等待完成）
    await refreshFavicon(finalUrl);
    console.log('[applyNewCover] ✅ 已强制刷新浏览器标签页图标');
    
    showToast(i18n[curLang].coverUpdated);
    
    console.log('[applyNewCover] ===== 封面更新完成 =====');
}

// 强制刷新浏览器标签页图标
// ⚠️ 直接使用封面图片作为 favicon（缩放为 32x32）
async function refreshFavicon(url) {
    console.log('[refreshFavicon] ===== 开始刷新 favicon =====');
    console.log('[refreshFavicon] 原始 URL:', url.substring(0, 50) + '...');
    
    // 将封面缩放到 32x32 作为 favicon
    const faviconUrl = await scaleImageTo32x32(url);
    console.log('[refreshFavicon] ✅ 已缩放到 32x32');
    
    // 直接更新 favicon
    updateFaviconDirectly(faviconUrl);
    
    console.log('[refreshFavicon] ===== favicon 刷新完成 =====');
}

// 将图片缩放到 32x32（适合作为 favicon）
async function scaleImageTo32x32(imageUrl) {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = 32;
                canvas.height = 32;
                const ctx = canvas.getContext('2d');
                
                // 保持比例绘制
                const scale = Math.min(32 / img.width, 32 / img.height);
                const x = (32 - img.width * scale) / 2;
                const y = (32 - img.height * scale) / 2;
                
                ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
                
                // 转换为 PNG 格式（最适合 favicon）
                const pngDataUrl = canvas.toDataURL('image/png');
                resolve(pngDataUrl);
            } catch (e) {
                console.log('[scaleImageTo32x32] ⚠️ 缩放失败，使用原始 URL');
                resolve(imageUrl);
            }
        };
        
        img.onerror = () => {
            console.log('[scaleImageTo32x32] ⚠️ 图片加载失败，使用原始 URL');
            resolve(imageUrl);
        };
        
        img.src = imageUrl;
    });
}

// 从图片提取主色调
async function extractDominantColor(imageUrl) {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = 1;
                canvas.height = 1;
                const ctx = canvas.getContext('2d');
                
                // 取图片中心像素的颜色
                const centerX = Math.floor(img.width / 2);
                const centerY = Math.floor(img.height / 2);
                
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);
                
                const pixelData = ctx.getImageData(centerX, centerY, 1, 1).data;
                const hex = rgbToHex(pixelData[0], pixelData[1], pixelData[2]);
                resolve(hex);
            } catch (e) {
                console.log('[extractDominantColor] ⚠️ 提取失败，使用默认颜色');
                resolve('#fa2d48');
            }
        };
        
        img.onerror = () => {
            console.log('[extractDominantColor] ⚠️ 图片加载失败，使用默认颜色');
            resolve('#fa2d48');
        };
        
        img.src = imageUrl;
    });
}

// RGB 转 HEX
function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(x => {
        const hex = x.toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    }).join('');
}

// 创建彩色 SVG favicon
function createColorfulFavicon(color) {
    // 创建一个带有音乐音符图标的 SVG
    const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
            <rect width="32" height="32" fill="${color}" rx="4"/>
            <path d="M12 24V8l12-4v16" fill="none" stroke="white" stroke-width="2" stroke-linecap="round"/>
            <path d="M12 24L24 8" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
    `;
    return 'data:image/svg+xml,' + encodeURIComponent(svg);
}

// 预加载图片
function preloadImage(url) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve();
        img.onerror = () => resolve();
        img.src = url;
    });
}

// 直接更新 favicon（简单粗暴但有效）
function updateFaviconDirectly(url) {
    // 移除所有现有的图标标签
    document.querySelectorAll("link[rel*='icon']").forEach(link => link.remove());
    
    // 创建一个新的 icon 标签
    const link = document.createElement('link');
    link.rel = 'icon';
    link.href = url;
    link.type = url.startsWith('data:image/png') ? 'image/png' : 'image/svg+xml';
    link.sizes = '32x32';
    
    // 插入到 head 的最前面
    document.head.insertBefore(link, document.head.firstChild);
    
    console.log('[updateFaviconDirectly] ✅ favicon 已更新');
}

// 快速切换多个图标强制刷新（最激进的方法）
async function rapidSwitchFavicon(targetUrl) {
    console.log('[rapidSwitchFavicon] 开始快速切换');
    
    // 创建一个临时的纯色图标序列
    const tempIcons = [
        'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect fill="%23ff0000" width="32" height="32"/></svg>',
        'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect fill="%2300ff00" width="32" height="32"/></svg>',
        'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect fill="%230000ff" width="32" height="32"/></svg>',
        'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect fill="%23ffff00" width="32" height="32"/></svg>',
    ];
    
    // 快速切换临时图标
    for (let i = 0; i < tempIcons.length; i++) {
        await new Promise(resolve => setTimeout(resolve, 100));
        setSingleFavicon(tempIcons[i]);
        console.log('[rapidSwitchFavicon] ✅ 切换到临时图标 #' + (i + 1));
    }
    
    // 等待一下，然后设置目标图标
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // 设置最终图标（多次设置确保生效）
    for (let i = 0; i < 3; i++) {
        setSingleFavicon(targetUrl);
        await new Promise(resolve => setTimeout(resolve, 150));
        console.log('[rapidSwitchFavicon] ✅ 设置目标图标 #' + (i + 1));
    }
    
    // 最后更新所有 rel 类型
    setTimeout(() => {
        setAllFaviconRelTypes(targetUrl);
        console.log('[rapidSwitchFavicon] ✅ 更新所有 rel 类型');
    }, 300);
    
    // 触发页面标题闪烁
    const originalTitle = document.title;
    setTimeout(() => {
        document.title = '[M] IanMusic';
        setTimeout(() => {
            document.title = originalTitle;
        }, 100);
    }, 500);
}

// 设置单个 favicon（替换所有现有图标）
function setSingleFavicon(url) {
    // 移除所有现有的图标标签
    document.querySelectorAll("link[rel*='icon']").forEach(link => link.remove());
    
    // 创建新的图标标签
    const link = document.createElement('link');
    link.rel = 'icon';
    link.href = url;
    link.type = 'image/png';
    link.sizes = '32x32';
    document.head.appendChild(link);
}

// 设置所有类型的 favicon
function setAllFaviconRelTypes(url) {
    const relTypes = ['icon', 'shortcut icon', 'apple-touch-icon', 'apple-touch-icon-precomposed'];
    
    relTypes.forEach((relType, index) => {
        // 移除同类型的旧标签
        document.querySelectorAll(`link[rel="${relType}"]`).forEach(link => link.remove());
        
        const newLink = document.createElement('link');
        newLink.rel = relType;
        newLink.href = url;
        newLink.type = 'image/png';
        
        if (relType === 'apple-touch-icon' || relType === 'apple-touch-icon-precomposed') {
            newLink.sizes = '180x180';
        } else {
            newLink.sizes = '32x32';
        }
        
        document.head.appendChild(newLink);
    });
}

// 使用 iframe 技巧强制刷新 favicon（这是最有效的方法）
function forceFaviconRefresh(faviconUrl) {
    return new Promise((resolve) => {
        console.log('[forceFaviconRefresh] 开始 iframe 强制刷新');
        
        // 创建一个隐藏的 iframe，加载一个包含新 favicon 的页面
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.style.width = '1px';
        iframe.style.height = '1px';
        
        // 创建一个临时的 HTML 内容，包含新的 favicon
        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <link rel="icon" href="${faviconUrl}" type="image/png">
            </head>
            <body></body>
            </html>
        `;
        
        // 使用 blob URL 加载 iframe
        const blob = new Blob([htmlContent], { type: 'text/html' });
        iframe.src = URL.createObjectURL(blob);
        
        iframe.onload = () => {
            console.log('[forceFaviconRefresh] ✅ iframe 加载完成');
            
            // 等待一小段时间让浏览器加载 favicon
            setTimeout(() => {
                // 清理
                iframe.remove();
                URL.revokeObjectURL(iframe.src);
                console.log('[forceFaviconRefresh] ✅ iframe 清理完成');
                resolve();
            }, 1000);
        };
        
        iframe.onerror = () => {
            console.log('[forceFaviconRefresh] ⚠️ iframe 加载失败，继续执行');
            iframe.remove();
            resolve();
        };
        
        document.body.appendChild(iframe);
        console.log('[forceFaviconRefresh] ✅ iframe 已添加');
    });
}

// 将大图转换为适合作为 favicon 的小图（使用 canvas）
function createSmallFavicon(base64Url) {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = 32;
            canvas.height = 32;
            const ctx = canvas.getContext('2d');
            
            // 绘制图片并保持比例
            const scale = Math.min(32 / img.width, 32 / img.height);
            const x = (32 - img.width * scale) / 2;
            const y = (32 - img.height * scale) / 2;
            ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
            
            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = () => {
            // 如果加载失败，返回原始 URL
            console.log('[createSmallFavicon] ⚠️ 图片加载失败，使用原始 URL');
            resolve(base64Url);
        };
        img.src = base64Url;
    });
}
function importCustomCover(input){
    const file=input.files[0];if(!file||currentTrackId===null)return;
    const reader=new FileReader();reader.onload=(e)=>applyNewCover(e.target.result);reader.readAsDataURL(file);input.value='';
}

// ===== 歌词来源选择 + 手动搜索 =====
let currentLyricSource='tencent';
let _searchModalTrackId = null;  // 记录打开搜索modal时的歌曲ID，防止切歌后保存到错误歌曲
let _searchModalTrackIdx = -1;   // 记录打开搜索modal时的歌曲索引

function setLyricSource(val,text,el){currentLyricSource=val;document.getElementById('lyric-source-text').innerText=text;
    document.getElementById('lyric-source-select')?.classList.remove('open');
    document.querySelectorAll('#lyric-source-select .custom-option').forEach(opt=>opt.classList.remove('selected'));
    if(el)el.classList.add('selected');
}

function openSearchModal(){
    if(playlist.length===0)return;const t=playlist[curIdx];
    // 🔒 记录当前歌曲ID和索引，确保手动选择的歌词保存到正确的歌曲
    _searchModalTrackId = t.id;
    _searchModalTrackIdx = curIdx;
    document.getElementById('search-track').value=`${t.title} ${t.artist}`;document.getElementById('search-results').innerHTML='';
    // 取消进行中的自动歌词匹配，防止竞态覆盖手动选择
    lyricReqId++;
    toggleSearchModal(true);
    // 不自动搜索，等用户确认/修改后再手动点"搜索"按钮
}
async function performLyricSearch(){
    const query=document.getElementById('search-track').value.trim();const list=document.getElementById('search-results');if(!query)return;
    var goBtn=document.getElementById('lyric-search-go-btn');
    if(goBtn){goBtn.disabled=true;goBtn.textContent = i18n[curLang].searchLabel;}
    list.innerHTML=`<div style="display:flex;justify-content:center;padding:30px;"><div class="spinner"></div></div>`;
    try{
        if(currentLyricSource==='lrclib'){
            const res=await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(query)}`);const data=await res.json();list.innerHTML='';
            if(data.length===0){list.innerHTML=`<div style="text-align:center;padding:20px;opacity:0.6;">${i18n[curLang].notfound}</div>`;return;}
            data.forEach(item=>{
                if(!item.syncedLyrics&&!item.plainLyrics)return;
                const d=document.createElement('d');d.style.cssText="padding:12px;border-bottom:1px solid rgba(255,255,255,0.05);cursor:pointer;transition:0.2s;";
                d.onmouseover=()=>d.style.background='rgba(255,255,255,0.05)';d.onmouseout=()=>d.style.background='transparent';
                d.innerHTML=`<div class="search-result-title">${item.trackName}</div><div class="search-result-artist">${item.artistName}<span style="float:right;color:var(--accent)">${item.syncedLyrics?i18n[curLang].scrollLyrics:i18n[curLang].staticLyrics}</span></div>`;
                d.onclick=()=>applyNewLyrics(item.syncedLyrics||item.plainLyrics,!!item.syncedLyrics);list.appendChild(d);
            });
        } else if(currentLyricSource==='tencent'){
            // QQ音乐：优先尝试 QRC 逐字歌词
            list.innerHTML=`<div style="display:flex;justify-content:center;padding:30px;"><div class="spinner"></div><div class="search-result-hint" style="margin-top:8px;">${i18n[curLang].searchingQQMusic}</div></div>`;
            const r = await metingFetch(`/search?server=tencent&id=${encodeURIComponent(query)}`);
            const json = await r.json(); list.innerHTML='';
            const data = json.data || json;
            if(!data||data.length===0){list.innerHTML=`<div style="text-align:center;padding:20px;opacity:0.6;">${i18n[curLang].notfound}</div>`;return;}
            data.forEach(item=>{
                const d=document.createElement('d');d.style.cssText="padding:12px;border-bottom:1px solid rgba(255,255,255,0.05);cursor:pointer;transition:0.2s;display:flex;align-items:center;gap:12px;";
                d.onmouseover=()=>d.style.background='rgba(255,255,255,0.05)';d.onmouseout=()=>d.style.background='transparent';
                const displayName = item.name || item.title || i18n[curLang].unknownSong;
                const displayArtist = Array.isArray(item.artist) ? item.artist.join('/') : (item.artist || item.author || i18n[curLang].unknownSinger);
                const coverId = item.pic_id || item.id || '';
                const coverUrl = coverId ? `https://y.gtimg.cn/music/photo_new/T002R300x300M000${coverId}.jpg` : "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23333'/%3E%3C/svg%3E";
                d.innerHTML=`<div style="width:36px;height:36px;border-radius:6px;background:url('${coverUrl}') center/cover;"></div><div style="flex:1;overflow:hidden;"><div class="search-result-title" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${displayName}</div><div class="search-result-artist" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${displayArtist}</div></div><span class="search-result-hint" style="color:var(--accent);">${i18n[curLang].qrcWordLevel}</span>`;
                d.onclick=async()=>{
                    d.style.opacity='0.5';
                    // 🔒 取消所有进行中的自动歌词匹配，防止覆盖手动选择
                    lyricReqId++;
                    try{
                        // QQ音乐优先使用 songmid (url_id) 获取歌词，比数字ID更可靠
                        // item.id 可能是 Meting 内部ID，不一定对应正确的QQ音乐歌曲
                        const songMid = item.url_id || item.songmid || '';
                        const songId = item.lyric_id || item.id || '';
                        if(!songMid && !songId){showToast(i18n[curLang].noLyricId);return;}
                        // 优先传 songmid，让后端用 songmid 转换获取歌词
                        const lrcRes=await metingFetch(`/tencent/lyric-raw?id=${encodeURIComponent(songId)}&songmid=${encodeURIComponent(songMid)}`, 15000);
                        const lrcJson=await lrcRes.json();
                        if(lrcJson.success && lrcJson.lyrics){
                            applyNewLyrics(lrcJson.lyrics, true, 'qrc');
                        } else {
                            showToast(i18n[curLang].noLyricData + ': ' + (lrcJson.message || ''));
                        }
                    }catch(e){showToast(i18n[curLang].fetchLyricFail + ': ' + (e.message||''));}d.style.opacity='1';
                };list.appendChild(d);
            });
        } else{
            const r = await metingFetch(`/search?server=${currentLyricSource}&id=${encodeURIComponent(query)}`);
            const json = await r.json();list.innerHTML='';
            const data=json.data||json;
            if(!data||data.length===0){list.innerHTML=`<div style="text-align:center;padding:20px;opacity:0.6;">${i18n[curLang].notfound}</div>`;return;}
            data.forEach(item=>{
                const d=document.createElement('d');d.style.cssText="padding:12px;border-bottom:1px solid rgba(255,255,255,0.05);cursor:pointer;transition:0.2s;display:flex;align-items:center;gap:12px;";
                d.onmouseover=()=>d.style.background='rgba(255,255,255,0.05)';d.onmouseout=()=>d.style.background='transparent';
                const displayName = item.name || item.title || i18n[curLang].unknownSong;
                const displayArtist = Array.isArray(item.artist) ? item.artist.join('/') : (item.artist || item.author || i18n[curLang].unknownSinger);
                const coverId = item.pic_id || item.id || '';
                const coverUrl = coverId ? `${METING_API}/pic?server=${currentLyricSource}&id=${coverId}&size=300` : "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23333'/%3E%3C/svg%3E";
                d.innerHTML=`<div style="width:36px;height:36px;border-radius:6px;background:url('${coverUrl}') center/cover;"></div><div style="flex:1;overflow:hidden;"><div class="search-result-title" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${displayName}</div><div class="search-result-artist" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${displayArtist}</div></div>`;
                d.onclick=async()=>{
                    d.style.opacity='0.5';
                    lyricReqId++;
                    try{
                        if(!item.lyric_id){showToast(i18n[curLang].noLyricIdTrack);return;}
                        const lrcRes=await metingFetch(`/lyric?server=${currentLyricSource}&id=${item.lyric_id}`);
                        const lrcJson=await lrcRes.json();let lyricContent='';
                        lyricContent=(lrcJson.data&&lrcJson.data.lyric)||(lrcJson.data&&lrcJson.data.text)||lrcJson.lyric||lrcJson.text||'';
                        if(lyricContent&&lyricContent.includes('[00:'))applyNewLyrics(lyricContent,true);
                        else if(lyricContent&&lyricContent.length>10)applyNewLyrics(lyricContent,false);else showToast(i18n[curLang].noOnlineLyrics);
                    }catch(e){showToast(i18n[curLang].tryAnotherSource);}d.style.opacity='1';
                };list.appendChild(d);
            });
        }
    } catch(e){list.innerHTML=`<div style="text-align:center;padding:20px;opacity:0.6;">${i18n[curLang].searchErrorRetry}</div>`;}
    var goBtn2=document.getElementById('lyric-search-go-btn');
    if(goBtn2){goBtn2.disabled=false;goBtn2.textContent = i18n[curLang].searchLabel;}
}
async function applyNewLyrics(lyricText,isSynced,format){
    // 🔒 使用打开modal时记录的歌曲ID，防止切歌后保存到错误歌曲
    const targetId = _searchModalTrackId || currentTrackId;
    const targetIdx = _searchModalTrackIdx >= 0 ? _searchModalTrackIdx : curIdx;
    if(targetId===null||targetIdx<0||!playlist[targetIdx])return;
    toggleSearchModal(false);
    // 🔒 锁死：手动选择的歌词绝不被自动匹配覆盖
    lyricReqId++;
    playlist[targetIdx].savedLyrics=lyricText;
    window.IanMusicUtils.cacheSet('am_lyric_'+targetId, typeof lyricText === 'object' ? JSON.stringify(lyricText) : lyricText);
    if(typeof _manualLyricLock !== 'undefined'){
        _manualLyricLock.add(targetId);
        try{ localStorage.setItem('am_manual_lyric_lock', JSON.stringify([..._manualLyricLock])); }catch(e){}
    }
    if(playlist[targetIdx].isLocal)await updateLocalMeta(targetId,{savedLyrics:lyricText});
    // 只有当前正在播放这首歌时才立即渲染，否则只保存不渲染
    if(targetId === currentTrackId){
        if(format === 'qrc') {
            renderQrcLyrics(lyricText);
        } else if(isSynced) {
            renderLyrics(lyricText);
        } else {
            renderPlainLyrics(lyricText);
        }
    }
    showToast(i18n[curLang].lyricsUpdated);
    // 清除记录，防止影响下次操作
    _searchModalTrackId = null;
    _searchModalTrackIdx = -1;
}
function importCustomLyric(input){
    const file=input.files[0];if(!file||currentTrackId===null)return;
    const reader=new FileReader();reader.onload=(e)=>{const text=e.target.result;applyNewLyrics(text,text.includes('[00:'));};reader.readAsText(file);input.value='';
}

// ===== 原生媒体卡片（Android Bridge + Web MediaSession）=====
let __nativeRetryCount=0;
let __nativeUnavailable=false; // 一次性标记：检测到无bridge后不再重试
function syncNativeMediaCard(title,artist,coverUrl,isPlaying){
    if(title===null&&curIdx>=0&&playlist[curIdx]){const t=playlist[curIdx];title=t.title||i18n[curLang].unknownSong;artist=t.artist||i18n[curLang].unknownSinger;
        coverUrl=coverUrl||(t.cover||localStorage.getItem('am_cover_'+t.id)||'');}
    try{
        const posMs=Math.floor((audio&&audio.currentTime?audio.currentTime:0)*1000);
        const durMs=Math.floor((audio&&audio.duration&&isFinite(audio.duration)?audio.duration:0)*1000);
        // Android原生桥接（仅在Android WebView中可用）
        if(window.AndroidMusic){__nativeRetryCount=0;if(title&&artist!==undefined){window.AndroidMusic.updateMedia(title,artist,'IanMusic',!!isPlaying,posMs,durMs,coverUrl||'');}else{window.AndroidMusic.setPlaying(!!isPlaying,posMs,durMs);}}
        else if(!__nativeUnavailable){// 仅首次提示一次
            __nativeUnavailable=true;console.log('[MediaCard] ℹ️ Android bridge not available (desktop mode)');
        }
    } catch(e){/* 静默处理桥接异常 */}
    if('mediaSession'in navigator){
        if(title&&artist!==undefined){navigator.mediaSession.metadata=new MediaMetadata({title:title,artist:artist,album:'IanMusic',artwork:[{src:coverUrl||'',sizes:'512x512',type:'image/jpeg'}]});}
        navigator.mediaSession.playbackState=isPlaying?'playing':'paused';
        if(!navigator.mediaSession._actionsSet){
            navigator.mediaSession.setActionHandler('play',()=>{if(audio&&audio.paused)togglePlay();});
            navigator.mediaSession.setActionHandler('pause',()=>{if(audio&&!audio.paused)togglePlay();});
            navigator.mediaSession.setActionHandler('previoustrack',()=>{if(typeof prev==='function')prev();});
            navigator.mediaSession.setActionHandler('nexttrack',()=>{if(typeof next==='function')next();});
            navigator.mediaSession.setActionHandler('seekto',(details)=>{if(audio&&audio.duration){audio.currentTime=details.seekTime;if(details.fastSeek&&audio.fastSeek)audio.fastSeek(details.seekTime);}});
            navigator.mediaSession.setActionHandler('stop',()=>{if(audio){audio.pause();audio.currentTime=0;}});
            navigator.mediaSession._actionsSet=true;
        }
    }
}
window._onNativeMediaCmd=function(cmd){
    console.log('[MediaCard]',cmd);switch(cmd){
        case'play':case'pause':togglePlay();break;
        case'next':case'nexttrack':next();break;
        case'prev':case'previoustrack':prev();break;
        default:{if(cmd.indexOf('seek:')===0){const sec=parseFloat(cmd.split(':')[1])/1000;if(!isNaN(sec)&&audio&&audio.duration)audio.currentTime=Math.max(0,Math.min(audio.duration,sec));}}
    }
};

// ===== 初始化入口 =====
async function init(){
    console.log('%c[init] 🔥 初始化开始...', 'color:#ff453a;font-weight:bold;font-size:14px');

    // 🌟 配置 localforage 数据库名
    if (typeof localforage !== 'undefined' && localforage.config) {
        localforage.config({ name: 'LiquidMusic' });
        console.log('[init] localforage 已配置');
    } else {
        console.warn('[init] localforage 不可用，离线存储功能将受限');
    }
    
    loadSettings(); Picker.init();
    cleanupStorageCache();
    window.IanMusic.initStoragePath();
    updateDownloadPathDisplay();
    console.log('[init] loadSettings + Picker.init 完成, myTracks长度:', typeof myTracks !== 'undefined' ? myTracks.length : 'myTracks未定义!!!');

    (function(){
        var q='std';try{q=localStorage.getItem('am_quality')||'std';}catch(e){}
        var el=document.getElementById('q-'+q);if(el){document.querySelectorAll('#quality-segment .segment-opt').forEach(function(o){o.classList.remove('active');});el.classList.add('active');}
        var tag=document.getElementById('quality-tag');if(tag)tag.textContent=getQualityLabel();
    })();

    await window.IanMusic.loadTracksConfig();
    await loadLibrary();

    // 🌟 手机端状态同步（初始化）
    if (isShuffle) document.getElementById('mv-shuffle-btn')?.classList.add('active');
    updateRepeatUI();
    syncMobileVolUI(audio.volume);

    // 🌟 进度条拖拽事件监听（桌面端核心交互！）
    document.getElementById('seek')?.addEventListener('input', function() { isDrag=true; window.IanMusic.updateRangeUI(this); });
    document.getElementById('seek')?.addEventListener('change', function() {
        if(audio.duration&&isFinite(audio.duration)){
            audio.currentTime=(this.value/100)*audio.duration;
            setTimeout(function() { isDrag=false; }, 200);
        } else {
            isDrag=false;
        }
    });

    // 🌟 手机端进度条拖拽事件监听
    document.getElementById('mob-seek')?.addEventListener('input', function() { isDrag=true; });
    document.getElementById('mob-seek')?.addEventListener('change', function() {
        if(audio.duration&&isFinite(audio.duration)){
            audio.currentTime=(this.value/100)*audio.duration;
            setTimeout(function() { isDrag=false; }, 200);
        } else {
            isDrag=false;
        }
    });

    // 🌟 播放时实时更新进度条
    audio.addEventListener('timeupdate', function() {
        if (isDrag || !audio.duration || !isFinite(audio.duration)) return;
        const pct = (audio.currentTime / audio.duration) * 100;
        const seekEl = document.getElementById('seek');
        if (seekEl) { seekEl.value = pct; window.IanMusic.updateRangeUI(seekEl); }
        var mobSeekEl = document.getElementById('mob-seek');
        if (mobSeekEl) { mobSeekEl.value = pct; }
        const currEl = document.getElementById('curr');
        if (currEl) currEl.textContent = fmt(audio.currentTime);
        const durEl = document.getElementById('dur');
        if (durEl) durEl.textContent = fmt(audio.duration);
    });

    audio.addEventListener('seeked', function() {
        isDrag = false;
    });
    
    // 🌟 音量条拖拽事件监听
    document.getElementById('vol')?.addEventListener('input', (e) => { window.IanMusic.updateVolume(e.target); window.IanMusic.updateRangeUI(e.target); });
    const volEl=document.getElementById('vol');if(volEl)window.IanMusic.updateRangeUI(volEl);
    const seekEl=document.getElementById('seek');if(seekEl)window.IanMusic.updateRangeUI(seekEl);

    // 🌟 恢复 API 设置到输入框
    document.getElementById('api-key-input')?.setAttribute('value', aiApiKey);
    document.getElementById('api-url-input')?.setAttribute('value', aiBaseUrl);
    document.getElementById('api-model-input')?.setAttribute('value', aiModel);

    // 初始化移动端进度/音量条交互
    window.IanMusic.initMobileSeek(); window.IanMusic.initMobileVol(); window.IanMusic.initMobileGestures();

    // 恢复上次播放位置
    const lastTrackId=localStorage.getItem('am_last_track');
    if(lastTrackId){
        const idx=playlist.findIndex(t=>t.id===lastTrackId);
        if(idx>=0)loadTrack(idx,false);
    } else if(playlist.length>0){
        showHint();
    }

    // 窗口大小变化时刷新按钮显隐
    window.addEventListener('resize',updateTopBtnsVisibility);

    // 初始化来源选择器显示文本
    const sourceTextEl = document.getElementById('current-source-text');
    if (sourceTextEl) {
        const sourceMap = { 'kugou': '酷狗', 'netease': '网易云', 'tencent': 'QQ音乐', 'kuwo': '酷我', 'bilibili': '哔哩哔哩' };
        sourceTextEl.innerText = sourceMap[currentSource] || currentSource;
    }

    // 键盘快捷键：全局媒体控制
    window.addEventListener('keydown', function(e) {
        // 输入框内不拦截快捷键
        var tag = (e.target.tagName || '').toLowerCase();
        if (tag === 'input' || tag === 'textarea' || e.target.isContentEditable) return;
        // 快捷键
        if (e.code === 'Space') {
            e.preventDefault();
            if (typeof togglePlay === 'function') togglePlay(); else if (audio.paused) audio.play(); else audio.pause();
            return;
        }
        if (e.code === 'ArrowLeft') {
            e.preventDefault();
            audio.currentTime = Math.max(0, audio.currentTime - (e.ctrlKey||e.metaKey ? 1 : 5));
            return;
        }
        if (e.code === 'ArrowRight') {
            e.preventDefault();
            audio.currentTime = Math.min(audio.duration||0, audio.currentTime + (e.ctrlKey||e.metaKey ? 1 : 5));
            return;
        }
        if (e.ctrlKey || e.metaKey) {
            if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') return; // handled above
        }
        if (e.code === 'ArrowUp') {
            e.preventDefault();
            audio.volume = Math.min(1, audio.volume + 0.05);
            const volEl = document.getElementById('vol');
            if (volEl) { volEl.value = audio.volume * 100; window.IanMusic.updateRangeUI(volEl); }
            showToast(i18n[curLang].volumeToast + ' ' + Math.round(audio.volume * 100) + '%');
            return;
        }
        if (e.code === 'ArrowDown') {
            e.preventDefault();
            audio.volume = Math.max(0, audio.volume - 0.05);
            const volEl2 = document.getElementById('vol');
            if (volEl2) { volEl2.value = audio.volume * 100; window.IanMusic.updateRangeUI(volEl2); }
            showToast(i18n[curLang].volumeToast + ' ' + Math.round(audio.volume * 100) + '%');
            return;
        }
        if (e.code === 'MediaPlayPause' || e.code === 'MediaPlay' || e.code === 'MediaPause' || e.code === 'MediaStop') {
            e.preventDefault();
            if (typeof togglePlay === 'function') togglePlay(); else if (audio.paused) audio.play(); else audio.pause();
            return;
        }
        if (e.code === 'MediaTrackNext') { e.preventDefault(); next(); return; }
        if (e.code === 'MediaTrackPrevious') { e.preventDefault(); prev(); return; }

        if (e.code === 'Escape') {
            // 关闭所有打开的 modal
            var modals = document.querySelectorAll('.modal-overlay.active, [id$="-modal"].active');
            modals.forEach(function(m) { m.classList.remove('active'); });
            // 关闭设置
            var settings = document.getElementById('settings-modal');
            if (settings && settings.classList.contains('active')) settings.classList.remove('active');
            // 关闭 source 选择器
            var srcMenu = document.getElementById('source-menu');
            if (srcMenu && srcMenu.classList.contains('open')) srcMenu.classList.remove('open');
            // 退出全屏
            if (window.appRuntime && window.appRuntime.isElectron &&
                document.body.getAttribute('data-window-state') === 'fullscreen') {
                window.appRuntime.fullscreen();
            }
            updateTopBtnsVisibility();
            return;
        }
    });

    if (window.appRuntime && window.appRuntime.onSystemThemeChanged) {
        function _applySystemTheme(isDark) {
            if (isDark) {
                document.documentElement.classList.add('dark');
            } else {
                document.documentElement.classList.remove('dark');
            }
        }
        _applySystemTheme(window.matchMedia('(prefers-color-scheme: dark)').matches);
        window.appRuntime.onSystemThemeChanged(_applySystemTheme);
    }

    console.log('%c[init] ✅ 初始化完成！playlist长度:', playlist.length, 'color:#30d158;font-weight:bold');
    if (playlist.length === 0) {
        console.warn('%c[init] ⚠️ playlist为空！检查 myTracks 定义和 localforage', 'color:orange;font-weight:bold');
    }
    console.log('%c🎵 IanMusic %cLoaded','color:#fa2d48;font-weight:bold;font-size:16px','color:#888;font-size:12px');

    // 🍎 延迟初始化：Apple Music 流动背景（非关键UI，不阻塞首屏加载）
    var _startVisualizer = function() {
        try {
            window.__bgVisualizer = new window.IanMusic.AppleMusicVisualizer();
            window.__bgVisualizer.start();
            var hex = ThemeManager.getCurrentHex();
            if (hex) window.__bgVisualizer.setAccentColors([hex]);
            console.log('[init] AppleMusicVisualizer 已启动（延迟加载），主题色:', hex);
        } catch(e) {
            console.warn('[init] AppleMusicVisualizer 初始化失败:', e);
        }
    };
    if (typeof requestIdleCallback !== 'undefined') {
        requestIdleCallback(_startVisualizer);
    } else {
        setTimeout(_startVisualizer, 100);
    }

    // ===== Segment Control 滑动 pill + 键盘导航 + ARIA =====
    function syncSegPills() {
        document.querySelectorAll('.segment-control').forEach(function(ctrl) {
            var active = ctrl.querySelector('.segment-opt.active');
            if (active) {
                var borderL = parseFloat(getComputedStyle(ctrl).borderLeftWidth) || 1;
                ctrl.style.setProperty('--pill-x', (active.offsetLeft - borderL) + 'px');
                ctrl.style.setProperty('--pill-w', active.offsetWidth + 'px');
            }
        });
    }
    function initSegAria(ctrl) {
        ctrl.setAttribute('role', 'radiogroup');
        ctrl.setAttribute('aria-label', ctrl.closest('.settings-group')?.querySelector('.settings-section-title')?.textContent || ctrl.previousElementSibling?.textContent || 'Option');
        var opts = ctrl.querySelectorAll('.segment-opt');
        opts.forEach(function(opt, i) {
            opt.setAttribute('role', 'radio');
            opt.setAttribute('aria-checked', opt.classList.contains('active') ? 'true' : 'false');
            opt.setAttribute('tabindex', opt.classList.contains('active') ? '0' : '-1');
            if (!opt.hasAttribute('aria-label')) {
                opt.setAttribute('aria-label', (opt.textContent || '').trim());
            }
        });
    }
    function segNavigate(ctrl, dir) {
        var opts = Array.from(ctrl.querySelectorAll('.segment-opt:not(.disabled):not([aria-disabled="true"])'));
        if (opts.length < 2) return;
        var cur = ctrl.querySelector('.segment-opt[tabindex="0"]') || ctrl.querySelector('.segment-opt.active');
        var idx = opts.indexOf(cur);
        if (idx < 0) idx = 0;
        var next = opts[(idx + dir + opts.length) % opts.length];
        if (next && next !== cur) {
            if (next.onclick) { next.click(); }
            else {
                cur.classList.remove('active'); cur.setAttribute('aria-checked', 'false'); cur.setAttribute('tabindex', '-1');
                next.classList.add('active'); next.setAttribute('aria-checked', 'true'); next.setAttribute('tabindex', '0');
                next.focus({ preventScroll: true });
                requestAnimationFrame(syncSegPills);
            }
        }
    }
    document.querySelectorAll('.segment-control').forEach(function(ctrl) {
        initSegAria(ctrl);
        ctrl.addEventListener('keydown', function(e) {
            var isRTL = getComputedStyle(ctrl).direction === 'rtl';
            var dir;
            if (e.key === 'ArrowLeft') dir = isRTL ? 1 : -1;
            else if (e.key === 'ArrowRight') dir = isRTL ? -1 : 1;
            else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); return; }
            else if (e.key === 'Home') { var f = ctrl.querySelector('.segment-opt:not(.disabled)'); if (f && f.onclick) f.click(); e.preventDefault(); return; }
            else if (e.key === 'End') { var all = ctrl.querySelectorAll('.segment-opt:not(.disabled)'); var l = all[all.length - 1]; if (l && l.onclick) l.click(); e.preventDefault(); return; }
            else return;
            e.preventDefault();
            segNavigate(ctrl, dir);
        });
    });
    syncSegPills();
    requestAnimationFrame(function() { requestAnimationFrame(syncSegPills); });
    document.addEventListener('click', function(e) {
        var opt = e.target.closest('.segment-opt');
        if (!opt) return;
        var ctrl = opt.closest('.segment-control');
        if (!ctrl) return;
        requestAnimationFrame(function() {
            ctrl.querySelectorAll('.segment-opt').forEach(function(o) { o.setAttribute('tabindex', '-1'); });
            var active = ctrl.querySelector('.segment-opt.active') || opt;
            active.setAttribute('aria-checked', 'true');
            active.setAttribute('tabindex', '0');
            ctrl.querySelectorAll('.segment-opt:not(.active)').forEach(function(o) { o.setAttribute('aria-checked', 'false'); });
            syncSegPills();
        });
    });
    if (window.ResizeObserver) {
        new ResizeObserver(function() { requestAnimationFrame(syncSegPills); }).observe(document.body);
    } else {
        window.addEventListener('resize', syncSegPills);
    }
    var _settingsObs = new MutationObserver(function(muts) {
        muts.forEach(function(m) {
            if (m.target.id === 'settings-modal' && m.target.classList.contains('active')) {
                requestAnimationFrame(function() { requestAnimationFrame(syncSegPills); });
            }
        });
    });
    var _settingsEl = document.getElementById('settings-modal');
    if (_settingsEl) _settingsObs.observe(_settingsEl, { attributes: true, attributeFilter: ['class'] });

    // 首次使用声明弹窗（仅一次/会话，点击外部不可关闭）
    if (!localStorage.getItem('am_first_time_ack')) {
        var _ftModal = document.getElementById('first-time-modal');
        var _ftBtn = document.getElementById('first-time-ack-btn');
        if (_ftModal && _ftBtn) {
            _ftModal.classList.add('active');
            _ftBtn.onclick = function() {
                localStorage.setItem('am_first_time_ack', '1');
                _ftModal.classList.remove('active');
            };
        }
    }

    window.addEventListener('beforeunload', () => {
        clearInterval(sleepInterval);
        if (window.__bgVisualizer && typeof window.__bgVisualizer.destroy === 'function') {
            window.__bgVisualizer.destroy();
        }
    });
}

window.IanMusic.init=init;window.IanMusic.setBlur=setBlur;window.IanMusic.setSize=setSize;
window.IanMusic.cycleSleepTimer=cycleSleepTimer;window.IanMusic.setSleep=setSleep;window.IanMusic.setCustomSleep=setCustomSleep;
window.IanMusic.openCoverSearchModal=openCoverSearchModal;window.IanMusic.performCoverSearch=performCoverSearch;
window.IanMusic.applyNewCover=applyNewCover;window.IanMusic.importCustomCover=importCustomCover;
window.IanMusic.cacheCoverAsBase64=cacheCoverAsBase64;
window.IanMusic.setLyricSource=setLyricSource;window.IanMusic.openSearchModal=openSearchModal;
window.IanMusic.performLyricSearch=performLyricSearch;window.IanMusic.applyNewLyrics=applyNewLyrics;
window.IanMusic.importCustomLyric=importCustomLyric;window.IanMusic.syncNativeMediaCard=syncNativeMediaCard;

window.toggleOfflinePanel = function() {
    var panel = document.getElementById('offline-panel');
    if (!panel) return;
    var isOpen = panel.style.display === 'block';
    panel.style.display = isOpen ? 'none' : 'block';
    var overlay = document.getElementById('offline-overlay');
    if (overlay) overlay.style.display = isOpen ? 'none' : 'block';
    if (!isOpen) {
        window.IanMusic.renderOfflinePanel();
    }
    if (typeof updateTopBtnsVisibility === 'function') updateTopBtnsVisibility();
};

window.IanMusic.getStoragePath = function() {
    try {
        if (window.appRuntime && window.appRuntime.isElectron && window.appRuntime.songsGetDir) {
            var dir = window.appRuntime.songsGetDir();
            if (dir && typeof dir === 'string') return dir;
            var customPath = localStorage.getItem('am_download_path');
            if (customPath) return customPath;
        }
    } catch(e) {}
    return 'IndexedDB \u00b7 ianmusic_downloads';
};

window.IanMusic.initStoragePath = async function() {
    try {
        if (window.appRuntime && window.appRuntime.isElectron) {
            if (window.appRuntime.songsGetDir) {
                var songsDir = await window.appRuntime.songsGetDir();
                if (songsDir) {
                    localStorage.setItem('am_download_path', songsDir);
                    return;
                }
            }
            if (window.appRuntime.getUserDataPath) {
                var customPath = localStorage.getItem('am_download_path');
                if (!customPath) {
                    var userDataPath = await window.appRuntime.getUserDataPath();
                    var sep = (window.appRuntime.platform === 'win32') ? '\\' : '/';
                    localStorage.setItem('am_download_path', userDataPath + sep + 'IndexedDB');
                }
            }
        }
    } catch(e) {}
};

window.IanMusic.openStoragePath = async function() {
    try {
        if (window.appRuntime && window.appRuntime.openPathInExplorer) {
            var path = window.IanMusic.getStoragePath();
            if (path && path !== 'IndexedDB \u00b7 ianmusic_downloads') {
                await window.appRuntime.openPathInExplorer(path);
            } else {
                if (typeof showToast === 'function') showToast('仅在 Electron 桌面端支持打开文件夹');
            }
        } else {
            if (typeof showToast === 'function') showToast('仅在 Electron 桌面端支持打开文件夹');
        }
    } catch(e) {
        if (typeof showToast === 'function') showToast('无法打开文件夹');
    }
};

window.changeDownloadPath = async function() {
    console.log('[changeDownloadPath] 开始选择下载路径');
    try {
        // 方法1: Electron IPC selectFolder
        if (window.appRuntime && window.appRuntime.selectFolder) {
            console.log('[changeDownloadPath] 使用 Electron IPC selectFolder');
            try {
                var selectedPath = await window.appRuntime.selectFolder();
                if (selectedPath) {
                    localStorage.setItem('am_download_path', selectedPath);
                    updateDownloadPathDisplay();
                    if (typeof showToast === 'function') showToast('下载路径已更新');
                    console.log('[changeDownloadPath] 路径已更新:', selectedPath);
                    return;
                }
                // 用户取消了对话框，直接返回，不尝试其他方法
                console.log('[changeDownloadPath] 用户取消了文件夹选择');
                return;
            } catch(e) {
                console.warn('[changeDownloadPath] IPC selectFolder 异常:', e);
                return;
            }
        }

        // 方法2: File System Access API
        if (typeof window.showDirectoryPicker === 'function') {
            console.log('[changeDownloadPath] 使用 showDirectoryPicker');
            try {
                var dirHandle = await window.showDirectoryPicker();
                if (dirHandle && dirHandle.name) {
                    localStorage.setItem('am_download_path', 'FileSystem: ' + dirHandle.name);
                    updateDownloadPathDisplay();
                    if (typeof showToast === 'function') showToast('下载路径已更新');
                    console.log('[changeDownloadPath] 路径已更新:', dirHandle.name);
                    return;
                }
                return;
            } catch(e) {
                if (e.name === 'AbortError') {
                    console.log('[changeDownloadPath] 用户取消了 showDirectoryPicker');
                    return;
                }
                console.warn('[changeDownloadPath] showDirectoryPicker 异常:', e);
            }
        }

        // 方法3: webkitdirectory input
        console.log('[changeDownloadPath] 使用 webkitdirectory');
        try {
            var dirPath = await new Promise(function(resolve) {
                var input = document.createElement('input');
                input.type = 'file';
                input.webkitdirectory = true;
                input.style.display = 'none';
                var resolved = false;
                input.addEventListener('change', function() {
                    resolved = true;
                    if (input.files && input.files.length > 0) {
                        var file = input.files[0];
                        if (file.path && file.webkitRelativePath) {
                            var p = file.path.substring(0, file.path.length - file.webkitRelativePath.length - 1);
                            resolve(p);
                        } else if (file.webkitRelativePath) {
                            var parts = file.webkitRelativePath.split('/');
                            resolve(parts[0]);
                        } else {
                            resolve(null);
                        }
                    } else {
                        resolve(null);
                    }
                    if (input.parentNode) document.body.removeChild(input);
                });
                document.body.appendChild(input);
                input.click();
                // 监听窗口focus事件来检测用户取消
                var onFocus = function() {
                    setTimeout(function() {
                        if (!resolved) {
                            resolved = true;
                            resolve(null);
                            if (input.parentNode) document.body.removeChild(input);
                        }
                    }, 300);
                };
                window.addEventListener('focus', onFocus, { once: true });
                setTimeout(function() {
                    if (!resolved) {
                        resolved = true;
                        resolve(null);
                        if (input.parentNode) document.body.removeChild(input);
                    }
                    window.removeEventListener('focus', onFocus);
                }, 60000);
            });
            if (dirPath) {
                localStorage.setItem('am_download_path', dirPath);
                updateDownloadPathDisplay();
                if (typeof showToast === 'function') showToast('下载路径已更新');
                console.log('[changeDownloadPath] 路径已更新:', dirPath);
                return;
            }
            // 用户取消了文件夹选择
            console.log('[changeDownloadPath] 用户取消了 webkitdirectory');
            return;
        } catch(e) {
            console.warn('[changeDownloadPath] webkitdirectory 异常:', e);
        }

        // 方法4: prompt() 兜底
        console.log('[changeDownloadPath] 使用 prompt 兜底');
        var currentPath = localStorage.getItem('am_download_path') || '';
        var newPath = prompt('请输入新的下载路径:', currentPath);
        if (newPath !== null && newPath.trim()) {
            localStorage.setItem('am_download_path', newPath.trim());
            updateDownloadPathDisplay();
            if (typeof showToast === 'function') showToast('下载路径已更新');
            console.log('[changeDownloadPath] 路径已更新:', newPath.trim());
        }
    } catch(e) {
        console.error('[changeDownloadPath] 错误:', e);
        if (typeof showToast === 'function') showToast('选择文件夹失败');
    }
};

window.resetDownloadPath = async function() {
    try {
        if (window.appRuntime && window.appRuntime.getUserDataPath) {
            var userDataPath = await window.appRuntime.getUserDataPath();
            var sep = (window.appRuntime && window.appRuntime.platform === 'win32') ? '\\' : '/';
            localStorage.setItem('am_download_path', userDataPath + sep + 'IndexedDB');
        } else {
            localStorage.removeItem('am_download_path');
        }
    } catch(e) {
        localStorage.removeItem('am_download_path');
    }
    updateDownloadPathDisplay();
    if (typeof showToast === 'function') showToast('下载路径已重置');
};

function updateDownloadPathDisplay() {
    var display = document.getElementById('download-path-display');
    if (display) {
        display.textContent = window.IanMusic.getStoragePath();
    }
}

window.getQualityLabel = function() {
    return localStorage.getItem('am_quality') || 'std';
};

window.setQuality = async function(q) {
    try { localStorage.setItem('am_quality', q); } catch(e) {}
    document.querySelectorAll('#quality-segment .segment-opt').forEach(function(o){o.classList.remove('active');});
    var el=document.getElementById('q-'+q);if(el)el.classList.add('active');
    var label=q==='sq'?'SQ 无损':q==='hq'?'HQ 高品质':q==='aac'?'AAC':'标准';
    var tag=document.getElementById('quality-tag');if(tag)tag.textContent=getQualityLabel();

    if(typeof curIdx!=='undefined'&&curIdx>=0&&playlist[curIdx]&&!audio.paused){
        var t = playlist[curIdx];
        var pos = audio.currentTime;
        var wasPlaying = !audio.paused;

        var bitrate = 128;
        switch(q) {
            case 'sq': bitrate = 999; break;
            case 'hq': bitrate = 320; break;
            case 'aac': bitrate = 256; break;
            default: bitrate = 128;
        }

        var server = t.source || t._source || '';
        var songId = t._songId || t.id || '';

        if (server && songId && typeof window.IanMusicUtils !== 'undefined' && window.IanMusicUtils.tryBitrate && typeof metingFetch === 'function') {
            try {
                showToast('正在切换至 ' + label + ' 音质...', '');
                var bitrateList = [bitrate];
                if (bitrate !== 128) bitrateList.push(128);
                var newUrl = await window.IanMusicUtils.tryBitrate(server, songId, bitrateList, metingFetch);
                if (newUrl && newUrl !== t.src) {
                    t.src = newUrl;
                    audio.src = newUrl;
                    audio.load();
                    audio.currentTime = pos;
                    if (wasPlaying) audio.play().catch(function(){});
                    showToast('已切换至 ' + label + ' 音质');
                    return;
                } else if (!newUrl && bitrate !== 128) {
                    showToast(label + ' 音质不可用，保持当前音质', 'warn');
                    return;
                }
            } catch(e) {
                console.warn('[setQuality] 音质切换失败:', e.message);
            }
        }

        showToast('已切换至 ' + label + ' 音质');
        loadTrack(curIdx, wasPlaying).then(function(){ if(wasPlaying) audio.currentTime = pos; });
    } else {
        showToast('已切换至 ' + label + ' 音质');
    }
};

function addSearchHistory(query) {
    if (!query || !query.trim()) return;
    var q = query.trim();
    var hist = [];
    try { hist = JSON.parse(localStorage.getItem('am_search_history') || '[]'); } catch(e) {}
    hist = hist.filter(function(h) { return h !== q; });
    hist.unshift(q);
    if (hist.length > 15) hist = hist.slice(0, 15);
    try { localStorage.setItem('am_search_history', JSON.stringify(hist)); } catch(e) {}
    renderSearchHistory();
}
function renderSearchHistory() {
    var container = document.getElementById('search-history-tags');
    if (!container) return;
    var hist = [];
    try { hist = JSON.parse(localStorage.getItem('am_search_history') || '[]'); } catch(e) {}
    container.innerHTML = '';
    hist.forEach(function(h) {
        var tag = document.createElement('span');
        tag.className = 'search-history-tag';
        tag.textContent = h;
        tag.onclick = function() {
            document.getElementById('net-search-input').value = h;
            performNetSearch();
        };
        container.appendChild(tag);
    });
}
function clearSearchHistory() {
    try { localStorage.removeItem('am_search_history'); } catch(e) {}
    renderSearchHistory();
}
window.IanMusic.addSearchHistory = addSearchHistory;
window.IanMusic.renderSearchHistory = renderSearchHistory;
window.IanMusic.clearSearchHistory = clearSearchHistory;


