# QRC 逐字歌词功能 - 使用指南和故障排除

## 📋 功能概述

QRC (QQMusic Rich Content) 逐字歌词是QQ音乐推出的高级歌词格式，支持**逐字同步显示**，而不仅仅是逐行同步。这为用户提供了类似卡拉OK的精确歌词体验。

### ✨ 核心特性
- **逐字时间戳**: 每个字符都有独立的显示时间
- **Triple DES解密**: 自动解密QQ音乐加密的歌词数据
- **智能回退机制**: QRC失败时自动降级到普通LRC歌词
- **多格式支持**: 支持XML包裹、纯时间戳、混合LRC等多种变体
- **详细日志**: 完整的调试信息，便于问题定位

---

## 🚀 快速开始

### 前置条件

1. **启动本地API服务器**
   ```bash
   cd meting-api
   node server.js
   # 服务将在 http://localhost:3300 启动
   ```

2. **配置QQ音乐Cookie**（必需）
   - 打开浏览器访问 https://y.qq.com 并登录
   - 按 F12 打开开发者工具
   - 在 Console 中输入 `document.cookie` 并复制结果
   - 在 IanMusic 设置中粘贴到 "QQ音乐 Cookie" 字段
   - 或者手动编辑 `meting-api/cookies.json`:
     ```json
     {
       "tencent": "你的QQ音乐Cookie字符串"
     }
     ```

3. **配置本地API地址**
   - 在 IanMusic 设置中的 "本地Meting API地址" 填入：`http://localhost:3300`
   - 或在浏览器控制台执行：
     ```javascript
     localStorage.setItem('am_local_meting_api', 'http://localhost:3300');
     location.reload();
     ```

---

## 🔧 工作原理

### 架构流程

```
前端 (lyrics.js)
    ↓ 搜索歌曲
后端 API (/search?server=tencent)
    ↓ 获取 songId/songMid
后端 API (/tencent/lyric-raw?id=xxx)
    ↓ 调用 QQ音乐 musicu.fcg API
    ↓ Triple DES 解密 + zlib 解压
    ↓ 返回 JSON {qrc: "...", lrc: "..."}
前端 (parseQrc → renderQrcLyrics)
    ↓ 解析逐字时间戳
    ↓ 渲染带动画的歌词DOM
```

### 关键技术点

1. **Triple DES 解密**
   - 密钥: `!@#)(*$%123ZXC!@!@#)(NHL` (24字节)
   - 算法: `des-ede3-ecb` (ECB模式)
   - 后处理: `zlib.unzipSync()` 解压缩

2. **QRC 格式示例**
   ```
   [0,190]Counting(0,13) Stars(26,13)-(52,13) OneRepublic(78,13)
   ```
   - `[0,190]`: 行起始时间(毫秒), 持续时间
   - `(0,13)`: 字符起始偏移, 持续时间, 标志位
   - 支持 `[mm:ss.xx]` 和 `[ms]` 两种时间格式

3. **智能格式检测**
   - XML包裹: `<LyricContent="..."/>`
   - 纯逐字: `[(\d+),\d+](.*)\(.*\)`
   - 混合格式: LRC时间戳 + 逐字标记

---

## 🐛 故障排除

### 常见错误及解决方案

#### ❌ 错误1: "Failed to execute 'json' on 'Response': Unexpected end of JSON input"

**原因**: 后端返回了非JSON格式的响应（已通过本次修复解决）

**解决方案**:
1. ✅ 已优化后端错误处理，确保所有响应都是有效JSON
2. ✅ 前端增加了响应验证，解析前会检查状态码和内容类型
3. 如果仍出现此错误：
   - 检查后端服务是否正常运行: 访问 `http://localhost:3300/health`
   - 查看浏览器控制台的详细错误日志（以 [Lyrics] 或 [QRC] 开头）
   - 重启后端服务: `Ctrl+C` 然后 `node server.js`

#### ❌ 错误2: "需要 QQ音乐 Cookie"

**原因**: 未配置或Cookie过期

**解决方案**:
1. 更新Cookie（参考"快速开始"第2步）
2. 验证Cookie有效性：登录 y.qq.com 后重新复制
3. 检查 cookies.json 格式是否正确

#### ❌ 错误3: "QQ音乐API返回空响应"

**原因**: Cookie无效、IP被限制或网络问题

**解决方案**:
1. 更换网络环境（如手机热点）
2. 使用新的Cookie
3. 检查防火墙/代理设置
4. 等待几分钟后重试（可能触发了频率限制）

#### ❌ 错误4: "歌词解密全部失败"

**原因**: 
- 歌曲本身无歌词
- 地区限制（部分歌曲仅在特定地区提供）
- Cookie权限不足（非VIP用户可能无法获取某些歌曲）

**解决方案**:
1. 尝试其他歌曲测试
2. 系统会自动回退到网易云/酷我等其他平台
3. 手动搜索歌词（点击"手动搜索"按钮）

#### ⚠️ 问题5: 歌词显示但无逐字效果

