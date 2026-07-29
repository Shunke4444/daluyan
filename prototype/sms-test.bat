@echo off
REM Daluyan - send ONE real test SMS to a single number (no registry, no zones).
REM Uses Semaphore by default; edit SMS_PROVIDER below to test another provider.
where python >nul 2>nul || (echo Python 3.10+ required & pause & exit /b 1)
if not exist .venv python -m venv .venv
call .venv\Scripts\activate.bat
pip install -q -r requirements.txt

set SMS_PROVIDER=semaphore
set /p SEMAPHORE_API_KEY=Semaphore API key:
set /p SEMAPHORE_SENDER=Approved sender name (blank = account default):
set /p TESTNUM=Your mobile number (09XXXXXXXXX):

echo.
python smstest.py %TESTNUM%
echo.
pause
