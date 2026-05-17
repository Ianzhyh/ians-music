/**
 * @module IanMusic/config
 * @description 配置 + 常量 + 国际化 + 全局状态声明 + AI 变量
 */

// 确保 window.IanMusic 命名空间存在
window.IanMusic = window.IanMusic || {};

// ====== i18n 国际化字典 ======
const i18n = {
    __note: "DO NOT EDIT - auto-generated i18n dictionary",
    en: {
        // ===== Title Bar =====
        minimize: "Minimize", maximize: "Maximize", fullscreen: "Fullscreen", exitFullscreen: "Exit Fullscreen", closeWin: "Close",
        // ===== First-time Modal =====
        welcome: "Welcome", appDisclaimer: "This application is for learning purposes only.", iUnderstand: "I Understand",
        disclaimer1: "This application is for learning and research purposes only, and must not be used for any commercial activities or copyright infringement.",
        disclaimer2: "Your Cookie is a personal login credential. Do not share it with others. We recommend changing your password regularly to ensure account security.",
        disclaimer3: "Listening to VIP songs requires two conditions: ① a valid Cookie must be filled in, and ② the account associated with that Cookie must have an active platform VIP membership. Both are essential.",
        disclaimer4: "By using this application, you acknowledge and agree to assume all associated risks and responsibilities.",
        // ===== Existing Keys (preserved) =====
        settings: "Settings", lang: "Language", accent: "Theme", blur: "Blur", size: "Lyrics Size", reset: "Reset Library", library: "Library", file: "+ File", folder: "+ Folder", export: "Export", import: "Import", searchTitle: "Search Lyrics", searchBtn: "Go", hint: "Lyrics will appear here", notfound: "No lyrics found", move: "Move to...", create: "Create New...", sleep: "Sleep Timer", customSleep: "Custom (min):", set: "Set",
        shuffleOn: "Shuffle On", shuffleOff: "Shuffle Off", repeatOff: "Repeat Off", repeatAll: "Repeat All", repeatOne: "Repeat One",
        sleepOff: "Sleep Timer Off", sleepSet: "Sleep Timer: ", sleepReached: "Sleep Timer Reached",
        playlistSorted: "Playlist Reordered", searching: "Searching...", retry: "Retry", manual: "Manual Search",
        liked: "Added to Favorites", unliked: "Removed from Favorites",
        aiTitle: "Song Insight", aiLoading: "Asking DeepSeek...", aiError: "Error. Check Key or Network.",
        confirmDelete: "Delete this track?", confirmReset: "Reset entire library? This cannot be undone.", confirmImport: "Clear current library and import backup?", invalidJson: "Import failed: Invalid file.", genericError: "An error occurred.",
        renamePrompt: "Rename folder:", newFolderPrompt: "New folder name:", done: "Done", cancel: "Cancel", refreshed: "Library Refreshed",
        apiKey: "API Key", apiEndpoint: "Base URL", modelName: "Model Name",
        proxyHint: "Recommended for China: Use SiliconFlow (api.siliconflow.cn). Get Key at cloud.siliconflow.cn.",
        themeGen: "AI Theme Generator", poweredBy: "Powered by DeepSeek AI",
        defaultGroup: "Default", importedGroup: "Imported", searchLibPlaceholder: "Search library...",
        keySaved: "Settings Saved", themeGenerated: "Theme: ",
        cookieSaved: "Cookie Saved", apiSaved: "API Address Saved",
        netSearchTitle: "Web Search", netSearchBtn: "Search", netSearch: "Web", onlineGroup: "Online",
        aiTranslate: "Translate", noLyricsToTranslate: "No translatable lyrics found", bilingualShown: "Bilingual On", bilingualHidden: "Bilingual Off", translateFailed: "Translation failed or timed out",
        baseUrl: "Base URL", modelName: "Model",
        themeColor: "Theme Color", aiThemeGen: "AI Theme Generator", go: "Go", blur: "Blur", blurLow: "Low", blurHigh: "High", lyricsSize: "Lyrics Size",
        sleepTimer: "Sleep Timer", sleepOff: "Off", customMin: "Custom (min):", sleepSet: "Set",
        resetLib: "Reset Library", cancel: "Cancel",
        searchCover: "Search Online Covers", search: "Search",
        netSearchPlaceholder: "Song, Artist", netSearchDesc: "一次搜索酷狗·网易云·QQ·酷我·B站，自动过滤 Live 版，自动双 API 重试。",
        library: "Library", drawerDone: "DONE", searchPlaceholder: "Search songs...", addFile: "+ File", addFolder: "+ Folder", netSearchLib: "Web Search",
        songInfoTitle: "Song Info", album: "Album", duration: "Duration", publishDate: "Released", source: "Source",
        // ===== Toast Messages =====
        coverUpdated: "Cover Updated", lyricsUpdated: "Lyrics Updated", crossfadeOn: "Crossfade: On", crossfadeOff: "Crossfade: Off", crossfadeSec: "Crossfade: ",
        playError: "Playback error", noAudioUrl: "No playback URL available", audioLoadFailed: "Audio load failed — auto re-searching...",
        noWorkingAudio: "No working audio found after 2 retries", searchingAudio: "Searching audio...", noAlternativeAudio: "No alternative audio found",
        autoColorMode: "Auto color mode enabled", noLyricId: "No lyric ID", noLyricData: "No lyric data", fetchLyricFail: "Failed to fetch lyrics",
        noLyricIdTrack: "No lyric ID for this track", noOnlineLyrics: "No online lyrics available", tryAnotherSource: "Failed to fetch lyrics, try another source",
        noCoverFound: "No cover found", networkErrorRetry: "Network error, retry later", searchErrorRetry: "Search failed, check network or try another source",
        volumeToast: "Volume", mute: "Mute", modeChanged: "Mode Changed",
        // ===== Lyrics =====
        lyricsCenter: "Lyrics Centered", lyricsLeft: "Lyrics Left Aligned",
        qrcParseFailed: "QRC parse failed", qrcEmpty: "QRC lyrics empty, trying alternatives",
        noLyricsOnline: "No lyrics found online, try manual search",
        scrollLyrics: "Scrolling Lyrics", staticLyrics: "Static Lyrics",
        searchingQQMusic: "Searching QQ Music lyrics (word-level)...", qrcWordLevel: "QRC Word-Level",
        unknownSong: "Unknown Song", unknownSinger: "Unknown Singer",
        importLocalLrc: "Import local .lrc / .txt lyrics",
        // ===== Playlist =====
        deleteTrack: "Delete Track", deleteLabel: "Delete", deleteFolder: "Delete Folder",
        confirmDeleteFolder: "Delete folder", folderDeleted: "Folder deleted",
        resetLabel: "Reset", importLabel: "Import", importBackup: "Import Backup",
        newName: "New name", noTrackPlaying: "No track playing",
        searchLabel: "Search", searchingText: "Searching...", searchingMsg: "Searching...",
        playlistFound: "Found: ", playlistNotFound: "[ERR] Not found",
        // ===== AI / Song Insight =====
        apiKeyNotSet: "Please set API Key in Settings.",
        answerSystemPrompt: "Answer in Chinese",
        enterThemeDesc: "Please enter theme description",
        fetchingTranslation: "Fetching translation...", officialTransApplied: "Official translation applied",
        aiTranslating: "AI translating...", lyricsFormatNotSupported: "Lyrics format not supported for translation",
        aiFormatError: "AI format error, please retry", noTranslationNeeded: "No translation needed or failed",
        playingTitle: "Playing: ",
        // ===== Mobile More Menu =====
        searchLyricsMobile: "Search Lyrics", translateLyricsMobile: "Translate Lyrics", songInsightMobile: "Song Insight",
        shuffleModeMobile: "Shuffle", repeatModeMobile: "Repeat Mode", importPlaylistMobile: "Import Playlist",
        airplayNotSupported: "AirPlay not supported in browser", commentSoon: "Comment section coming soon...",
        // ===== Settings Group Titles =====
        aiApiGroup: "AI API", musicApiGroup: "Music API", themeDisplayGroup: "Theme & Display", sleepTimerGroup: "Sleep Timer",
        // ===== Search Modals =====
        searchLyricsTitle: "Search Lyrics", searchOnlineCoverTitle: "Search Online Covers", importPlaylistTitle: "Import Playlist",
        loadPlaylist: "Load Playlist", playlistLinkPlaceholder: "Paste QQ Music / NetEase playlist link...",
        playlistLinkHint: "Supports QQ Music, NetEase playlist links, and pure IDs",
        searchOnlineImg: "Search Online Images", localUpload: "Local Upload",
        pasteLinkFirst: "Paste a playlist or song link first", loadingText: "Loading...",
        unsupportedLink: "[WARN] Unsupported link format", noPlayableSongs: "[WARN] No playable songs found",
        playlistSongsFmt: "Playlist ({count} songs)", addAllSongsFmt: "Add all {count} songs",
        importingText: "Importing...", importedFmt: "Imported: {count} songs", addedFmt: "Added {count} songs",
        // ===== QR Login =====
        qrExpired: "QR code expired", clickRefresh: "Click to refresh", fetchingQR: "Fetching QR code...",
        noCookieManual: "No cookie? Paste manually", confirmPaste: "Confirm Paste",
        cookiePlaceholder: "Scan QR to auto-fill, or paste manually",
        loginSuccess: "Login successful! Cookie saved", loginFailed: "Login failed",
        qrLoginFileProtocol: "QR login requires http:// or https:// protocol",
        qrLoginModuleNotLoaded: "QR login module not loaded",
        openWebLogin: "Open Web Login", openingText: "Opening...", openingQQLogin: "Opening QQ login window...",
        localMetingLabel: "Local Meting API Address",
        localMetingHint: "Self-hosted Meting-API address (required for Cookie functionality)",
        whyNeedCookie: "Why need Cookie?",
        cookieExplanation: "Due to copyright protection, music platforms require login credentials (Cookie) to access streaming URLs. Your Cookie is stored locally in your browser and is never uploaded to any server. We recommend using a dedicated account for this purpose and changing your password regularly.",
        vipPrerequisiteTitle: "VIP Song Playback Requirements",
        vipPrerequisiteText: "To play VIP songs, your account must: 1) Have a valid Cookie filled in the settings; 2) Have an active VIP membership on the corresponding music platform. Both conditions must be met.",
        cookieOnlyWithSelfApi: "Cookie only works with self-hosted Meting-API",
        qrScanGuide: "Open the QQ Music or NetEase Music app on your phone, scan the QR code to authorize login. After successful login, the Cookie will be automatically saved.",
        // ===== Other UI =====
        likeBtn: "Like", moreBtn: "More", favoriteBtn: "Favorite",
        crossfadeLabel: "Crossfade", offLabel: "Off", confirmLabel: "Confirm", okLabel: "OK", cancelLabel: "Cancel",
        emptyLibrary: "No songs yet. Search or import to start playing.",
        // ===== Mobile =====
        translateShort: "译", lyricsStyleShort: "词", lyricsCommentsTab: "Lyrics / Comments", songLibraryTab: "Library"
    },
    zh: {
        // ===== Title Bar =====
        minimize: "最小化", maximize: "最大化", fullscreen: "全屏", exitFullscreen: "退出全屏", closeWin: "关闭",
        // ===== First-time Modal =====
        welcome: "欢迎", appDisclaimer: "本应用仅供学习研究使用。", iUnderstand: "我已知晓",
        disclaimer1: "本应用仅供学习研究使用，不得用于任何商业用途或侵权行为",
        disclaimer2: "Cookie 为您的个人登录凭证，请勿向他人泄露；建议定期更换密码以保障账号安全",
        disclaimer3: "VIP 歌曲收听需满足两个条件：① 填写有效的 Cookie ② 该 Cookie 关联的账号需已开通平台 VIP 会员。缺一不可。",
        disclaimer4: "使用本应用即表示您已了解并同意自行承担相关风险与责任",
        // ===== Existing Keys (preserved) =====
        settings: "设置", lang: "语言", accent: "主题色", blur: "模糊", size: "歌词大小", reset: "重置媒体库", library: "音乐库", file: "+ 添加文件", folder: "+ 添加文件夹", export: "导出", import: "导入", searchTitle: "更换歌词", searchBtn: "搜索", hint: "歌词将显示在这里", notfound: "未找到相关内容", move: "移动到...", create: "新建文件夹...", sleep: "睡眠定时", customSleep: "自定义 (分):", set: "设定",
        shuffleOn: "随机播放: 开", shuffleOff: "随机播放: 关", repeatOff: "循环关闭", repeatAll: "列表循环", repeatOne: "单曲循环",
        sleepOff: "定时已关闭", sleepSet: "睡眠定时: ", sleepReached: "定时已结束，暂停播放",
        playlistSorted: "列表顺序已更新", searching: "歌词搜索中...", retry: "重试", manual: "手动搜索",
        liked: "已添加至我喜欢的音乐", unliked: "已取消喜欢",
        aiTitle: "歌曲解构", aiLoading: "正在询问 DeepSeek...", aiError: "连接失败，请检查API Key或网络。",
        confirmDelete: "确定要删除这首歌曲吗？", confirmReset: "确定要重置整个音乐库吗？此操作无法撤销。", confirmImport: "确定要清空当前库并导入备份文件吗?", invalidJson: "导入失败: 文件格式无效。", genericError: "发生错误。",
        renamePrompt: "重命名文件夹:", newFolderPrompt: "新文件夹名称:", done: "完成", cancel: "取消", refreshed: "音乐库已刷新",
        apiKey: "API Key", apiEndpoint: "API 地址 (Base URL)", modelName: "模型名称 (Model)",
        proxyHint: "国内推荐使用 SiliconFlow（硅基流动）。默认地址已设为 api.siliconflow.cn，请填写对应的 Key。",
        themeGen: "AI 主题生成器", poweredBy: "由 DeepSeek AI 提供支持",
        defaultGroup: "默认列表", importedGroup: "导入列表", searchLibPlaceholder: "搜索音乐库...",
        keySaved: "设置已保存", themeGenerated: "主题已应用: ",
        cookieSaved: "Cookie 已保存", apiSaved: "API 地址已保存",
        netSearchTitle: "网络搜索", netSearchBtn: "搜索", netSearch: "网络", onlineGroup: "在线试听",
        aiTranslate: "翻译", noLyricsToTranslate: "当前没有可翻译的歌词", bilingualShown: "双语已显示", bilingualHidden: "双语已隐藏", translateFailed: "翻译请求失败或超时",
        baseUrl: "Base URL", modelName: "模型名称",
        themeColor: "主题色", aiThemeGen: "AI 主题生成器", go: "生成", blur: "模糊", blurLow: "低", blurHigh: "高", lyricsSize: "歌词大小",
        sleepTimer: "睡眠定时", sleepOff: "关闭", customMin: "自定义 (分):", sleepSet: "设定",
        resetLib: "重置媒体库", cancel: "取消",
        searchCover: "搜索在线封面", search: "搜索",
        netSearchPlaceholder: "歌曲名 歌手名", netSearchDesc: "一次搜索酷狗·网易云·QQ·酷我·B站，自动过滤 Live 版，自动双 API 重试。",
        library: "音乐库", drawerDone: "完成", searchPlaceholder: "搜索歌曲...", addFile: "+ 文件", addFolder: "+ 文件夹", netSearchLib: "网络搜索",
        songInfoTitle: "歌曲信息", album: "专辑", duration: "时长", publishDate: "发行日期", source: "来源",
        // ===== Toast Messages =====
        coverUpdated: "封面已更新", lyricsUpdated: "歌词已更换", crossfadeOn: "交叉淡入淡出: 开", crossfadeOff: "交叉淡入淡出: 关", crossfadeSec: "交叉淡入淡出: ",
        playError: "播放错误", noAudioUrl: "没有可播放的音源", audioLoadFailed: "音频加载失败 — 自动重试中...",
        noWorkingAudio: "两次重试后未找到可用音源", searchingAudio: "正在搜索音源...", noAlternativeAudio: "未找到替代音源",
        autoColorMode: "自动配色模式已启用", noLyricId: "没有歌词 ID", noLyricData: "无歌词数据", fetchLyricFail: "获取歌词失败",
        noLyricIdTrack: "该歌曲没有歌词 ID", noOnlineLyrics: "没有在线歌词", tryAnotherSource: "获取歌词失败，请尝试其他来源",
        noCoverFound: "未找到相关封面", networkErrorRetry: "网络错误，请稍后重试", searchErrorRetry: "搜索出错，请检查网络或更换源",
        volumeToast: "音量", mute: "静音", modeChanged: "模式已切换",
        // ===== Lyrics =====
        lyricsCenter: "歌词居中", lyricsLeft: "歌词左对齐",
        qrcParseFailed: "QRC 歌词解析失败", qrcEmpty: "QRC 歌词数据为空，尝试其他来源",
        noLyricsOnline: "未找到在线歌词，请尝试手动搜索",
        scrollLyrics: "滚动歌词", staticLyrics: "静态歌词",
        searchingQQMusic: "正在搜索 QQ音乐 歌词（含逐字时间）...", qrcWordLevel: "QRC 逐字",
        unknownSong: "未知歌曲", unknownSinger: "未知歌手",
        importLocalLrc: "导入本地 .lrc / .txt 歌词文件",
        // ===== Playlist =====
        deleteTrack: "删除歌曲", deleteLabel: "删除", deleteFolder: "删除文件夹",
        confirmDeleteFolder: "确定要删除文件夹", folderDeleted: "文件夹已删除",
        resetLabel: "重置", importLabel: "导入", importBackup: "导入备份",
        newName: "新名称", noTrackPlaying: "当前无播放歌曲",
        searchLabel: "搜索", searchingText: "搜索中...", searchingMsg: "正在搜索...",
        playlistFound: "找到：", playlistNotFound: "[ERR] 未找到相关歌曲",
        // ===== AI / Song Insight =====
        apiKeyNotSet: "请先在设置中填写 API Key。",
        answerSystemPrompt: "请用中文回答",
        enterThemeDesc: "请输入主题描述",
        fetchingTranslation: "获取翻译...", officialTransApplied: "官方翻译已应用",
        aiTranslating: "AI 翻译中...", lyricsFormatNotSupported: "当前歌词格式不支持翻译",
        aiFormatError: "AI 返回格式异常，请重试", noTranslationNeeded: "无需翻译或翻译失败",
        playingTitle: "正在播放：",
        // ===== Mobile More Menu =====
        searchLyricsMobile: "歌词搜索", translateLyricsMobile: "翻译歌词", songInsightMobile: "歌曲解构",
        shuffleModeMobile: "随机播放", repeatModeMobile: "循环模式", importPlaylistMobile: "导入歌单",
        airplayNotSupported: "网页版不支持 AirPlay", commentSoon: "评论功能即将上线...",
        // ===== Settings Group Titles =====
        aiApiGroup: "AI API", musicApiGroup: "音乐 API", themeDisplayGroup: "主题与显示", sleepTimerGroup: "睡眠定时",
        // ===== Search Modals =====
        searchLyricsTitle: "更换歌词", searchOnlineCoverTitle: "搜索在线封面", importPlaylistTitle: "导入歌单",
        loadPlaylist: "加载歌单", playlistLinkPlaceholder: "粘贴 QQ音乐 / 网易云歌单链接...",
        playlistLinkHint: "支持 QQ音乐、网易云歌单链接，以及纯 ID",
        searchOnlineImg: "网络搜图", localUpload: "本地上传",
        pasteLinkFirst: "请先粘贴歌单或歌曲链接", loadingText: "加载中...",
        unsupportedLink: "[WARN] 不支持的链接格式", noPlayableSongs: "[WARN] 未找到可播放歌曲",
        playlistSongsFmt: "歌单 ({count} 首)", addAllSongsFmt: "添加全部 {count} 首",
        importingText: "导入中...", importedFmt: "已导入：{count} 首", addedFmt: "已添加 {count} 首歌曲",
        // ===== QR Login =====
        qrExpired: "二维码已过期", clickRefresh: "点击刷新", fetchingQR: "正在获取二维码...",
        noCookieManual: "没有 Cookie？手动粘贴", confirmPaste: "确认粘贴",
        cookiePlaceholder: "从浏览器 DevTools → Application → Cookies 复制完整 Cookie 字符串粘贴到这里...",
        loginSuccess: "登录成功！Cookie 已自动保存", loginFailed: "登录失败",
        qrLoginFileProtocol: "扫码登录功能不支持 file:// 协议，请使用本地服务器运行",
        qrLoginModuleNotLoaded: "扫码登录模块未加载",
        openWebLogin: "打开网页登录", openingText: "正在打开...", openingQQLogin: "正在打开 QQ 登录窗口...",
        localMetingLabel: "本地 Meting API 地址",
        localMetingHint: "自建 Meting-API 服务地址（Cookie 功能必须使用自建 API）",
        whyNeedCookie: "为什么需要填写 Cookie？",
        cookieExplanation: "由于版权保护，各音乐平台需要对登录态（Cookie）进行验证后才能获取流媒体链接。您的 Cookie 仅保存在您本地浏览器中，不会上传至任何服务器。建议使用专用账号并定期更换密码以确保安全。",
        vipPrerequisiteTitle: "VIP 歌曲播放条件",
        vipPrerequisiteText: "要播放 VIP 歌曲，您的账号必须：1）已在设置中填写有效的 Cookie；2）已开通对应音乐平台的 VIP 会员。两个条件缺一不可。",
        cookieOnlyWithSelfApi: "Cookie 仅在使用自建 Meting-API 时生效",
        qrScanGuide: "请在手机上打开 QQ音乐 或 网易云音乐 App，扫描二维码授权登录。登录成功后 Cookie 将自动保存到浏览器本地。",
        // ===== Other UI =====
        likeBtn: "喜欢", moreBtn: "更多", favoriteBtn: "收藏",
        crossfadeLabel: "交叉淡入淡出", offLabel: "关闭", confirmLabel: "确认", okLabel: "确定", cancelLabel: "取消",
        emptyLibrary: "暂无歌曲，搜索或导入歌单开始播放",
        // ===== Mobile =====
        translateShort: "译", lyricsStyleShort: "词", lyricsCommentsTab: "歌词 / 评论", songLibraryTab: "歌曲库"
    }
};
let curLang = 'en';

