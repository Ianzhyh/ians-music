@echo off
title IAN'S MUSIC - Server
cd /d "%~dp0meting-api"
echo ========================================
echo   IAN'S MUSIC Server
echo ========================================
echo.
echo   Open:  http://localhost:3300
echo   Stop:  Ctrl+C
echo.
node server.js
pause
