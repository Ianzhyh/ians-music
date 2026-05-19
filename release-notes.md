## v2.5.0 — Major Bug Fixes and Feature Improvements / 主要错误修复与功能改进

### UI/Layout Fixes / 界面布局修复

- Fix offline music library content overlapped by function buttons (translate, library, etc.) / 修复离线音乐库内容被功能按钮遮挡问题
- Fix segment-opt component visual accessibility — both buttons displayed in white with no contrast / 修复 segment-opt 组件按钮视觉可访问性问题
- Add independent settings-action-btn style for download path button / 新增下载路径按钮独立样式
- Add offline overlay backdrop with blur effect / 添加离线面板遮罩层和模糊效果
- Add mobile responsive styles for offline panel / 添加移动端离线面板响应式样式

### Download System Overhaul / 下载系统重写

- Fix download quality selection not applying actual bitrate — always downloaded highest quality regardless of user choice / 修复音质选择无效问题（无论选什么音质都下载最高品质）
- Add quality-to-bitrate mapping (SQ/HQ/AAC/Standard) with API-based URL fetching / 实现音质到比特率映射和 API 获取对应链接
- Add automatic quality fallback when selected quality is unavailable / 添加所选音质不可用时自动降级功能
- Show actual quality label and file size in download completion toast / 下载完成时显示实际音质和文件大小
- Replace download path text input with native folder picker dialog (Electron IPC) / 将下载路径文本输入替换为原生文件夹选择器
- Fix folder picker cascade popup — cancelling one dialog no longer triggers the next / 修复选择器级联弹窗问题（取消一个不再弹出下一个）
- Add webkitdirectory and showDirectoryPicker fallback methods / 添加 webkitdirectory 和 showDirectoryPicker 降级方案
- Add comprehensive logging for path selection debugging / 添加路径选择调试日志

### Offline Playback Fixes / 离线播放修复

- Fix offline playback failing after page refresh — blob URLs are now rebuilt from stored audio data / 修复页面刷新后离线播放失败
- Fix offline playback triggering online search flow when disconnected / 修复断网时离线播放仍触发在线搜索
- Save downloaded audio to disk (songs/ directory) via Electron IPC instead of IndexedDB only / 将下载音频保存到磁盘 songs/ 目录
- Add songs:save, songs:list, songs:read-audio, songs:delete, songs:update-meta IPC handlers / 新增歌曲文件管理 IPC 处理器
- Add automatic migration from IndexedDB to disk storage / 添加从 IndexedDB 到磁盘的自动迁移

### Playback System Fixes / 播放系统修复

- Fix playlist song duplication — playMetingTrack, loadOfflineTrack, and importFiles now check for existing IDs / 修复播放列表歌曲重复问题
- Fix space bar and media key play/pause icon not syncing — now calls togglePlay() instead of raw audio.play()/pause() / 修复空格键和媒体键播放暂停图标不同步
- Fix progress bar drag bounce-back — isDrag now resets after seeked event confirmation / 修复进度条拖拽回弹问题
- Add mob-seek mobile progress bar input/change event listeners / 添加移动端进度条事件监听
- Add seeked event handler for reliable drag state reset / 添加 seeked 事件确保拖拽状态正确重置

### API Server Fixes / API 服务器修复

- Fix API server startup failure due to missing node_modules dependencies / 修复 API 服务器因依赖缺失启动失败
- Fix server.js syntax error — async callback for handleCookieSave / 修复 server.js 语法错误
- Fix ESM import compatibility for packaged Electron app / 修复打包后 ESM 模块导入兼容性
- Add auto npm install in development mode when dependencies are missing / 开发模式下自动安装缺失依赖
- Improve API startup error dialog with specific fix steps / 改进 API 启动错误提示，列出具体修复步骤
- Prioritize extraResources path over asar path for server.js resolution / 优先使用解压路径而非 asar 路径解析 server.js
- Add build-time dependency check in build-app.bat / 构建时自动检查依赖

### Data Persistence / 数据持久化

- Fix downloaded songs lost after app update — songs/ directory moved from installation dir to userData persistent dir / 修复更新后歌曲丢失问题（songs/ 从安装目录迁移到 userData 持久目录）
- Fix downloaded songs cannot be deleted — numeric ID caused TypeError in songs:save / 修复无法删除已下载歌曲问题（数字ID导致 TypeError）
- Add String(id) coercion in all songs IPC handlers to prevent TypeError on numeric IDs / 在所有 IPC 处理器中强制转字符串类型
- Fix songs:delete returning true unconditionally — now returns actual deletion result / 修复 songs:delete 无条件返回 true
- Fix IndexedDB key type mismatch — delete with both string and numeric keys / 修复 IndexedDB 键类型不匹配
- Add NSIS installer songs/ folder backup/restore during upgrade / 添加 NSIS 安装器更新时 songs/ 文件夹备份恢复
- Add migrateOldSongsDir() to auto-move files from old installation to userData / 添加旧目录自动迁移功能

### Code Quality / 代码质量

- Extract hardcoded song list from config.js to songs.json with validation / 将硬编码歌曲列表提取到 songs.json 配置文件
- Add validateTracksConfig() for JSON format verification / 添加配置文件验证机制
- Remove unused new-player directory / 移除未使用的 new-player 目录