// ====== 内置曲目列表 ======
const myTracks = [
    { id:'d1', src: "./songs/大笨钟 - 周杰伦.flac", title: "大笨钟", artist: "周杰伦", group: "Default", cover: "" },
    { id:'d2', src: "./songs/爱的飞行日记 - 周杰伦杨瑞代.flac", title: "爱的飞行日记", artist: "周杰伦 & 杨瑞代", group: "Default", cover: "" },
    { id:'d3', src: "./songs/飞机场的10：30.flac", title: "飞机场的10：30", artist: "陶喆", group: "Default", cover: "" },
    { id:'s1', src: "./songs/周杰伦 - 太阳之子_EM.flac", title: "太阳之子", artist: "周杰伦", group: "太阳之子", cover: "" },
    { id:'s2', src: "./songs/周杰伦 - 西西里_EM.flac", title: "西西里", artist: "周杰伦", group: "太阳之子", cover: "" },
    { id:'s3', src: "./songs/周杰伦 - 那天下雨了_EM.flac", title: "那天下雨了", artist: "周杰伦", group: "太阳之子", cover: "" },
    { id:'s4', src: "./songs/周杰伦 - 湘女多情_EM.flac", title: "湘女多情", artist: "周杰伦", group: "太阳之子", cover: "" },
    { id:'s5', src: "./songs/周杰伦 - 谁稀罕_EM.flac", title: "谁稀罕", artist: "周杰伦", group: "太阳之子", cover: "" },
    { id:'s6', src: "./songs/周杰伦 - 七月的极光_EM.flac", title: "七月的极光", artist: "周杰伦", group: "太阳之子", cover: "" },
    { id:'s7', src: "./songs/周杰伦 - 爱琴海_EM.flac", title: "爱琴海", artist: "周杰伦", group: "太阳之子", cover: "" },
    { id:'s8', src: "./songs/周杰伦 - I Do_EM.flac", title: "I Do", artist: "周杰伦", group: "太阳之子", cover: "" },
    { id:'s9', src: "./songs/周杰伦 - 圣徒_EM.flac", title: "圣徒", artist: "周杰伦", group: "太阳之子", cover: "" },
    { id:'s10', src: "./songs/周杰伦 - 女儿殿下_EM.flac", title: "女儿殿下", artist: "周杰伦", group: "太阳之子", cover: "" },
    { id:'s11', src: "./songs/周杰伦 - 淘金小镇_EM.flac", title: "淘金小镇", artist: "周杰伦", group: "太阳之子", cover: "" },
    { id:'s12', src: "./songs/周杰伦 - 乡间的路_EM.flac", title: "乡间的路", artist: "周杰伦", group: "太阳之子", cover: "" },
    { id:'s13', src: "./songs/周杰伦 - 圣诞星 (feat_ 杨瑞代)_EM.flac", title: "圣诞星", artist: "周杰伦 & 杨瑞代", group: "太阳之子", cover: "" }
];

