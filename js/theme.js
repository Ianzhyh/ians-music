/**
 * @module IanMusic/theme
 * @description 统一主题色系统 - v3 极简版
 *
 * 设计原则:
 *   1. 所有导出都是 window 全局，不依赖 const/let 的跨脚本可见性
 *   2. 取色永远从 base64 数据源走（不会遇到 CORS 问题）
 *   3. 一旦提取到颜色立刻 apply，不等任何东西
 */

window.IanMusic = window.IanMusic || {};

// ================================================================
// 内部状态
// ================================================================
var _themeAuto = true;
var _themeReqId = 0;

// ================================================================
// parseColor(color) → { r, g, b, hex } | null
// ================================================================
function _parseColor(c) {
    if (!c) return null;
    var m, r, g, b;
    if (c.charAt(0) === '#') {
        m = c.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
        if (!m) return null;
        r = parseInt(m[1], 16); g = parseInt(m[2], 16); b = parseInt(m[3], 16);
        return { r: r, g: g, b: b, hex: c.toLowerCase() };
    }
    if (c.indexOf('rgb(') === 0) {
        m = c.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (!m) return null;
        r = +m[1]; g = +m[2]; b = +m[3];
        return { r: r, g: g, b: b,
            hex: '#' + _h(r) + _h(g) + _h(b) };
    }
    if (c.indexOf('hsl(') === 0) {
        m = c.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
        if (!m) return null;
        var arr = _hsl2rgb(+m[1]/360, +m[2]/100, +m[3]/100);
        r = arr[0]; g = arr[1]; b = arr[2];
        return { r: r, g: g, b: b,
            hex: '#' + _h(r) + _h(g) + _h(b) };
    }
    return null;
}
function _h(n) { return ('0' + n.toString(16)).slice(-2); }

function _hsl2rgb(h, s, l) {
    var r, g, b;
    if (s === 0) { r = g = b = l; }
    else {
        var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        var p = 2 * l - q;
        r = _hue(p, q, h + 1/3);
        g = _hue(p, q, h);
        b = _hue(p, q, h - 1/3);
    }
    return [Math.round(r*255), Math.round(g*255), Math.round(b*255)];
}
function _hue(p, q, t) {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
}

function _bright(r, g, b, ratio) {
    return '#' + _h(Math.min(255, Math.round(r*(1+ratio)))) +
                 _h(Math.min(255, Math.round(g*(1+ratio)))) +
                 _h(Math.min(255, Math.round(b*(1+ratio))));
}
function _dark(r, g, b, ratio) {
    return '#' + _h(Math.max(0, Math.round(r*(1-ratio)))) +
                 _h(Math.max(0, Math.round(g*(1-ratio)))) +
                 _h(Math.max(0, Math.round(b*(1-ratio))));
}

// ================================================================
// MMCQ — 从像素数组找主导色
// ================================================================
function _mmcq(pixels) {
    function VBox(pxs) {
        this.rMin=255;this.rMax=0;this.gMin=255;this.gMax=0;this.bMin=255;this.bMax=0;
        this.pixels=pxs;
        for (var i=0;i<pxs.length;i++) {
            var p=pxs[i];
            if(p[0]<this.rMin)this.rMin=p[0];if(p[0]>this.rMax)this.rMax=p[0];
            if(p[1]<this.gMin)this.gMin=p[1];if(p[1]>this.gMax)this.gMax=p[1];
            if(p[2]<this.bMin)this.bMin=p[2];if(p[2]>this.bMax)this.bMax=p[2];
        }
    }
    VBox.prototype.volume=function(){return(this.rMax-this.rMin)*(this.gMax-this.gMin)*(this.bMax-this.bMin);};
    VBox.prototype.count=function(){return this.pixels.length;};
    VBox.prototype.average=function(){
        var r=0,g=0,b=0;
        for(var i=0;i<this.pixels.length;i++){r+=this.pixels[i][0];g+=this.pixels[i][1];b+=this.pixels[i][2];}
        var n=this.pixels.length;
        return[Math.round(r/n),Math.round(g/n),Math.round(b/n)];
    };
    VBox.prototype.split=function(){
        if(this.pixels.length<=1)return null;
        var dr=this.rMax-this.rMin,dg=this.gMax-this.gMin,db=this.bMax-this.bMin;
        var ch='r',rng=dr;
        if(dg>=dr&&dg>=db){ch='g';rng=dg;}
        if(db>=dr&&db>=dg){ch='b';rng=db;}
        if(rng===0)return null;
        var ci=(ch==='r'?0:(ch==='g'?1:2));
        this.pixels.sort(function(a,b){return a[ci]-b[ci];});
        var mid=Math.floor(this.pixels.length/2);
        return[new VBox(this.pixels.slice(0,mid)),new VBox(this.pixels.slice(mid))];
    };

    var boxes=[new VBox(pixels)];
    for(var it=0;it<8;it++){
        var best=null,bv=-1,bi=-1;
        for(var i=0;i<boxes.length;i++){
            var v=boxes[i].volume();
            if(v>bv&&boxes[i].count()>1){bv=v;best=boxes[i];bi=i;}
        }
        if(!best||bv<=0)break;
        var parts=best.split();if(!parts)break;
        boxes.splice(bi,1);boxes.push(parts[0],parts[1]);
    }
    var bestBox=null,bc=0;
    for(var j=0;j<boxes.length;j++){
        var ct=boxes[j].count();if(ct>bc){bc=ct;bestBox=boxes[j];}
    }
    return bestBox?bestBox.average():(pixels[0]||[128,64,96]);
}

