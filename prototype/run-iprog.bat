@echo off
REM Daluyan - LIVE test via IPROG SMS (iprogsms.com): PHP1/SMS, packages from PHP100,
REM credits never expire, free trial credits after KYC signup.
REM NOTE: shared sender reaches Globe/TM/DITO/GOMO only - Smart/TNT needs your own
REM approved sender name (free to request on their Sender Names page).
where python >nul 2>nul || (echo Python 3.10+ required & pause & exit /b 1)
if not exist .venv python -m venv .venv
call .venv\Scripts\activate.bat
pip install -q -r requirements.txt

set /p IPROG_API_TOKEN=IPROG API token (from dashboard):
set SMS_PROVIDER=iprog
set DEMO_FAST=1

echo.
echo Starting Daluyan with LIVE SMS via IPROG (PHP1/SMS pay-per-use)...
echo Dashboard: http://127.0.0.1:8787   (Ctrl+C to stop)
echo.
python -m daluyan.main
pause
