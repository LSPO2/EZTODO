# 父子任务规则详细设计

> 文档版本：v1.0
> 编制日期：2026-07-22
> 关联文档：[product-rules.md](./product-rules.md)

---

## 1. 层级结构

### 1.1 层级定义

```
Level 0: 顶级任务 (parent_id = NULL)
  └── Level 1: 子任务 (parent_id = 顶级任务ID)
       └── Level 2: 孙任务 (parent_id = 子任务ID)
```

### 1.2 层级约束

| 约束 | 规则 | 实现方式 |
|---|---|---|
| 最大层级 | 3 级 | 创建/移动时检查祖先层级 |
| 循环引用 | 禁止 | 移动前遍历目标祖先链 |
| 孤儿节点 | 禁止 | 外键约束 + 级联删除 |

---

## 2. 完成联动规则

### 2.1 自动完成父任务

**触发条件**：所有子任务状态变为 `done`

**执行逻辑**：
```python
def check_parent_completion(parent_id: str):
    """检查父任务是否应该自动完成"""
    parent = get_task(parent_id)
    children = get_children(parent_id)
    
    # 所有子任务都已完成
    if all(child.status == 'done' for child in children):
        parent.status = 'done'
        parent.completed_at = now()
        save_task(parent)
        
        # 递归检查祖父任务
        if parent.parent_id:
            check_parent_completion(parent.parent_id)
```

**事务要求**：
- 在单个数据库事务内执行
- 所有变化写入同步队列

### 2.2 手动完成父任务

**触发条件**：用户手动完成一个有未完成子任务的父任务

**执行流程**：
```
用户点击完成 → 检查子任务状态 → 弹出确认框
                                      ↓
                              ┌───────┴───────┐
                              ↓               ↓
                        仅完成父任务    同时完成所有子任务
                              ↓               ↓
                        父任务=done      父任务=done
                        子任务=不变      所有子任务=done
                              ↓               ↓
                        写入同步队列    写入同步队列
```

**确认框文案**：
```
标题：完成任务
内容：该任务有 X 个未完成的子任务

[仅完成父任务]  [同时完成所有子任务]  [取消]
```

### 2.3 重新打开父任务

**触发条件**：用户重新打开一个已完成的父任务

**执行流程**：
```
用户点击恢复 → 弹出确认框
                      ↓
              ┌───────┴───────┐
              ↓               ↓
        仅恢复父任务    同时恢复所有子任务
              ↓               ↓
        父任务=todo      父任务=todo
        子任务=不变      所有子任务=todo
              ↓               ↓
        写入同步队列    写入同步队列
```

**确认框文案**：
```
标题：重新打开任务
内容：是否同时恢复所有子任务？

[仅恢复父任务]  [同时恢复所有子任务]  [取消]
```

---

## 3. 删除联动规则

### 3.1 软删除

**规则**：父任务软删除时，所有子孙任务一起进入回收站

**执行逻辑**：
```python
def soft_delete_task(task_id: str):
    """软删除任务及其所有子孙"""
    task = get_task(task_id)
    descendants = get_all_descendants(task_id)
    
    # 在事务内执行
    with transaction():
        # 删除当前任务
        task.deleted_at = now()
        save_task(task)
        
        # 递归删除所有子孙
        for desc in descendants:
            desc.deleted_at = now()
            save_task(desc)
            
        # 写入同步队列
        for item in [task] + descendants:
            add_to_sync_outbox(item, operation='update')
```

### 3.2 恢复

**规则**：恢复父任务时，一并恢复其子任务

**执行逻辑**：
```python
def restore_task(task_id: str):
    """恢复任务及其所有子孙"""
    task = get_task(task_id)
    descendants = get_all_descendants(task_id)
    
    with transaction():
        # 恢复当前任务
        task.deleted_at = None
        save_task(task)
        
        # 恢复所有子孙
        for desc in descendants:
            desc.deleted_at = None
            save_task(desc)
            
        # 写入同步队列
        for item in [task] + descendants:
            add_to_sync_outbox(item, operation='update')
```

### 3.3 永久删除

**规则**：永久删除前必须确认所有活动设备已收到删除事件

**检查逻辑**：
```python
def can_permanently_delete(task_id: str) -> bool:
    """检查是否可以永久删除"""
    # 检查删除墓碑是否已同步到所有设备
    tombstone = get_sync_tombstone(task_id)
    active_devices = get_active_devices()
    
    for device in active_devices:
        if not tombstone.synced_to_device(device.id):
            return False
    return True
```

---

## 4. 移动规则

### 4.1 移动到其他父任务

**约束检查**：
1. 目标父任务不能是自己的子孙（防止循环）
2. 移动后层级不能超过 3 级
3. 目标父任务不能是已删除状态

