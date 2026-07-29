@echo off
REM Daluyan - LIVE test via PhilSMS (real PH aggregator, 5 free trial SMS on signup).
REM 1. Sign up at philsms.com (free)  2. Dashboard -> Developers -> copy API token  3. Run this.
where python >nul 2>nul || (echo Python 3.10+ required & pause & exit /b 1)
if not exist .venv python -m venv .venv
call .venv\Scripts\activate.bat
pip install -q -r requirements.txt

set /p PHILSMS_API_TOKEN=PhilSMS API token:
set /p PHILSMS_SENDER=Sender ID (leave BLANK for default "PhilSMS"):
if "%PHILSMS_SENDER%"=="" set PHILSMS_SENDER=PhilSMS
set SMS_PROVIDER=philsms
set DEMO_FAST=1

echo.
echo Starting Daluyan with LIVE SMS via PhilSMS aggregator...
echo Dashboard: http://127.0.0.1:8787   (Ctrl+C to stop)
echo.
python -m daluyan.main
pause