// ====== 全局状态变量声明 ======
let playlist = [], curIdx = 0, isDrag = false;
let sleepInterval = null, sleepTargetTime = 0;
let targetMoveIdx = -1, isShuffle = false;
let draggedItemIdx = null;
let lyricReqId = 0;
let isLyricVisible = true; // 移动端歌词显隐
let prevVol = 0.8; // 静音前的音量
let _lastLrcUrl = null; // 🌟 记录最近一次歌词来源 URL，搜同一首歌时直接复用

// 🔒 手动歌词锁定：记录用户手动更换过歌词的歌曲ID，防止自动搜索覆盖
// 使用 localStorage 持久化，格式为 JSON 数组
let _manualLyricLock = new Set();
try {
    const saved = localStorage.getItem('am_manual_lyric_lock');
    if (saved) _manualLyricLock = new Set(JSON.parse(saved));
} catch (e) { _manualLyricLock = new Set(); }

let repeatMode = 1;
let currentTrackId = null;
let currentSource = localStorage.getItem('am_current_source') || 'tencent';

// ====== 音频对象创建 ======
const audio = new Audio();
audio.setAttribute('playsinline', '');
audio.setAttribute('webkit-playsinline', '');
var _savedVol = parseFloat(localStorage.getItem('am_volume'));
if (!isNaN(_savedVol) && _savedVol >= 0 && _savedVol <= 1) {
    audio.volume = _savedVol;
    prevVol = _savedVol;
}
audio.addEventListener('volumechange', function() {
    if (audio.volume > 0.01) localStorage.setItem('am_volume', audio.volume);
});
let _audioRetryCount = 0;
let _audioRetrying = false;

