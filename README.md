# IAN'S MUSIC

> Multi-platform desktop music player -- aggregated playback from QQ Music, NetEase Cloud Music, Kugou, Kuwo, Bilibili, and more

<p align="center">
  <img src="img/icon.png" alt="IAN'S MUSIC" width="128">
</p>

IAN'S MUSIC is a cross-platform desktop music player built on [Electron](https://www.electronjs.org/). It aggregates search and playback capabilities from multiple music platforms via the built-in [Meting](https://github.com/metowolf/Meting) API, and integrates AI-powered features (song deconstruction, AI translation, AI theme generation) for a one-stop music listening experience.

***

## Screenshots

<p align="center">
  <img src="img/效果图/QQ_1778999762640.png" alt="Main Interface" width="80%">
</p>

<p align="center">
  <img src="img/效果图/QQ_1778999845818.png" alt="Playing Interface" width="80%">
</p>

<p align="center">
  <img src="img/效果图/QQ_1778999887552.png" alt="Lyrics & Visualizer" width="80%">
</p>

***

## Features

### Music Playback

- **Multi-platform Aggregated Search** -- Single search across Kugou, NetEase Cloud Music, QQ Music, Kuwo, Bilibili
- **Online Listening** -- Streaming playback with automatic multi-source switching
- **Local Music Library** -- Import local audio files to build a personal library
- **Playlist Import** -- Paste QQ Music / NetEase Cloud Music playlist links for one-click import
- **Play Modes** -- Shuffle, List Loop, Single Track Loop
- **Sleep Timer** -- Customizable auto-pause timer

### UI & Visuals

- **Apple Music Style Visualizer** -- Dynamic gradient background that moves with the music
- **Frosted Glass UI** -- Full-interface backdrop-filter glass texture
- **AI Theme Generation** -- Generate color schemes from natural language descriptions (powered by DeepSeek)
- **Multiple Theme Colors** -- Built-in color schemes + auto color extraction mode
- **Adaptive Layout** -- Desktop and mobile dual mode with smooth switching

### Lyrics System

- **QRC Karaoke Lyrics** -- Supports QQ Music word-by-word timestamped lyrics (Karaoke mode)
- **Desktop Lyrics** -- Independent floating lyrics window
- **Online Lyrics Search** -- Multi-source lyrics retrieval and manual replacement
- **Bilingual Translation** -- AI auto-translation with official translation fallback
- **Lyrics Customization** -- Center/left alignment, adjustable font size, scroll animation

### AI Features

- **Song Insight** -- Analyze song background, arrangement details, and emotions
- **AI Lyrics Translation** -- LLM-powered intelligent lyrics translation
- **AI Theme Generation** -- Generate interface color schemes from natural language

### Others

- **QR Code Login** -- Scan with mobile app to auto-fetch cookies and unlock higher quality
- **Cover Search** -- Multi-source online album art search and replacement
- **Bilingual UI** -- One-click language switch, instant effect
- **PWA Support** -- Use as a Progressive Web App in browsers

***

## Tech Stack

| Category        | Technology                          |
| --------------- | ----------------------------------- |
| **Framework**   | Electron 33                         |
| **Frontend**    | Vanilla HTML / CSS / JavaScript (no framework) |
| **Backend API** | Node.js (Express) + Meting API      |
| **Storage**     | localStorage / localforage          |
| **Build**       | electron-builder (NSIS installer)   |
| **AI**          | DeepSeek API (OpenAI-compatible)    |
| **Lyrics Decryption** | Triple DES (QQ Music QRC format) |
| **PWA**         | Service Worker + Manifest           |

***

## Project Structure

