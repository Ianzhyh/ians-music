@echo off

set VERSION=2.5.0

echo ==========================================
echo   IAN'S MUSIC - Build Script v%VERSION%
echo ==========================================
echo.

echo [1/5] Updating version numbers...
node scripts\update-version.js %VERSION%
echo.

echo [2/5] Checking meting-api dependencies...
if not exist "meting-api\node_modules" (
    echo [WARN] meting-api\node_modules not found!
    echo [INFO] Running: cd meting-api ^&^& npm install
    cd meting-api
    call npm install
    cd ..
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to install meting-api dependencies!
        pause
        exit /b 1
    )
) else (
    echo [OK] meting-api\node_modules found
)
if not exist "meting-api\node_modules\@meting" (
    echo [WARN] @meting/core not found, reinstalling...
    cd meting-api
    call npm install
    cd ..
)
echo.

echo [3/5] Killing running processes...
taskkill /F /IM IansMusic.exe /IM electron.exe /IM node.exe 2>nul
timeout /t 2 /nobreak >nul

echo [4/5] Cleaning old dist folder...
if exist "dist" rmdir /S /Q "dist" 2>nul

echo [5/5] Building with electron-builder...
call npx electron-builder
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Build failed!
    pause
    exit /b 1
)

echo.
echo Build complete!
if exist "dist\IANS_MUSIC_Setup_v%VERSION%.exe" (
    echo Installer: dist\IANS_MUSIC_Setup_v%VERSION%.exe
    for %%F in ("dist\IANS_MUSIC_Setup_v%VERSION%.exe") do echo Size: %%~zF bytes
)
echo.
pause
