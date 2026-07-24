@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

REM EZTODO API Quality Gate
REM Uses project venv, fails if not available

set ROOT_DIR=%~dp0..
set VENV_PYTHON=%ROOT_DIR%\services\api\venv\Scripts\python.exe
set API_DIR=%ROOT_DIR%\services\api

echo === API Quality Gate ===

REM Check if venv exists
if not exist "%VENV_PYTHON%" (
    echo FAIL: Virtual environment not found at %VENV_PYTHON%
    echo Please run: cd services/api ^&^& python -m venv venv ^&^& venv\Scripts\pip install -r requirements.txt
    exit /b 1
)

REM Check if pytest is installed
echo [1/2] Checking pytest availability...
"%VENV_PYTHON%" -c "import pytest" 2>nul
if errorlevel 1 (
    echo FAIL: pytest not installed in virtual environment
    echo Please run: services\api\venv\Scripts\pip install -r requirements.txt
    exit /b 1
)
echo [✓] pytest available

REM Run tests
echo.
echo [2/2] Running pytest...
cd /d "%API_DIR%"
"%VENV_PYTHON%" -m pytest tests/ -v
if errorlevel 1 (
    echo FAIL: pytest failed
    exit /b 1
)

echo.
echo [✓] API quality gate passed
exit /b 0