// ================================================================
// 从一个 Image 元素提取主导色 → Promise<"rgb(r,g,b)"|null>
// ================================================================
function _extractFromImg(img) {
    return new Promise(function(resolve) {
        console.log('[Theme] _extractFromImg start');
        var cv = document.createElement('canvas');
        cv.width = 80; cv.height = 80;
        var ctx = cv.getContext('2d');
        ctx.drawImage(img, 0, 0, 80, 80);
        var data;
        try { data = ctx.getImageData(0, 0, 80, 80).data; }
        catch(e) { console.warn('[Theme] getImageData failed (cross-origin?):', e.message); resolve(null); return; }

        var px = [];
        for (var i = 0; i < data.length; i += 4) {
            var r = data[i], g = data[i+1], b = data[i+2];
            var lum = (r*299 + g*587 + b*114) / 1000;
            if (lum < 20 || lum > 235) continue;
            var mx = Math.max(r,g,b), mn = Math.min(r,g,b);
            if (mx > 0 && (mx - mn) / mx < 0.05) continue;
            px.push([r, g, b]);
        }
        var result;
        if (px.length === 0) {
            var sr=0,sg=0,sb=0,n=0;
            for (var j=0;j<data.length;j+=4){sr+=data[j];sg+=data[j+1];sb+=data[j+2];n++;}
            result = n>0?[Math.round(sr/n),Math.round(sg/n),Math.round(sb/n)]:null;
        } else { result = _mmcq(px); }
        if (!result) result = [128, 64, 96];

        var fr=result[0],fg=result[1],fb=result[2];
        if ((fr*299+fg*587+fb*114)/1000 < 70) {
            fr = Math.min(255, fr+85); fg = Math.min(255, fg+85); fb = Math.min(255, fb+85);
        }
        console.log('[Theme] _extractFromImg result:', fr, fg, fb);
        resolve('rgb('+fr+','+fg+','+fb+')');
    });
}

// ================================================================
// 从 URL 取色: data: → 直接提取 / http: → cacheCoverAsBase64 → 提取
// ================================================================
function _extractFromUrl(url, trackId) {
    console.log('[Theme] _extractFromUrl', url ? url.substring(0,40) : 'null', 'trackId:', trackId);

    return new Promise(function(resolve) {
        // --- data: ---
        if (url && url.indexOf('data:') === 0) {
            var img1 = new Image();
            img1.onload  = function() { _extractFromImg(img1).then(resolve); };
            img1.onerror = function() { console.warn('[Theme] data: img load error'); resolve(null); };
            img1.src = url;
            return;
        }

        // --- try localStorage b64 cache ---
        if (trackId) {
            var cached = localStorage.getItem('am_cover_b64_' + trackId);
            if (cached && cached.indexOf('data:') === 0) {
                console.log('[Theme] found cached b64');
                var img2 = new Image();
                img2.onload  = function() { _extractFromImg(img2).then(resolve); };
                img2.onerror = function() { console.warn('[Theme] cached b64 load error'); resolve(null); };
                img2.src = cached;
                return;
            }
        }

        // --- try cacheCoverAsBase64 ---
        if (url && url.indexOf('http') === 0 && trackId) {
            var cacheFn = window.IanMusic && window.IanMusic.cacheCoverAsBase64;
            if (typeof cacheFn === 'function') {
                console.log('[Theme] calling cacheCoverAsBase64...');
                cacheFn(url, trackId).then(function(b64) {
                    console.log('[Theme] cacheCoverAsBase64 returned:', b64 ? b64.substring(0,30) : 'null');
                    if (b64 && b64.indexOf('data:') === 0) {
                        var img3 = new Image();
                        img3.onload  = function() { _extractFromImg(img3).then(resolve); };
                        img3.onerror = function() { console.warn('[Theme] fetched b64 load error'); resolve(null); };
                        img3.src = b64;
                    } else { resolve(null); }
                }).catch(function(e) {
                    console.warn('[Theme] cacheCoverAsBase64 error:', e.message);
                    resolve(null);
                });
                return;
            }
        }

        // --- nothing works ---
        console.warn('[Theme] no valid source, returning null');
        resolve(null);
    });
}