audio.onerror = function() {
    if (_audioRetrying) return;
    if (!audio.paused) audio.setAttribute('data-was-playing', '1');
    showToast(i18n[curLang].audioLoadFailed, 'warn');
    _autoRefetchAudioUrl();
};

async function _autoRefetchAudioUrl() {
    if (curIdx < 0 || curIdx >= playlist.length) return;
    const t = playlist[curIdx];
    if (t.isLocal && t.src && t.src.startsWith('./')) return;
    if (_audioRetryCount >= 2) {
        _audioRetrying = false;
        _audioRetryCount = 0;
        showToast(i18n[curLang].noWorkingAudio, 'error');
        return;
    }
    _audioRetrying = true;
    _audioRetryCount++;
    showToast(i18n[curLang].searchingAudio + ' (' + _audioRetryCount + '/2)', '');
    console.log('[autoRetry] Searching for:', t.title, t.artist);

    const query = encodeURIComponent(t.title + ' ' + t.artist);
    const platforms = ['tencent', 'kugou', 'netease', 'kuwo'];

    for (const server of platforms) {
        try {
            const sr = await metingFetch('/search?server=' + server + '&id=' + query + '&limit=5', 8000);
            const sj = await sr.json().catch(() => null);
            const results = ((sj && sj.data) || []).filter(r => r.id);
            if (!results.length) continue;

            for (const r of results) {
                const brs = [999, 320, 128];
                for (const br of brs) {
                    try {
                        const ur = await metingFetch('/url?server=' + server + '&id=' + r.id + '&r=' + br, 6000);
                        const uj = await ur.json().catch(() => null);
                        const url = uj?.data?.url || uj?.url || '';
                        if (url) {
                            console.log('[autoRetry] Found URL from', server, ':', url.slice(0, 60));
                            playlist[curIdx].src = url;
                            playlist[curIdx].source = server;
                            if (r.pic_id) playlist[curIdx]._picId = r.pic_id;
                            if (r.id) playlist[curIdx]._songId = r.id;
                            saveOrder();
                            audio.src = url;
                            audio.load();
                            _audioRetrying = false;
                            setPlayIcons(true);
                            document.getElementById('art').classList.remove('paused');
                            updateListActiveState();
                            if (!audio.paused || audio.getAttribute('data-was-playing') === '1') {
                                audio.play().catch(() => {});
                                audio.removeAttribute('data-was-playing');
                            }
                            setTimeout(() => { _audioRetryCount = 0; }, 5000);

                            // 尝试获取高清封面
                            if (r.pic_id || r.pic) {
                                if (!playlist[curIdx].cover || !playlist[curIdx].coverFetched) {
                                    const searchTitle = t.title;
                                    const searchArtist = t.artist;
                                    const targetIdx = curIdx;
                                    (window.IanMusic?.fetchOnlineCover || fetchOnlineCover)(searchTitle, searchArtist).then(hiResCover => {
                                        if (hiResCover && targetIdx >= 0 && playlist[targetIdx]) {
                                            playlist[targetIdx].cover = hiResCover;
                                            playlist[targetIdx].coverFetched = true;
                                            localStorage.setItem('am_cover_' + playlist[targetIdx].id, hiResCover);
                                            if (typeof applyCover === 'function') applyCover(hiResCover, playlist[targetIdx].id, true);
                                        }
                                    }).catch(() => {});
                                }
                            }
                            return;
                        }
                    } catch (_) {}
                }
            }
        } catch (_) {}
    }
    showToast(i18n[curLang].noAlternativeAudio, 'warn');
    _audioRetrying = false;
    setTimeout(() => { _audioRetryCount = 0; }, 5000);
}

