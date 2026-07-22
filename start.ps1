# EZTODO 一键启动脚本 (PowerShell)

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "    EZTODO 一键启动脚本" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path

# 检查 Docker
Write-Host "[1/5] 检查 Docker..." -ForegroundColor Yellow
try {
    docker info 2>&1 | Out-Null
    Write-Host "[√] Docker 已就绪" -ForegroundColor Green
} catch {
    Write-Host "[错误] Docker 未运行，请先启动 Docker Desktop" -ForegroundColor Red
    exit 1
}

# 启动 PostgreSQL
Write-Host ""
Write-Host "[2/5] 启动 PostgreSQL..." -ForegroundColor Yellow
Set-Location "$scriptPath\infra\docker"
docker-compose up -d postgres
if ($LASTEXITCODE -ne 0) {
    Write-Host "[错误] PostgreSQL 启动失败" -ForegroundColor Red
    exit 1
}
Write-Host "[√] PostgreSQL 已启动" -ForegroundColor Green

# 等待数据库就绪
Write-Host ""
Write-Host "[3/5] 等待数据库就绪..." -ForegroundColor Yellow
Start-Sleep -Seconds 3
Write-Host "[√] 数据库已就绪" -ForegroundColor Green

# 启动后端 API
Write-Host ""
Write-Host "[4/5] 启动后端 API..." -ForegroundColor Yellow
Set-Location "$scriptPath\services\api"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "venv\Scripts\activate; uvicorn main:app --reload --host 127.0.0.1 --port 8000" -WindowStyle Normal
Write-Host "[√] 后端 API 启动中..." -ForegroundColor Green

# 等待 API 启动
Start-Sleep -Seconds 2

# 启动前端
Write-Host ""
Write-Host "[5/5] 启动前端..." -ForegroundColor Yellow
Set-Location "$scriptPath\apps\desktop"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "npm run dev" -WindowStyle Normal
Write-Host "[√] 前端启动中..." -ForegroundColor Green

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "    启动完成！" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "访问地址：" -ForegroundColor White
Write-Host "  前端: http://localhost:1420" -ForegroundColor Green
Write-Host "  API:  http://localhost:8000" -ForegroundColor Green
Write-Host "  文档: http://localhost:8000/docs" -ForegroundColor Green
Write-Host ""

$openBrowser = Read-Host "是否打开浏览器? (Y/N)"
if ($openBrowser -eq "Y" -or $openBrowser -eq "y") {
    Start-Process "http://localhost:1420"
}
