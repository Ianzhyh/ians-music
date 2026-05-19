@echo off
title IAN'S MUSIC - Build
echo ========================================
echo   IAN'S MUSIC - Build Tool
echo ========================================
echo.

cd /d "%~dp0.."

set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
set ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/

echo [0] Cleaning up previous build artifacts...
if exist "dist" rmdir /s /q "dist" >nul 2>&1
echo     Done.
echo.

echo [1/3] Installing root dependencies (Electron + electron-builder)...
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo [!] Failed to install root dependencies. Check network.
    pause
    exit /b 1
)
echo [OK] Root dependencies installed

echo.
echo [2/3] Installing API server dependencies (meting-api)...
cd meting-api
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo [!] Failed to install API dependencies. Check network.
    pause
    exit /b 1
)
cd ..
echo [OK] API dependencies installed

echo.
echo [3/3] Building portable EXE...
echo     Using mirror: %ELECTRON_MIRROR%
echo     This may take a few minutes on first run...
call npx electron-builder

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo   BUILD SUCCESS!
    echo ========================================
    echo   Output: dist\IANS_MUSIC_Setup_v2.0.0.exe
    echo   Double-click to run!
    echo ========================================
    start "" "dist"
) else (
    echo.
    echo [!] Build failed.
    echo.
    echo TIPS:
    echo   1. If download failed, check your network
    echo   2. Try running this command manually first:
    echo      npm config set registry https://registry.npmmirror.com
    echo   3. Then re-run this script
)

pause
