# IAN'S MUSIC — 综合安全审查报告

**审计日期**: 2026-05-17  
**项目版本**: v2.4.0  
**审计范围**: 全量代码文件（17 JS/HTML）、Git 提交历史、环境配置、依赖审计

---

## 执行摘要

本报告对 IAN'S MUSIC Electron 桌面音乐播放器进行了 6 个维度的全面安全审计。共发现 **22 个安全发现**，包括 **7 个严重 (Critical)**、**7 个高危 (High)**、**5 个中危 (Medium)**、**3 个低危 (Low)**。

### 最紧迫的威胁

| 优先级 | 问题 | 影响 |
|--------|------|------|
| 🚨 P0 | QQ 音乐完整访问令牌已提交到 Git 仓库 | 攻击者可完全接管 QQ 音乐账号（播放、收藏、购买） |
| 🚨 P0 | `webSecurity: false` 禁用所有浏览器安全保护 | XSS 攻击可无视同源策略窃取所有平台 Cookie |
| 🚨 P0 | Cookie 内容在服务端日志中明文泄露 | 日志文件泄露 = 全部音乐平台账号泄露 |
| 🚨 P0 | QR 登录 SSRF — IPC 处理器可被利用访问内网 | 攻击者可利用 Electron 进程扫描/攻击局域网 |
| ⚠️ P1 | 5 个平台 Cookie 以明文 localStorage 存储 | 一次 XSS 即可窃取所有音乐平台 VIP 权限 |
| ⚠️ P1 | AI API Key 明文 localStorage — 违反 JS-STORAGE-001 | API 额度被盗用、恶意请求 |
| ⚠️ P1 | 77 处 innerHTML 调用，分组名可被 Stored XSS | 播放列表分组名注入恶意代码 |

---

## 发现列表（按严重程度排列）

### 🔴 CRITICAL

#### SEC-001: QQ 音乐完整访问令牌已提交到 Git 仓库
- **规则**: REQ-AUDIT-001
- **文件**: `meting-api/ecosystem.config.js:27`
- **Git Commit**: `1a1f81b0`（初始提交）
- **泄露内容**: ~~令牌已从 Git 历史中清除并在 QQ 端轮换~~ — 所有敏感值已脱敏处理
- **影响**: 任何能访问 GitHub 仓库的人可完全控制该 QQ 音乐账号。攻击者可播放/下载 VIP 歌曲、修改播放列表、进行购买操作。该 token 一旦泄露永久有效（直到用户主动修改密码）。
- **修复**:
  1. 立即在 QQ 安全中心修改密码，吊销所有旧令牌
  2. 将 `ecosystem.config.js` 中的 `METING_COOKIES` 改为 `METING_COOKIES=__PLACEHOLDER__`
  3. 使用 `git filter-branch` 或 `BFG Repo-Cleaner` 清除 Git 历史
  4. 后续通过环境变量注入 COOKIES

#### SEC-002: 网易云音乐 Cookie 在服务端日志中泄露前 80 字符
- **规则**: REQ-AUDIT-002
- **文件**: `meting-api/server.js:1493`
- **代码**: `console.log('[Netease/QR] cookie extracted:', cookie.slice(0, 80))`
- **影响**: 前 80 字符包含 `MUSIC_U=` token 的全部键和足够用于会话劫持的值前缀。日志文件若被访问即导致网易云账号泄露。
- **修复**: 改为 `console.log('[Netease/QR] cookie extracted, length:', cookie.length)`

#### SEC-003: QQ 音乐 Cookie 在服务端日志中泄露前 120 字符
- **规则**: REQ-AUDIT-002
- **文件**: `meting-api/server.js:1760`
- **代码**: `console.log('[Tencent/QR] cookie extracted:', cookie.slice(0, 120))`
- **影响**: 120 字符足以暴露 QQ 音乐的 `uin`、`skey`、`p_skey`、`qm_keyst` 等全部核心鉴权字段。
- **修复**: 同上，仅记录长度和关键字段存在性

#### SEC-004: Electron `webSecurity: false` 禁用所有浏览器安全保护
- **规则**: REQ-AUDIT-006
- **文件**: `electron-main.js:178`
- **代码**: `webSecurity: false`
- **影响**: 禁用同源策略、CORS、混合内容保护。任何 XSS 攻击可无视同源限制访问本地文件系统和所有网络资源。与 `contextIsolation: true` 组合形成安全假象。
- **修复**: 改为 `webSecurity: true`；如确需跨域请求，使用 `ses.webRequest.onBeforeSendHeaders` 精确处理

