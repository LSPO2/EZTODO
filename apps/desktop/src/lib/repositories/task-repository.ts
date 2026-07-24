/**
 * Task repository implementation
 */

import { v7 as uuidv7 } from 'uuid'
import { getDatabase } from '../database'
import type {
  Task,
  CreateTaskRequest,
  UpdateTaskRequest,
  TaskFilters,
  ViewType,
  SyncOperation,
} from './types'

export class TaskRepository {
  /**
   * Create a new task
   */
  async create(request: CreateTaskRequest): Promise<Task> {
    const db = await getDatabase()
    const now = new Date().toISOString()
    const id = uuidv7()

    const task: Task = {
      id,
      parentId: request.parentId || null,
      projectId: request.projectId || null,
      title: request.title.trim(),
      note: request.note?.trim() || null,
      status: 'todo',
      priority: request.priority || 'none',
      sortOrder: 0,
      scheduledDate: request.scheduledDate || null,
      scheduledAt: request.scheduledAt || null,
      dueAt: request.dueAt || null,
      isAllDay: request.isAllDay || false,
      timezone: request.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      estimatedMinutes: request.estimatedMinutes || null,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
      deletedAt: null,
      revision: 1,
      source: request.source || 'manual',
      sourceCaptureId: request.sourceCaptureId || null,
    }

    await db.execute(
      `INSERT INTO tasks (
        id, parent_id, project_id, title, note, status, priority, sort_order,
        scheduled_date, scheduled_at, due_at, is_all_day, timezone, estimated_minutes,
        created_at, updated_at, completed_at, deleted_at, revision, source, source_capture_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)`,
      [
        task.id, task.parentId, task.projectId, task.title, task.note,
        task.status, task.priority, task.sortOrder,
        task.scheduledDate, task.scheduledAt, task.dueAt, task.isAllDay,
        task.timezone, task.estimatedMinutes,
        task.createdAt, task.updatedAt, task.completedAt, task.deletedAt,
        task.revision, task.source, task.sourceCaptureId,
      ]
    )

    // Add to sync outbox
    await this.addToSyncOutbox('task', id, 'create', task)

    return task
  }

  /**
   * Update a task
   */
  async update(id: string, updates: UpdateTaskRequest): Promise<Task> {
    const db = await getDatabase()
    const now = new Date().toISOString()

    // Get current task
    const current = await this.findById(id)
    if (!current) {
      throw new Error(`Task not found: ${id}`)
    }

    // Build update fields
    const fields: string[] = []
    const values: unknown[] = []
    let paramIndex = 1

    if (updates.title !== undefined) {
      fields.push(`title = $${paramIndex++}`)
      values.push(updates.title.trim())
    }
    if (updates.parentId !== undefined) {
      fields.push(`parent_id = $${paramIndex++}`)
      values.push(updates.parentId)
    }
    if (updates.projectId !== undefined) {
      fields.push(`project_id = $${paramIndex++}`)
      values.push(updates.projectId)
    }
    if (updates.note !== undefined) {
      fields.push(`note = $${paramIndex++}`)
      values.push(updates.note?.trim() || null)
    }
    if (updates.status !== undefined) {
      fields.push(`status = $${paramIndex++}`)
      values.push(updates.status)
      if (updates.status === 'done') {
        fields.push(`completed_at = $${paramIndex++}`)
        values.push(now)
      } else if (current.status === 'done') {
        fields.push(`completed_at = $${paramIndex++}`)
        values.push(null)
      }
    }
    if (updates.priority !== undefined) {
      fields.push(`priority = $${paramIndex++}`)
      values.push(updates.priority)
    }
    if (updates.sortOrder !== undefined) {
      fields.push(`sort_order = $${paramIndex++}`)
      values.push(updates.sortOrder)
    }
    if (updates.scheduledDate !== undefined) {
      fields.push(`scheduled_date = $${paramIndex++}`)
      values.push(updates.scheduledDate)
    }
    if (updates.scheduledAt !== undefined) {
      fields.push(`scheduled_at = $${paramIndex++}`)
      values.push(updates.scheduledAt)
    }
    if (updates.dueAt !== undefined) {
      fields.push(`due_at = $${paramIndex++}`)
      values.push(updates.dueAt)
    }
    if (updates.isAllDay !== undefined) {
      fields.push(`is_all_day = $${paramIndex++}`)
      values.push(updates.isAllDay ? 1 : 0)
    }
    if (updates.timezone !== undefined) {
      fields.push(`timezone = $${paramIndex++}`)
      values.push(updates.timezone)
    }
    if (updates.estimatedMinutes !== undefined) {
      fields.push(`estimated_minutes = $${paramIndex++}`)
      values.push(updates.estimatedMinutes)
    }

    // Always update updated_at and revision
    fields.push(`updated_at = $${paramIndex++}`)
    values.push(now)
    fields.push(`revision = $${paramIndex++}`)
    values.push(current.revision + 1)

    // Execute update
    values.push(id)
    await db.execute(
      `UPDATE tasks SET ${fields.join(', ')} WHERE id = $${paramIndex}`,
      values
    )

    // Get updated task
    const updated = await this.findById(id)
    if (!updated) {
      throw new Error(`Failed to update task: ${id}`)
    }

    // Add to sync outbox
    await this.addToSyncOutbox('task', id, 'update', updated)

    return updated
  }

