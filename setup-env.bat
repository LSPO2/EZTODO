@echo off
chcp 65001 >nul
title EZTODO 环境初始化

echo ========================================
echo    EZTODO 环境初始化
echo ========================================
echo.

:: 检查 Node.js
echo [1/6] 检查 Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo [错误] Node.js 未安装，请先安装 Node.js 18+
    echo 下载地址: https://nodejs.org/
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node --version') do echo [√] Node.js %%i

:: 检查 Python
echo.
echo [2/6] 检查 Python...
python --version >nul 2>&1
if errorlevel 1 (
    echo [错误] Python 未安装，请先安装 Python 3.11+
    echo 下载地址: https://www.python.org/
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('python --version') do echo [√] Python %%i

:: 检查 Docker
echo.
echo [3/6] 检查 Docker...
docker --version >nul 2>&1
if errorlevel 1 (
    echo [警告] Docker 未安装，数据库功能将不可用
    echo 下载地址: https://www.docker.com/products/docker-desktop
) else (
    for /f "tokens=*" %%i in ('docker --version') do echo [√] Docker %%i
)

:: 安装前端依赖
echo.
echo [4/6] 安装前端依赖...
cd /d "%~dp0apps\desktop"
if not exist "node_modules" (
    call npm install
    if errorlevel 1 (
        echo [错误] 前端依赖安装失败
        pause
        exit /b 1
    )
) else (
    echo [√] 前端依赖已存在
)

:: 安装后端依赖
echo.
echo [5/6] 安装后端依赖...
cd /d "%~dp0services\api"
if not exist "venv" (
    echo 创建 Python 虚拟环境...
    python -m venv venv
    call venv\Scripts\activate
    pip install -r requirements.txt
    if errorlevel 1 (
        echo [错误] 后端依赖安装失败
        pause
        exit /b 1
    )
) else (
    echo [√] 后端虚拟环境已存在
)

:: 创建环境配置
echo.
echo [6/6] 检查环境配置...
cd /d "%~dp0"
if not exist "services\api\.env" (
    echo 创建环境配置文件...
    copy .env.example services\api\.env
    echo.
    echo [提示] 请编辑 services\api\.env 填入以下配置：
    echo   - JWT_SECRET_KEY: JWT 密钥
    echo   - AI_API_KEY: DeepSeek API 密钥
    echo   - POSTGRES_PASSWORD: 数据库密码
) else (
    echo [√] 环境配置已存在
)

echo.
echo ========================================
echo    环境初始化完成！
echo ========================================
echo.
echo 下一步：
echo   1. 编辑 services\api\.env 配置文件
echo   2. 运行 start-dev.bat 启动应用
echo.
pause
