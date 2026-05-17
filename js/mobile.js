/**
 * @module IanMusic/mobile
 * @description 移动端专属逻辑 — 收藏/静音/音量条/歌词显隐/评论/进度拖拽/动态背景
 */
window.IanMusic = window.IanMusic || {};

function toggleFavorite(){if(curIdx<0||!playlist[curIdx])return;toggleLike();}
var _volIconLowSVG = '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>';
var _volIconHighSVG = '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>';
var _volIconMuteSVG = '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>';
function toggleMute(){
    const volEl=document.getElementById('vol');
    var muted;
    if(audio.volume>0){prevVol=audio.volume;audio.volume=0;if(volEl){volEl.value=0;updateRangeUI(volEl);}muted=true;}
    else{audio.volume=prevVol;if(volEl){volEl.value=prevVol*100;updateRangeUI(volEl);}muted=false;}
    var low=document.getElementById('txt-mute-btn');
    var high=document.getElementById('txt-volume-btn');
    var mv=document.getElementById('mv-vol-icon');
    if(muted){
        if(low){low.innerHTML=_volIconMuteSVG;low.title='Unmute';}
        if(high){high.innerHTML=_volIconMuteSVG;high.title='Unmute';}
        if(mv){mv.innerHTML=_volIconMuteSVG;mv.setAttribute('viewBox','0 0 24 24');}
    }else{
        if(low){low.innerHTML=_volIconLowSVG;low.title='Mute';}
        if(high){high.innerHTML=_volIconHighSVG;high.title='Volume';}
        if(mv){mv.innerHTML=_volIconHighSVG;mv.setAttribute('viewBox','0 0 24 24');}
    }
}
function syncMobileVolUI(audioVol){const v=document.getElementById('mv-vol-fill');if(v)v.style.width=(audioVol*100)+'%';}

function toggleLyricStyle(){
    if(typeof isLyricVisible === 'undefined') isLyricVisible = true;
    isLyricVisible = !isLyricVisible;
    
    if(isLyricVisible){
        // ===== 歌词模式（无歌词 → 歌词）=====
        // 动画函数内部处理：封面淡出 + 歌词淡入 + 恢复顶部栏
        _animateCoverTransition(/*toBig*/false, () => {
            // 动画完成后：立即跳到当前唱的歌词行
            _syncMobileLyricToNow();
        });
    }else{
        // ===== 无歌词模式（歌词 → 无歌词）=====
        // 动画函数内部处理：歌词淡出 + 封面淡入 + 隐藏顶部栏
        _animateCoverTransition(/*toBig*/true, () => {});
    }
}

/** 同步封面/歌名到无歌词面板 */
function syncNoLyricCover(){
    const artEl=document.getElementById('no-lyric-art');
    const titleEl=document.getElementById('no-lyric-title');
    const artistEl=document.getElementById('no-lyric-artist');
    if(!artEl) return;
    
    const desktopArt=document.getElementById('art');
    if(desktopArt&&desktopArt.style.backgroundImage)
        artEl.style.backgroundImage=desktopArt.style.backgroundImage;
    else{
        const mvArt=document.getElementById('mv-art');
        if(mvArt&&mvArt.src) artEl.style.backgroundImage="url('"+mvArt.src+"')";
    }
    const dt=document.getElementById('title'),da=document.getElementById('artist');
    if(titleEl&&dt) titleEl.textContent=dt.textContent;
    if(artistEl&&da) artistEl.textContent=da.textContent;
}
function toggleComments(){
    // 如果当前是无歌词模式，点击底部「歌词」按钮切回歌词模式
    if(typeof isLyricVisible !== 'undefined' && !isLyricVisible){
        toggleLyricStyle();
    } else {
        showToast(i18n[curLang].commentSoon);
    }
}

