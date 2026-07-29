@echo off
REM Daluyan prototype - Windows launcher (Python 3.10+)
where python >nul 2>nul || (echo Python 3.10+ required & exit /b 1)
if not exist .venv python -m venv .venv
call .venv\Scripts\activate.bat
pip install -q -r requirements.txt
set DEMO_FAST=1
python -m daluyan.main
