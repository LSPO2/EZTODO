@echo off
chcp 65001 >nul
title EZTODO 开发环境

echo ========================================
echo    EZTODO 一键启动脚本
echo ========================================
echo.

:: 检查 Docker 是否运行
echo [1/5] 检查 Docker...
docker info >nul 2>&1
if errorlevel 1 (
    echo [错误] Docker 未运行，请先启动 Docker Desktop
    pause
    exit /b 1
)
echo [√] Docker 已就绪

:: 启动 PostgreSQL
echo.
echo [2/5] 启动 PostgreSQL...
cd /d "%~dp0infra\docker"
docker-compose up -d postgres
if errorlevel 1 (
    echo [错误] PostgreSQL 启动失败
    pause
    exit /b 1
)
echo [√] PostgreSQL 已启动

:: 等待数据库就绪
echo.
echo [3/5] 等待数据库就绪...
timeout /t 3 /nobreak >nul

:: 启动后端 API
echo.
echo [4/5] 启动后端 API...
cd /d "%~dp0services\api"
start "EZTODO API" cmd /k "venv\Scripts\activate && uvicorn main:app --reload --host 127.0.0.1 --port 8000"
echo [√] 后端 API 启动中...

:: 等待 API 启动
timeout /t 2 /nobreak >nul

:: 启动前端
echo.
echo [5/5] 启动前端...
cd /d "%~dp0apps\desktop"
start "EZTODO Frontend" cmd /k "npm run dev"
echo [√] 前端启动中...

echo.
echo ========================================
echo    启动完成！
echo ========================================
echo.
echo 访问地址：
echo   前端: http://localhost:1420
echo   API:  http://localhost:8000
echo   文档: http://localhost:8000/docs
echo.
echo 按任意键打开浏览器...
pause >nul

start http://localhost:1420
