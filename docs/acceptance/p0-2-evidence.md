# P0-2 验收证据

> 更新时间：2026-07-23（整改复验）  
> 当前结论：自动化验收通过；Tauri 原生构建和实机验收尚未完成，不能标记为最终验收通过。

## 本轮修复

### 1. SQLite 事务、batch_id 与 outbox

- Tauri Repository 组合根现在为原生数据库注入 `transaction()`，实际执行 `BEGIN IMMEDIATE TRANSACTION / COMMIT / ROLLBACK`。
- Tauri SQLite 初始化失败时停止启动并报错，不再静默降级到 Browser/localStorage。
- 新增 migration v5：为 `sync_outbox` 增加 `batch_id` 和索引。
- 批量完成、删除、恢复、更新优先级/项目，以及批量添加/移除标签均在单个 Repository 事务中执行。
- 标签关系变化也写入 outbox，并复用同一 `batch_id`。
- 撤销使用 `restoreSnapshots()` 在一个事务内恢复任务字段和标签关系；撤销本身写入统一 outbox 批次。
- 失败或部分失败的批量结果不再进入撤销栈；撤销失败时保留撤销项以便重试。

自动化证据：

- `sqlite-repository.test.ts` 验证共享 batch_id、失败回滚结果、原子快照恢复、标签 outbox。
- `batch-service.test.ts` 验证批量命令、撤销栈和失败语义。

### 2. 父子任务一致性

- 父任务连带完成/重开、子树删除和子树恢复改为 Repository 批量事务。
- 最后一个子任务完成时，所有满足条件的祖先和当前任务进入同一事务、同一 outbox 批次。
- 完成/重开覆盖全部后代，不只处理直接子任务。
- 保留最多 3 层、循环移动拦截、完整 trash 子树恢复和截止时间倒挂 warning。
- 缩进/提升错误不再静默吞掉，UI 会显示失败信息。

### 3. 命令和 UI 接线

以下命令已通过 Store/TaskService/BatchService/Repository 调用链实现：

- create、update、complete、reopen、softDelete、restore
- copyTask、moveTaskToProject、setTaskPriority
- addTag、removeTag、reorderSiblingTasks

App 已增加复制按钮和同级上移/下移入口。

### 4. 搜索、筛选和排序

- 搜索文本写入现有 `TaskFilters` 后调用 `findByView()`，可与其他筛选组合，不再绕过当前筛选。
- UI 已接入项目、标签、优先级、状态筛选。
- UI 已接入计划时间、截止时间、创建时间、手动顺序和升/降序。
- UI 已接入“仅父任务”“展开全部子任务”“收起全部”和一键清除。
- SQLite 标签筛选使用每个标签一个 `EXISTS` 条件，语义为 AND。
- 修正 SQLite 日期表达式，移除不兼容 SQLite 的 `INTERVAL` 写法。
- Store 查询根任务后递归加载后代，使展开控制能够显示实际子树。

### 5. 可见撤销和组件测试

- 撤销栏独立于 `selectedTaskIds.size > 0`。
- 批量成功清空选择后，撤销按钮仍然可见和可点击。
- `App.test.tsx` 真实渲染组件，验证撤销入口和筛选/排序/父任务控件接线。

### 6. 10,000 条性能

查询数据集：固定 seed=42，10,000 条，warmup=3，每项 20 个样本，查询阈值 P95 < 200ms。

本次 `npm.cmd run check:all` 实测：

| 场景 | P50 | P95 | Max |
|---|---:|---:|---:|
| today | 20.58ms | 25.68ms | 29.13ms |
| inbox | 21.63ms | 25.31ms | 25.36ms |
| completed | 20.50ms | 27.08ms | 27.13ms |
| search | 16.97ms | 23.39ms | 23.90ms |
| project | 21.96ms | 25.27ms | 25.73ms |
| priority | 18.22ms | 22.26ms | 23.01ms |
| tag | 18.03ms | 20.81ms | 20.88ms |
| combined | 14.27ms | 24.02ms | 28.86ms |

渲染测试使用同一规模的 10,000 条固定数据，App 首屏限制为 20 个根任务并提供“加载更多”。warmup=3、样本=10，本次实测：P50 201.99ms、P95 233.07ms、Max 233.07ms；测试阈值为 250ms。

说明：这些结果来自 jsdom/Browser Repository 自动化环境，不等同于 Tauri WebView + SQLite 实机性能。

## 完整自动化结果

执行命令：

```text
npm.cmd run check:all
```

结果：

| 检查 | 结果 |
|---|---|
| 前端测试 | 19 个文件、157 项通过、0 失败 |
| TypeScript | 0 errors |
| ESLint | 0 errors、69 warnings |
| 前端构建 | 通过 |
| API pytest | 18 passed |
| P0 矩阵 | source 388 / unique 388 |
| git diff --check | 通过；仅换行提示 |

## Tauri 验证状态

尝试执行：

```text
npm.cmd run tauri -w apps/desktop -- build --no-bundle
```

结果：未执行到编译阶段，当前机器找不到 `cargo`：

```text
failed to run 'cargo metadata': program not found
```

因此以下项目仍未验证：

1. migration v5 在真实旧数据库上的升级。
2. SQLite 重启持久化。
3. 真实 SQLite 故障注入后的回滚和 outbox 状态。
4. 通知出现、稍后提醒、完成动作和通知点击导航。
5. 托盘、关闭到托盘、窗口恢复和全局快捷键。
6. 旧 localStorage 数据迁移到真实 SQLite。
7. Tauri WebView + SQLite 的 10,000 条查询和渲染性能。

## 最终判定

P0-2 的代码整改和自动化验收已经完成，当前状态应标记为：

**自动化通过 / Tauri 原生构建与实机验收待完成。**

在安装 Rust/Cargo 并完成上述实机场景前，不应写成“P0-2 最终验收通过”。