**执行逻辑**：
```python
def move_task(task_id: str, new_parent_id: Optional[str]):
    """移动任务到新的父任务"""
    task = get_task(task_id)
    
    # 检查循环引用
    if new_parent_id:
        if is_ancestor(task_id, new_parent_id):
            raise CircularReferenceError("不能移动到自己的子孙下面")
    
    # 检查层级深度
    if new_parent_id:
        new_depth = get_task_depth(new_parent_id) + 1
        max_descendant_depth = get_max_descendant_depth(task_id)
        if new_depth + max_descendant_depth > 3:
            raise MaxDepthError("移动后层级超过 3 级")
    
    # 执行移动
    with transaction():
        old_parent_id = task.parent_id
        task.parent_id = new_parent_id
        save_task(task)
        
        # 写入同步队列
        add_to_sync_outbox(task, operation='update')
```

### 4.2 循环引用检测

**算法**：
```python
def is_ancestor(ancestor_id: str, descendant_id: str) -> bool:
    """检查 ancestor_id 是否是 descendant_id 的祖先"""
    current = get_task(descendant_id)
    while current.parent_id:
        if current.parent_id == ancestor_id:
            return True
        current = get_task(current.parent_id)
    return False
```

**示例**：
```
任务 A
  └── 任务 B
       └── 任务 C

移动 A 到 C 下面 → 拒绝（A 是 C 的祖先）
移动 C 到 A 下面 → 允许（已经是）
移动 B 到 C 下面 → 拒绝（B 是 C 的父任务）
```

---

## 5. 进度显示

### 5.1 父任务进度

**显示格式**：`已完成数/总子任务数`

**计算逻辑**：
```python
def get_task_progress(task_id: str) -> Tuple[int, int]:
    """获取任务进度 (completed, total)"""
    children = get_children(task_id)
    total = len(children)
    completed = sum(1 for c in children if c.status == 'done')
    return (completed, total)
```

**UI 显示**：
- 任务标题旁显示 `[3/5]`
- 进度条显示完成百分比
- 全部完成时显示 ✅

### 5.2 递归进度

**规则**：只计算直接子任务，不递归计算孙任务

**原因**：
- 递归计算会让进度显示复杂
- 用户通常只关心直接子任务的完成情况
- 孙任务的进度由子任务自己显示

---

## 6. 同步处理

### 6.1 级联操作同步

**规则**：父子任务联动产生的每个变化都进入同步队列

**示例**：
```
操作：完成父任务（同时完成所有子任务）
同步队列：
  1. 父任务 status → done
  2. 子任务1 status → done
  3. 子任务2 status → done
  4. 子任务3 status → done
```

### 6.2 冲突处理

**场景**：一台设备完成父任务，另一台完成部分子任务

**处理策略**：
```
设备 A：完成父任务（同时完成所有子任务）
设备 B：完成子任务 1

同步后结果：
- 父任务：done（来自设备 A）
- 子任务 1：done（两边都是 done）
- 子任务 2：done（来自设备 A）
- 子任务 3：done（来自设备 A）
```

---

## 7. 测试用例

### 7.1 完成联动测试

| 测试 | 输入 | 预期 |
|---|---|---|
| 自动完成 | 完成最后一个子任务 | 父任务自动完成 |
| 手动完成（仅父） | 有未完成子任务，选择"仅完成父任务" | 父任务完成，子任务不变 |
| 手动完成（全部） | 有未完成子任务，选择"同时完成所有子任务" | 全部完成 |
| 重新打开（仅父） | 选择"仅恢复父任务" | 父任务恢复，子任务不变 |
| 重新打开（全部） | 选择"同时恢复所有子任务" | 全部恢复 |

### 7.2 循环引用测试

| 测试 | 操作 | 预期 |
|---|---|---|
| 移动到子孙 | 把 A 移动到 C 下面（A→B→C） | 拒绝 |
| 移动到自己 | 把 A 移动到 A 下面 | 拒绝 |
| 正常移动 | 把 C 移动到 A 下面 | 允许 |

### 7.3 删除恢复测试

| 测试 | 操作 | 预期 |
|---|---|---|
| 删除父任务 | 删除有子任务的父任务 | 全部进入回收站 |
| 恢复父任务 | 从回收站恢复父任务 | 全部恢复 |
| 永久删除 | 永久删除未同步的任务 | 拒绝 |

---

## 8. 数据库设计

### 8.1 tasks 表相关字段

```sql
CREATE TABLE tasks (
    id UUID PRIMARY KEY,
    parent_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
    -- 其他字段...
    deleted_at TIMESTAMP WITH TIME ZONE,
    revision INTEGER DEFAULT 1
);

-- 索引
CREATE INDEX idx_tasks_parent_id ON tasks(parent_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_tasks_deleted_at ON tasks(deleted_at) WHERE deleted_at IS NOT NULL;
```

### 8.2 层级深度查询

```sql
-- 查询任务的层级深度
WITH RECURSIVE ancestors AS (
    SELECT id, parent_id, 0 as depth
    FROM tasks WHERE id = :task_id
    UNION ALL
    SELECT t.id, t.parent_id, a.depth + 1
    FROM tasks t
    JOIN ancestors a ON t.id = a.parent_id
)
SELECT MAX(depth) FROM ancestors;
```

---

> 本文档定义了父子任务的核心规则，实现时需要严格按照规则执行