  /**
   * Soft delete a task
   */
  async delete(id: string): Promise<void> {
    const db = await getDatabase()
    const now = new Date().toISOString()

    // Get current task
    const task = await this.findById(id)
    if (!task) {
      throw new Error(`Task not found: ${id}`)
    }

    // Soft delete task and its descendants
    await db.execute(
      `UPDATE tasks SET deleted_at = $1, updated_at = $1, revision = revision + 1
       WHERE id = $2 OR parent_id = $2 OR id IN (
         SELECT id FROM tasks WHERE parent_id IN (
           SELECT id FROM tasks WHERE parent_id = $2
         )
       )`,
      [now, id]
    )

    // Add to sync outbox
    await this.addToSyncOutbox('task', id, 'update', { ...task, deletedAt: now })
  }

  /**
   * Restore a soft-deleted task
   */
  async restore(id: string): Promise<Task> {
    const db = await getDatabase()
    const now = new Date().toISOString()

    // Restore task and its descendants
    await db.execute(
      `UPDATE tasks SET deleted_at = NULL, updated_at = $1, revision = revision + 1
       WHERE id = $2 OR parent_id = $2 OR id IN (
         SELECT id FROM tasks WHERE parent_id IN (
           SELECT id FROM tasks WHERE parent_id = $2
         )
       )`,
      [now, id]
    )

    // Get restored task
    const task = await this.findById(id)
    if (!task) {
      throw new Error(`Failed to restore task: ${id}`)
    }

    // Add to sync outbox
    await this.addToSyncOutbox('task', id, 'update', task)

    return task
  }

  /**
   * Permanently delete a task
   */
  async permanentlyDelete(id: string): Promise<void> {
    const db = await getDatabase()

    // Check if task is synced
    const pendingSync = await db.select(
      `SELECT COUNT(*) as count FROM sync_outbox WHERE entity_id = $1 AND synced_at IS NULL`,
      [id]
    )

    if (pendingSync[0]?.count > 0) {
      throw new Error('Cannot delete task with pending sync operations')
    }

    // Delete task (cascade will handle children)
    await db.execute('DELETE FROM tasks WHERE id = $1', [id])
  }

  /**
   * Find task by ID
   */
  async findById(id: string): Promise<Task | null> {
    const db = await getDatabase()

    const result = await db.select(
      `SELECT
        id, parent_id as parentId, project_id as projectId,
        title, note, status, priority, sort_order as sortOrder,
        scheduled_date as scheduledDate, scheduled_at as scheduledAt,
        due_at as dueAt, is_all_day as isAllDay, timezone,
        estimated_minutes as estimatedMinutes,
        created_at as createdAt, updated_at as updatedAt,
        completed_at as completedAt, deleted_at as deletedAt,
        revision, source, source_capture_id as sourceCaptureId
      FROM tasks WHERE id = $1`,
      [id]
    )

    return result[0] || null
  }