// ================================================================
// apply(color, sourceEl) → 更新所有 CSS 变量 + UI
// ================================================================
function _apply(color, sourceEl) {
    console.log('[Theme] _apply called, color:', color, 'sourceEl:', sourceEl ? sourceEl.id : 'null');
    if (!color) { console.warn('[Theme] _apply: color is null, aborting'); return; }
    var p = _parseColor(color);
    if (!p) { console.warn('[Theme] _apply: parseColor failed for', color); return; }
    var r = p.r, g = p.g, b = p.b, hex = p.hex;

    var root = document.documentElement.style;
    root.setProperty('--accent',       hex);
    root.setProperty('--accent-dim',   'rgba('+r+','+g+','+b+',0.30)');
    root.setProperty('--accent-glow',  'rgba('+r+','+g+','+b+',0.20)');
    root.setProperty('--accent-hover', _bright(r,g,b,0.12));
    root.setProperty('--accent-press', _dark(r,g,b,0.10));
    root.setProperty('--accent-r',     r);
    root.setProperty('--accent-g',     g);
    root.setProperty('--accent-b',     b);
    root.setProperty('--accent-rgb',   1);
    root.setProperty('--accent-blue',      '#0a84ff');
    root.setProperty('--accent-blue-dim',  'rgba(10,132,255,0.25)');
    root.setProperty('--accent-amber',     '#ff9f0a');
    root.setProperty('--accent-amber-dim', 'rgba(255,159,10,0.25)');
    root.setProperty('--shadow-glow',
        '0 0 30px rgba('+r+','+g+','+b+',0.20), 0 0 60px rgba('+r+','+g+','+b+',0.08)');

    localStorage.setItem('am_accent', hex);

    // --- auto / manual mode ---
    if (sourceEl && sourceEl.id !== 'auto-color-btn') {
        _themeAuto = false;
        localStorage.setItem('am_auto_color', 'false');
        console.log('[Theme] switched to MANUAL mode');
    }
    if (sourceEl && sourceEl.id === 'auto-color-btn') {
        _themeAuto = true;
        localStorage.setItem('am_auto_color', 'true');
    }

    // --- UI sync ---
    document.querySelectorAll('.color-circle').forEach(function(el){el.classList.remove('active');});
    if (sourceEl) sourceEl.classList.add('active');
    if (typeof updateRangeUI === 'function') {
        var s=document.getElementById('seek'),v=document.getElementById('vol');
        if(s)updateRangeUI(s);if(v)updateRangeUI(v);
    }
    if (window.__bgVisualizer && typeof window.__bgVisualizer.setAccentColors === 'function') {
        window.__bgVisualizer.setAccentColors([hex]);
    }
    console.log('[Theme] ✅ applied', hex, '| auto:', _themeAuto);
}

// ================================================================
// extractAndApply(url, trackId) → 提取 + 应用（带 reqId 防过期）
// ================================================================
function _extractAndApply(url, trackId) {
    var reqId = ++_themeReqId;
    console.log('[Theme] _extractAndApply reqId:', reqId);
    _extractFromUrl(url, trackId).then(function(color) {
        if (reqId !== _themeReqId) {
            console.log('[Theme] stale request', reqId, 'discarded, current:', _themeReqId);
            return;
        }
        if (!color) {
            console.warn('[Theme] extraction returned null, using fallback');
            color = '#fa2d48';
        }
        console.log('[Theme] extracted:', color);
        _apply(color, document.getElementById('auto-color-btn'));
    });
}

// ================================================================
// 初始化
// ================================================================
function _init() {
    _themeAuto = localStorage.getItem('am_auto_color') !== 'false';
    var saved = localStorage.getItem('am_accent');
    console.log('[Theme] init — auto:', _themeAuto, 'saved:', saved);
    if (saved) _apply(saved, _themeAuto ? document.getElementById('auto-color-btn') : null);
}

// ================================================================
// 导出 — window 全局
// ================================================================