// 移动端进度条拖拽
function initMobileSeek(){
    const seekBg=document.querySelector('.mv-seek-bg');
    if(!seekBg)return;
    let dragging=false;
    const update=e=>{
        if(!dragging||!audio.duration)return;
        const rect=seekBg.getBoundingClientRect();
        const pct=Math.max(0,Math.min(1,(e.clientX-rect.left)/rect.width));
        audio.currentTime=pct*audio.duration;
        const fill=document.getElementById('mv-seek-fill');
        if(fill)fill.style.width=(pct*100)+'%';
    };
    const onMove=e=>{if(!dragging)return;update(e);};
    const onUp=()=>{dragging=false;};
    seekBg.addEventListener('pointerdown',e=>{dragging=true;seekBg.setPointerCapture(e.pointerId);update(e);});
    document.addEventListener('pointermove',onMove);
    document.addEventListener('pointerup',onUp);
    document.addEventListener('pointercancel',onUp);
}
// 移动端音量条拖拽
function initMobileVol(){
    const wrap=document.querySelector('.mv-vol-wrap');if(!wrap)return;
    const track=wrap.querySelector('.mv-vol-track');if(!track)return;
    let dragging=false;
    const update=e=>{
        if(!dragging)return;
        const rect=track.getBoundingClientRect();
        const pct=Math.max(0,Math.min(1,(e.clientX-rect.left)/rect.width));
        audio.volume=pct;
        document.getElementById('mv-vol-fill').style.width=(pct*100)+'%';
        const volEl2=document.getElementById('vol');if(volEl2){volEl2.value=pct*100;updateRangeUI(volEl2);}
    };
    const onMove=e=>{if(!dragging)return;update(e);};
    const onUp=()=>{dragging=false;};
    track.addEventListener('pointerdown',e=>{dragging=true;track.setPointerCapture(e.pointerId);update(e);});
    document.addEventListener('pointermove',onMove);
    document.addEventListener('pointerup',onUp);
    document.addEventListener('pointercancel',onUp);
}

window.IanMusic.toggleFavorite=toggleFavorite;window.IanMusic.toggleMute=toggleMute;
window.IanMusic.syncMobileVolUI=syncMobileVolUI;window.IanMusic.toggleLyricStyle=toggleLyricStyle;
window.IanMusic.toggleComments=toggleComments;window.IanMusic.initMobileSeek=initMobileSeek;
window.IanMusic.initMobileVol=initMobileVol;

/**
 * 切回歌词模式时，立即根据 audio.currentTime 定位到正在唱的那句
 * （解决从无歌词模式切回时"要等下一句才跳"的问题）
 */
function _syncMobileLyricToNow(){
    const mobLs=document.querySelectorAll('#mv-lyric-rows .lyric-line, #mobile-lyrics-box .lyric-line');
    if(mobLs.length===0||!audio.duration) return;
    
    // 找到当前时间应该激活的行
    let targetIdx=-1;
    for(let i=0;i<mobLs.length;i++){
        if(audio.currentTime>=parseFloat(mobLs[i].dataset.time)) targetIdx=i;
        else break;
    }
    if(targetIdx<0) return; // 还没到任何一行
    
    // 清除所有旧的 active 状态
    mobLs.forEach(l=>{ l.classList.remove('active'); l.querySelectorAll('.lyric-char').forEach(c=>c.style.setProperty('--char-pct','0%')); });
    
    // 激活当前行 + 标记之前的行为 sung
    for(let i=0;i<targetIdx;i++){ mobLs[i].classList.add('sung'); }
    mobLs[targetIdx].classList.add('active');
    
    // 更新全局状态（让后续 ontimeupdate 能正确衔接）
    if(typeof _lastMobActiveIdx !== 'undefined') _lastMobActiveIdx=targetIdx;
    
    // 滚动到正确位置
    const container=document.getElementById('mv-body');
    if(container&&mobLs[targetIdx]){
        const targetOffset=container.clientHeight*0.125;
        const activeTop=mobLs[targetIdx].offsetTop;
        const newScrollY=-(activeTop-targetOffset);
        if(typeof _mobScrollY !== 'undefined'){ _mobScrollY=newScrollY; }
        mobLs.forEach(line=>line.style.setProperty('--scroll-y',newScrollY+'px'));
    }
}

/**
 * 模式切换动画（淡入淡出 + 轻微位移）
 * 不做任何缩放或坐标计算，纯 CSS transition 驱动，稳定可靠
 * @param {boolean} toBig true = 歌词模式→无歌词（小→大），false = 反向
 * @param {Function} callback 动画完成后调用
 */
