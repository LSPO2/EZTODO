@echo off
chcp 65001 >nul
title EZTODO 统一检查

echo ========================================
echo    EZTODO 统一检查脚本
echo ========================================
echo.

set PASSED=0
set FAILED=0
set FAILED_CMD=

:: 前端检查
echo [1/7] 前端依赖安装...
cd /d "%~dp0apps\desktop"
call npm ci
if errorlevel 1 (
    echo [✗] 前端依赖安装失败
    set /a FAILED+=1
    set FAILED_CMD=%FAILED_CMD% "npm ci"
) else (
    echo [✓] 前端依赖安装成功
    set /a PASSED+=1
)

echo.
echo [2/7] 前端 lint...
call npm run lint
if errorlevel 1 (
    echo [✗] 前端 lint 失败
    set /a FAILED+=1
    set FAILED_CMD=%FAILED_CMD% "npm run lint"
) else (
    echo [✓] 前端 lint 通过
    set /a PASSED+=1
)

echo.
echo [3/7] 前端类型检查...
call npx tsc --noEmit
if errorlevel 1 (
    echo [✗] 前端类型检查失败
    set /a FAILED+=1
    set FAILED_CMD=%FAILED_CMD% "tsc --noEmit"
) else (
    echo [✓] 前端类型检查通过
    set /a PASSED+=1
)

echo.
echo [4/7] 前端测试...
call npm test
if errorlevel 1 (
    echo [✗] 前端测试失败
    set /a FAILED+=1
    set FAILED_CMD=%FAILED_CMD% "npm test"
) else (
    echo [✓] 前端测试通过
    set /a PASSED+=1
)

echo.
echo [5/7] 前端构建...
call npm run build
if errorlevel 1 (
    echo [✗] 前端构建失败
    set /a FAILED+=1
    set FAILED_CMD=%FAILED_CMD% "npm run build"
) else (
    echo [✓] 前端构建成功
    set /a PASSED+=1
)

:: 后端检查
echo.
echo [6/7] 后端依赖安装...
cd /d "%~dp0services\api"
if not exist "venv" (
    python -m venv venv
)
call venv\Scripts\activate
pip install -r requirements.txt
if errorlevel 1 (
    echo [✗] 后端依赖安装失败
    set /a FAILED+=1
    set FAILED_CMD=%FAILED_CMD% "pip install"
) else (
    echo [✓] 后端依赖安装成功
    set /a PASSED+=1
)

echo.
echo [7/7] 后端测试...
python -m pytest tests/ -v
if errorlevel 1 (
    echo [✗] 后端测试失败
    set /a FAILED+=1
    set FAILED_CMD=%FAILED_CMD% "pytest"
) else (
    echo [✓] 后端测试通过
    set /a PASSED+=1
)

:: 汇总
echo.
echo ========================================
echo    检查结果汇总
echo ========================================
echo.
echo 通过: %PASSED%
echo 失败: %FAILED%
echo.

if %FAILED% gtr 0 (
    echo [结果] 存在失败项，请修复后再提交
    echo.
    echo 失败命令:
    for %%c in (%FAILED_CMD%) do echo  - %%c
    exit /b 1
) else (
    echo [结果] 全部通过！
    exit /b 0
)
