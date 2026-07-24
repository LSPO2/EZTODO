/**
 * Task service layer
 * Encapsulates complex business logic for tasks
 */

import { getRepositories } from '../repositories'
import type {
  Task,
  CreateTaskRequest,
  UpdateTaskRequest,
  BatchResult,
  TaskPriority,
} from '../repositories'
import { validateTaskTitle } from '../repositories'
async function syncTaskReminder(task: Task): Promise<void> {
  const { reminderScheduler } = await import('../reminder')
  reminderScheduler.syncTask(task)
}

async function cancelTaskReminder(taskId: string): Promise<void> {
  const { reminderScheduler } = await import('../reminder')
  reminderScheduler.cancelTask(taskId)
}

async function advanceRecurrence(taskId: string): Promise<void> {
  const { generateNextInstance } = await import('../recurrence')
  await generateNextInstance(taskId)
}
export interface TaskServiceResult<T> {
  success: boolean
  data?: T
  error?: string
  warnings?: string[]
}

export class TaskService {
  /**
   * Create a new task with validation
   */
  async createTask(request: CreateTaskRequest): Promise<TaskServiceResult<Task>> {
    // Validate title
    const titleValidation = validateTaskTitle(request.title)
    if (!titleValidation.valid) {
      return { success: false, error: titleValidation.error }
    }

    // Validate depth if creating a child task
    if (request.parentId) {
      const depthCheck = await this.validateChildDepth(request.parentId)
      if (!depthCheck.success) {
        return { success: false, error: depthCheck.error }
      }
    }

    try {
      const repos = await getRepositories()
      const task = await repos.tasks.create(request)
      await syncTaskReminder(task)
      return { success: true, data: task }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  }

  /**
   * Update a task with validation
   */
  async updateTask(id: string, updates: UpdateTaskRequest): Promise<TaskServiceResult<Task>> {
    // Validate title if provided
    if (updates.title !== undefined) {
      const titleValidation = validateTaskTitle(updates.title)
      if (!titleValidation.valid) {
        return { success: false, error: titleValidation.error }
      }
    }

    try {
      const repos = await getRepositories()
      const previous = await repos.tasks.findById(id)
      if (!previous) {
        return { success: false, error: '\u4efb\u52a1\u4e0d\u5b58\u5728' }
      }
      const task = await repos.tasks.update(id, updates)
      await syncTaskReminder(task)

      // Check for due date warning: child due date later than parent
      const warnings: string[] = []
      if (task.parentId && (updates.dueAt !== undefined || task.dueAt)) {
        const parent = await repos.tasks.findById(task.parentId)
        if (parent?.dueAt && task.dueAt) {
          if (new Date(task.dueAt) > new Date(parent.dueAt)) {
            warnings.push('\u5b50\u4efb\u52a1\u622a\u6b62\u65f6\u95f4\u665a\u4e8e\u7236\u4efb\u52a1')
          }
        }
      }

      return { success: true, data: task, warnings: warnings.length > 0 ? warnings : undefined }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  }

  /**
   * Complete a task with parent-child logic.
   *
   * @param id            Task to complete
   * @param completeMode  'self' = only this task; 'withChildren' = also complete children; undefined = auto (no children → complete, has children → caller should ask)
   */
  async completeTask(id: string, completeMode?: 'self' | 'withChildren'): Promise<TaskServiceResult<Task>> {
    try {
      const repos = await getRepositories()
      const task = await repos.tasks.findById(id)
      if (!task) {
        return { success: false, error: '任务不存在' }
      }

      // If mode not specified and task has uncompleted children, caller must decide
      if (!completeMode) {
        const children = await repos.tasks.findByParentId(id)
        const activeChildren = children.filter(c => !c.deletedAt)
        const hasUncompleted = activeChildren.some(c => c.status !== 'done')
        if (hasUncompleted) {
          return { success: false, error: 'HAS_UNCOMPLETED_CHILDREN' }
        }
      }

      const changedDescendants = completeMode === 'withChildren'
        ? (await repos.tasks.getDescendants(id)).filter(descendant => descendant.status !== 'done')
        : []
      const completionIds = new Set<string>([id, ...changedDescendants.map(descendant => descendant.id)])
      const changedTasks = new Map<string, Task>([[task.id, task], ...changedDescendants.map(descendant => [descendant.id, descendant] as const)])

      // Walk upward before writing. Every auto-completed ancestor joins the same
      // repository batch, so task changes and outbox rows share one transaction.
      let ancestorId = task.parentId
      while (ancestorId) {
        const children = (await repos.tasks.findByParentId(ancestorId)).filter(child => !child.deletedAt)
        if (children.length === 0 || !children.every(child => child.status === 'done' || completionIds.has(child.id))) break
        completionIds.add(ancestorId)
        const ancestor = await repos.tasks.findById(ancestorId)
        if (ancestor) changedTasks.set(ancestor.id, ancestor)
        ancestorId = ancestor?.parentId ?? null
      }

      let completed: Task
      if (completionIds.size > 1) {
        const batch = await repos.tasks.batchUpdate([...completionIds], { status: 'done' })
        if (!batch.success) throw new Error(batch.errors.map(item => item.error).join('; '))
        completed = (await repos.tasks.findById(id))!
      } else {
        completed = await repos.tasks.update(id, { status: 'done' })
      }

      for (const changed of changedTasks.values()) {
        if (changed.status === 'done') continue
        await cancelTaskReminder(changed.id)
        await advanceRecurrence(changed.id)
      }

      return { success: true, data: completed }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  }

  /**
   * Reopen a task with option to also reopen ALL completed descendants (not just direct children).
   */
  async reopenTask(id: string, reopenChildren: boolean = false): Promise<TaskServiceResult<Task>> {
    try {
      const repos = await getRepositories()
      const task = await repos.tasks.findById(id)
      if (!task) {
        return { success: false, error: '任务不存在' }
      }

      let reopened: Task
      if (reopenChildren) {
        const descendants = await repos.tasks.getDescendants(id)
        const changedDescendants = descendants.filter(desc => desc.status === 'done')
        const ids = [...changedDescendants.map(desc => desc.id), id]
        const batch = await repos.tasks.batchUpdate(ids, { status: 'todo' })
        if (!batch.success) throw new Error(batch.errors.map(item => item.error).join('; '))
        reopened = (await repos.tasks.findById(id))!
        for (const descendant of changedDescendants) {
          await syncTaskReminder({ ...descendant, status: 'todo' })
        }
      } else {
        reopened = await repos.tasks.update(id, { status: 'todo' })
      }
      await syncTaskReminder(reopened)
      return { success: true, data: reopened }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  }

  /**
   * Check and auto-complete parent if all children are done
   */
  async checkAndAutoCompleteParent(parentId: string): Promise<boolean> {
    try {
      const repos = await getRepositories()
      const children = await repos.tasks.findByParentId(parentId)
      const activeChildren = children.filter(c => !c.deletedAt)

      if (activeChildren.length > 0 && activeChildren.every(c => c.status === 'done')) {
        const result = await this.completeTask(parentId)
        return result.success
      }
      return false
    } catch {
      return false
    }
  }

  /**
   * Move task to new parent with hierarchy validation
   */
  async moveTask(id: string, newParentId: string | null): Promise<TaskServiceResult<void>> {
    try {
      const repos = await getRepositories()

      if (newParentId === id) {
        return { success: false, error: '不能将任务移到自己下面' }
      }
      if (newParentId) {
        const descendants = await repos.tasks.getDescendants(id)
        if (descendants.some((task) => task.id === newParentId)) {
          return { success: false, error: '不能将任务移到自己的后代节点下面' }
        }
        const parent = await repos.tasks.findById(newParentId)
        if (!parent || parent.deletedAt) {
          return { success: false, error: '目标任务不存在' }
        }

        // Depth validation: max 3 levels (root=level1/depth0, child=level2/depth1, grandchild=level3/depth2)
        // "最多允许3层" = max depth 2. Reject when the resulting depth would be >= 3.
        const targetDepth = await this.getTaskDepth(newParentId)
        const maxDescendantDepth = await this.getMaxDescendantDepth(id)
        const resultingDepth = targetDepth + 1 + maxDescendantDepth
        if (resultingDepth >= 3) {
          return { success: false, error: '移动后层级超过3级' }
        }
      }

      await repos.tasks.moveTask(id, newParentId)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  }

  /**
   * Calculate depth of a task (root=0, child=1, grandchild=2)
   */
  async getTaskDepth(taskId: string): Promise<number> {
    const repos = await getRepositories()
    let depth = 0
    let currentId: string | null = taskId
    const visited = new Set<string>()
    while (currentId) {
      if (visited.has(currentId)) break // cycle protection
      visited.add(currentId)
      const task = await repos.tasks.findById(currentId)
      if (!task || !task.parentId) break
      depth++
      currentId = task.parentId
    }
    return depth
  }

  /**
   * Get max depth of all descendants of a task
   */
  async getMaxDescendantDepth(taskId: string): Promise<number> {
    const repos = await getRepositories()
    const children = await repos.tasks.findByParentId(taskId)
    if (children.length === 0) return 0
    const childDepths = await Promise.all(
      children.map(c => this.getMaxDescendantDepth(c.id))
    )
    return 1 + Math.max(...childDepths)
  }

  /**
   * Validate depth before creating a child task
   */
  async validateChildDepth(parentId: string): Promise<TaskServiceResult<void>> {
    const parentDepth = await this.getTaskDepth(parentId)
    if (parentDepth >= 2) {
      return { success: false, error: '最多允许3层任务，当前父任务已达到最大层级' }
    }
    return { success: true }
  }

  /**
   * Delete task with cascade
   */
  async deleteTask(id: string): Promise<TaskServiceResult<void>> {
    try {
      const repos = await getRepositories()
      const descendants = await repos.tasks.getDescendants(id)
      const ids = [...descendants.map(descendant => descendant.id), id]
      const batch = await repos.tasks.batchDelete(ids)
      if (!batch.success) throw new Error(batch.errors.map(item => item.error).join('; '))
      for (const taskId of ids) await cancelTaskReminder(taskId)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  }

  /**
   * Restore task with children
   */
  async restoreTask(id: string): Promise<TaskServiceResult<Task>> {
    try {
      const repos = await getRepositories()

      // `findByParentId` intentionally excludes deleted tasks, so build the
      // complete subtree from the trash view before restoring anything.
      const trashedTasks = await repos.tasks.findByView('trash')
      const childrenByParent = new Map<string, string[]>()
      for (const candidate of trashedTasks) {
        if (!candidate.parentId) continue
        const children = childrenByParent.get(candidate.parentId) ?? []
        children.push(candidate.id)
        childrenByParent.set(candidate.parentId, children)
      }
      const subtreeIds = [id]
      const pending = [...(childrenByParent.get(id) ?? [])]
      while (pending.length > 0) {
        const childId = pending.pop()!
        subtreeIds.push(childId)
        pending.push(...(childrenByParent.get(childId) ?? []))
      }
      const batch = await repos.tasks.batchRestore(subtreeIds)
      if (!batch.success) throw new Error(batch.errors.map(item => item.error).join('; '))
      const task = await repos.tasks.findById(id)
      if (!task) throw new Error('任务不存在')
      for (const taskId of subtreeIds) {
        const restored = await repos.tasks.findById(taskId)
        if (restored) await syncTaskReminder(restored)
      }
      return { success: true, data: task }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  }

  /**
   * Batch complete with result reporting
   */
  async batchComplete(ids: string[]): Promise<BatchResult> {
    const errors: Array<{ id: string; error: string }> = []
    let affectedCount = 0
    for (const id of ids) {
      const result = await this.completeTask(id)
      if (result.success) affectedCount++
      else errors.push({ id, error: result.error || 'Complete failed' })
    }
    return { success: errors.length === 0, affectedCount, errors, undoToken: null }
  }
  /**
   * Batch delete with result reporting
   */
  async batchDelete(ids: string[]): Promise<BatchResult> {
    const errors: Array<{ id: string; error: string }> = []
    let affectedCount = 0
    for (const id of ids) {
      const result = await this.deleteTask(id)
      if (result.success) affectedCount++
      else errors.push({ id, error: result.error || 'Delete failed' })
    }
    return { success: errors.length === 0, affectedCount, errors, undoToken: null }
  }
  /**
   * Batch restore with result reporting
   */
  async batchRestore(ids: string[]): Promise<BatchResult> {
    const errors: Array<{ id: string; error: string }> = []
    let affectedCount = 0
    for (const id of ids) {
      const result = await this.restoreTask(id)
      if (result.success) affectedCount++
      else errors.push({ id, error: result.error || 'Restore failed' })
    }
    return { success: errors.length === 0, affectedCount, errors, undoToken: null }
  }
  /**
   * Batch update priority
   */
  async batchUpdatePriority(ids: string[], priority: TaskPriority): Promise<BatchResult> {
    try {
      const repos = await getRepositories()
      return await repos.tasks.batchUpdate(ids, { priority })
    } catch (error) {
      return {
        success: false,
        affectedCount: 0,
        errors: ids.map(id => ({ id, error: String(error) })),
        undoToken: null,
      }
    }
  }

  /**
   * Batch move to project
   */
  async batchMoveToProject(ids: string[], projectId: string | null): Promise<BatchResult> {
    try {
      const repos = await getRepositories()
      return await repos.tasks.batchUpdate(ids, { projectId })
    } catch (error) {
      return {
        success: false,
        affectedCount: 0,
        errors: ids.map(id => ({ id, error: String(error) })),
        undoToken: null,
      }
    }
  }

  /**
   * Batch add a tag to tasks
   */
  async batchAddTag(ids: string[], tagId: string): Promise<BatchResult> {
    const repos = await getRepositories()
    const errors: Array<{ id: string; error: string }> = []
    let affectedCount = 0
    for (const id of ids) {
      try {
        await repos.tags.addToTask(id, tagId)
        affectedCount++
      } catch (error) {
        errors.push({ id, error: String(error) })
      }
    }
    return { success: errors.length === 0, affectedCount, errors, undoToken: null }
  }

  /**
   * Batch remove a tag from tasks
   */
  async batchRemoveTag(ids: string[], tagId: string): Promise<BatchResult> {
    const repos = await getRepositories()
    const errors: Array<{ id: string; error: string }> = []
    let affectedCount = 0
    for (const id of ids) {
      try {
        await repos.tags.removeFromTask(id, tagId)
        affectedCount++
      } catch (error) {
        errors.push({ id, error: String(error) })
      }
    }
    return { success: errors.length === 0, affectedCount, errors, undoToken: null }
  }
  /**
   * Get task hierarchy (parent + children)
   */
  async getTaskHierarchy(taskId: string): Promise<TaskServiceResult<{ task: Task; children: Task[] }>> {
    try {
      const repos = await getRepositories()
      const task = await repos.tasks.findById(taskId)
      if (!task) {
        return { success: false, error: '任务不存在' }
      }

      const children = await repos.tasks.findByParentId(taskId)
      return { success: true, data: { task, children } }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  }

  /**
   * Get task progress (completed/total children)
   */
  async getTaskProgress(taskId: string): Promise<{ done: number; total: number }> {
    try {
      const repos = await getRepositories()
      const children = await repos.tasks.findByParentId(taskId)
      const activeChildren = children.filter(c => !c.deletedAt)
      const done = activeChildren.filter(c => c.status === 'done').length
      return { done, total: activeChildren.length }
    } catch {
      return { done: 0, total: 0 }
    }
  }

  /**
   * Copy a task with a new ID and fresh timestamps.
   *
   * Fields copied: title, note, projectId, priority, scheduledDate, scheduledAt,
   *   dueAt, isAllDay, timezone, estimatedMinutes, source, parentId.
   * Fields reset: id (new), createdAt/updatedAt (now), completedAt (null),
   *   deletedAt (null), revision (1), sortOrder (next after original).
   *
   * @param sourceId     Task to copy
   * @param withChildren If true, recursively copy all direct children (depth-limited to 3)
   */
  async copyTask(sourceId: string, withChildren: boolean = false): Promise<TaskServiceResult<Task>> {
    try {
      const repos = await getRepositories()
      const source = await repos.tasks.findById(sourceId)
      if (!source) return { success: false, error: '任务不存在' }

      // Determine sort order: place copy right after the source
      const siblings = source.parentId
        ? await repos.tasks.findByParentId(source.parentId)
        : (await repos.tasks.findByView('inbox')).filter(t => !t.parentId)
      const maxSort = siblings.reduce((max, s) => Math.max(max, s.sortOrder), 0)

      const copy = await repos.tasks.create({
        title: source.title + ' (副本)',
        parentId: source.parentId ?? undefined,
        projectId: source.projectId ?? undefined,
        note: source.note ?? undefined,
        priority: source.priority,
        sortOrder: maxSort + 1,
        scheduledDate: source.scheduledDate ?? undefined,
        scheduledAt: source.scheduledAt ?? undefined,
        dueAt: source.dueAt ?? undefined,
        isAllDay: source.isAllDay,
        timezone: source.timezone,
        estimatedMinutes: source.estimatedMinutes ?? undefined,
        source: source.source,
      })

      // Recursively copy children if requested
      if (withChildren) {
        const children = await repos.tasks.findByParentId(sourceId)
        for (const child of children) {
          const childCopy = await this.copyTask(child.id, true)
          if (childCopy.success && childCopy.data) {
            await repos.tasks.moveTask(childCopy.data.id, copy.id)
          }
        }
      }

      return { success: true, data: copy }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  }

  /**
   * Reorder siblings by assigning contiguous sort_order values.
   *
   * @param parentId  Parent whose children to reorder (null = root tasks)
   * @param orderedIds  The desired order of child IDs. Must contain exactly
   *                    the same IDs as the current children (no additions/removals).
   * @returns The reordered task list, or an error if orderedIds doesn't match.
   */
  async reorderSiblingTasks(parentId: string | null, orderedIds: string[]): Promise<TaskServiceResult<Task[]>> {
    try {
      const repos = await getRepositories()
      const children = parentId
        ? await repos.tasks.findByParentId(parentId)
        : (await repos.tasks.findByView('inbox')).filter(t => !t.parentId)

      // Validate that orderedIds contains exactly the same IDs
      const currentIds = new Set(children.map(c => c.id))
      const providedIds = new Set(orderedIds)
      if (currentIds.size !== providedIds.size) {
        return { success: false, error: '排序列表必须包含且仅包含当前所有子任务' }
      }
      for (const id of orderedIds) {
        if (!currentIds.has(id)) {
          return { success: false, error: `任务 ${id} 不是当前层级的子任务` }
        }
      }

      // Assign contiguous sort_order values
      const updated: Task[] = []
      for (let i = 0; i < orderedIds.length; i++) {
        const task = await repos.tasks.update(orderedIds[i], { sortOrder: i })
        updated.push(task)
      }

      return { success: true, data: updated }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  }
}

// Singleton instance
export const taskService = new TaskService()
