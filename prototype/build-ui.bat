@echo off
REM Build the React console (needs Node 18+ / npm). Run once, then any run*.bat serves it at /ui/
where npm >nul 2>nul || (echo Node.js 18+ required - install from nodejs.org & pause & exit /b 1)
cd /d "%~dp0frontend"
call npm install
call npm run build
echo.
echo Build done. Start the server with any run*.bat - the new UI is at http://127.0.0.1:8787/ui/
pause