**原因**: 该歌曲只有普通LRC歌词，没有QRC逐字数据

**表现**: 控制台显示 `[Lyrics] ℹ️ 使用LRC普通歌词作为备选`

**这是正常行为** - 不是所有歌曲都有逐字歌词，系统会使用最佳可用格式。

---

## 📊 调试指南

### 查看详细日志

打开浏览器开发者工具 (F12) → Console 标签页，过滤关键词：

**后端日志** (终端窗口):
```
[QQ/LyricRaw] 🎵 请求歌曲ID: xxx
[QQ/LyricRaw] ✅ LRC解密成功: 1234字
[QQ/LyricRaw] 🎉 解密完成 - LRC:1234字 | QRC:5678字 | 翻译:234字
```

**前端日志** (浏览器Console):
```
[Lyrics] 🎵 开始QQ音乐QRC歌词搜索: 歌名 歌手
[Lyrics] ✅ 找到歌曲，ID: xxx Mid: xxx
[Lyrics] 🔍 请求QRC歌词: /tencent/lyric-raw?id=xxx
[Lyrics] 🎉 获取到QRC逐字歌词，长度: 5678
[QRC] 🎨 开始渲染QRC歌词，输入长度: 5678
[QRC] ✅ 成功解析 45 行歌词
[QRC] ✅ 成功渲染 45 行歌词
```

### 测试步骤

1. **启动后端**
   ```bash
   cd d:\IanMusic\meting-api
   node server.js
   ```
   应看到: `🎵 Meting Music API 已启动` 和端口信息

2. **健康检查**
   - 浏览器访问: `http://localhost:3300/health`
   - 应返回JSON包含 `"status": "running"` 和 cookie状态

3. **测试QRC接口**
   ```bash
   # 用周杰伦的"晴天"测试（songId=4298339）
   curl "http://localhost:3300/tencent/lyric-raw?id=4298339"
   ```
   应返回:
   ```json
   {
     "success": true,
     "qrc": "[0,3500]故事的小黄花...(0,120)(120,120)...",
     "lrc": "[00:00.00]作词 :周杰伦\n...",
     "hasQrc": true
   }
   ```

4. **前端验证**
   - 打开 IanMusic 页面
   - 播放一首歌（推荐周杰伦的歌曲，QRC覆盖率较高）
   - 观察Console是否出现 `[QRC] ✅` 开头的成功日志
   - 歌词应该有逐字高亮动画效果

---

## 🎯 性能优化建议

1. **本地缓存**: 首次获取后会缓存到 localStorage，切歌不需要重新请求
2. **超时设置**: QRC请求15秒超时，避免长时间阻塞
3. **多级回退**: QQ音乐→网易云→酷我→LRCLIB，确保总能找到歌词
4. **批量预加载**: 可以考虑在播放列表切换时预加载下一首的歌词

---

## 🔄 版本更新记录

### v2.0 (2026-05-06) - 本次更新

#### ✅ 新增功能
- 完整的错误处理和日志系统
- 多种QRC格式的智能检测和兼容
- 前端JSON解析的安全验证
- 详细的故障排除文档

#### 🐛 修复问题
- **关键修复**: 解决 "Unexpected end of JSON input" 错误
- 后端确保所有响应都是标准JSON格式
- 前端增加响应状态和内容类型验证
- 解密过程异常不再导致整个流程崩溃

#### 🔧 改进项
- 每个解密字段独立try-catch
- 增加更多调试信息字段（hasQrc, hasLrc等）
- 渲染过程增加异常捕获和向上抛出
- 时间戳无效时使用等分时间作为fallback

---

## 💡 高级用法

### 自定义QRC渲染器

如果需要自定义逐字动画效果，可以修改 `_updateLineCharProgress` 函数：

```javascript
// 当前默认：线性渐变 --char-pct: 0% → 100%
// 可改为：弹跳、波浪、颜色渐变等效果
function _updateLineCharProgress(lineEl){
    // ...现有代码...
    // 自定义你的动画逻辑
}
```

### 批量下载QRC歌词

可以编写脚本批量获取并保存QRC歌词：

```javascript
async function batchDownloadQRC(songList) {
    for (const song of songList) {
        try {
            const res = await metingFetch(`/tencent/lyric-raw?id=${song.id}`);
            const data = await res.json();
            if (data.qrc) {
                console.log(`✅ ${song.title}: ${data.qrc.length}字`);
                // 保存到文件或数据库
            }
        } catch(e) {
            console.log(`❌ ${song.title}: ${e.message}`);
        }
    }
}
```

---

## 📞 技术支持

如遇到问题，请按以下顺序排查：

1. **查看日志** - 浏览器Console和后端终端
2. **健康检查** - 访问 `/health` 确认服务状态
3. **Cookie验证** - 确认Cookie未过期且格式正确
4. **重启服务** - 有时候简单的重启能解决问题
5. **查看本文档** - 故障排除章节可能已有答案

---

**最后更新**: 2026-05-06  
**适用版本**: IanMusic v1.1+ / Meting-API v1.1+
