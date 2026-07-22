# EZTODO 部署文档

> 文档版本：v1.0
> 编制日期：2026-07-22

---

## 1. 服务器部署

### 1.1 环境要求

- Docker 20.10+
- Docker Compose 2.0+
- 2GB+ RAM
- 10GB+ 磁盘空间

### 1.2 快速部署

```bash
# 克隆仓库
git clone https://github.com/LSPO2/EZTODO.git
cd EZTODO

# 复制环境配置
cp .env.example .env

# 编辑配置
nano .env

# 启动服务
cd infra/docker
docker-compose up -d
```

### 1.3 环境变量

| 变量 | 说明 | 默认值 |
|---|---|---|
| `POSTGRES_PASSWORD` | 数据库密码 | `eztodo_dev_password` |
| `JWT_SECRET_KEY` | JWT 密钥 | `your_jwt_secret` |
| `AI_API_KEY` | DeepSeek API 密钥 | - |

### 1.4 验证部署

```bash
# 检查服务状态
docker-compose ps

# 检查 API 健康
curl http://localhost:8000/api/v1/health

# 预期响应
{
  "status": "healthy",
  "service": "EZTODO API",
  "version": "0.1.0-m0"
}
```

---

## 2. 数据库管理

### 2.1 备份

```bash
# 手动备份
./infra/scripts/backup-db.sh

# 备份文件位置
./backups/eztodo_backup_YYYYMMDD_HHMMSS.sql.gz
```

### 2.2 恢复

```bash
# 恢复备份
./infra/scripts/restore-db.sh ./backups/eztodo_backup_YYYYMMDD_HHMMSS.sql.gz
```

### 2.3 迁移

```bash
# 进入 API 容器
docker exec -it eztodo-api bash

# 运行迁移
alembic upgrade head
```

---

## 3. HTTPS 配置

### 3.1 Caddy 自动 HTTPS

Caddy 会自动申请 Let's Encrypt 证书。

修改 `infra/docker/Caddyfile`：

```
yourdomain.com {
    reverse_proxy api:8000
}
```

### 3.2 手动证书

如需使用自定义证书：

```
yourdomain.com {
    tls /path/to/cert.pem /path/to/key.pem
    reverse_proxy api:8000
}
```

---

## 4. 客户端发布

### 4.1 构建安装包

```bash
# 进入客户端目录
cd apps/desktop

# 安装依赖
npm install

# 构建 Tauri 应用
npm run tauri build
```

### 4.2 安装包位置

```
apps/desktop/src-tauri/target/release/bundle/
├── nsis/
│   └── EZTODO_0.1.0_x64-setup.exe
└── msi/
    └── EZTODO_0.1.0_x64_en-US.msi
```

### 4.3 生成校验和

```bash
# 生成 SHA-256
sha256sum EZTODO_0.1.0_x64-setup.exe > EZTODO_0.1.0_x64-setup.exe.sha256
```

---

## 5. 升级流程

### 5.1 服务器升级

```bash
# 拉取最新代码
git pull

# 备份数据库
./infra/scripts/backup-db.sh

# 重新构建并启动
cd infra/docker
docker-compose down
docker-compose build
docker-compose up -d

# 验证
curl http://localhost:8000/api/v1/health
```

### 5.2 客户端升级

1. 下载新版本安装包
2. 运行安装程序（覆盖安装）
3. 数据自动保留

---

## 6. 故障恢复

### 6.1 服务无法启动

```bash
# 查看日志
docker-compose logs api

# 检查数据库
docker-compose exec postgres psql -U eztodo -d eztodo -c "SELECT 1"
```

### 6.2 数据库损坏

```bash
# 停止服务
docker-compose down

# 恢复备份
./infra/scripts/restore-db.sh ./backups/latest_backup.sql.gz

# 重启服务
docker-compose up -d
```

### 6.3 客户端数据丢失

1. 检查回收站是否有数据
2. 使用导入功能恢复备份
3. 从服务器重新同步

---

## 7. 监控

### 7.1 健康检查

```bash
# API 健康
curl http://localhost:8000/api/v1/health

# 数据库就绪
curl http://localhost:8000/api/v1/ready

# 版本信息
curl http://localhost:8000/api/v1/version
```

### 7.2 日志查看

```bash
# API 日志
docker-compose logs -f api

# 数据库日志
docker-compose logs -f postgres
```

---

## 8. 安全建议

1. 修改默认密码
2. 使用强 JWT 密钥
3. 启用 HTTPS
4. 限制数据库访问
5. 定期备份
6. 监控磁盘空间

---

> 本文档涵盖 EZTODO 的部署和运维指南
