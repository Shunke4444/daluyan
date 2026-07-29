@echo off
REM Daluyan - LIVE test launcher using Traccar SMS Gateway (installed from Google Play).
REM Phone app: Play Store -> "Traccar SMS Gateway" (org.traccar.gateway, Tananaev Solutions).
REM In the app: enable the gateway and copy the CLOUD TOKEN it shows.
where python >nul 2>nul || (echo Python 3.10+ required & pause & exit /b 1)
if not exist .venv python -m venv .venv
call .venv\Scripts\activate.bat
pip install -q -r requirements.txt

set /p TRACCAR_TOKEN=Traccar token (from the app):
set /p TRACCAR_URL=Local URL from app, e.g. http://192.168.x.x:8082 (leave BLANK for cloud):
if "%TRACCAR_URL%"=="" set TRACCAR_URL=https://www.traccar.org/sms/
set SMS_PROVIDER=traccar
set DEMO_FAST=1

echo.
echo Starting Daluyan with LIVE SMS via your Android (Traccar gateway, send-only)...
echo Dashboard: http://127.0.0.1:8787   (Ctrl+C to stop)
echo.
python -m daluyan.main
pause
