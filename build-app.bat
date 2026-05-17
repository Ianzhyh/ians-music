@echo off
chcp 65001 >nul
echo ==========================================
echo   IAN'S MUSIC - Build Script
echo ==========================================
echo.

echo [1/4] Killing running IansMusic processes...
taskkill /F /IM IansMusic.exe /IM electron.exe /IM node.exe 2>nul
timeout /t 2 /nobreak >nul

echo [2/4] Cleaning old dist folder...
if exist "dist" (
    rmdir /S /Q "dist" 2>nul
    if exist "dist" (
        echo WARNING: Could not fully remove dist folder. Retrying...
        timeout /t 2 /nobreak >nul
        rmdir /S /Q "dist" 2>nul
    )
)

echo [3/4] Building with electron-builder...
echo.
call npx electron-builder
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Build failed!
    pause
    exit /b 1
)

echo.
echo [4/4] Build complete!
echo.
if exist "dist\IANS_MUSIC_Setup_v2.0.0.exe" (
    echo Installer: dist\IANS_MUSIC_Setup_v2.0.0.exe
    for %%F in ("dist\IANS_MUSIC_Setup_v2.0.0.exe") do echo Size: %%~zF bytes
)
echo.
pause
