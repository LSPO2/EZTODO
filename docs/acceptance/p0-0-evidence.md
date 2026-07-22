# P0-0 验收证据

> 执行日期：2026-07-22
> 文档版本：v2.0（修正版）

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

## 2. 矩阵覆盖验证

### 源文档统计

```bash
$ grep -c '\[P0\]' PC端AI_Todo开发任务清单.md
388
```

### 矩阵统计

```bash
$ grep -c '| P0 |' docs/acceptance/requirements-matrix.md
388
```

### 缺失项已补齐

| 原始行号 | 矩阵 ID | 需求 |
|---|---|---|
| 283 | M1-FLD-018 | source_capture_id 对应 AI 原始输入 |
| 425 | M2-REC-011 | 月末、闰年和夏令时边界测试 |
| 681 | M5-IMP-007 | 无效日期、层级或提醒进入错误报告 |
| 684 | M5-IMP-010 | 大文件导入显示进度并允许取消 |

---

## 3. 质量门禁脚本

### 根 package.json

```json
{
  "check:frontend": "npm run lint && npm run test && npm run build",
  "check:api": "cd services/api && python -m pytest tests/ -v",
  "check:matrix": "node scripts/verify-matrix.js",
  "check:all": "npm run check:frontend && npm run check:matrix"
}
```

### 校验脚本

- `scripts/verify-matrix.js` - Node.js 版本（跨平台）
- `scripts/verify-matrix.sh` - Bash 版本
- `scripts/verify-matrix.bat` - Windows 版本

---

## 4. 验收命令执行结果

### 前端检查

```bash
$ npm run lint
✖ 71 problems (0 errors, 71 warnings)
Exit code: 0 ✓
```

```bash
$ npm test
Test Files  6 passed (6)
Tests       40 passed (40)
Exit code: 0 ✓
```

```bash
$ npm run build
✓ built in 178ms
Exit code: 0 ✓
```

### 后端检查

```bash
$ python -m pytest tests/test_ai_parser.py -v
========================= 18 passed in 19.82s =========================
Exit code: 0 ✓
```

### 矩阵校验

```bash
$ node scripts/verify-matrix.js
=== Matrix Coverage Verification ===
Source P0 count: 388
Matrix P0 count: 388
PASS: Matrix covers all 388 P0 items
Exit code: 0 ✓
```

### Git 检查

```bash
$ git diff --check
(无输出)
Exit code: 0 ✓
```

---

## 5. 当前 Git 状态

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

## 6. 剩余风险

1. **Tauri 环境验证**：所有功能需要在 Tauri 环境验证
2. **SQLite 真源**：当前使用 localStorage，需要 P0-1 切换到 SQLite
3. **性能测试**：10,000 条任务测试未执行
4. **Windows 兼容性**：需要实际 Windows 环境验证
5. **历史提交污染**：fb39590 提交混入了 P0-2 WIP

---

## 7. 建议提交信息

```
fix(p0-0): complete matrix coverage and unify quality gates

- Add 4 missing P0 items to requirements matrix
- Add matrix coverage verification script
- Unify check:frontend, check:api, check:all in package.json
- Update check-all.bat to use consistent logic
- Correct evidence document to reflect actual history
```
