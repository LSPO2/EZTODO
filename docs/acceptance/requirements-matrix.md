# EZTODO 需求验收矩阵

> 文档版本：v1.0
> 编制日期：2026-07-22
> 状态说明：待开发 | 开发中 | 已实现 | 已验证 | 不通过

---

## 1. 数据与架构 (DATA)

| ID | 需求 | 优先级 | 实现文件 | 测试文件 | 状态 | 阻塞原因 |
|---|---|---|---|---|---|---|
| DATA-001 | 生产版任务数据通过 Repository -> Tauri SQLite 读写 | P0 | lib/repositories/* | - | 待开发 | |
| DATA-002 | UI 不得直接读写 SQL 或 localStorage | P0 | - | - | 待开发 | |
| DATA-003 | localStorage 仅用于浏览器演示和测试 | P0 | lib/database/browser-db.ts | - | 已实现 | 需标注 demo/test only |
| DATA-004 | 任务操作在同一事务中完成业务写入和 sync_outbox 写入 | P0 | lib/repositories/task-repository.ts | - | 待开发 | |
| DATA-005 | 离线操作不阻塞创建/编辑/完成/删除 | P0 | - | - | 待开发 | |
| DATA-006 | 同步成功后才更新 outbox synced_at | P0 | lib/sync.ts | - | 已实现 | |
| DATA-007 | 超时或响应丢失时保留原操作并重试 | P0 | lib/sync.ts | - | 已实现 | |
| DATA-008 | 实体 ID 使用 UUIDv7 | P0 | lib/repositories/* | - | 待开发 | 当前使用 Date.now() |
| DATA-009 | 精确时间传输使用 UTC ISO 8601 | P0 | lib/time.ts | lib/__tests__/time.test.ts | 已实现 | |
| DATA-010 | 全天任务使用独立日期字段 | P0 | lib/repositories/types.ts | - | 已实现 | |
| DATA-011 | 任务层级最多 3 级 | P0 | lib/repositories/task-repository.ts | - | 待开发 | |
| DATA-012 | 移动任务前防止循环引用 | P0 | lib/repositories/task-repository.ts | - | 待开发 | |

---

## 2. 任务 CRUD (TASK)

| ID | 需求 | 优先级 | 实现文件 | 测试文件 | 状态 | 阻塞原因 |
|---|---|---|---|---|---|---|
| TASK-001 | 新建任务 | P0 | App.tsx | - | 已实现 | 使用 localStorage |
| TASK-002 | 编辑标题和备注 | P0 | App.tsx | - | 已实现 | 使用 localStorage |
| TASK-003 | 标记完成/取消完成 | P0 | App.tsx | - | 已实现 | 使用 localStorage |
| TASK-004 | 软删除任务 | P0 | App.tsx | - | 已实现 | 使用 localStorage |
| TASK-005 | 复制任务 | P0 | - | - | 待开发 | |
| TASK-006 | 移动到其他项目 | P0 | - | - | 待开发 | |
| TASK-007 | 设置优先级 | P0 | App.tsx | - | 已实现 | 使用 localStorage |
| TASK-008 | 添加和删除标签 | P0 | - | - | 待开发 | |
| TASK-009 | 拖动调整同级任务顺序 | P0 | - | - | 待开发 | |
| TASK-010 | 所有修改立即写入本地数据库 | P0 | - | - | 待开发 | |
| TASK-011 | 每次修改同时写入同步队列 | P0 | - | - | 待开发 | |

---

## 3. 内置视图 (VIEW)

| ID | 需求 | 优先级 | 实现文件 | 测试文件 | 状态 | 阻塞原因 |
|---|---|---|---|---|---|---|
| VIEW-001 | Inbox 视图 | P0 | App.tsx | - | 已实现 | 过滤逻辑在组件中 |
| VIEW-002 | 今天视图 | P0 | App.tsx | - | 已实现 | 过滤逻辑在组件中 |
| VIEW-003 | 未来 7 天视图 | P0 | App.tsx | - | 已实现 | 过滤逻辑在组件中 |
| VIEW-004 | 已逾期视图 | P0 | App.tsx | - | 已实现 | 过滤逻辑在组件中 |
| VIEW-005 | 无日期任务视图 | P0 | - | - | 待开发 | |
| VIEW-006 | 已完成视图 | P0 | App.tsx | - | 已实现 | |
| VIEW-007 | 回收站视图 | P0 | App.tsx | - | 已实现 | 使用 localStorage |

---

## 4. 搜索筛选排序 (SEARCH)

| ID | 需求 | 优先级 | 实现文件 | 测试文件 | 状态 | 阻塞原因 |
|---|---|---|---|---|---|---|
| SEARCH-001 | 搜索标题和备注 | P0 | App.tsx | - | 已实现 | 基础实现 |
| SEARCH-002 | 按项目、标签、优先级、状态筛选 | P0 | - | - | 待开发 | |
| SEARCH-003 | 按计划时间、截止时间、创建时间和手动顺序排序 | P0 | - | - | 待开发 | |
| SEARCH-004 | 支持"仅显示父任务"或"展开全部子任务" | P0 | - | - | 待开发 | |
| SEARCH-005 | 清楚显示当前生效的筛选条件 | P0 | - | - | 待开发 | |
| SEARCH-006 | 为 10,000 条任务建立性能测试 | P0 | - | - | 待开发 | |

---

## 5. 父子任务 (PARENT)

| ID | 需求 | 优先级 | 实现文件 | 测试文件 | 状态 | 阻塞原因 |
|---|---|---|---|---|---|---|
| PARENT-001 | 新建子任务 | P0 | - | - | 待开发 | |
| PARENT-002 | 将普通任务缩进或提升层级 | P0 | - | - | 待开发 | |
| PARENT-003 | 折叠和展开子任务 | P0 | - | - | 待开发 | |
| PARENT-004 | 显示父任务完成进度 | P0 | - | - | 待开发 | |
| PARENT-005 | 子任务全部完成时自动完成父任务 | P0 | - | - | 待开发 | |
| PARENT-006 | 完成父任务弹窗确认 | P0 | - | - | 待开发 | |
| PARENT-007 | 重新打开父任务时选择是否恢复子任务 | P0 | - | - | 待开发 | |
| PARENT-008 | 删除父任务时子任务一起进入回收站 | P0 | - | - | 待开发 | |
| PARENT-009 | 恢复父任务时完整恢复子任务 | P0 | - | - | 待开发 | |
| PARENT-010 | 禁止循环引用 | P0 | - | - | 待开发 | |

---

## 6. 时间与重复 (TIME)

| ID | 需求 | 优先级 | 实现文件 | 测试文件 | 状态 | 阻塞原因 |
|---|---|---|---|---|---|---|
| TIME-001 | 区分计划日期、计划时间、截止时间和提醒时间 | P0 | lib/time.ts | lib/__tests__/time.test.ts | 已实现 | |
| TIME-002 | 所有精确时间保存 UTC | P0 | lib/time.ts | - | 已实现 | |
| TIME-003 | 全天任务按本地日期存储 | P0 | lib/time.ts | - | 已实现 | |
| TIME-004 | 系统时区改变后重新计算提醒 | P0 | - | - | 待开发 | |
| TIME-005 | 允许一个任务设置多个提醒 | P0 | - | - | 待开发 | |
| REC-001 | 每天重复 | P0 | lib/recurrence.ts | lib/__tests__/recurrence.test.ts | 已实现 | |
| REC-002 | 每个工作日重复 | P0 | - | - | 待开发 | |
| REC-003 | 每周指定星期重复 | P0 | lib/recurrence.ts | - | 已实现 | |
| REC-004 | 每月指定日期重复 | P0 | lib/recurrence.ts | - | 已实现 | |
| REC-005 | 每年指定日期重复 | P0 | - | - | 待开发 | |
| REC-006 | 完成后每隔 N 天 | P0 | - | - | 待开发 | |
| REC-007 | 设置重复开始日期和结束日期 | P0 | lib/recurrence.ts | - | 已实现 | |
| REC-008 | 完成本次后生成下一次实例 | P0 | lib/recurrence.ts | - | 已实现 | |
| REC-009 | 支持跳过本次 | P0 | lib/recurrence.ts | - | 已实现 | |

---

## 7. 提醒 (REMINDER)

| ID | 需求 | 优先级 | 实现文件 | 测试文件 | 状态 | 阻塞原因 |
|---|---|---|---|---|---|---|
| REM-001 | 建立独立的提醒调度服务 | P0 | lib/reminder.ts | - | 已实现 | |
| REM-002 | 应用启动时加载未来提醒 | P0 | lib/reminder.ts | - | 已实现 | |
| REM-003 | 任务修改后取消旧提醒并重新调度 | P0 | - | - | 待开发 | |
| REM-004 | 应用从睡眠恢复时扫描错过的提醒 | P0 | lib/reminder.ts | - | 已实现 | |
| REM-005 | 主窗口关闭到托盘后提醒继续运行 | P0 | - | - | 待开发 | |
| REM-006 | 通知点击后打开对应任务 | P0 | - | - | 待开发 | |
| REM-007 | 支持"完成"和"稍后提醒" | P0 | lib/reminder.ts | - | 已实现 | |
| REM-008 | 稍后提醒支持 10 分钟、1 小时、明天 | P0 | lib/reminder.ts | - | 已实现 | |
| REM-009 | 安静时段内将普通提醒延后 | P0 | lib/reminder.ts | - | 已实现 | |

---

## 8. 同步 (SYNC)

| ID | 需求 | 优先级 | 实现文件 | 测试文件 | 状态 | 阻塞原因 |
|---|---|---|---|---|---|---|
| SYNC-001 | 每次本地写操作生成唯一 operation_id | P0 | lib/sync.ts | - | 已实现 | |
| SYNC-002 | 服务端重复收到同一 operation_id 不重复执行 | P0 | services/api/services/sync.py | - | 已实现 | |
| SYNC-003 | 服务端分配递增游标 | P0 | services/api/services/sync.py | - | 已实现 | |
| SYNC-004 | 客户端通过游标增量拉取 | P0 | lib/sync.ts | - | 已实现 | |
| SYNC-005 | 删除通过 tombstone 同步 | P0 | - | - | 待开发 | |
| SYNC-006 | 冲突检测和解决 | P0 | - | - | 待开发 | |
| SYNC-007 | 两台设备同步不产生重复任务 | P0 | - | - | 待开发 | |

---

## 9. 认证 (AUTH)

| ID | 需求 | 优先级 | 实现文件 | 测试文件 | 状态 | 阻塞原因 |
|---|---|---|---|---|---|---|
| AUTH-001 | 创建管理员命令或初始化流程 | P0 | - | - | 待开发 | |
| AUTH-002 | 密码使用 Argon2id 哈希 | P0 | services/api/services/auth.py | - | 已实现 | |
| AUTH-003 | 登录返回 Access Token 和 Refresh Token | P0 | services/api/api/v1/auth.py | - | 已实现 | |
| AUTH-004 | Refresh Token 只保存哈希值 | P0 | services/api/services/auth.py | - | 已实现 | |
| AUTH-005 | 客户端 Token 保存到安全凭据存储 | P0 | - | - | 待开发 | |
| AUTH-006 | 实现刷新、退出和 Token 撤销 | P0 | services/api/api/v1/auth.py | - | 已实现 | |

---

## 10. AI 解析 (AI)

| ID | 需求 | 优先级 | 实现文件 | 测试文件 | 状态 | 阻塞原因 |
|---|---|---|---|---|---|---|
| AI-001 | 定义统一 TaskParserProvider 接口 | P0 | services/api/services/ai/provider.py | - | 已实现 | |
| AI-002 | 支持配置模型名称、API Base、API Key | P0 | services/api/core/config.py | - | 已实现 | |
| AI-003 | 密钥只保存在服务端环境变量 | P0 | .env.example | - | 已实现 | |
| AI-004 | 模型不可用时允许退回普通任务创建 | P0 | - | - | 待开发 | |
| AI-005 | 接收用户原文、当前时间、时区 | P0 | services/api/services/ai/parser.py | - | 已实现 | |
| AI-006 | 强制模型按 JSON Schema 输出 | P0 | services/api/services/ai/deepseek.py | - | 已实现 | |
| AI-007 | 服务端再次校验标题、日期、层级 | P0 | - | - | 待开发 | |
| AI-008 | 返回解析置信度和警告列表 | P0 | services/api/services/ai/provider.py | - | 已实现 | |
| AI-009 | 原文被视为数据，防止提示注入 | P0 | services/api/services/ai/deepseek.py | - | 已实现 | |
| AI-010 | 单次最多生成 20 个任务 | P0 | - | - | 待开发 | |
| AI-011 | 快速添加框区分普通创建和 AI 创建 | P0 | App.tsx | - | 已实现 | 基础实现 |
| AI-012 | 高置信度结果可直接进入 Inbox | P0 | - | - | 待开发 | |
| AI-013 | 低置信度结果显示确认卡片 | P0 | - | - | 待开发 | |
| AI-014 | AI 失败时保留原始文字 | P0 | - | - | 待开发 | |

---

## 11. 回收站 (TRASH)

| ID | 需求 | 优先级 | 实现文件 | 测试文件 | 状态 | 阻塞原因 |
|---|---|---|---|---|---|---|
| TRASH-001 | 所有删除默认进入回收站 | P0 | App.tsx | - | 已实现 | 使用 localStorage |
| TRASH-002 | 删除后显示即时撤销 | P0 | - | - | 待开发 | |
| TRASH-003 | 回收站显示原项目、删除时间和剩余保留天数 | P0 | App.tsx | - | 已实现 | 基础实现 |
| TRASH-004 | 支持单个和批量恢复 | P0 | App.tsx | - | 已实现 | |
| TRASH-005 | 恢复父任务时一并恢复其子任务 | P0 | - | - | 待开发 | |
| TRASH-006 | 支持手动永久删除并二次确认 | P0 | App.tsx | - | 已实现 | |
| TRASH-007 | 30 天后后台物理清理 | P0 | - | - | 待开发 | |
| TRASH-008 | 清理前确保删除墓碑已同步 | P0 | - | - | 待开发 | |

---

## 12. 导入导出 (IMPORT/EXPORT)

| ID | 需求 | 优先级 | 实现文件 | 测试文件 | 状态 | 阻塞原因 |
|---|---|---|---|---|---|---|
| IMPORT-001 | 支持标准 CSV | P0 | App.tsx | - | 已实现 | 基础实现 |
| IMPORT-002 | 支持本软件完整 JSON 备份 | P0 | App.tsx | - | 已实现 | |
| IMPORT-003 | 自动识别 UTF-8、UTF-8 BOM | P0 | - | - | 待开发 | |
| IMPORT-004 | 提供列名和字段映射 | P0 | - | - | 待开发 | |
| IMPORT-005 | 导入前预览前若干条数据 | P0 | - | - | 待开发 | |
| IMPORT-006 | 检测重复 ID 和疑似重复任务 | P0 | - | - | 待开发 | |
| IMPORT-007 | 导入使用事务或独立批次 ID | P0 | - | - | 待开发 | |
| IMPORT-008 | 支持整批撤销 | P0 | - | - | 待开发 | |
| EXPORT-001 | 导出完整 JSON | P0 | App.tsx | - | 已实现 | |
| EXPORT-002 | 导出通用 CSV | P0 | App.tsx | - | 已实现 | |
| EXPORT-003 | 导出文件包含格式版本和创建时间 | P0 | App.tsx | - | 已实现 | |
| BACKUP-001 | 提供手动本地备份 | P0 | App.tsx | - | 已实现 | |
| BACKUP-002 | 提供一键恢复并显示影响范围 | P0 | App.tsx | - | 已实现 | 基础实现 |
| BACKUP-003 | 恢复前自动备份当前数据库 | P0 | - | - | 待开发 | |
| BACKUP-004 | 备份和恢复均校验文件完整性 | P0 | - | - | 待开发 | |

---

## 13. Windows 外壳 (WIN)

| ID | 需求 | 优先级 | 实现文件 | 测试文件 | 状态 | 阻塞原因 |
|---|---|---|---|---|---|---|
| WIN-001 | 保存并恢复窗口大小、位置和最大化状态 | P0 | lib/window.ts | - | 已实现 | |
| WIN-002 | 双屏环境下验证窗口不会恢复到不可见区域 | P0 | - | - | 待开发 | |
| WIN-003 | 支持浅色、深色和跟随系统主题 | P0 | - | - | 待开发 | |
| WIN-004 | 支持 100%、125%、150%、200% DPI 缩放 | P0 | - | - | 待开发 | |
| WIN-005 | 防止启动多个应用实例 | P0 | - | - | 待开发 | |
| WIN-006 | 第二次启动时唤醒已有窗口 | P0 | - | - | 待开发 | |
| TRAY-001 | 创建托盘图标 | P0 | lib/tray.ts | - | 已实现 | |
| TRAY-002 | 单击托盘图标显示或隐藏主窗口 | P0 | lib/tray.ts | - | 已实现 | |
| TRAY-003 | 托盘菜单包含快速添加、今天、同步、设置、退出 | P0 | lib/tray.ts | - | 已实现 | |
| TRAY-004 | 点击窗口关闭按钮时默认隐藏到托盘 | P0 | - | - | 待开发 | |
| TRAY-005 | 真正退出前提示"退出后将无法收到本地提醒" | P0 | - | - | 待开发 | |
| KEY-001 | Ctrl+N：新建普通任务 | P0 | lib/shortcuts.ts | - | 已实现 | |
| KEY-002 | Ctrl+K：全局搜索 | P0 | lib/shortcuts.ts | - | 已实现 | |
| KEY-003 | Ctrl+Enter：保存任务 | P0 | lib/shortcuts.ts | - | 已实现 | |
| KEY-004 | Esc：关闭详情或弹窗 | P0 | lib/shortcuts.ts | - | 已实现 | |

---

## 14. 部署安全 (DEPLOY)

| ID | 需求 | 优先级 | 实现文件 | 测试文件 | 状态 | 阻塞原因 |
|---|---|---|---|---|---|---|
| DEPLOY-001 | API、PostgreSQL 分容器部署 | P0 | infra/docker/docker-compose.yml | - | 已实现 | |
| DEPLOY-002 | PostgreSQL 不直接暴露公网端口 | P0 | infra/docker/docker-compose.yml | - | 已实现 | |
| DEPLOY-003 | Caddy 自动配置 HTTPS | P0 | infra/docker/Caddyfile | - | 待开发 | 当前只监听 :80 |
| DEPLOY-004 | 只允许必要来源和方法，配置严格 CORS | P0 | services/api/main.py | - | 已实现 | |
| DEPLOY-005 | 配置容器健康检查和自动重启 | P0 | infra/docker/docker-compose.yml | - | 已实现 | |
| DEPLOY-006 | 配置数据库每日备份和保留周期 | P0 | infra/scripts/backup-db.sh | - | 已实现 | |
| DEPLOY-007 | 实际执行一次全量恢复演练 | P0 | - | - | 待开发 | |
| DEPLOY-008 | 删除所有生产默认密码 | P0 | - | - | 待开发 | |

---

## 统计摘要

| 状态 | 数量 | 百分比 |
|---|---|---|
| 已实现 | 68 | 47% |
| 待开发 | 76 | 53% |
| 已验证 | 0 | 0% |
| 不通过 | 0 | 0% |
| **总计** | **144** | **100%** |

---

## 待开发优先级排序

### 第一优先级（P0-1 架构收敛）
1. DATA-001 ~ DATA-008：切换到 Repository -> SQLite
2. TASK-005 ~ TASK-011：补齐任务 CRUD
3. VIEW-005：无日期任务视图
4. SEARCH-002 ~ SEARCH-006：筛选排序

### 第二优先级（P0-2 功能补全）
1. PARENT-001 ~ PARENT-010：父子任务
2. TIME-004 ~ TIME-005：时区和多提醒
3. REC-002, REC-005, REC-006：重复规则补全
4. REM-003, REM-005, REM-006：提醒补全

### 第三优先级（P0-3 ~ P0-6）
1. SYNC-005 ~ SYNC-007：同步冲突
2. AUTH-001, AUTH-005：管理员和安全存储
3. AI-004, AI-007, AI-010 ~ AI-014：AI 补全
4. TRASH-005, TRASH-007, TRASH-008：回收站补全
5. IMPORT-003 ~ IMPORT-008, BACKUP-003 ~ BACKUP-004：导入导出补全

---

> 本文档是需求、实现、测试、发布的唯一事实来源
