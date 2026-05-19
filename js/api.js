/**
 * @module IanMusic/api
 * @description Meting API 封装 + 网络请求工具 + B站API封装 + 歌词抓取辅助函数
 * 
 * [FIX] metingFetch 已从 fetchLyrics 内部提升为全局函数，
 *   支持 多 API 备援（自建服务 + 公共实例），解决 performNetSearch() 调用时报错问题。
 */

// 确保 window.IanMusic 命名空间存在
window.IanMusic = window.IanMusic || {};

// ====== 网络搜歌平台列表 ======
const NET_SEARCH_SOURCES = [
    { name: 'all', label: '全部', priority: 0 },
    { name: 'kugou', label: '酷狗', priority: 1 },
    { name: 'netease', label: '网易云', priority: 2 },
    { name: 'tencent', label: 'QQ音乐' },
    { name: 'kuwo', label: '酷我', priority: 4 },
    { name: 'migu', label: '咪咕', priority: 5 },
    { name: 'bilibili', label: '哔哩哔哩', priority: 6 },
];

const BILIBILI_API = "";

// ============================================
// 🔥 核心修复：metingFetch — 从 fetchLyrics 内部提升为全局函数！
// 支持多 API 备援、超时控制、本地开发模式自动降级、Cookie 授权
// ============================================
async function metingFetch(path, timeoutMs = 8000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const _origin = (typeof location !== 'undefined') ? location.origin : '';
    const isLocal = !_origin || _origin.startsWith('file:') || _origin.includes('localhost') || _origin === 'null' || location.protocol === 'file:';

    const localMeting = (window.IanMusic && window.IanMusic.localMetingApi) || '';
    const neteaseCookie = (window.IanMusic && window.IanMusic.neteaseCookie) || '';
    const qqmusicCookie = (window.IanMusic && window.IanMusic.qqmusicCookie) || '';
    const kugouCookie = (window.IanMusic && window.IanMusic.kugouCookie) || '';

    const decodedPath = decodeURIComponent(path);
    const isNetease = decodedPath.includes('server=netease') || path.includes('server%3Dnetease') || decodedPath.includes('/netease/');
    const isTencent = decodedPath.includes('server=tencent') || path.includes('server%3Dtencent') || decodedPath.includes('/tencent/');
    const isKugou = decodedPath.includes('server=kugou') || path.includes('server%3Dkugou') || decodedPath.includes('/kugou/');

    const buildHeaders = (isLocalApi) => {
        const headers = { 'Accept': 'application/json' };
        if (!isLocalApi) {
            console.log('[metingFetch] 使用公共API，Cookie 不会被转发（需要自建 Meting-API）');
            return headers;
        }
        // 本地API始终发送 Cookie 头（即使前端没填，后端也会 fallback 到 cookies.json）
        if (isNetease) {
            headers['X-Netease-Cookie'] = neteaseCookie || '';
            if(neteaseCookie) console.log('[metingFetch] 网易云 Cookie 通过 X-Netease-Cookie 头传递');
        }
        if (isTencent) {
            headers['X-Tencent-Cookie'] = qqmusicCookie || '';
            if(qqmusicCookie) console.log('[metingFetch] QQ音乐 Cookie 通过 X-Tencent-Cookie 头传递');
        }
        if (isKugou) {
            headers['X-Kugou-Cookie'] = kugouCookie || '';
            if(kugouCookie) console.log('[metingFetch] 酷狗 Cookie 通过 X-Kugou-Cookie 头传递');
        }
        console.log('[metingFetch] 本地API请求，后端将使用 cookies.json 兜底（Cookie长度=' + (qqmusicCookie||neteaseCookie||'').length + '）');
        return headers;
    };

    // 🔥 关键修复：始终优先尝试本地API（localhost:3300），不管 isLocal 的值
    // 因为用户可能在本地运行了 Meting API 服务，即使通过非localhost地址访问页面
    const apiBases = [
        (localMeting ? localMeting : null),
        'http://localhost:3300',
        'http://127.0.0.1:3300',
        (window.IanMusic && window.IanMusic.METING_API) || null,
        (window.IanMusic && window.IanMusic.METING_ALT) || null,
        (window.IanMusic && window.IanMusic.METING_BACKUP) || null,
    ].filter(Boolean);
    // 去重
    const uniqueBases = [...new Set(apiBases)];

    console.log(`[metingFetch] 可用API列表 (${uniqueBases.length}个):`, uniqueBases);
    console.log(`[metingFetch] isLocal=${isLocal}, location.protocol=${location?.protocol}`);

    for (let i = 0; i < uniqueBases.length; i++) {
        const base = uniqueBases[i];
        const isLocalApi = base.includes('localhost') || base.includes('127.0.0.1') || base === localMeting;
        try {
            console.log(`[metingFetch] 尝试 API [${i+1}/${uniqueBases.length}]: ${base}`);
            const headers = buildHeaders(isLocalApi);
            const res = await fetch(`${base}${path}`, {
                signal: controller.signal,
                headers
            });
            if (res.ok) {
                console.log(`[metingFetch] ✅ API ${base} 成功`);
                clearTimeout(timer);
                return res;
            } else {
                console.warn(`[metingFetch] ⚠️ API ${base} 返回状态码: ${res.status}`);
            }
        } catch (e) {
            console.log(`[metingFetch] ❌ API ${base} 失败：${e.message}`);
        }
    }

    clearTimeout(timer);
    throw new Error("全部音乐 API 均失败，请检查网络或切换 B 站搜索");
}