#### SEC-005: QR 登录 IPC SSRF — `qr-login-request` 处理器
- **规则**: REQ-AUDIT-006（SSRF via IPC）
- **文件**: `electron-main.js:302-354`
- **处理器**: `ipcMain.handle('qr-login-request', async (event, { url, method, ... }) => {`
- **影响**: 该处理器接受任意 URL 并对其发起 HTTP 请求。攻击者通过 XSS 或恶意输入可让 Electron 主进程访问 `http://localhost:3300`、`http://169.254.169.254`（云元数据）、内网服务，或对任意目标发起 DDoS 请求。
- **修复**: 添加 URL 白名单校验，仅允许 `*.ptlogin2.qq.com`、`*.music.163.com` 等登录域名；拒绝内网 IP 范围

#### SEC-006: QR 登录图片下载 SSRF — `qr-login-get-image` 处理器
- **规则**: REQ-AUDIT-006（SSRF via IPC）
- **文件**: `electron-main.js:356-374`
- **处理器**: `ipcMain.handle('qr-login-get-image', async (event, url) => {`
- **影响**: 同上 — 接受任意 URL 并执行 HTTP GET+Buffer 返回。可被利用下载内网资源并回传给渲染进程。
- **修复**: 同上 URL 白名单

#### SEC-007: 分组名 Stored XSS — HTML 注入播放列表 DOM
- **规则**: REQ-AUDIT-005 / JS-XSS-001
- **文件**: `js/playlist.js`（`innerHTML` 调用点）
- **场景**: 用户在"添加分组"中输入 `<img src=x onerror=alert(1)>`，该分组名称被存储到 `localStorage` 并在下次加载时以 `innerHTML` 注入 DOM
- **影响**: 用户打开任意被注入恶意分组名的播放列表时，脚本自动执行，可窃取所有 `localStorage` 中的 Cookie 和 API Key
- **修复**: 对所有分组名、歌单名、曲目名使用 `escHtml()` 转义后再插入 DOM

---

### 🟠 HIGH

#### SEC-008: 网易云 Cookie 明文 localStorage 存储
- **规则**: JS-STORAGE-001
- **文件**: `js/config.js:402,437`
- **存储 Key**: `am_netease_cookie` — 完整 Cookie 字符串含 `MUSIC_U`
- **修复**: 使用 `localStorage` 加密存储（Web Crypto API）或迁移到 Electron `safeStorage`

#### SEC-009: QQ 音乐 Cookie 明文 localStorage 存储
- **规则**: JS-STORAGE-001
- **文件**: `js/config.js:403,445`
- **存储 Key**: `am_qqmusic_cookie` — 完整 Cookie 含 `uin`/`skey`/`qm_keyst`

#### SEC-010: 酷狗 Cookie 明文 localStorage 存储
- **规则**: JS-STORAGE-001
- **文件**: `js/config.js:404,453`
- **存储 Key**: `am_kugou_cookie`

#### SEC-011: AI API Key 明文 localStorage — 违反 JS-STORAGE-001
- **规则**: JS-STORAGE-001
- **文件**: `js/config.js:389-398`
- **存储 Key**: `am_ai_key` — 用户配置的 AI API 密钥（如 SiliconFlow Token）
- **修复**: 使用 Electron `safeStorage` API 加密存储

#### SEC-012: 所有平台 Cookie 以明文 JSON 持久化到磁盘
- **规则**: REQ-AUDIT-002
- **文件**: `electron-main.js:271-285`
- **路径**: `{$userData}/cookies.json` — 所有平台 Cookie 明文 JSON，无加密

#### SEC-013: 无 CSP 策略 — XSS 无最后防线
- **规则**: JS-CSP-001
- **影响**: 当前任何成功的 XSS 攻击无额外防护。CSP 可作为 defense-in-depth 在即使存在 XSS 漏洞时限制攻击者能执行的脚本来源
- **修复**: 在 `index.html` 添加 `<meta http-equiv="Content-Security-Policy" content="script-src 'self'">`

#### SEC-014: `/api/cookie` 端点在 meting-api 上无鉴权
- **规则**: REQ-AUDIT-003
- **文件**: `meting-api/server.js:1916-1943`
- **影响**: 仅监听 localhost，但若存在 SSRF 或本地恶意进程可写入恶意 Cookie
- **修复**: 添加本地 token 鉴权

---

### 🟡 MEDIUM

#### SEC-015: `webSecurity: false` 64 处 innerHTML 注入
- **规则**: JS-XSS-001 (大量 Medium 实例)
- **影响**: 曲目数据从 API 返回后以 `innerHTML` 插入，虽然可信度较高，但若上游 API 被入侵或中间人攻击，可注入恶意脚本
- **修复**: 对 API 返回的文本数据统一使用 `escHtml()` 转义

#### SEC-016: 缺少 CI/CD 流水线
- **规则**: REQ-AUDIT-004
- **影响**: 无自动化安全扫描，无构建验证，无依赖审计自动化
- **修复**: 添加 `.github/workflows/ci.yml`，包含 lint + build + `npm audit`

