@echo off
chcp 65001 >nul
title EZTODO 统一检查

echo ========================================
echo    EZTODO 统一检查脚本
echo ========================================
echo.

set PASSED=0
set FAILED=0

:: 前端检查
echo [1/6] 前端依赖安装...
cd /d "%~dp0apps\desktop"
call npm ci >nul 2>&1
if errorlevel 1 (
    echo [✗] 前端依赖安装失败
    set /a FAILED+=1
) else (
    echo [✓] 前端依赖安装成功
    set /a PASSED+=1
)

echo.
echo [2/6] 前端类型检查...
call npx tsc --noEmit >nul 2>&1
if errorlevel 1 (
    echo [✗] 前端类型检查失败
    set /a FAILED+=1
) else (
    echo [✓] 前端类型检查通过
    set /a PASSED+=1
)

echo.
echo [3/6] 前端测试...
call npm test >nul 2>&1
if errorlevel 1 (
    echo [✗] 前端测试失败
    set /a FAILED+=1
) else (
    echo [✓] 前端测试通过
    set /a PASSED+=1
)

echo.
echo [4/6] 前端构建...
call npm run build >nul 2>&1
if errorlevel 1 (
    echo [✗] 前端构建失败
    set /a FAILED+=1
) else (
    echo [✓] 前端构建成功
    set /a PASSED+=1
)

:: 后端检查
echo.
echo [5/6] 后端依赖安装...
cd /d "%~dp0services\api"
if not exist "venv" (
    python -m venv venv
)
call venv\Scripts\activate
pip install -r requirements.txt >nul 2>&1
if errorlevel 1 (
    echo [✗] 后端依赖安装失败
    set /a FAILED+=1
) else (
    echo [✓] 后端依赖安装成功
    set /a PASSED+=1
)

echo.
echo [6/6] 后端测试...
python -m pytest tests/ -v >nul 2>&1
if errorlevel 1 (
    echo [✗] 后端测试失败
    set /a FAILED+=1
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
    exit /b 1
) else (
    echo [结果] 全部通过！
    exit /b 0
)