// ====== B 站搜索 & 播放地址（通过本地 Meting API 代理 Bilibili 公开 API）======
async function bilibiliPublicSearch(query) {
    try {
        var url = 'https://api.bilibili.com/audio/music-service-c/s?search_type=music&page=1&pagesize=20&keyword=' + encodeURIComponent(query);
        var r = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': 'https://www.bilibili.com/'
            }
        });
        var j = await r.json();
        if (j.code === 0 && j.data && j.data.result) {
            return j.data.result.map(function(item) {
                return {
                    id: 'bili_' + item.id,
                    name: item.title || '',
                    artist: item.author || '',
                    album: '',
                    cover: item.cover || '',
                    bvid: item.bvid || '',
                    duration: item.duration || 0,
                    source: 'bilibili',
                    _source: 'bilibili',
                    isBilibili: true
                };
            });
        }
        return [];
    } catch(e) {
        console.warn('[bilibiliPublicSearch] 公开API失败:', e.message);
        return [];
    }
}
window.IanMusic.bilibiliPublicSearch = bilibiliPublicSearch;

async function bilibiliSearch(query) {
    try {
        const r = await metingFetch(`/bilibili/search?id=${encodeURIComponent(query)}&pagesize=20`, 10000);
        const j = await r.json().catch(() => null);
        if (j && j.success && Array.isArray(j.data)) return j.data;
        return [];
    } catch (e) {
        console.warn('[bilibiliSearch] 失败:', e.message);
        return [];
    }
}

async function bilibiliGetUrl(bvid) {
    try {
        const r = await metingFetch(`/bilibili/url?bvid=${encodeURIComponent(bvid)}`, 10000);
        const j = await r.json().catch(() => null);
        if (j && j.success && j.url) return j.url;
        return null;
    } catch (e) {
        console.warn('[bilibiliGetUrl] 失败:', e.message);
        return null;
    }
}

