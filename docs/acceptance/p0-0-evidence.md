# P0-0 验收证据

> 执行日期：2026-07-22
> 文档版本：v3.0（最终整改版）

---

## 1. 历史提交范围污染说明

**提交 fb39590 存在范围污染**：

该提交声称完成 P0-0，但实际混入了以下不应属于 P0-0 的文件：

| 文件 | 问题 |
|---|---|
| `apps/desktop/src/App.tsx` | 包含 P0-2 WIP（localStorage 直接访问） |
| `apps/desktop/src/lib/database/index.ts` | 包含 P0-2 WIP（浏览器适配器改动） |
| `改进方案v2.md` | 不应提交到仓库 |

**本次提交只处理 P0-0 文档、脚本和门禁**，不触碰任何业务模块。

---

## 2. 质量门禁命令与执行顺序

### 门禁脚本

```bash
# 前端门禁
npm run check:frontend  # dependency lock check -> lint -> tsc --noEmit -> test -> build

# API 门禁
npm run check:api       # 使用项目 venv 执行 pytest

# 矩阵校验
npm run check:matrix    # 原始行号集合比较

# Git 检查
npm run check:git       # git diff --check

# 统一门禁
npm run check:all       # check:frontend -> check:api -> check:matrix -> check:git
```

### Windows 批处理

```bash
check-all.bat           # 调用 npm run check:all
```

---

## 3. API 门禁说明

- 使用项目虚拟环境：`services/api/venv/Scripts/python.exe`
- 若虚拟环境不存在，输出清晰错误并以非 0 退出
- 不静默退回到全局 Python
- 执行 `python -m pytest tests/ -v`

---

## 4. 矩阵校验说明

- 从源文档解析全部 `[P0]` 的原始行号
- 从矩阵解析每条 P0 的 `原文行号`
- 集合比对，检测：
  - 源清单中存在、矩阵缺失的原始行号
  - 矩阵中存在、源清单不存在的原始行号
  - 矩阵中重复的 `原文行号`
- 任一问题存在时以非 0 退出

---

## 5. 验收命令执行结果

### check:frontend

```bash
$ npm run check:frontend
# dependency lock check
npm ci --dry-run --ignore-scripts
# lockfile and manifest are consistent
# lint
✖ 71 problems (0 errors, 71 warnings)
# tsc --noEmit
(no output, success)
# test
Test Files  6 passed (6)
Tests       40 passed (40)
# build
✓ built in 111ms
Exit code: 0 ✓
```

### check:api

```bash
$ npm run check:api
=== API Quality Gate ===
[1/2] Checking pytest availability...
[✓] pytest available

[2/2] Running pytest...
tests/test_ai_parser.py::test_parse_tomorrow_afternoon PASSED
... (18 tests)
========================= 18 passed in 18.70s =========================
[✓] API quality gate passed
Exit code: 0 ✓
```

### check:matrix

```bash
$ npm run check:matrix
=== Matrix Coverage Verification ===
Source P0 count: 388
Matrix unique P0 count: 388

PASS: Matrix covers all P0 items correctly
Exit code: 0 ✓
```

### check:all

```bash
$ npm run check:all
# check:frontend ✓
# check:api ✓
# check:matrix ✓
# check:git ✓
Exit code: 0 ✓
```

### check-all.bat

```bash
$ check-all.bat
# 调用 npm run check:all
Exit code: 0 ✓
```

### git diff --check

```bash
$ git diff --check
(无输出)
Exit code: 0 ✓
```

---

## 6. 当前 Git 状态

### 已验证数量

**已验证 = 0**

原因：所有验收需要在 Tauri 环境执行，浏览器演示不构成验证。当前项目使用 localStorage 作为数据库，不是真正的 SQLite 真源。

### 已实现但未验证

以下项目有完整实现，但未在目标环境验证：

- M0 全部（文档、原型、工程基础）
- M1 部分（数据库初始化、数据表定义、基本 CRUD）
- M2 部分（时间工具、重复规则、提醒模块）
- M3 部分（认证 API、同步 API）
- M4 部分（AI Provider、解析流程）
- M5 部分（回收站、导入导出）

---

## 7. 剩余风险

1. **Tauri 环境验证**：所有功能需要在 Tauri 环境验证
2. **SQLite 真源**：当前使用 localStorage，需要 P0-1 切换到 SQLite
3. **性能测试**：10,000 条任务测试未执行
4. **Windows 兼容性**：需要实际 Windows 环境验证
5. **历史提交污染**：fb39590 提交混入了 P0-2 WIP

---

> 本文档如实记录 P0-0 验收状态，不包含未实际执行的命令
