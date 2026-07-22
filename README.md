# EZTODO - AI Todo Application

> AI 驱动的待办事项桌面应用

## 项目结构

```
EZTODO/
├── apps/
│   └── desktop/          # Tauri 2 桌面客户端
│       ├── src/          # React 前端代码
│       └── src-tauri/    # Tauri Rust 后端
├── services/
│   └── api/              # FastAPI 服务端
│       ├── api/          # API 路由
│       ├── core/         # 核心配置
│       ├── domain/       # 领域模型
│       ├── services/     # 业务逻辑
│       ├── repositories/ # 数据访问
│       └── models/       # 数据库模型
├── packages/
│   └── contracts/        # 共享类型定义
├── infra/
│   └── docker/           # Docker 部署配置
└── docs/                 # 文档
```

## 技术栈

| 层级 | 技术 |
|---|---|
| 桌面客户端 | Tauri 2 + React + TypeScript |
| 前端状态 | Zustand |
| 本地数据库 | SQLite |
| 服务端 | FastAPI + Pydantic |
| 服务端数据库 | PostgreSQL |
| 部署 | Docker Compose + Caddy |

## 快速开始

### 前置要求

- Node.js >= 18
- Python >= 3.11
- Rust (for Tauri)
- Docker (for PostgreSQL)

### 安装依赖

```bash
# 安装前端依赖
npm install

# 安装 Python 依赖
cd services/api
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 启动开发服务器

```bash
# 启动 PostgreSQL
cd infra/docker
docker-compose up -d postgres

# 启动 FastAPI 服务端
cd services/api
uvicorn main:app --reload

# 启动 Tauri 桌面客户端
npm run tauri dev
```

## 版本

- 当前版本：0.1.0-m0 (M0 阶段)
- 目标平台：Windows 10/11

## 文档

- [M0阶段计划任务.md](./M0阶段计划任务.md)
- [PC端AI_Todo开发任务清单.md](./PC端AI_Todo开发任务清单.md)
