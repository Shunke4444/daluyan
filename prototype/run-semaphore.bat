@echo off
REM Daluyan - LIVE via Semaphore (semaphore.co): prepaid credits, PHP0.56/SMS.
REM 1. Sign up at semaphore.co  2. Buy credits  3. Copy API key from your account page.
REM Sender name: leave blank until your registered sender name is approved (up to 5 business days).
where python >nul 2>nul || (echo Python 3.10+ required & pause & exit /b 1)
if not exist .venv python -m venv .venv
call .venv\Scripts\activate.bat
pip install -q -r requirements.txt

set /p SEMAPHORE_API_KEY=Semaphore API key:
set /p SEMAPHORE_SENDER=Sender name (blank = account default):
set SMS_PROVIDER=semaphore
set DEMO_FAST=1

echo.
echo Starting Daluyan with LIVE SMS via Semaphore...
echo Dashboard: http://127.0.0.1:8787   (Ctrl+C to stop)
echo.
python -m daluyan.main
pause