```
IanMusic/
├── css/                    # Stylesheets
│   ├── variables.css       # CSS variables / design tokens
│   ├── components.css      # UI component styles
│   ├── desktop.css         # Desktop layout
│   ├── mobile.css          # Mobile layout
│   └── icons.css           # Icon styles
├── js/                     # Frontend JavaScript
│   ├── app.js              # Main application logic & entry
│   ├── player.js           # Audio playback control
│   ├── playlist.js         # Playlist management & i18n
│   ├── lyrics.js           # Lyrics rendering & parsing
│   ├── ai.js               # AI translation / insight / theme
│   ├── config.js           # Configuration & i18n dictionary
│   ├── ui.js               # UI components & modals
│   ├── theme.js            # Color theme management
│   ├── visualizer.js       # Background visualizer
│   ├── api.js              # Metadata API calls
│   ├── net-search.js       # Network search & playlist import
│   ├── mobile.js           # Mobile logic
│   ├── qr-login.js         # QR code login
│   └── lib/                # Third-party libraries
│       ├── jsmediatags.min.js
│       └── localforage.min.js
├── img/                    # Images & icons
│   └── screenshots/        # App screenshots
├── build/                  # electron-builder config
│   ├── installer.nsh       # NSIS installer script
│   └── installerHeader.bmp
├── scripts/
│   └── build.bat           # Build script
├── meting-api/             # Meting API service
│   ├── server.js           # API entry point
│   ├── proxy.js            # Proxy config
│   ├── qrc-decrypt.js      # QQ Music QRC decryption
│   └── lib/qrcode/         # QR code generation for login
├── test/
│   └── color-extraction.test.js
├── index.html              # Main page
├── electron-main.js        # Electron main process
├── preload.js              # Electron preload script
├── sw.js                   # Service Worker (PWA)
├── manifest.json           # PWA manifest
├── package.json            # Project config
├── start.bat               # Dev startup script (Windows)
├── build-app.bat           # Build script (Windows)
└── .gitignore
```

***

## Quick Start

### Prerequisites

- **Node.js** >= 18
- **npm** >= 9
- **OS**: Windows / macOS / Linux

### 1. Clone Repository

```bash
git clone https://github.com/Ianzhyh/ians-music.git
cd ians-music
```

### 2. Install Dependencies

```bash
# Install main project dependencies
npm install

# Install API service dependencies
cd meting-api && npm install && cd ..
```

### 3. Start Development Mode

**Windows:**

```bash
# Using batch script
start.bat

# Or manually
cd meting-api && node server.js &
npx electron .
```

### 4. Browser Mode (PWA)

Start the API service, then open `index.html` in your browser:

```bash
cd meting-api
node server.js
# Visit http://localhost:3300
```

***

## Configuration

### AI API Setup

Configure DeepSeek (or OpenAI-compatible) API in the settings panel:

| Parameter | Description                    | Example                        |
| --------- | ------------------------------ | ------------------------------ |
| API Key   | DeepSeek / SiliconFlow API key | `sk-xxxx...`                   |
| Base URL  | API endpoint                   | `https://api.siliconflow.cn`   |
| Model     | Model name                     | `deepseek-ai/DeepSeek-V3`      |

<br />

### Music API Setup

The built-in Meting API works out of the box without additional configuration. For higher quality or VIP content access:

1. **Start your own API** -- `cd meting-api && node server.js`
2. **Fill in Cookies** -- Use QR code login in settings to obtain platform cookies
3. **VIP song playback requires**:
   - Valid cookies
   - The associated account has an active VIP membership for the corresponding platform

***

## Build Installer

```bash
# Windows
build-app.bat

# Or manually
npx electron-builder
```

Build output in the `dist/` directory:

- `IANS_MUSIC_Setup_v{x.y.z}.exe` -- Windows installer

***

## Disclaimer

1. This application is for educational and research purposes only. Do not use it for any commercial purposes or copyright infringement.
2. Cookies are personal login credentials. Do not share them. Change passwords regularly to protect account security.
3. VIP song playback requires appropriate account permissions.
4. By using this application, you acknowledge and agree to assume all related risks and responsibilities.

***

## License

This project is open-sourced under the [MIT License](LICENSE).

***

## Acknowledgments

- [Meting](https://github.com/metowolf/Meting) -- Multi-platform music API aggregation framework
- [Electron](https://www.electronjs.org/) -- Cross-platform desktop application framework
- [DeepSeek](https://www.deepseek.com/) -- Large language model API
- [SiliconFlow](https://www.siliconflow.cn/) -- Domestic API proxy acceleration
- Public APIs provided by various music platforms