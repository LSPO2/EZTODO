# EZTODO v2.0.0

EZTODO 是面向 Windows 10/11 的本地优先桌面待办应用，桌面端采用 Tauri 2、React、TypeScript、Zustand 和 SQLite。项目同时保留 FastAPI 服务端、共享契约与部署配置，为后续同步能力提供基础。

## 当前状态（2026-07-24）

当前版本为 **v2.0.0**，仍处于实机验证和交互打磨阶段。

已实现并接入桌面应用的主要能力：

- TODO 创建、编辑、完成、删除、回收站恢复和撤销提示。
- 父子任务、子任务进度、上下移动排序和层级调整。
- 分类、优先级、搜索、筛选和批量操作。
- 任务卡直接显示备注、创建时间及方形快捷优先级菜单。
- 任务详情未保存保护：保存、不保存、取消。
- 开始时间、截止时间、Windows 提醒、托盘与窗口关闭保护。
- 数据导入、导出、备份和本地 SQLite 持久化。
- BYOK AI 设置、连接反馈、结构化任务识别和确认后创建。

当前验证边界：

- 自动测试基线：29 个测试文件、213 项测试通过。
- TypeScript/Vite 生产构建通过。
- Windows/Tauri 实机交互仍由当前验收流程持续验证；自动测试通过不等同于全部实机验收完成。

## 项目结构

```text
EZTODO/
├─ apps/desktop/                 Tauri 2 + React 桌面应用
│  ├─ src/                      前端、状态、服务和仓储
│  └─ src-tauri/                Rust/Tauri 原生层
├─ services/api/                FastAPI 服务端
├─ packages/contracts/          共享类型与契约
├─ infra/                       Docker 与部署配置
├─ docs/                        项目文档（audit 审计，archive 历史归档）
├─ scripts/                     检查与发布辅助脚本
└─ PC端AI_Todo开发任务清单.md    需求与验收基线
```

## 开发与验证

环境要求：Node.js 18+、npm 9+、Rust stable；服务端开发另需 Python 3.11+。

```powershell
npm install
npm run dev
npm test
npm run build
npm run lint
```

启动 Tauri 开发版：

```powershell
npm run tauri -- dev
```

## 发布 EXE 与根目录快捷方式

每次发布新版本必须执行：

```powershell
npm run release:desktop
```

该命令会：

1. 构建当前版本的 Tauri release。
2. 更新项目根目录的 `EZTODO 最新版.lnk`。
3. 让快捷方式指向 `apps/desktop/src-tauri/target/release/eztodo-desktop.exe`。

根目录只保留一个稳定名称的“最新版”快捷方式，避免每次升级产生多个旧快捷方式。快捷方式不是 EXE 副本；清理 Rust `target` 目录后需要重新运行发布命令。该 `.lnk` 含本机绝对路径，因此保留在本地但不提交 Git；仓库提交生成脚本，由每台机器在发布时自动更新快捷方式。

## 数据位置与安全

- Tauri 桌面版使用应用数据目录中的 `eztodo.db`。
- SQLite 运行时可能同时存在 `-wal` 和 `-shm` 文件；复制或检查数据库前应先停止应用，或同时保留这两个伴随文件。
- API Key 使用应用的安全凭据流程保存；不要把真实密钥写入 `.env.example`、日志或提交记录。

## 目录清理规则

构建缓存、诊断数据库、日志和历史文档在删除前必须先列出用途、大小和影响，由项目负责人确认。未经审核不得删除源码、数据库或未提交的工作区改动。历史方案保存在 `docs/archive/legacy-plans`，项目审计与路线文档保存在 `docs/audit`。
