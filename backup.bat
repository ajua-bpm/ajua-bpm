@echo off
echo.
echo  ╔═══════════════════════════════════════╗
echo  ║   AJUA BPM — Backup Local Firebase   ║
echo  ╚═══════════════════════════════════════╝
echo.
cd /d "%~dp0"
node backup-local.js
echo.
pause