const jsmediatags = window.jsmediatags;

// ====== AI 默认配置 ======
const DEFAULT_URL = "https://api.siliconflow.cn/v1/chat/completions";
const DEFAULT_MODEL = "deepseek-ai/DeepSeek-V3";

// ====== 音乐 API 地址配置 ======
// 网易云音乐增强版 API（最可靠）
const NCM_API_ENHANCED = "https://ncmapi.1234567890.xyz";  // 公开实例
const NCM_API_ENHANCED2 = "https://api.uomg.com/api.rand.music";  // 备用

// 🏠 Meting API 服务地址（按优先级排序）
// 注意：公共 API 可能随时失效，建议自建部署
const METING_API  = "https://meting.songs.tk/meting/api";       // 公共实例1（较稳定）
const METING_ALT  = "https://meting.js.org/api";               // 公共实例2（备用）
const METING_BACKUP = "https://api.paugram.com/meting";        // 公共实例3（兜底）

// 官方 API（可能需要 cookie）
const NETEASE_OFFICIAL = "https://music.163.com/api";
const KUGOU_OFFICIAL = "https://mobileservice.kugou.com/api";

// ====== 后端引擎地址 ======
const MY_GO_API   = METING_API;  // AI 后端共用主实例

// ====== AI 变量 ======
function _getApiKey() {
    return localStorage.getItem('am_ai_key') || '';
}
let aiApiKey = _getApiKey();
let aiBaseUrl = localStorage.getItem('am_ai_url') || DEFAULT_URL;
let aiModel = localStorage.getItem('am_ai_model') || DEFAULT_MODEL;

