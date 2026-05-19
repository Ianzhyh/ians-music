/**
 * @module IanMusic/ai
 * @description AI 功能 — 调用/歌曲解构/AI主题生成/颜色选择器/AI翻译歌词
 * ⚠️ 全部还原自原始 index.html，确保功能100%一致
 */
window.IanMusic = window.IanMusic || {};

async function callAI(promptText) {
    if(!aiApiKey) return i18n[curLang].apiKeyNotSet;
    const finalUrl = aiBaseUrl;
    const authHeader = aiApiKey.startsWith('Bearer') ? aiApiKey : `Bearer ${aiApiKey}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000);
    try {
        const response = await fetch(finalUrl, {
            method: "POST",
            headers: {"Content-Type": "application/json", "Authorization": authHeader},
            body: JSON.stringify({
                model: aiModel,
                messages: [
                    {role:"system", content:"You are a helpful music assistant. Keep answers concise."},
                    {role:"user", content:promptText}
                ],
                stream:false
            }),
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        if(!response.ok) {
            const errJson = await response.json().catch(() => ({}));
            if(response.status === 401) throw new Error("Invalid API Key");
            throw new Error(errJson.error?.message || `HTTP ${response.status}`);
        }
        const data = await response.json();
        return data.choices?.[0]?.message?.content || i18n[curLang].genericError;
    } catch(e) {
        clearTimeout(timeoutId);
        if(e.name === 'AbortError') return `请求超时，API响应时间超过了45秒，请重试。`;
        return `${i18n[curLang].aiError}\n(${e.message})`;
    }
}

async function openAIInsight() {
    if(playlist.length === 0) return;
    toggleAIModal(true);
    const contentBox = document.getElementById('ai-content');
    const btn = document.getElementById('ai-insight-btn');
    contentBox.innerHTML = `<div class="spinner"></div><div style="text-align:center;opacity:0.7">${i18n[curLang].aiLoading}</div>`;
    btn.classList.add('loading');
    const track = playlist[curIdx];
    const langInstruction = i18n[curLang].answerSystemPrompt;
    const prompt = `Tell me a short, interesting fact or the meaning behind the song "${track.title}" by "${track.artist}". Keep it under 60 words. ${langInstruction}.`;
    const result = await callAI(prompt);
    btn.classList.remove('loading');
    contentBox.innerText = result;
}

async function generateAITheme() {
    const input = document.getElementById('ai-theme-input');
    const prompt = input.value.trim();
    if(!prompt) { showToast(i18n[curLang].enterThemeDesc); return; }
    toggleAIModal(true);
    document.getElementById('ai-content').innerHTML = `<div class="spinner"></div><div style="text-align:center;opacity:0.7">Generating...</div>`;
    try {
        const result = await callAI(`Generate exactly ONE vibrant hex color code (like #FF5733 or #1ABC9C) for this music player theme: "${prompt}". Return ONLY the hex color, nothing else.`);
        const colorMatch = result.match(/#([0-9A-Fa-f]{6})/);
        if(!colorMatch) throw new Error('No color in response');
        const c = '#' + colorMatch[1];
        ThemeManager.apply(c, null);
        input.value = '';
        document.getElementById('ai-content').innerHTML = `<div class="ai-response-text">${i18n[curLang].themeGenerated}<span style="color:${c};font-weight:var(--weight-bold);font-size:var(--text-xl);font-family:var(--font-display);">${c}</span></div>`;
    } catch(e) {
        document.getElementById('ai-content').innerHTML = `<div class="ai-response-text" style="color:#fa2d48;">${e.message}</div>`;
    }
}

// ===== 颜色选择器（Canvas 取色板）=====
const Picker = {
    init() {
        this.canvas = document.getElementById('color-canvas');
        this.hueSlider = document.getElementById('hue-slider');
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');
        this.canvas.width = 300;
        this.canvas.height = 120;
        this.draw(0);
        this.canvas.addEventListener('mousedown', e => this.pick(e));
        this.canvas.addEventListener('mousemove', e => { if (e.buttons === 1) this.pick(e); });
    },
    draw(hue) {
        if (!this.ctx) return;
        const gradH = this.ctx.createLinearGradient(0, 0, this.canvas.width, 0);
        gradH.addColorStop(0, '#fff');
        gradH.addColorStop(1, `hsl(${hue}, 100%, 50%)`);
        this.ctx.fillStyle = gradH;
        this.ctx.fillRect(0, 0, 300, 120);
        const gradV = this.ctx.createLinearGradient(0, 0, 0, 120);
        gradV.addColorStop(0, 'transparent');
        gradV.addColorStop(1, '#000');
        this.ctx.fillStyle = gradV;
        this.ctx.fillRect(0, 0, 300, 120);
    },
    pick(e) {
        if (!this.ctx || !this.canvas) return;
        const rect = this.canvas.getBoundingClientRect();
        const x = Math.max(0, Math.min(300, e.clientX - rect.left));
        const y = Math.max(0, Math.min(120, e.clientY - rect.top));
        const d = this.ctx.getImageData(x, y, 1, 1).data;
        const hex = '#' + ((1 << 24) + (d[0] << 16) + (d[1] << 8) + d[2]).toString(16).slice(1);
        ThemeManager.apply(hex, null);
    }
};
// 初始化颜色选择器（DOM 就绪时）
setTimeout(() => { try { Picker.init(); } catch(_) {} }, 100);

function escHtml(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

// ===== AI 翻译歌词（原始完整版：双语LRC注入 + 防死机 + 容错）=====
async function translateLyrics() {
    if(playlist.length === 0 || !playlist[curIdx].savedLyrics) { showToast(i18n[curLang].noLyricsToTranslate); return; }

    const currentLrc = playlist[curIdx].savedLyrics;
    const box = document.getElementById('desktop-lyrics-box');
    const btn = document.getElementById('ai-translate-btn');
    const btnText = document.getElementById('ai-btn-text');

    const mobBox = document.getElementById('mv-lyric-rows') || document.getElementById('mobile-lyrics-box');

    // 已有翻译行 → 切换显示/隐藏
    var hasTrans = false;
    if (typeof currentLrc === 'string' && currentLrc.includes('<span class="trans-line"')) hasTrans = true;
    if (Array.isArray(currentLrc) && currentLrc.some(function(l) { return l.trans; })) hasTrans = true;

    if (hasTrans) {
        if(box.classList.contains('hide-trans')) {
            box.classList.remove('hide-trans');
            if(mobBox) mobBox.classList.remove('hide-trans');
            btn.classList.add('active');
            showToast(i18n[curLang].bilingualShown);
        } else {
            box.classList.add('hide-trans');
            if(mobBox) mobBox.classList.add('hide-trans');
            btn.classList.remove('active');
            showToast(i18n[curLang].bilingualHidden);
        }
        return;
    }

    // ── 尝试从后端重新获取翻译（优先于 AI）──
    try {
        btn.style.boxShadow = "0 0 25px var(--accent)";
        btn.style.borderColor = "var(--accent)";
        btn.style.transform = "scale(1.05)";
        btn.style.background = "rgba(0,0,0,0.6)";
        btnText.innerHTML = i18n[curLang].fetchingTranslation;
        btn.disabled = true;

        var t = playlist[curIdx];
        var query = (t.artist || t.author || '') + ' ' + (t.title || t.name || '');
        var transResult = await _tryFetchOfficialTrans(query, t.artist || t.author || '', t.title || t.name || '');

        if (transResult) {
            console.log('[Translate] 官方翻译获取成功，直接注入');
            if (typeof currentLrc === 'string') {
                var injectedLrc = _injectTransToLrc(currentLrc, transResult);
                
                // 检测注入结果是否是 JSON（source 是 QRC 数组）→ 用 renderQrcLyrics
                var isQrcResult = injectedLrc && injectedLrc.charAt(0) === '[' && /^\s*\[\s*\{/.test(injectedLrc);
                
                if (isQrcResult) {
                    try {
                        var qrcParsed = JSON.parse(injectedLrc);
                        if (Array.isArray(qrcParsed) && qrcParsed.some(function(l) { return l.trans; })) {
                            playlist[curIdx].savedLyrics = qrcParsed;
                            window.IanMusicUtils.cacheSet('am_lyric_' + currentTrackId, injectedLrc);
                            if(playlist[curIdx].isLocal) await updateLocalMeta(currentTrackId, {savedLyrics: injectedLrc});
                            box.classList.remove('hide-trans');
                            if(mobBox) mobBox.classList.remove('hide-trans');
                            btn.classList.add('active');
                            renderQrcLyrics(qrcParsed);
                            showToast(i18n[curLang].officialTransApplied);
                            return;
                        }
                    } catch(e) { console.warn('[Translate] QRC JSON解析失败:', e); }
                }
                
                if (injectedLrc && injectedLrc !== currentLrc && injectedLrc.trim() !== '' &&
                    injectedLrc.includes('<span class="trans-line"')) {
                    playlist[curIdx].savedLyrics = injectedLrc;
                    window.IanMusicUtils.cacheSet('am_lyric_' + currentTrackId, injectedLrc);
                    if(playlist[curIdx].isLocal) await updateLocalMeta(currentTrackId, {savedLyrics: injectedLrc});
                    box.classList.remove('hide-trans');
                    if(mobBox) mobBox.classList.remove('hide-trans');
                    btn.classList.add('active');
                    renderLyrics(injectedLrc);
                    if (!box || box.children.length === 0) {
                        console.error('[Translate] 渲染后歌词框为空，回退到原歌词');
                        playlist[curIdx].savedLyrics = currentLrc;
                        window.IanMusicUtils.cacheSet('am_lyric_' + currentTrackId, currentLrc);
                        renderLyrics(currentLrc);
                    }
                    showToast(i18n[curLang].officialTransApplied);
                    return;
                }
                console.warn('[Translate] 官方翻译注入失败，回退到 AI');
                renderLyrics(currentLrc);
            } else if (Array.isArray(currentLrc)) {
                _injectTransToQrc(currentLrc, transResult);
                var hasAny = currentLrc.some(function(l) { return l.trans; });
                if (hasAny) {
                    window.IanMusicUtils.cacheSet('am_lyric_' + currentTrackId, JSON.stringify(currentLrc));
                    if(playlist[curIdx].isLocal) await updateLocalMeta(currentTrackId, {savedLyrics: JSON.stringify(currentLrc)});
                    box.classList.remove('hide-trans');
                    if(mobBox) mobBox.classList.remove('hide-trans');
                    btn.classList.add('active');
                    renderQrcLyrics(currentLrc);
                    showToast(i18n[curLang].officialTransApplied);
                    return;
                }
                console.warn('[Translate] QRC官方翻译注入失败，回退到 AI');
                renderQrcLyrics(currentLrc);
            }
        }

        // ── 官方翻译不可用 → fallback 到 AI ──
        console.log('[Translate] 官方翻译不可用，使用 AI 翻译');
        btnText.innerHTML = i18n[curLang].aiTranslating;

        const pureLyrics = [], timestamps = [];
        currentLrc.split('\n').forEach(line => {
            const m = line.match(/^(\[\d{2}:\d{2}[.:]\d{2,3}\])(.*)/);
            if(m && m[2].trim() !== '') { timestamps.push(m[1]); pureLyrics.push(m[2].trim()); }
        });
        if(pureLyrics.length === 0) throw new Error(i18n[curLang].lyricsFormatNotSupported);

        let numberedLyrics = pureLyrics.map((text, i) => `${i}||${text}`).join('\n');
        const prompt = `你是一个专业的音乐翻译家。
严苛指令：
1. 必须保持我给你的编号格式！输出必须是"序号||翻译结果"。
2. 绝不允许合并重复的行！
3. 绝不输出废话，不用代码块。
4. 重要：如果原歌词是繁体中文（臺灣、香港等），请保持繁体不转简体，只翻译非中文的外语部分；如果原歌词已经是简体，则翻译为简体中文。
歌词：
${numberedLyrics.substring(0, 7000)}`;

        let translatedRes = await callAI(prompt);

        if(!translatedRes || translatedRes.includes("请求超时") || translatedRes.includes("Error")) {
            throw new Error(translatedRes || "API 请求超时或报错");
        }

        translatedRes = translatedRes.replace(/```[a-z]*\n?/gi, '').replace(/```/g, '').trim();
        const transMap = new Map();
        translatedRes.split('\n').forEach(line => {
            const match = line.match(/^\s*\[?【?(\d+)】?\]?\s*\|\|\s*(.*)/);
            if(match) transMap.set(parseInt(match[1]), match[2].trim());
        });

        if(transMap.size === 0) {
            console.log("AI 原始返回:", translatedRes);
            throw new Error(i18n[curLang].aiFormatError);
        }

        let newLrc = '';
        let successCount = 0;

        for(let i = 0; i < pureLyrics.length; i++) {
            let transText = transMap.get(i);
            if(transText && transText !== pureLyrics[i]) {
                newLrc += `${timestamps[i]}${pureLyrics[i]}<span class="trans-line">${escHtml(transText)}</span>\n`;
                successCount++;
            } else {
                newLrc += `${timestamps[i]}${pureLyrics[i]}\n`;
            }
        }

        if(successCount === 0) throw new Error(i18n[curLang].noTranslationNeeded);

        playlist[curIdx].savedLyrics = newLrc;
        window.IanMusicUtils.cacheSet('am_lyric_' + currentTrackId, newLrc);

        if(playlist[curIdx].isLocal) { await updateLocalMeta(currentTrackId, {savedLyrics: newLrc}); }

        box.classList.remove('hide-trans');
        if(mobBox) mobBox.classList.remove('hide-trans');
        btn.classList.add('active');
        renderLyrics(newLrc);

    } catch(error) {
        console.error(i18n[curLang].translateFailed + ":", error);
        showToast(error.message || i18n[curLang].translateFailed);
    } finally {
        btnText.innerHTML = i18n[curLang].aiTranslate;
        btn.disabled = false;
        btn.style.boxShadow = "none";
        btn.style.borderColor = "rgba(255,255,255,0.15)";
        btn.style.transform = "scale(1)";
        btn.style.background = "rgba(255,255,255,0.08)";
    }
}

async function _tryFetchOfficialTrans(query, artist, title) {
    try {
        if (typeof metingFetch !== 'function') return null;
        var res = await metingFetch('/search?server=tencent&id=' + encodeURIComponent(query));
        if (!res || !res.ok) return null;
        var json = await res.json();
        var data = json.data || json;
        if (!data || data.length === 0) return null;

        var target = null;
        for (var i = 0; i < data.length; i++) {
            var d = data[i];
            if (d.title && (d.title.includes(title) || title.includes(d.title))) {
                target = d; break;
            }
        }
        if (!target) target = data[0];
        var songId = target.id || target.url_id || target.lyric_id || '';
        if (!songId) return null;

        var lrcRes = await metingFetch('/tencent/lyric-raw?id=' + encodeURIComponent(songId) + '&songmid=' + encodeURIComponent(target.url_id || ''), 10000);
        if (!lrcRes || !lrcRes.ok) return null;
        var lrcJson = await lrcRes.json();
        if (lrcJson.trans && lrcJson.trans.length > 0) {
            console.log('[Translate] 获取到官方翻译:', lrcJson.trans.length, '字');
            return lrcJson.trans.replace(/^\/\/\s?/gm, '').replace(/^\s*\/\/\s?/gm, '');
        }
        return null;
    } catch (e) {
        console.warn('[Translate] 官方翻译获取失败:', e.message);
        return null;
    }
}

window.IanMusic.callAI = callAI;
window.IanMusic.openAIInsight = openAIInsight;
window.IanMusic.generateAITheme = generateAITheme;
window.IanMusic.translateLyrics = translateLyrics;
window.IanMusic.Picker = Picker;