function _animateCoverTransition(toBig, callback){
    const rows=document.getElementById('mv-lyric-rows');
    const noL=document.getElementById('mv-no-lyric');
    const topRow=document.querySelector('.mv-top-row');
    const transBtn=document.getElementById('mv-trans-btn');
    const wordBtn=document.getElementById('mv-word-btn');

    // 动画时长
    const DUR = 320;

    const body = document.getElementById('mv-body');

    if(toBig){
        // ===== 歌词 → 无歌词：歌词上滑淡出，封面下滑淡入 =====
        syncNoLyricCover();

        // 0) 禁止 mv-body 滚动，防止封面被滑动
        if(body){ body.style.overflowY = 'hidden'; body.style.touchAction = 'none'; }

        // 1) 立即隐藏顶部栏和译词按钮（避免和大封面同时出现）
        // 双重保险：CSS类 + 内联样式，防止被其他代码或!important覆盖
        if(topRow){ topRow.classList.add('mv-hidden'); topRow.style.display='none'; }
        if(transBtn){ transBtn.classList.add('mv-hidden'); transBtn.style.display='none'; }
        if(wordBtn){ wordBtn.classList.add('mv-hidden'); wordBtn.style.display='none'; }

        // 1) 歌词区域准备：加过渡，淡出上滑
        if(rows){
            rows.style.transition = `opacity ${DUR}ms ease, transform ${DUR}ms ease`;
            rows.style.opacity = '0';
            rows.style.transform = 'translateY(-20px)';
        }

        // 2) 无歌词面板准备：初始状态透明+下移
        noL.classList.add('show');
        noL.classList.remove('animated-in');
        noL.style.transition = 'none';
        noL.style.opacity = '0';
        noL.style.transform = 'translateY(30px)';

        // 3) 强制重排后开始动画
        void noL.offsetHeight;

        noL.style.transition = `opacity ${DUR}ms cubic-bezier(0.32,0.72,0,1), transform ${DUR}ms cubic-bezier(0.32,0.72,0,1)`;
        requestAnimationFrame(()=>{
            noL.style.opacity = '1';
            noL.style.transform = 'translateY(0)';
            noL.classList.add('animated-in');
        });

        // 4) 动画结束清理
        setTimeout(() => {
            // 确保歌词区被隐藏
            if(rows){
                rows.style.display='none'; rows.style.visibility='hidden'; rows.style.height='0';
                rows.style.transition=''; rows.style.opacity=''; rows.style.transform='';
            }

            // 清理无歌词面板的内联样式（让CSS接管）
            noL.style.transition='';
            noL.style.transform='';
            callback();
        }, DUR + 30);

    }else{
        // ===== 无歌词 → 歌词：封面上滑淡出，歌词下滑淡入 =====
        syncNoLyricCover();

        // 0) 恢复 mv-body 滚动能力
        if(body){ body.style.overflowY = ''; body.style.touchAction = ''; }

        // 1) 封面准备：上滑淡出
        noL.style.transition = `opacity ${(DUR*0.9)|0}ms ease, transform ${(DUR*0.9)|0}ms ease`;
        noL.style.opacity = '0';
        noL.style.transform = 'translateY(-25px)';
        noL.classList.remove('animated-in');

        // 2) 歌词区先恢复显示但透明+下移
        if(rows){
            rows.style.removeProperty('display');
            rows.style.removeProperty('visibility');
            rows.style.removeProperty('height');
            rows.style.transition = 'none';
            rows.style.opacity = '0';
            rows.style.transform = 'translateY(20px)';
        }
        if(topRow){ topRow.classList.remove('mv-hidden'); topRow.style.removeProperty('display'); topRow.style.transition='none'; topRow.style.opacity='0'; }
        if(transBtn){ transBtn.classList.remove('mv-hidden'); transBtn.style.removeProperty('display'); transBtn.style.transition='none'; transBtn.style.opacity='0'; }
        if(wordBtn){ wordBtn.classList.remove('mv-hidden'); wordBtn.style.removeProperty('display'); wordBtn.style.transition='none'; wordBtn.style.opacity='0'; }

        // 3) 强制重排后开始动画
        void (rows||topRow).offsetHeight;

        if(rows) rows.style.transition = `opacity ${DUR}ms cubic-bezier(0.32,0.72,0,1), transform ${DUR}ms cubic-bezier(0.32,0.72,0,1)`;
        if(topRow) topRow.style.transition = `opacity ${(DUR*0.8)|0}ms cubic-bezier(0.32,0.72,0,1)`;
        if(transBtn) transBtn.style.transition = `opacity ${(DUR*0.7)|0}ms ease`;
        if(wordBtn) wordBtn.style.transition = `opacity ${(DUR*0.7)|0}ms ease`;

        requestAnimationFrame(()=>{
            if(rows){ rows.style.opacity='1'; rows.style.transform='translateY(0)'; }
            if(topRow) topRow.style.opacity='1';
            if(transBtn) transBtn.style.opacity='1';
            if(wordBtn) wordBtn.style.opacity='1';
        });

        // 4) 动画结束清理
        setTimeout(() => {
            // 隐藏无歌词面板
            noL.classList.remove('show','animated-in');
            noL.style.transition='';
            noL.style.opacity='';
            noL.style.transform='';

            // 清理歌词区内联样式
            if(rows){ rows.style.transition=''; rows.style.opacity=''; rows.style.transform=''; }
            if(topRow){ topRow.style.transition=''; topRow.style.opacity=''; }
            if(transBtn){ transBtn.style.transition=''; transBtn.style.opacity=''; }
            if(wordBtn){ wordBtn.style.transition=''; wordBtn.style.opacity=''; }

            callback();
        }, DUR + 30);
    }
}
