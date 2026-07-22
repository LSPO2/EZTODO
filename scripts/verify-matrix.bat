@echo off
setlocal enabledelayedexpansion

REM Verify that requirements matrix covers all P0 items from source document

set ROOT_DIR=%~dp0..
set SOURCE_FILE=%ROOT_DIR%\PC端AI_Todo开发任务清单.md
set MATRIX_FILE=%ROOT_DIR%\docs\acceptance\requirements-matrix.md

if not exist "%SOURCE_FILE%" (
    echo ERROR: Source file not found: %SOURCE_FILE%
    exit /b 1
)

if not exist "%MATRIX_FILE%" (
    echo ERROR: Matrix file not found: %MATRIX_FILE%
    exit /b 1
)

REM Count P0 items in source
set SOURCE_COUNT=0
for /f %%i in ('findstr /c:"[P0]" "%SOURCE_FILE%" ^| find /c /v ""') do set SOURCE_COUNT=%%i

REM Count P0 rows in matrix
set MATRIX_COUNT=0
for /f %%i in ('findstr /c:"| P0 |" "%MATRIX_FILE%" ^| find /c /v ""') do set MATRIX_COUNT=%%i

echo === Matrix Coverage Verification ===
echo Source P0 count: %SOURCE_COUNT%
echo Matrix P0 count: %MATRIX_COUNT%
echo.

if %SOURCE_COUNT% neq %MATRIX_COUNT% (
    echo FAIL: Matrix coverage mismatch!
    echo Expected: %SOURCE_COUNT%
    echo Actual: %MATRIX_COUNT%
    exit /b 1
)

echo PASS: Matrix covers all %SOURCE_COUNT% P0 items
exit /b 0