// 供 HTML onclick 使用
window.setAccent = function(color, el) {
    console.log('[Theme] setAccent clicked:', color);
    _apply(color, el);
};

window.setAutoColorMode = function() {
    console.log('[Theme] setAutoColorMode clicked');
    _themeAuto = true;
    localStorage.setItem('am_auto_color', 'true');

    document.querySelectorAll('.color-circle').forEach(function(el){el.classList.remove('active');});
    var btn = document.getElementById('auto-color-btn');
    if (btn) btn.classList.add('active');

    if (typeof showToast === 'function') showToast(i18n[curLang].autoColorMode);

    // ── 收集所有可能的封面来源 ──
    var cover = null;
    var trackId = null;

    // 1. 从当前播放的歌曲
    if (typeof curIdx !== 'undefined' && typeof playlist !== 'undefined' &&
        curIdx >= 0 && playlist[curIdx]) {
        var t = playlist[curIdx];
        trackId = t.id;
        cover = t.cover || localStorage.getItem('am_cover_' + t.id);
        console.log('[Theme] source 1 (track.cover):', cover ? cover.substring(0,40) : 'null');
    }

    // 2. localStorage base64 缓存（最优来源）
    if (!cover && trackId) {
        var b64 = localStorage.getItem('am_cover_b64_' + trackId);
        if (b64 && b64.indexOf('data:') === 0) {
            cover = b64;
            console.log('[Theme] source 2 (b64 cache):', b64.substring(0,30));
        }
    }

    // 3. 从页面上的 #art 元素读取背景图 URL
    if (!cover) {
        var art = document.getElementById('art');
        if (art && art.style.backgroundImage) {
            var bg = art.style.backgroundImage;
            var m = bg.match(/url\(["']?([^"')]+)["']?\)/);
            if (m && m[1]) {
                cover = m[1];
                console.log('[Theme] source 3 (#art bg):', cover.substring(0,40));
            }
        }
    }

    // 4. 从 visualizer 的 currentSrc
    if (!cover && window.__bgVisualizer && window.__bgVisualizer.currentSrc) {
        cover = window.__bgVisualizer.currentSrc;
        console.log('[Theme] source 4 (visualizer):', cover.substring(0,40));
    }

    // 5. 从 currentTrackId 的 localStorage 缓存
    if (!cover && typeof currentTrackId !== 'undefined' && currentTrackId) {
        trackId = trackId || currentTrackId;
        cover = localStorage.getItem('am_cover_' + trackId);
        console.log('[Theme] source 5 (am_cover_):', cover ? cover.substring(0,40) : 'null');
    }

    // ── 尝试提取并应用（保证一定有视觉反馈）──
    if (cover && (cover.indexOf('http') === 0 || cover.indexOf('data:') === 0)) {
        console.log('[Theme] auto mode: extracting from', cover.substring(0,50));
        _extractAndApply(cover, trackId);
    } else {
        // 没有封面可用 → 直接用默认色，确保 UI 变化
        console.warn('[Theme] auto mode: no cover found, applying default accent');
        _apply('#fa2d48', btn);
    }
};

// 兼容旧全局别名
window.commitAccent = function(c, el) { _apply(c, el); };
window.getThemeColor = function(url, tid) { return _extractFromUrl(url, tid); };
window.toggleCustomPicker = function() {
    var cp = document.getElementById('custom-picker');
    if (cp) cp.classList.toggle('active');
};
window.updateColorFromPicker = function() {
    if (typeof Picker !== 'undefined' && Picker.draw) {
        Picker.draw(document.getElementById('hue-slider').value);
    }
};
window.isAutoColor = true; // 只读兼容

// ================================================================
// ThemeManager 对象（供 player.js / app.js 调用）
// ================================================================
window.ThemeManager = {
    init:             _init,
    apply:            _apply,
    isAutoMode:       function() { return _themeAuto; },
    setAutoMode:      function(v) {
        _themeAuto = !!v;
        localStorage.setItem('am_auto_color', String(_themeAuto));
        if (v) {
            document.querySelectorAll('.color-circle').forEach(function(el){el.classList.remove('active');});
            var btn = document.getElementById('auto-color-btn');
            if (btn) btn.classList.add('active');
        }
    },
    extractFromCover: _extractFromUrl,
    extractAndApply:  _extractAndApply,
    getCurrentHex:    function() {
        var v = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
        return v || '#fa2d48';
    }
};

window.IanMusic.ThemeManager = window.ThemeManager;

console.log('%c[Theme] %cv3 module loaded',
    'color:#fa2d48;font-weight:bold', 'color:#888');
