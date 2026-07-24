@echo off
setlocal
echo ========================================
echo EZTODO quality gate
echo Running: npm.cmd run check:all
echo ========================================
cd /d "%~dp0"
call npm.cmd run check:all
set "EXIT_CODE=%ERRORLEVEL%"
if not "%EXIT_CODE%"=="0" (
  echo Quality gate failed with exit code %EXIT_CODE%.
  exit /b %EXIT_CODE%
)
echo Quality gate passed.
exit /b 0
