@echo off
chcp 65001 >nul
title EZTODO 统一质量门禁

echo ========================================
echo    EZTODO 统一质量门禁
echo ========================================
echo.

set PASSED=0
set FAILED=0
set FAILED_CMD=

:: 前端检查
echo [1/5] 前端 lint...
cd /d "%~dp0apps\desktop"
call npx eslint src --ext .ts,.tsx
if errorlevel 1 (
    echo [✗] 前端 lint 失败
    set /a FAILED+=1
    set FAILED_CMD=%FAILED_CMD% "lint"
) else (
    echo [✓] 前端 lint 通过
    set /a PASSED+=1
)

echo.
echo [2/5] 前端测试...
call npm test
if errorlevel 1 (
    echo [✗] 前端测试失败
    set /a FAILED+=1
    set FAILED_CMD=%FAILED_CMD% "test"
) else (
    echo [✓] 前端测试通过
    set /a PASSED+=1
)

echo.
echo [3/5] 前端构建...
call npm run build
if errorlevel 1 (
    echo [✗] 前端构建失败
    set /a FAILED+=1
    set FAILED_CMD=%FAILED_CMD% "build"
) else (
    echo [✓] 前端构建成功
    set /a PASSED+=1
)

:: 矩阵覆盖校验
echo.
echo [4/5] 矩阵覆盖校验...
cd /d "%~dp0"
node scripts/verify-matrix.js
if errorlevel 1 (
    echo [✗] 矩阵覆盖校验失败
    set /a FAILED+=1
    set FAILED_CMD=%FAILED_CMD% "matrix"
) else (
    echo [✓] 矩阵覆盖校验通过
    set /a PASSED+=1
)

:: Git 检查
echo.
echo [5/5] Git diff 检查...
cd /d "%~dp0"
git diff --check
if errorlevel 1 (
    echo [✗] Git diff 检查失败
    set /a FAILED+=1
    set FAILED_CMD=%FAILED_CMD% "git-diff"
) else (
    echo [✓] Git diff 检查通过
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