// 🌟 清洗 B 站歌词：去掉 UP主/av号/视频信息等干扰行，只留真实歌词行
function cleanBilibiliLyrics(text) {
    const noisePatterns = [
        /^(UP主|UP主:|up主|up主:)[^\n]*/im,
        /^(BV|av|AV|bv)[A-Za-z0-9]{10,}/,
        /^https?:\/\//,
        /^(视频|简介|简介:|标题:|标签:|分类:)[^\n]*/im,
        /^(已投稿|投稿视频|自制)[^\n]*/im,
        /^(bilibili|B站)[^\n]*/im,
        /^[\d\.\-:]+$/,                  // 纯时间戳无歌词
        /^[\W\d]+$/,                      // 全符号/数字行
    ];
    const lines = text.split('\n');
    const filtered = lines.filter(line => {
        const trimmed = line.trim();
        if (!trimmed) return false;
        if (noisePatterns.some(p => p.test(trimmed))) return false;
        // 保留有中文或日文汉字的歌词行
        if (/[\u4e00-\u9fa5]/.test(trimmed)) return true;
        // 或保留有实际英文单词的行（排除纯URL、时间轴）
        if (/[a-zA-Z]{3,}/.test(trimmed) && !/^[\[\d\.:]+/.test(trimmed)) return true;
        return false;
    });
    return filtered.join('\n');
}

// 🌟 带 GBK 回退的歌词抓取：UTF-8 读出来是乱码就自动换 GBK 重读
async function fetchLRCWithGBKFallback(url, timeoutMs = 8000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let res;
    try {
        res = await fetch(url, { signal: controller.signal });
    } catch (_) {
        clearTimeout(timer);
        throw new Error("歌词获取超时");
    }
    clearTimeout(timer);

    const text = await res.text();
    if (!isGarbled(text)) return text;
    // UTF-8 是乱码，尝试 GBK 解码（适用于酷狗、酷我等国产平台）
    try {
        const buf = await res.arrayBuffer();
        const decoder = new TextDecoder('gbk');
        const gbkText = decoder.decode(buf);
        if (!isGarbled(gbkText)) return gbkText;
    } catch(_) {}
    return text; // GBK 也失败就用原文（反正也比乱码强）
}

// 🌟 乱码检测：常见 Unicode 替代字符 + 无效中文字符占比过高 = 乱码
function isGarbled(text) {
    const replacementCount = (text.match(/\uFFFD/g) || []).length;
    const totalLen = text.length;
    // 替代字符过多，或基本没有有效中文字符
    if (replacementCount / totalLen > 0.05) return true;
    const chineseCount = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    // 没有中文，也没有 LRC 时间戳标签，说明很可能是乱码
    if (chineseCount === 0 && !text.includes('[0') && !text.includes('[1') && !text.includes('[2')) return true;
    return false;
}

// 🌟 判断是否为现场/Live版本（供 performNetSearch 和 fetchLyrics 共用）
const isLiveVersion = (title) => {
    if (!title) return false;
    const t = String(title).toLowerCase();
    return t.includes('live') || t.includes('现场') || t.includes('实录') ||
           t.includes('（live') || t.includes('(live') || t.includes('live版') ||
           t.includes('现场版') || t.includes('live version') || t.includes('Acoustic Live');
};

// 🌟 封面获取（优先 Meting API /search -> /pic，最后兜底 iTunes）
async function fetchOnlineCover(title, artist) {
    if (!title) return null;
    const query = encodeURIComponent(title + ' ' + (artist || ''));

    // 遍历所有支持 /pic 接口的平台，依次尝试（优先 QQ 音乐）
    const serversToTry = ['tencent', 'kugou', 'netease'];

    for (const server of serversToTry) {
        try {
            // 1. 搜索获取 pic_id
            const timeoutMs = server === 'tencent' ? 15000 : 5000;
            const searchRes = await metingFetch(`/search?server=${server}&id=${query}&limit=3`, timeoutMs);
            const searchJson = await searchRes.json().catch(() => null);
            const results = (searchJson?.data || searchJson || []).slice(0, 3);

            // 模糊匹配最接近的歌名
            const nt = (title || '').toLowerCase().replace(/[\s\(\)\[\]（）]/g, '');
            const match = results.find(r => {
                const rt = (r.name || r.title || '').toLowerCase().replace(/[\s\(\)\[\]（）]/g, '');
                return rt.includes(nt) || nt.includes(rt);
            }) || results[0];

            const picId = match?.pic_id || match?.pic;
            if (picId) {
                // 平台直接返回完整 URL（http://开头），直接使用
                if (String(picId).startsWith('http')) return picId;
                // 用 /pic 接口解析 pic_id -> 真实 URL
                const picUrl = await fetchSongPic(server, picId, 2000);
                if (picUrl) return picUrl;
            }
        } catch(e) {
            console.warn(`[fetchOnlineCover] ${server} 失败，尝试下一个...`);
        }
    }

    // 最终保底：iTunes
    try {
        const itunesRes = await fetch(`https://itunes.apple.com/search?term=${query}&media=music&entity=song&limit=1`);
        const itunesData = await itunesRes.json();
        if (itunesData.results?.[0]?.artworkUrl100) {
            // 升级到最高分辨率：/100x100bb/ -> /2000x2000bb/
            return itunesData.results[0].artworkUrl100.replace(/\/100x100([\/-])/, '/2000x2000$1');
        }
    } catch(e) {
        console.error('[fetchOnlineCover] iTunes 保底失败:', e);
    }

    return null;
}

// ====== 专用：QQ 音乐封面获取 ======
async function fetchTencentCover(title, artist) {
    if (!title) return null;
    const query = encodeURIComponent(title + ' ' + (artist || ''));

    try {
        // 搜索腾讯（15秒超时）
        const searchRes = await metingFetch(`/search?server=tencent&id=${query}&limit=3`, 15000);
        const searchJson = await searchRes.json().catch(() => null);
        const results = (searchJson?.data || searchJson || []);

        // 模糊匹配最接近的歌名
        const nt = (title || '').toLowerCase().replace(/[\s\(\)\[\]（）]/g, '');
        const match = results.find(r => {
            const rt = (r.name || r.title || '').toLowerCase().replace(/[\s\(\)\[\]（）]/g, '');
            return rt.includes(nt) || nt.includes(rt);
        }) || results[0];

        const picId = match?.pic_id || '';
        if (!picId) return null;

        // 直接拼 QQ 音乐 CDN 的封面 URL，不走 /pic 接口
        return `https://y.gtimg.cn/music/photo_new/T002R800x800M000${picId}.jpg`;
    } catch(e) {
        console.warn('[fetchTencentCover] 失败:', e.message);
        return null;
    }
}

// ====== Meting API 详细信息获取 ======
// 获取歌曲详细信息（含专辑、时长、发行日期等）
// ⚠️ Meting 的 /song 接口返回的字段有限，优先使用 /search 结果中的详细信息
async function fetchSongDetail(server, songId, searchResultItem = null) {
    // 如果传入了搜索结果项，先用它作为基础数据
    let r = searchResultItem ? { ...searchResultItem } : null;

    // 通过 /song 补全时长（/search 和 /album 都没有单歌曲时长）
    if (r && songId && !r.duration) {
        try {
            const songRes = await metingFetch(`/song?server=${server}&id=${songId}`, 8000);
            const songJson = await songRes.json();
            if (songJson && songJson.success && songJson.data) {
                const sd = Array.isArray(songJson.data) ? songJson.data[0] : songJson.data;
                if (sd) {
                    if (!r.duration && sd.duration) r.duration = sd.duration;
                    if (!r.publishDate && (sd.publishDate || sd.publish_time)) {
                        r.publishDate = sd.publishDate || sd.publish_time;
                    }
                }
            }
        } catch(e) { /* 补全失败就算了 */ }
    }

    // 通过 /album 补全发行日期（如果 /song 也没找到）
    const albumId = r ? (r.album_id || r.albumId) : null;
    if (r && albumId && !r.publishDate) {
        try {
            const albumRes = await metingFetch(`/album?server=${server}&id=${albumId}`, 8000);
            const albumJson = await albumRes.json();
            if (albumJson && albumJson.success && albumJson.data) {
                const ad = Array.isArray(albumJson.data) ? albumJson.data[0] : albumJson.data;
                if (ad) {
                    if (!r.publishDate && (ad.publishDate || ad.publish_time)) {
                        r.publishDate = ad.publishDate || ad.publish_time;
                    }
                    // 专辑名称和封面也以专辑数据补全
                    if (!r.album && (ad.album || ad.name)) r.album = ad.album || ad.name;
                    if (!r.pic && (ad.pic_id || ad.pic)) r.pic = ad.pic_id || ad.pic;
                    // /album 的 songs 数组里可能有时长
                    if (!r.duration && Array.isArray(ad.songs)) {
                        const matchedSong = ad.songs.find(s =>
                            (s.id == songId || s.id == r.id) && s.duration
                        );
                        if (matchedSong) r.duration = matchedSong.duration;
                    }
                }
            }
        } catch(e) { /* 补全失败就算了 */ }
    }

    if (r) {
        return {
            id: r.id || r.songid || songId,
            title: r.name || r.title || '',
            artist: (r.artist || r.author || r.singer || '').toString(),
            album: r.album || '',
            albumId: r.album_id || albumId || '',
            pic: r.pic_id || r.pic || '',
            duration: r.duration || 0,
            publishDate: r.publishDate || r.publish_time || '',
            url: r.url || '',
            lyricId: r.lyric_id || r.lrc_id || '',
            raw: r
        };
    }

    // 无搜索结果时：直接调 /song
    try {
        const res = await metingFetch(`/song?server=${server}&id=${songId}`, 10000);
        const j = await res.json();
        if (!j.success) return null;
        const d = j.data;
        const normalize = (item) => ({
            id: item.id || item.songid || songId,
            title: item.name || item.title || '',
            artist: (item.artist || item.author || item.singer || '').toString(),
            album: item.album || '',
            albumId: item.album_id || '',
            pic: item.pic_id || item.pic || '',
            duration: item.duration || 0,
            publishDate: item.publishDate || item.publish_time || '',
            url: item.url || '',
            lyricId: item.lyric_id || item.lrc_id || '',
            raw: item
        });
        if (Array.isArray(d)) return normalize(d[0]);
        return normalize(d);
    } catch(e) { return null; }
}

// 获取专辑详细信息（含封面、发行日期、曲目列表）
async function fetchAlbumDetail(server, albumId) {
    try {
        const res = await metingFetch(`/album?server=${server}&id=${albumId}`, 10000);
        const j = await res.json();
        if (!j.success) return null;
        const d = j.data;
        if (Array.isArray(d)) {
            return {
                id: d[0]?.album_id || albumId,
                name: d[0]?.album || '',
                artist: (d[0]?.artist || '').toString(),
                pic: d[0]?.pic_id || '',
                publishDate: d[0]?.publishDate || d[0]?.publish_time || '',
                songs: d.map(item => ({
                    id: item.id,
                    title: item.name || item.title || '',
                    artist: (item.artist || item.author || '').toString(),
                    duration: item.duration || 0
                })),
                raw: d
            };
        }
        return {
            id: d.album_id || albumId,
            name: d.album || d.name || '',
            artist: (d.artist || '').toString(),
            pic: d.pic_id || d.pic || '',
            publishDate: d.publishDate || d.publish_time || '',
            songs: Array.isArray(d.songs) ? d.songs : [],
            raw: d
        };
    } catch(e) { return null; }
}

// 获取歌手信息（含热门歌曲列表）
async function fetchArtistDetail(server, artistId) {
    try {
        const res = await metingFetch(`/artist?server=${server}&id=${artistId}&limit=20`, 10000);
        const j = await res.json();
        if (!j.success) return null;
        const d = j.data;
        if (Array.isArray(d)) {
            return {
                id: artistId,
                name: d[0]?.artist || '',
                songs: d.map(item => ({
                    id: item.id,
                    title: item.name || item.title || '',
                    album: item.album || '',
                    duration: item.duration || 0
                })),
                raw: d
            };
        }
        return { id: artistId, name: d.artist || '', songs: Array.isArray(d.songs) ? d.songs : [], raw: d };
    } catch(e) { return null; }
}

// 获取歌曲封面 URL（通过 Meting API）
async function fetchSongPic(server, picId, size = 600) {
    // 腾讯直接拼 URL，跳过 /pic 接口（避免 CORS）
    if (server === 'tencent') {
        return `https://y.gtimg.cn/music/photo_new/T002R300x300M000${picId}.jpg`;
    }
    if (server === 'netease') {
        return `https://p1.music.126.net/${picId}/${picId}.jpg?param=${size}y${size}`;
    }
    try {
        const res = await metingFetch(`/pic?server=${server}&id=${picId}&size=${size}`, 8000);
        if (res.redirected && res.url) return res.url;
        const j = await res.json();
        if (j.success && j.data) {
            const picUrl = typeof j.data === 'string' ? j.data : (j.data.url || '');
            return picUrl;
        }
        return null;
    } catch(e) { return null; }
}

// ====== CeruMusic 风格聚合搜索 ======
// 服务端并发搜索所有平台 → 轮转交错合并 → 智能去重
// 服务端不可用时回退到前端并发
async function aggregateSearch(query, options = {}) {
  const keyword = encodeURIComponent(query);
  const limit = options.limit || 30;
  const sources = options.sources || ['netease', 'tencent', 'kugou', 'kuwo', 'migu', 'bilibili'];

  // 优先尝试服务端聚合端点
  try {
    const r = await metingFetch(`/aggregate/search?id=${keyword}&limit=${limit}`, 10000);
    const j = await r.json().catch(() => null);
    if (j && j.success && Array.isArray(j.data) && j.data.length > 0) {
      console.log(`[aggregateSearch] 服务端聚合: ${j.data.length} 首 (来自 ${j.sources.join(',')})`);
      return { list: j.data, total: j.count, sources: j.sources, sourceCounts: j.sourceCounts };
    }
  } catch (e) {
    console.warn('[aggregateSearch] 服务端聚合失败，回退前端并发:', e.message);
  }

  // 回退：前端并发搜索
  console.log('[aggregateSearch] 前端并发搜索 ' + sources.join(', '));
  const tasks = sources.map(async (src) => {
    try {
      let r, j;
      if (src === 'migu') {
        r = await metingFetch(`/migu/search?id=${keyword}&limit=${limit}`, 8000);
        j = await r.json().catch(() => []);
      } else if (src === 'bilibili') {
        r = await metingFetch(`/bilibili/search?id=${keyword}&pagesize=${limit}`, 10000);
        j = await r.json().catch(() => []);
      } else {
        r = await metingFetch(`/search?server=${src}&id=${keyword}&limit=${limit}`, 8000);
        j = await r.json().catch(() => []);
      }
      const list = (j && j.data) ? j.data : (Array.isArray(j) ? j : []);
      return list.map(item => ({ ...item, _source: src }));
    } catch (e) {
      return [];
    }
  });

  const results = await Promise.all(tasks);
  const interleaved = _interleave(results);
  const deduped = _deduplicate(interleaved);
  console.log(`[aggregateSearch] 前端聚合: ${deduped.length} 首`);

  return { list: deduped, total: deduped.length, sources };
}

// 轮转交错算法
function _interleave(arrays) {
  const result = [];
  const filtered = arrays.filter(a => Array.isArray(a) && a.length > 0);
  if (!filtered.length) return result;
  const max = Math.max(...filtered.map(a => a.length));
  for (let i = 0; i < max; i++) {
    for (const arr of filtered) {
      if (i < arr.length) result.push(arr[i]);
    }
  }
  return result;
}

// 智能去重
function _deduplicate(list) {
  const seen = new Set();
  return list.filter(item => {
    const title = (item.title || item.name || '').toLowerCase().replace(/[（(][^)）]*[)）]/g, '').replace(/\s+/g, '').trim();
    const artist = (item.artist || item.author || item.singer || '').toString().toLowerCase().replace(/\s+/g, '').trim();
    const key = title + '|' + artist;
    if (key.length < 3) return false;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ====== 暴露到全局命名空间 ======
window.IanMusic.NET_SEARCH_SOURCES = NET_SEARCH_SOURCES;
window.IanMusic.BILIBILI_API = BILIBILI_API;
window.IanMusic.metingFetch = metingFetch;
window.IanMusic.bilibiliSearch = bilibiliSearch;
window.IanMusic.bilibiliGetUrl = bilibiliGetUrl;
window.IanMusic.cleanBilibiliLyrics = cleanBilibiliLyrics;
window.IanMusic.fetchLRCWithGBKFallback = fetchLRCWithGBKFallback;
window.IanMusic.isGarbled = isGarbled;
window.IanMusic.isLiveVersion = isLiveVersion;
window.IanMusic.aggregateSearch = aggregateSearch;
window.IanMusic.fetchOnlineCover = fetchOnlineCover;
window.IanMusic.fetchSongDetail = fetchSongDetail;
window.IanMusic.fetchAlbumDetail = fetchAlbumDetail;
window.IanMusic.fetchArtistDetail = fetchArtistDetail;
window.IanMusic.fetchSongPic = fetchSongPic;
window.IanMusic.fetchTencentCover = fetchTencentCover;