  /**
   * Find tasks by view
   */
  async findByView(view: ViewType, filters?: TaskFilters): Promise<Task[]> {
    const db = await getDatabase()
    const now = new Date().toISOString()
    const today = now.split('T')[0]

    let whereClause = 'WHERE deleted_at IS NULL'
    const params: unknown[] = []
    let paramIndex = 1

    // Apply view filter
    switch (view) {
      case 'inbox':
        whereClause += ` AND project_id IS NULL AND status = 'todo'`
        break
      case 'today':
        whereClause += ` AND (scheduled_date = $${paramIndex++} OR due_at <= $${paramIndex++}) AND status = 'todo'`
        params.push(today, now)
        break
      case 'week': {
        const weekLater = new Date()
        weekLater.setDate(weekLater.getDate() + 7)
        whereClause += ` AND scheduled_date BETWEEN $${paramIndex++} AND $${paramIndex++} AND status = 'todo'`
        params.push(today, weekLater.toISOString().split('T')[0])
        break
      }
      case 'overdue':
        whereClause += ` AND due_at < $${paramIndex++} AND status = 'todo'`
        params.push(now)
        break
      case 'no-date':
        whereClause += ` AND scheduled_date IS NULL AND scheduled_at IS NULL AND due_at IS NULL AND status = 'todo'`
        break
      case 'completed':
        whereClause = 'WHERE deleted_at IS NULL AND status = \'done\''
        break
      case 'trash':
        whereClause = 'WHERE deleted_at IS NOT NULL'
        break
    }

    // Apply additional filters
    if (filters) {
      if (filters.projectId) {
        whereClause += ` AND project_id = $${paramIndex++}`
        params.push(filters.projectId)
      }
      if (filters.priority) {
        whereClause += ` AND priority = $${paramIndex++}`
        params.push(filters.priority)
      }
      if (filters.status) {
        whereClause += ` AND status = $${paramIndex++}`
        params.push(filters.status)
      }
      if (filters.search) {
        whereClause += ` AND (title LIKE $${paramIndex++} OR note LIKE $${paramIndex++})`
        const searchTerm = `%${filters.search}%`
        params.push(searchTerm, searchTerm)
      }
    }

    // Execute query
    const tasks = await db.select(
      `SELECT
        id, parent_id as parentId, project_id as projectId,
        title, note, status, priority, sort_order as sortOrder,
        scheduled_date as scheduledDate, scheduled_at as scheduledAt,
        due_at as dueAt, is_all_day as isAllDay, timezone,
        estimated_minutes as estimatedMinutes,
        created_at as createdAt, updated_at as updatedAt,
        completed_at as completedAt, deleted_at as deletedAt,
        revision, source, source_capture_id as sourceCaptureId
      FROM tasks ${whereClause}
      ORDER BY sort_order ASC, created_at DESC`,
      params
    )

    return tasks
  }

  /**
   * Search tasks
   */
  async search(query: string): Promise<Task[]> {
    const db = await getDatabase()
    const searchTerm = `%${query}%`

    return db.select(
      `SELECT
        id, parent_id as parentId, project_id as projectId,
        title, note, status, priority, sort_order as sortOrder,
        scheduled_date as scheduledDate, scheduled_at as scheduledAt,
        due_at as dueAt, is_all_day as isAllDay, timezone,
        estimated_minutes as estimatedMinutes,
        created_at as createdAt, updated_at as updatedAt,
        completed_at as completedAt, deleted_at as deletedAt,
        revision, source, source_capture_id as sourceCaptureId
      FROM tasks
      WHERE deleted_at IS NULL AND (title LIKE $1 OR note LIKE $1)
      ORDER BY updated_at DESC`,
      [searchTerm]
    )
  }

  /**
   * Get children of a task
   */
  async getChildren(parentId: string): Promise<Task[]> {
    const db = await getDatabase()

    return db.select(
      `SELECT
        id, parent_id as parentId, project_id as projectId,
        title, note, status, priority, sort_order as sortOrder,
        scheduled_date as scheduledDate, scheduled_at as scheduledAt,
        due_at as dueAt, is_all_day as isAllDay, timezone,
        estimated_minutes as estimatedMinutes,
        created_at as createdAt, updated_at as updatedAt,
        completed_at as completedAt, deleted_at as deletedAt,
        revision, source, source_capture_id as sourceCaptureId
      FROM tasks
      WHERE parent_id = $1 AND deleted_at IS NULL
      ORDER BY sort_order ASC, created_at ASC`,
      [parentId]
    )
  }

  /**
   * Get all descendants of a task
   */
  async getDescendants(parentId: string): Promise<Task[]> {
    const db = await getDatabase()

    return db.select(
      `WITH RECURSIVE descendants AS (
        SELECT id, parent_id, title, status
        FROM tasks WHERE parent_id = $1 AND deleted_at IS NULL
        UNION ALL
        SELECT t.id, t.parent_id, t.title, t.status
        FROM tasks t
        JOIN descendants d ON t.parent_id = d.id
        WHERE t.deleted_at IS NULL
      )
      SELECT
        id, parent_id as parentId, project_id as projectId,
        title, note, status, priority, sort_order as sortOrder,
        scheduled_date as scheduledDate, scheduled_at as scheduledAt,
        due_at as dueAt, is_all_day as isAllDay, timezone,
        estimated_minutes as estimatedMinutes,
        created_at as createdAt, updated_at as updatedAt,
        completed_at as completedAt, deleted_at as deletedAt,
        revision, source, source_capture_id as sourceCaptureId
      FROM tasks
      WHERE id IN (SELECT id FROM descendants)`,
      [parentId]
    )
  }