function saveApiKey(key) { aiApiKey = key.trim(); localStorage.setItem('am_ai_key', aiApiKey); showToast(i18n[curLang].keySaved); }
function saveApiUrl(url) { aiBaseUrl = url.trim() || DEFAULT_URL; localStorage.setItem('am_ai_url', aiBaseUrl); showToast(i18n[curLang].keySaved); }
function saveApiModel(model) { aiModel = model.trim() || DEFAULT_MODEL; localStorage.setItem('am_ai_model', aiModel); showToast(i18n[curLang].keySaved); }

// ====== 音乐 API Cookie 配置 ======
// 用户可导入网易云/QQ音乐的 Cookie 以解锁 VIP 歌曲和灰色歌曲
let neteaseCookie = localStorage.getItem('am_netease_cookie') || "";
let qqmusicCookie = localStorage.getItem('am_qqmusic_cookie') || "";
let kugouCookie = localStorage.getItem('am_kugou_cookie') || "";
let localMetingApi = localStorage.getItem('am_local_meting_api') || "";

let _cookieDebounce = null;
function _debouncedToast() {
    clearTimeout(_cookieDebounce);
    _cookieDebounce = setTimeout(() => {
        showToast(i18n[curLang].cookieSaved || "Cookie 已保存");
    }, 600);
}