#### SEC-017: jsdelivr CDN 字体 — 无 Subresource Integrity (SRI)
- **规则**: JS-SRI-001
- **文件**: `index.html:21`
- **代码**: `<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/lxgw-wenkai-webfont@1.7.0/style.css">`
- **修复**: 添加 `integrity` 属性或本地化字体文件

#### SEC-018: 依赖 15+ 个外部 API 域名 — 含不可控第三方
- **规则**: REQ-AUDIT-004
- **影响**: `meting.songs.tk`、`meting.js.org`、`api.paugram.com`、`ncmapi.1234567890.xyz` 等为个人/社区公开服务，安全性和可用性不可控
- **修复**: 默认使用自建 Meting-API localhost:3300，公共实例仅作 fallback

#### SEC-019: `save-cookie` IPC 处理器缺少输入校验
- **规则**: REQ-AUDIT-006
- **文件**: `electron-main.js:271-285`
- **修复**: 添加 Cookie 格式校验，拒绝超长或格式异常的 Cookie 字符串

---

### 🟢 LOW

#### SEC-020: `new-player/backend/server.js` 硬编码测试账号
- **文件**: `new-player/backend/server.js:107`
- **代码**: `{ id: 1, username: 'ian', password: 'demo' }`
- **修复**: 改为环境变量 `process.env.DEMO_USER`

#### SEC-021: 多平台 `.cookies.json` 存在于 `dist/` 打包产物中
- **文件**: `dist/win-unpacked/resources/meting-api/.env`、`dist/.../meting-api/cookies.json`
- **影响**: 分发给用户时包含个人 Cookie
- **修复**: 每次发布前清理 `dist/` 中的敏感文件

#### SEC-022: font-display swap 可能导致不可见文字闪烁
- **规则**: JS-SUPPLY-001
- **文件**: `index.html:19` (Google Fonts 请求)
- **修复**: 将字体本地化到 `fonts/` 目录

---

## 统计概览

| 维度 | 扫描项 | 发现问题 |
|------|--------|----------|
| 密钥 & 凭证 | 代码+Git 历史全量扫描 | 3 处密钥泄露（2 已入 Git） |
| Cookie 安全 | 存储、传输、日志路径 | 2 处日志泄露、3 处明文存储 |
| 环境配置 | .env / cookies.json / package.json | 3 处 .env 含真实 Cookie |
| CI/CD & 依赖 | GitHub Actions / npm audit | 无 CI 流水线、npm audit 通过 |
| DOM XSS | 77 处 innerHTML / eval / CSP | 1 处 Stored XSS、CSP 缺失 |
| IPC & Electron | 8 个 IPC 处理器 / 安全配置 | `webSecurity: false` + 2 个 SSRF |

---

## 修复路线图

### 🚨 第一阶段（立即 — 24 小时内）

| ID | 行动 | 预计耗时 |
|----|------|----------|
| SEC-001 | QQ 安全中心改密码，注销所有旧令牌 | 5 分钟 |
| SEC-001 | `git filter-branch` 清除 Git 历史中的 token | 15 分钟 |
| SEC-001 | `ecosystem.config.js` 改为 `METING_COOKIES=__PLACEHOLDER__` | 2 分钟 |
| SEC-002/003 | 删除 server.js 中的 Cookie 内容日志 | 2 分钟 |
| SEC-004 | `webSecurity: true` + 测试功能完整性 | 30 分钟 |
| SEC-005/006 | `qr-login-request` / `qr-login-get-image` URL 白名单 | 20 分钟 |
| SEC-021 | 清理 `dist/` 中的 .env / cookies.json | 2 分钟 |

### ⚠️ 第二阶段（本周内）

| ID | 行动 | 预计耗时 |
|----|------|----------|
| SEC-007 | 所有 innerHTML 注入点添加 `escHtml()` 转义 | 2 小时 |
| SEC-013 | 添加 CSP `<meta>` 策略 | 15 分钟 |
| SEC-008~011 | localStorage Cookie/API Key 加密存储 | 2 小时 |
| SEC-012 | `cookies.json` 使用 `safeStorage` 加密 | 1 小时 |

### 📋 第三阶段（下个版本）

| ID | 行动 |
|----|------|
| SEC-016 | 添加 GitHub Actions CI 流水线 |
| SEC-017 | 字体本地化 / SRI |
| SEC-018 | 减少不可控第三方 API，默认自建 Meting |
| SEC-019 | `save-cookie` IPC 输入校验 |
| SEC-020 | `server.js` 测试账号环境变量化 |

---

> **报告生成时间**: 2026-05-17 12:30 UTC+8  
> **下次审查建议**: 第二阶段修复完成后重新扫描