  /**
   * Move task to new parent
   */
  async moveTask(id: string, newParentId: string | null): Promise<void> {
    const db = await getDatabase()
    const now = new Date().toISOString()

    // Check for circular reference
    if (newParentId) {
      const isCircular = await this.isAncestor(id, newParentId)
      if (isCircular) {
        throw new Error('Cannot move task to its own descendant')
      }
    }

    // Update parent_id
    await db.execute(
      `UPDATE tasks SET parent_id = $1, updated_at = $2, revision = revision + 1 WHERE id = $3`,
      [newParentId, now, id]
    )

    // Add to sync outbox
    const task = await this.findById(id)
    if (task) {
      await this.addToSyncOutbox('task', id, 'update', task)
    }
  }

  /**
   * Check if ancestorId is an ancestor of descendantId
   */
  private async isAncestor(ancestorId: string, descendantId: string): Promise<boolean> {
    const db = await getDatabase()

    const result = await db.select(
      `WITH RECURSIVE ancestors AS (
        SELECT parent_id FROM tasks WHERE id = $1
        UNION ALL
        SELECT t.parent_id FROM tasks t
        JOIN ancestors a ON t.id = a.parent_id
        WHERE t.parent_id IS NOT NULL
      )
      SELECT COUNT(*) as count FROM ancestors WHERE parent_id = $2`,
      [descendantId, ancestorId]
    )

    return (result[0]?.count || 0) > 0
  }

  /**
   * Batch update tasks
   */
  async batchUpdate(ids: string[], updates: UpdateTaskRequest): Promise<void> {
    const db = await getDatabase()

    await db.execute('BEGIN TRANSACTION')
    try {
      for (const id of ids) {
        await this.update(id, updates)
      }
      await db.execute('COMMIT')
    } catch (error) {
      await db.execute('ROLLBACK')
      throw error
    }
  }

  /**
   * Batch delete tasks
   */
  async batchDelete(ids: string[]): Promise<void> {
    const db = await getDatabase()

    await db.execute('BEGIN TRANSACTION')
    try {
      for (const id of ids) {
        await this.delete(id)
      }
      await db.execute('COMMIT')
    } catch (error) {
      await db.execute('ROLLBACK')
      throw error
    }
  }

  /**
   * Batch restore tasks
   */
  async batchRestore(ids: string[]): Promise<void> {
    const db = await getDatabase()

    await db.execute('BEGIN TRANSACTION')
    try {
      for (const id of ids) {
        await this.restore(id)
      }
      await db.execute('COMMIT')
    } catch (error) {
      await db.execute('ROLLBACK')
      throw error
    }
  }

  /**
   * Add operation to sync outbox
   */
  private async addToSyncOutbox(
    entityType: string,
    entityId: string,
    operation: string,
    payload: unknown
  ): Promise<void> {
    const db = await getDatabase()
    const now = new Date().toISOString()
    const operationId = uuidv7()

    await db.execute(
      `INSERT INTO sync_outbox (id, operation_id, entity_type, entity_id, operation, payload, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [uuidv7(), operationId, entityType, entityId, operation, JSON.stringify(payload), now]
    )
  }

  /**
   * Get pending sync operations
   */
  async getPendingSync(): Promise<SyncOperation[]> {
    const db = await getDatabase()

    return db.select(
      `SELECT
        id, operation_id as operationId,
        entity_type as entityType, entity_id as entityId,
        operation, payload, base_revision as baseRevision,
        created_at as createdAt, synced_at as syncedAt
      FROM sync_outbox
      WHERE synced_at IS NULL
      ORDER BY created_at ASC`
    )
  }

  /**
   * Mark sync operations as synced
   */
  async markSynced(operationIds: string[]): Promise<void> {
    const db = await getDatabase()
    const now = new Date().toISOString()

    for (const operationId of operationIds) {
      await db.execute(
        'UPDATE sync_outbox SET synced_at = $1 WHERE operation_id = $2',
        [now, operationId]
      )
    }
  }
}

// Export singleton instance
export const taskRepository = new TaskRepository()