function _persistCookie(platform, cookie) {
    const bases = [
        window.IanMusic && window.IanMusic.localMetingApi,
        'http://localhost:3300',
        'http://127.0.0.1:3300'
    ].filter(Boolean);
    for (const base of bases) {
        fetch(`${base}/api/cookie`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ platform, cookie })
        }).then(r => {
            if (r.ok) console.log(`[Cookie] ✓ ${platform} 已同步到服务器`);
        }).catch(() => {});
    }
    if (window.appRuntime && window.appRuntime.saveCookie) {
        window.appRuntime.saveCookie({ platform, cookie }).catch(() => {});
    }
}

function saveNeteaseCookie(cookie) {
    neteaseCookie = cookie.trim();
    localStorage.setItem('am_netease_cookie', neteaseCookie);
    window.IanMusic.neteaseCookie = neteaseCookie;
    _persistCookie('netease', neteaseCookie);
    _debouncedToast();
}

function saveQqmusicCookie(cookie) {
    qqmusicCookie = cookie.trim();
    localStorage.setItem('am_qqmusic_cookie', qqmusicCookie);
    window.IanMusic.qqmusicCookie = qqmusicCookie;
    _persistCookie('tencent', qqmusicCookie);
    _debouncedToast();
}

function saveKugouCookie(cookie) {
    kugouCookie = cookie.trim();
    localStorage.setItem('am_kugou_cookie', kugouCookie);
    window.IanMusic.kugouCookie = kugouCookie;
    _persistCookie('kugou', kugouCookie);
    _debouncedToast();
}

