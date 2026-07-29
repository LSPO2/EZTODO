# EZTODO

<p align="center">
  <img src="https://raw.githubusercontent.com/LSPO2/EZTODO/develop/apps/desktop/src-tauri/icons/128x128.png" alt="EZTODO logo" width="96" />
</p>

<p align="center">
  面向 Windows 10/11 的本地优先 AI 待办桌面应用
</p>

<p align="center">
  <a href="https://github.com/LSPO2/EZTODO/actions/workflows/ci.yml"><img src="https://github.com/LSPO2/EZTODO/actions/workflows/ci.yml/badge.svg?branch=develop" alt="EZTODO CI" /></a>
  <img src="https://img.shields.io/badge/version-2.0.0-2563eb" alt="Version 2.0.0" />
  <img src="https://img.shields.io/badge/platform-Windows-0078d4" alt="Windows" />
  <img src="https://img.shields.io/badge/status-active_development-f59e0b" alt="Active development" />
</p>

EZTODO 使用 Tauri 2、React、TypeScript、Zustand 与 SQLite 构建桌面端，在本地完成任务管理、层级组织、提醒、数据维护和 BYOK AI 辅助录入。仓库同时包含 FastAPI 服务端、共享契约和部署配置，为后续账号与多设备同步提供基础。

> 当前版本：**v2.0.0**<br>
> 当前实现与项目文档以 [`develop`](https://github.com/LSPO2/EZTODO/tree/develop) 分支为准；`main` 同步展示项目概览。<br>
> 项目阶段：**核心桌面流程已接线，自动化门禁通过，Windows/Tauri 最终实机验收仍在进行。**<br>
> 状态更新：**2026-07-29**

## 当前进度

| 能力 | 当前状态 | 说明 |
|---|---|---|
| 核心 TODO 生命周期 | 已接线、自动化通过 | 创建、编辑、完成、重开、软删除、恢复与撤销 |
| 父子任务与批量操作 | 已接线、自动化通过 | 最多 3 层、排序、移动、复制、批量事务与失败回滚 |
| 搜索、筛选与排序 | 已接线、自动化通过 | 项目、标签、优先级、状态、时间和手动顺序 |
| SQLite 本地持久化 | 已接线、自动化通过 | Repository 边界、迁移、事务、outbox 与 WAL 模式 |
| 提醒、重复任务与托盘 | 已接线、自动化通过 | 生命周期联动已覆盖；通知、睡眠唤醒和托盘仍需真机复验 |
| 导入、导出与备份 | 已实现并接入 | CSV/JSON 与本地备份可用；原子恢复仍是发布前工作 |
| BYOK AI 辅助添加 | 已接线、自动化通过 | 设置、连接反馈、结构化解析、可编辑确认后写入 |
| 账号与多设备同步 | 开发中 | API、共享契约和 outbox 已具备，完整同步闭环尚未验收 |
| Windows 安装与升级 | 待最终验收 | 安装包、全新安装、覆盖安装、卸载和真实升级场景待验证 |

## 已接入能力

- 快速创建、详情编辑、完成、重开、回收站恢复和可见撤销。
- 父子任务、子任务进度、层级调整、同级排序和最多 3 层约束。
- 项目、标签、优先级、全文搜索、组合筛选与多种排序方式。
- 批量完成、删除、恢复、修改优先级、移动项目和增删标签。
- 开始时间、截止时间、重复规则、提醒调度、托盘和窗口关闭保护。
- CSV/JSON 导入导出、完整备份和本地 SQLite 数据持久化。
- OpenAI-compatible BYOK 设置、连接测试、AI 任务拆解和确认后创建。
- 10,000 条固定数据集的查询与首屏渲染性能门禁。

AI 生成结果不会直接写入任务库：用户可以先编辑确认卡，再明确确认创建。API Base 与模型设置会持久化；API Key 当前只保留在进程内存中，不写入 SQLite、localStorage 或日志。

## 自动化验证

2026-07-29 在 `develop` 分支执行 `npm run check:all`：

| 检查 | 结果 |
|---|---:|
| 前端测试 | 29 个文件，213 项通过 |
| API 测试 | 18 项通过 |
| TypeScript | 0 error |
| ESLint | 0 error，69 warning |
| 前端生产构建 | 通过 |
| 共享契约构建 | 通过 |
| P0 需求矩阵覆盖 | 388 / 388 |
| Git whitespace check | 通过 |

自动化测试主要运行在 Node/jsdom 与 Browser Repository 环境中。上述结果证明当前代码门禁通过，不等同于 Windows WebView、真实 SQLite、真实 AI 服务、通知/托盘、安装升级或多设备同步已经完成最终验收。

## 当前发布边界

v2.0.0 仍属于开发与验收版本，尚未达到完整发布清单的最终通过状态。主要剩余工作：

- 完成 Windows/Tauri 原生流程、通知、睡眠唤醒、托盘和快捷键真机验收。
- 完成真实 API 连接、AI 任务落库与多任务原子写入验收。
- 完成备份原子恢复、旧数据迁移与重启持久化验证。
- 完成账号、冲突处理和两台设备增量同步闭环。
- 完成安装包生成、全新安装、覆盖安装、卸载和升级回滚验证。
- 收敛现有 ESLint warning，并补齐端到端与发布证据。

详细状态以 [需求验收矩阵](https://github.com/LSPO2/EZTODO/blob/develop/docs/acceptance/requirements-matrix.md)、[P0-2 验收证据](https://github.com/LSPO2/EZTODO/blob/develop/docs/acceptance/p0-2-evidence.md) 和 [发布检查清单](https://github.com/LSPO2/EZTODO/blob/develop/docs/release-checklist.md) 为准。

## 技术栈

| 层级 | 技术 |
|---|---|
| 桌面容器 | Tauri 2 / Rust |
| 前端 | React / TypeScript / Vite |
| 状态管理 | Zustand |
| 本地存储 | SQLite / Tauri SQL |
| 服务端 | FastAPI / SQLAlchemy |
| 测试与质量 | Vitest / Testing Library / Pytest / ESLint / GitHub Actions |
| 部署基础 | Docker Compose / Caddy / PostgreSQL |

## 项目结构

```text
EZTODO/
├─ apps/desktop/                 Tauri 2 + React 桌面应用
│  ├─ src/                      UI、Store、Service 与 Repository
│  └─ src-tauri/                Rust/Tauri 原生层
├─ services/api/                FastAPI 服务端
├─ packages/contracts/          前后端共享类型与契约
├─ infra/                       Docker 与部署配置
├─ docs/
│  ├─ acceptance/               验收场景、矩阵与证据
│  ├─ audit/                    审计、路线图与改进方案
│  └─ deployment/               部署文档
├─ scripts/                     检查与发布辅助脚本
└─ PC端AI_Todo开发任务清单.md    原始需求与 Definition of Done
```

## 本地开发

环境要求：

- Node.js 18+
- npm 9+
- Rust stable（运行或构建 Tauri）
- Python 3.11+（开发 FastAPI 服务端）

```powershell
git clone --branch develop https://github.com/LSPO2/EZTODO.git
cd EZTODO
npm install
npm run dev
```

启动 Tauri 桌面开发版：

```powershell
npm run tauri -- dev
```

运行完整自动化门禁：

```powershell
npm run check:all
npm run check:rust
```

`check:all` 包含依赖锁检查、Lint、TypeScript、前端测试、前端构建、共享契约、API 测试、需求矩阵和 Git whitespace 检查；Rust 检查因耗时较长单独执行。

## 构建 Windows 桌面版

```powershell
npm run release:desktop
```

该命令会构建 Tauri release，并更新项目根目录本机使用的 `EZTODO 最新版.lnk`，使其指向：

```text
apps/desktop/src-tauri/target/release/eztodo-desktop.exe
```

快捷方式包含本机绝对路径，因此不会提交到 Git。它不是 EXE 副本；清理 Rust `target` 目录后需要重新运行发布命令。

## 数据与安全

- Tauri 桌面版使用应用数据目录中的 `eztodo.db`。
- SQLite 运行时可能同时存在 `eztodo.db-wal` 与 `eztodo.db-shm`；检查或迁移数据库前应停止应用，或同时复制三个文件。
- 不要把真实 API Key 写入 `.env` 示例、数据库、日志、Issue 或提交记录。
- 构建缓存、诊断数据库、日志和未提交改动不得在未确认范围与影响前删除。

## 文档入口

- [开发目标与路线图](https://github.com/LSPO2/EZTODO/blob/develop/docs/audit/03-开发目标与路线图.md)
- [AI 设置与辅助添加验收](https://github.com/LSPO2/EZTODO/blob/develop/docs/audit/04-AI设置与辅助添加验收.md)
- [用户指南](https://github.com/LSPO2/EZTODO/blob/develop/docs/user-guide.md)
- [部署说明](https://github.com/LSPO2/EZTODO/blob/develop/docs/deployment/README.md)
- [Git 工作流](https://github.com/LSPO2/EZTODO/blob/develop/docs/git-workflow.md)
- [问题反馈](https://github.com/LSPO2/EZTODO/issues)
