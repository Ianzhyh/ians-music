window.IanMusicUtils = {};

window.IanMusicUtils.tryBitrate = async function(server, id, bitrates, metingFetch) {
    for (const br of bitrates) {
        try {
            const d = await Promise.race([
                metingFetch(`/url?server=${server}&id=${id}&r=${br}`, 8000).then(r => r.json()).catch(() => ({})),
                new Promise(r => setTimeout(() => r({}), 9000))
            ]);
            const url = d.data?.url || d.url || '';
            if (url) return url;
        } catch (_) {}
    }
    return null;
};

window.IanMusicUtils.ptHash33 = function(str) {
    let hash = 0;
    for (let i = 0, len = str.length; i < len; i++) {
        hash += (hash << 5) + str.charCodeAt(i);
    }
    return hash & 0x7FFFFFFF;
};

window.IanMusicUtils._CACHE_PREFIXES = ['am_cover_', 'am_song_info_', 'am_lyric_'];

window.IanMusicUtils._evictLRU = function(maxTotalBytes) {
    var prefixes = window.IanMusicUtils._CACHE_PREFIXES;
    var orderKey = 'am_cache_order';
    var order = [];
    try { order = JSON.parse(localStorage.getItem(orderKey) || '[]'); } catch(e) { order = []; }

    var entries = [];
    var totalSize = 0;
    for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (!k) continue;
        var isCache = prefixes.some(function(p) { return k.startsWith(p); });
        if (!isCache) continue;
        var val = localStorage.getItem(k);
        var size = val ? val.length * 2 : 0;
        totalSize += size;
        var orderIdx = order.indexOf(k);
        entries.push({ key: k, size: size, orderIdx: orderIdx >= 0 ? orderIdx : Infinity });
    }

    if (totalSize <= maxTotalBytes) return;

    entries.sort(function(a, b) { return a.orderIdx - b.orderIdx; });

    for (var ei = 0; ei < entries.length; ei++) {
        if (totalSize <= maxTotalBytes) break;
        localStorage.removeItem(entries[ei].key);
        totalSize -= entries[ei].size;
        var oi = order.indexOf(entries[ei].key);
        if (oi !== -1) order.splice(oi, 1);
    }

    try { localStorage.setItem(orderKey, JSON.stringify(order)); } catch(e2) {}
};

window.IanMusicUtils.cacheSet = function(key, value, maxTotalBytes) {
    if (key.startsWith('am_cover_b64_') && window.IanMusicUtils._coverDB) {
        window.IanMusicUtils._coverDB.setItem(key, value).catch(function() {
            try { localStorage.setItem(key, value); } catch(e2) {}
        });
        return;
    }
    if (maxTotalBytes === undefined) maxTotalBytes = 4 * 1024 * 1024;
    var orderKey = 'am_cache_order';
    var order = [];
    try { order = JSON.parse(localStorage.getItem(orderKey) || '[]'); } catch(e) { order = []; }

    var existingIdx = order.indexOf(key);
    if (existingIdx !== -1) order.splice(existingIdx, 1);
    order.push(key);

    try {
        localStorage.setItem(key, value);
        try { localStorage.setItem(orderKey, JSON.stringify(order)); } catch(e3) {}
    } catch(e) {
        if (e.name === 'QuotaExceededError' || e.code === 22) {
            var oi = order.indexOf(key);
            if (oi !== -1) order.splice(oi, 1);
            window.IanMusicUtils._evictLRU(maxTotalBytes);
            try { localStorage.setItem(key, value); order.push(key); } catch(e2) {}
            try { localStorage.setItem(orderKey, JSON.stringify(order)); } catch(e3) {}
        }
    }
};
