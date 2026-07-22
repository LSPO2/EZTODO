@echo off
chcp 65001 >nul
title EZTODO 停止服务

echo ========================================
echo    EZTODO 停止脚本
echo ========================================
echo.

:: 停止前端
echo [1/3] 停止前端...
taskkill /FI "WindowTitle eq EZTODO Frontend*" /F >nul 2>&1
echo [√] 前端已停止

:: 停止后端
echo.
echo [2/3] 停止后端 API...
taskkill /FI "WindowTitle eq EZTODO API*" /F >nul 2>&1
echo [√] 后端 API 已停止

:: 停止 PostgreSQL
echo.
echo [3/3] 停止 PostgreSQL...
cd /d "%~dp0infra\docker"
docker-compose down
echo [√] PostgreSQL 已停止

echo.
echo ========================================
echo    所有服务已停止
echo ========================================
echo.
pause