function saveLocalMetingApi(url) {
    localMetingApi = url.trim();
    localStorage.setItem('am_local_meting_api', localMetingApi);
    window.IanMusic.localMetingApi = localMetingApi;
    showToast(i18n[curLang].apiSaved || "API 地址已保存");
}

// ====== 暴露到全局命名空间 ======
window.IanMusic.i18n = i18n;
window.IanMusic.curLang = curLang;
window.IanMusic.myTracks = myTracks;
window.IanMusic.audio = audio;
window.IanMusic.jsmediatags = jsmediatags;
window.IanMusic.DEFAULT_URL = DEFAULT_URL;
window.IanMusic.DEFAULT_MODEL = DEFAULT_MODEL;
window.IanMusic.NCM_API_ENHANCED = NCM_API_ENHANCED;
window.IanMusic.NCM_API_ENHANCED2 = NCM_API_ENHANCED2;
window.IanMusic.METING_API = METING_API;
window.IanMusic.METING_ALT = METING_ALT;
window.IanMusic.METING_BACKUP = METING_BACKUP;
window.IanMusic.NETEASE_OFFICIAL = NETEASE_OFFICIAL;
window.IanMusic.KUGOU_OFFICIAL = KUGOU_OFFICIAL;
window.IanMusic.MY_GO_API = MY_GO_API;
window.IanMusic.aiApiKey = aiApiKey;
window.IanMusic.aiBaseUrl = aiBaseUrl;
window.IanMusic.aiModel = aiModel;
window.IanMusic.saveApiKey = saveApiKey;
window.IanMusic.saveApiUrl = saveApiUrl;
window.IanMusic.saveApiModel = saveApiModel;
window.IanMusic.neteaseCookie = neteaseCookie;
window.IanMusic.qqmusicCookie = qqmusicCookie;
window.IanMusic.kugouCookie = kugouCookie;
window.IanMusic.localMetingApi = localMetingApi;
window.IanMusic.saveNeteaseCookie = saveNeteaseCookie;
window.IanMusic.saveQqmusicCookie = saveQqmusicCookie;
window.IanMusic.saveKugouCookie = saveKugouCookie;
window.IanMusic.saveLocalMetingApi = saveLocalMetingApi;
