/**
 * @module IanMusic/visualizer
 * @description Apple Music 风格流动背景 — 纯 CSS 方案（GPU 加速）
 *
 * 原理：
 *   .apple-music-bg { filter: blur(80px) saturate(1.6) brightness(0.55); }
 *   切歌时 → 换背景图 → CSS transition 1.2s 渐变
 *   播放时 → CSS animation 呼吸缩放
 *
 * 为什么用 CSS 而不是 Canvas？
 *   Canvas 多层半透明叠加模拟 blur → 天然损失亮度（alpha 叠加）
 *   CSS filter: blur() → GPU 加速，100% 不透明度，色彩完整饱满
 */

class AppleMusicVisualizer {
    constructor() {
        this.bgEl = document.getElementById('apple-music-bg');
        if (!this.bgEl) { console.warn('[Visualizer] #apple-music-bg not found'); return; }

        this.currentSrc = '';
        this.accentColor = { r: 250, g: 45, b: 72 };
        this.isPlaying = false;
    }

    // ===== 设置封面 → 更新 CSS 背景 =====
    async setCover(imgSrc) {
        if (!imgSrc || !this.bgEl || imgSrc === this.currentSrc) return;
        console.log('[Visualizer] 新封面:', imgSrc.slice(0, 60));

        // 验证图片可访问
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        await new Promise((res) => {
            img.onload = res; img.onerror = () => { console.warn('[Visualizer] 图片加载失败'); res(); };
            img.src = imgSrc;
        });

        // 触发淡入动画
        this.bgEl.classList.remove('fade-in');
        void this.bgEl.offsetWidth; // force reflow 重置动画

        this.bgEl.style.backgroundImage = `url('${imgSrc}')`;
        this.bgEl.classList.add('fade-in');
        this.currentSrc = imgSrc;
    }

    // ===== 手动设置纯色主题 =====
    setAccentColors(hexColors) {
        if(!Array.isArray(hexColors)||hexColors.length===0)return;
        const hex=String(hexColors[0]);
        const m=hex.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
        if(m)this.accentColor={r:parseInt(m[1],16),g:parseInt(m[2],16),b:parseInt(m[3],16)};
    }

    // ===== 播放状态 → 控制呼吸动画 =====
    setPlaying(playing) {
        this.isPlaying=!!playing;
        if(this.bgEl){
            if(playing) this.bgEl.classList.add('breathing');
            else this.bgEl.classList.remove('breathing');
        }
    }

    // ===== 启动（纯 CSS 方案不需要循环渲染）=====
    start() {
        console.log('[Visualizer] Apple Music CSS Background ✓ started');
        // 默认开启呼吸
        if(this.bgEl) this.bgEl.classList.add('breathing');
    }

    destroy() {
        this.currentSrc='';
        if(this.bgEl){
            this.bgEl.style.backgroundImage='';
            this.bgEl.classList.remove('breathing','fade-in');
        }
    }
}

// ===== 挂载到全局 =====
window.IanMusic.AppleMusicVisualizer=AppleMusicVisualizer;

// 外部接口
window.IanMusic.setAccentColors=function(hexColors){
    if(window.__bgVisualizer) window.__bgVisualizer.setAccentColors(hexColors);
};
window.IanMusic.setVisualizerCover=async function(imgSrc){
    if(window.__bgVisualizer)await window.__bgVisualizer.setCover(imgSrc);
};
window.IanMusic.setVisualizerPlaying=function(playing){
    if(window.__bgVisualizer) window.__bgVisualizer.setPlaying(playing);
};
window.IanMusic.extractColor=async function(imgSrc){
    if(!window.__bgVisualizer)return null;
    await window.__bgVisualizer.setCover(imgSrc);
    return window.__bgVisualizer.accentColor;
};
