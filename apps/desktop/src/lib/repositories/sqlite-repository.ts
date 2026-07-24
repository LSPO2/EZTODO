/**
 * SQLite Repository implementation for Tauri environment
 * This is the production implementation that uses Tauri SQL plugin
 */

import type {
  Task,
  CreateTaskRequest,
  UpdateTaskRequest,
  TaskFilters,
  ViewType,
  Project,
  CreateProjectRequest,
  UpdateProjectRequest,
  Tag,
  CreateTagRequest,
  UpdateTagRequest,
  TaskRepository,
  ProjectRepository,
  TagRepository,
  SettingsRepository,
  SyncOperation,
  BatchResult,
  Repositories,
  TaskSnapshot,
} from './types'
import { validateTaskTitle, validateTaskPriority, validateTaskStatus } from './types'

// UUID generation using UUIDv7 (time-ordered, sortable)
import { v7 as uuidv7 } from 'uuid'
function generateId(): string {
  return uuidv7()
}

// Database interface (to be injected)
export interface Database {
  execute(sql: string, params?: unknown[]): Promise<{ rowsAffected: number }>
  select<T>(sql: string, params?: unknown[]): Promise<T>
  /** Execute a function inside a BEGIN/COMMIT block; ROLLBACK on throw */
  transaction<T>(fn: () => Promise<T>): Promise<T>
}

/**
 * Add an operation to the sync outbox (shared by all repositories)
 */
async function addToSyncOutbox(
  db: Database,
  entityType: string,
  entityId: string,
  operation: string,
  payload: unknown,
  batchId?: string
): Promise<void> {
  const now = new Date().toISOString()
  const opId = generateId()
  await db.execute(
    `INSERT INTO sync_outbox (id, operation_id, entity_type, entity_id, operation, payload, batch_id, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [generateId(), opId, entityType, entityId, operation, JSON.stringify(payload), batchId || null, now]
  )
}

export class SQLiteTaskRepository implements TaskRepository {
  private db: Database

  constructor(db: Database) {
    this.db = db
  }

  async create(request: CreateTaskRequest): Promise<Task> {
    // Validate title
    const titleValidation = validateTaskTitle(request.title)
    if (!titleValidation.valid) {
      throw new Error(titleValidation.error)
    }

    // Validate priority if provided
    if (request.priority && !validateTaskPriority(request.priority)) {
      throw new Error(`Invalid priority: ${request.priority}`)
    }

    const now = new Date().toISOString()
    const id = generateId()

    const task: Task = {
      id,
      parentId: request.parentId || null,
      projectId: request.projectId || null,
      title: request.title.trim(),
      note: request.note?.trim() || null,
      status: 'todo',
      priority: request.priority || 'none',
      sortOrder: request.sortOrder || 0,
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

    // Wrap INSERT + outbox in a single transaction for atomicity
    await this.db.transaction(async () => {
      await this.db.execute(
        `INSERT INTO tasks (
          id, parent_id, project_id, title, note, status, priority, sort_order,
          scheduled_date, scheduled_at, due_at, is_all_day, timezone, estimated_minutes,
          created_at, updated_at, completed_at, deleted_at, revision, source, source_capture_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)`,
        [
          task.id, task.parentId, task.projectId, task.title, task.note,
          task.status, task.priority, task.sortOrder,
          task.scheduledDate, task.scheduledAt, task.dueAt, task.isAllDay ? 1 : 0,
          task.timezone, task.estimatedMinutes,
          task.createdAt, task.updatedAt, task.completedAt, task.deletedAt,
          task.revision, task.source, task.sourceCaptureId,
        ]
      )

      await this.addToSyncOutbox('task', id, 'create', task)
    })

    return task
  }

  async findById(id: string): Promise<Task | null> {
    const result = await this.db.select<Task[]>(
      `SELECT
        id, parent_id as "parentId", project_id as "projectId",
        title, note, status, priority, sort_order as "sortOrder",
        scheduled_date as "scheduledDate", scheduled_at as "scheduledAt",
        due_at as "dueAt", is_all_day as "isAllDay", timezone,
        estimated_minutes as "estimatedMinutes",
        created_at as "createdAt", updated_at as "updatedAt",
        completed_at as "completedAt", deleted_at as "deletedAt",
        revision, source, source_capture_id as "sourceCaptureId"
      FROM tasks WHERE id = $1`,
      [id]
    )
    return result[0] || null
  }

  async update(id: string, updates: UpdateTaskRequest): Promise<Task> {
    // Validate title if provided
    if (updates.title !== undefined) {
      const titleValidation = validateTaskTitle(updates.title)
      if (!titleValidation.valid) {
        throw new Error(titleValidation.error)
      }
    }

    // Validate priority if provided
    if (updates.priority !== undefined && !validateTaskPriority(updates.priority)) {
      throw new Error(`Invalid priority: ${updates.priority}`)
    }

    // Validate status if provided
    if (updates.status !== undefined && !validateTaskStatus(updates.status)) {
      throw new Error(`Invalid status: ${updates.status}`)
    }

    const now = new Date().toISOString()
    const current = await this.findById(id)
    if (!current) throw new Error(`Task not found: ${id}`)

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
      if (updates.status === 'done' && current.status !== 'done') {
        fields.push(`completed_at = $${paramIndex++}`)
        values.push(now)
      } else if (updates.status !== 'done' && current.status === 'done') {
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

    fields.push(`updated_at = $${paramIndex++}`)
    values.push(now)
    fields.push(`revision = $${paramIndex++}`)
    values.push(current.revision + 1)

    values.push(id)

    // Wrap UPDATE + outbox in a single transaction for atomicity
    let updated: Task
    await this.db.transaction(async () => {
      await this.db.execute(
        `UPDATE tasks SET ${fields.join(', ')} WHERE id = $${paramIndex}`,
        values
      )

      const result = await this.db.select<Task[]>(
        `SELECT
          id, parent_id as "parentId", project_id as "projectId",
          title, note, status, priority, sort_order as "sortOrder",
          scheduled_date as "scheduledDate", scheduled_at as "scheduledAt",
          due_at as "dueAt", is_all_day as "isAllDay", timezone,
          estimated_minutes as "estimatedMinutes",
          created_at as "createdAt", updated_at as "updatedAt",
          completed_at as "completedAt", deleted_at as "deletedAt",
          revision, source, source_capture_id as "sourceCaptureId"
        FROM tasks WHERE id = $1`,
        [id]
      )
      if (!result[0]) throw new Error(`Failed to update task: ${id}`)
      updated = result[0]

      await this.addToSyncOutbox('task', id, 'update', updated)
    })

    return updated!
  }

  async delete(id: string): Promise<void> {
    const now = new Date().toISOString()
    // Wrap soft-delete + outbox in a single transaction for atomicity
    await this.db.transaction(async () => {
      await this.db.execute(
        `UPDATE tasks SET deleted_at = $1, updated_at = $1, revision = revision + 1 WHERE id = $2`,
        [now, id]
      )
      await this.addToSyncOutbox('task', id, 'update', { deletedAt: now })
    })
  }

  async restore(id: string): Promise<Task> {
    const now = new Date().toISOString()
    // Wrap restore + outbox in a single transaction for atomicity
    let task: Task
    await this.db.transaction(async () => {
      await this.db.execute(
        `UPDATE tasks SET deleted_at = NULL, updated_at = $1, revision = revision + 1 WHERE id = $2`,
        [now, id]
      )
      const result = await this.db.select<Task[]>(
        `SELECT
          id, parent_id as "parentId", project_id as "projectId",
          title, note, status, priority, sort_order as "sortOrder",
          scheduled_date as "scheduledDate", scheduled_at as "scheduledAt",
          due_at as "dueAt", is_all_day as "isAllDay", timezone,
          estimated_minutes as "estimatedMinutes",
          created_at as "createdAt", updated_at as "updatedAt",
          completed_at as "completedAt", deleted_at as "deletedAt",
          revision, source, source_capture_id as "sourceCaptureId"
        FROM tasks WHERE id = $1`,
        [id]
      )
      if (!result[0]) throw new Error(`Failed to restore task: ${id}`)
      task = result[0]
      await this.addToSyncOutbox('task', id, 'update', task)
    })
    return task!
  }

  async permanentlyDelete(id: string): Promise<void> {
    await this.db.execute('DELETE FROM tasks WHERE id = $1', [id])
  }

  async findByView(view: ViewType, filters?: TaskFilters): Promise<Task[]> {
    let query = `SELECT DISTINCT
      t.id, t.parent_id as "parentId", t.project_id as "projectId",
      t.title, t.note, t.status, t.priority, t.sort_order as "sortOrder",
      t.scheduled_date as "scheduledDate", t.scheduled_at as "scheduledAt",
      t.due_at as "dueAt", t.is_all_day as "isAllDay", t.timezone,
      t.estimated_minutes as "estimatedMinutes",
      t.created_at as "createdAt", t.updated_at as "updatedAt",
      t.completed_at as "completedAt", t.deleted_at as "deletedAt",
      t.revision, t.source, t.source_capture_id as "sourceCaptureId"
    FROM tasks t`


    query += ` WHERE `

    const conditions: string[] = []
    const params: unknown[] = []
    let paramIndex = 1

    // View filter
    switch (view) {
      case 'all':
        conditions.push(`t.parent_id IS NULL AND t.status = 'todo' AND t.deleted_at IS NULL`)
        break
      case 'inbox':
        conditions.push(`t.parent_id IS NULL AND t.project_id IS NULL AND t.status = 'todo' AND t.deleted_at IS NULL`)
        break
      case 'today':
        conditions.push(`t.parent_id IS NULL AND t.status = 'todo' AND t.deleted_at IS NULL`)
        conditions.push(`(
          t.scheduled_date = date('now', 'localtime')
          OR t.due_at <= datetime('now')
          OR (t.scheduled_date IS NULL AND t.scheduled_at IS NULL AND t.due_at IS NULL)
        )`)
        break
      case 'week':
        conditions.push(`t.parent_id IS NULL AND t.status = 'todo' AND t.deleted_at IS NULL`)
        conditions.push(`t.scheduled_date BETWEEN date('now', 'localtime') AND date('now', 'localtime', '+7 days')`)
        break
      case 'overdue':
        conditions.push(`t.parent_id IS NULL AND t.status = 'todo' AND t.deleted_at IS NULL`)
        conditions.push(`t.due_at < datetime('now')`)
        break
      case 'no-date':
        conditions.push(`t.parent_id IS NULL AND t.status = 'todo' AND t.deleted_at IS NULL`)
        conditions.push(`t.scheduled_date IS NULL AND t.scheduled_at IS NULL AND t.due_at IS NULL`)
        break
      case 'completed':
        conditions.push(`t.parent_id IS NULL AND t.status = 'done' AND t.deleted_at IS NULL`)
        break
      case 'trash':
        conditions.push(`t.deleted_at IS NOT NULL`)
        break
    }

    // parentOnly override
    if (filters?.parentOnly) {
      conditions.push(`t.parent_id IS NULL`)
    }

    // Additional filters
    if (filters?.projectId) {
      conditions.push(`t.project_id = $${paramIndex++}`)
      params.push(filters.projectId)
    }
    if (filters?.priority) {
      conditions.push(`t.priority = $${paramIndex++}`)
      params.push(filters.priority)
    }
    if (filters?.status && view !== 'trash') {
      conditions.push(`t.status = $${paramIndex++}`)
      params.push(filters.status)
    }
    if (filters?.search) {
      conditions.push(`(t.title LIKE $${paramIndex} OR t.note LIKE $${paramIndex})`)
      params.push(`%${filters.search}%`)
      paramIndex++
    }
    if (filters?.tagIds && filters.tagIds.length > 0) {
      // AND semantics: require one matching task_tags row for every selected tag.
      for (const tagId of filters.tagIds) {
        conditions.push(`EXISTS (SELECT 1 FROM task_tags tt WHERE tt.task_id = t.id AND tt.tag_id = $${paramIndex++})`)
        params.push(tagId)
      }
    }

    query += conditions.join(' AND ')

    // Sort
    const sort = filters?.sort
    const sortFieldMap: Record<string, string> = {
      sortOrder: 't.sort_order',
      createdAt: 't.created_at',
      scheduledDate: 't.scheduled_date',
      dueAt: 't.due_at',
      priority: 't.priority',
    }
    const sortCol = sort ? (sortFieldMap[sort.field] || 't.sort_order') : 't.sort_order'
    const sortDir = sort?.direction === 'desc' ? 'DESC' : 'ASC'
    query += ` ORDER BY ${sortCol} ${sortDir}, t.created_at DESC`

    return this.db.select<Task[]>(query, params)
  }

  async search(query: string): Promise<Task[]> {
    return this.db.select<Task[]>(
      `SELECT
        id, parent_id as "parentId", project_id as "projectId",
        title, note, status, priority, sort_order as "sortOrder",
        scheduled_date as "scheduledDate", scheduled_at as "scheduledAt",
        due_at as "dueAt", is_all_day as "isAllDay", timezone,
        estimated_minutes as "estimatedMinutes",
        created_at as "createdAt", updated_at as "updatedAt",
        completed_at as "completedAt", deleted_at as "deletedAt",
        revision, source, source_capture_id as "sourceCaptureId"
      FROM tasks
      WHERE deleted_at IS NULL AND (title LIKE $1 OR note LIKE $1)
      ORDER BY updated_at DESC`,
      [`%${query}%`]
    )
  }

  async findByParentId(parentId: string): Promise<Task[]> {
    return this.db.select<Task[]>(
      `SELECT
        id, parent_id as "parentId", project_id as "projectId",
        title, note, status, priority, sort_order as "sortOrder",
        scheduled_date as "scheduledDate", scheduled_at as "scheduledAt",
        due_at as "dueAt", is_all_day as "isAllDay", timezone,
        estimated_minutes as "estimatedMinutes",
        created_at as "createdAt", updated_at as "updatedAt",
        completed_at as "completedAt", deleted_at as "deletedAt",
        revision, source, source_capture_id as "sourceCaptureId"
      FROM tasks
      WHERE parent_id = $1 AND deleted_at IS NULL
      ORDER BY sort_order ASC, created_at ASC`,
      [parentId]
    )
  }

  async batchComplete(ids: string[], batchId?: string): Promise<BatchResult> {
    const bid = batchId || generateId()
    try {
      await this.db.transaction(async () => {
        for (const id of ids) {
          const now = new Date().toISOString()
          const current = await this.findById(id)
          if (!current) throw new Error(`Task not found: ${id}`)
          await this.db.execute(
            `UPDATE tasks SET status = 'done', completed_at = $1, updated_at = $1, revision = revision + 1 WHERE id = $2`,
            [now, id]
          )
          await this.addToSyncOutbox('task', id, 'update', { ...current, status: 'done', completedAt: now }, bid)
        }
      })
      return { success: true, affectedCount: ids.length, errors: [], undoToken: bid }
    } catch (e) {
      return { success: false, affectedCount: 0, errors: [{ id: 'batch', error: String(e) }], undoToken: null }
    }
  }

  async batchDelete(ids: string[], batchId?: string): Promise<BatchResult> {
    const bid = batchId || generateId()
    try {
      await this.db.transaction(async () => {
        for (const id of ids) {
          const now = new Date().toISOString()
          await this.db.execute(
            `UPDATE tasks SET deleted_at = $1, updated_at = $1, revision = revision + 1 WHERE id = $2`,
            [now, id]
          )
          await this.addToSyncOutbox('task', id, 'update', { deletedAt: now }, bid)
        }
      })
      return { success: true, affectedCount: ids.length, errors: [], undoToken: bid }
    } catch (e) {
      return { success: false, affectedCount: 0, errors: [{ id: 'batch', error: String(e) }], undoToken: null }
    }
  }

  async batchRestore(ids: string[], batchId?: string): Promise<BatchResult> {
    const bid = batchId || generateId()
    try {
      await this.db.transaction(async () => {
        for (const id of ids) {
          const now = new Date().toISOString()
          await this.db.execute(
            `UPDATE tasks SET deleted_at = NULL, updated_at = $1, revision = revision + 1 WHERE id = $2`,
            [now, id]
          )
          const task = await this.findById(id)
          if (!task) throw new Error(`Task not found: ${id}`)
          await this.addToSyncOutbox('task', id, 'update', task, bid)
        }
      })
      return { success: true, affectedCount: ids.length, errors: [], undoToken: bid }
    } catch (e) {
      return { success: false, affectedCount: 0, errors: [{ id: 'batch', error: String(e) }], undoToken: null }
    }
  }

  async batchUpdate(ids: string[], updates: UpdateTaskRequest, batchId?: string): Promise<BatchResult> {
    const bid = batchId || generateId()
    try {
      await this.db.transaction(async () => {
        for (const id of ids) {
          const now = new Date().toISOString()
          const current = await this.findById(id)
          if (!current) throw new Error(`Task not found: ${id}`)

          const fields: string[] = []
          const values: unknown[] = []
          let paramIndex = 1

          if (updates.priority !== undefined) { fields.push(`priority = $${paramIndex++}`); values.push(updates.priority) }
          if (updates.projectId !== undefined) { fields.push(`project_id = $${paramIndex++}`); values.push(updates.projectId) }
          if (updates.sortOrder !== undefined) { fields.push(`sort_order = $${paramIndex++}`); values.push(updates.sortOrder) }
          if (updates.title !== undefined) { fields.push(`title = $${paramIndex++}`); values.push(updates.title.trim()) }
          if (updates.status !== undefined) {
            fields.push(`status = $${paramIndex++}`); values.push(updates.status)
            if (updates.status === 'done' && current.status !== 'done') {
              fields.push(`completed_at = $${paramIndex++}`); values.push(now)
            } else if (updates.status !== 'done' && current.status === 'done') {
              fields.push(`completed_at = $${paramIndex++}`); values.push(null)
            }
          }

          fields.push(`updated_at = $${paramIndex++}`); values.push(now)
          fields.push(`revision = $${paramIndex++}`); values.push(current.revision + 1)
          values.push(id)

          await this.db.execute(`UPDATE tasks SET ${fields.join(', ')} WHERE id = $${paramIndex}`, values)
          const updated = await this.findById(id)
          await this.addToSyncOutbox('task', id, 'update', updated, bid)
        }
      })
      return { success: true, affectedCount: ids.length, errors: [], undoToken: bid }
    } catch (e) {
      return { success: false, affectedCount: 0, errors: [{ id: 'batch', error: String(e) }], undoToken: null }
    }
  }

  async getChildren(parentId: string): Promise<Task[]> {
    return this.findByParentId(parentId)
  }

  async getDescendants(parentId: string): Promise<Task[]> {
    return this.db.select<Task[]>(
      `WITH RECURSIVE descendants AS (
        SELECT id FROM tasks WHERE parent_id = $1 AND deleted_at IS NULL
        UNION ALL
        SELECT t.id FROM tasks t JOIN descendants d ON t.parent_id = d.id WHERE t.deleted_at IS NULL
      )
      SELECT
        id, parent_id as "parentId", project_id as "projectId",
        title, note, status, priority, sort_order as "sortOrder",
        scheduled_date as "scheduledDate", scheduled_at as "scheduledAt",
        due_at as "dueAt", is_all_day as "isAllDay", timezone,
        estimated_minutes as "estimatedMinutes",
        created_at as "createdAt", updated_at as "updatedAt",
        completed_at as "completedAt", deleted_at as "deletedAt",
        revision, source, source_capture_id as "sourceCaptureId"
      FROM tasks WHERE id IN (SELECT id FROM descendants)`,
      [parentId]
    )
  }

  async moveTask(id: string, newParentId: string | null): Promise<void> {
    const now = new Date().toISOString()
    await this.db.execute(
      `UPDATE tasks SET parent_id = $1, updated_at = $2, revision = revision + 1 WHERE id = $3`,
      [newParentId, now, id]
    )
    const task = await this.findById(id)
    if (task) {
      await this.addToSyncOutbox('task', id, 'update', task)
    }
  }

  async getSnapshots(ids: string[]): Promise<TaskSnapshot[]> {
    if (ids.length === 0) return []
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(',')
    const tasks = await this.db.select<Task[]>(
      `SELECT id, status, priority, project_id as "projectId",
              parent_id as "parentId", deleted_at as "deletedAt"
       FROM tasks WHERE id IN (${placeholders})`,
      ids,
    )
    const snapshots: TaskSnapshot[] = []
    for (const task of tasks) {
      const tags = await this.db.select<{ tag_id: string }[]>(
        'SELECT tag_id FROM task_tags WHERE task_id = $1',
        [task.id],
      )
      snapshots.push({
        id: task.id,
        status: task.status,
        priority: task.priority,
        projectId: task.projectId,
        parentId: task.parentId,
        deletedAt: task.deletedAt,
        tagIds: tags.map((t) => t.tag_id),
      })
    }
    return snapshots
  }

  async restoreSnapshots(snapshots: TaskSnapshot[], batchId: string): Promise<BatchResult> {
    try {
      await this.db.transaction(async () => {
        const now = new Date().toISOString()
        for (const snapshot of snapshots) {
          const current = await this.findById(snapshot.id)
          if (!current) throw new Error(`Task not found: ${snapshot.id}`)

          await this.db.execute(
            `UPDATE tasks SET status = $1, priority = $2, project_id = $3, parent_id = $4,
             deleted_at = $5, completed_at = $6, updated_at = $7, revision = revision + 1
             WHERE id = $8`,
            [snapshot.status, snapshot.priority, snapshot.projectId, snapshot.parentId,
              snapshot.deletedAt, snapshot.status === 'done' ? current.completedAt : null,
              now, snapshot.id],
          )
          await this.db.execute('DELETE FROM task_tags WHERE task_id = $1', [snapshot.id])
          for (const tagId of snapshot.tagIds) {
            await this.db.execute(
              'INSERT INTO task_tags (task_id, tag_id) VALUES ($1, $2)',
              [snapshot.id, tagId],
            )
          }
          const restored = await this.findById(snapshot.id)
          await this.addToSyncOutbox('task', snapshot.id, 'update', restored, batchId)
        }
      })
      return { success: true, affectedCount: snapshots.length, errors: [], undoToken: batchId }
    } catch (error) {
      return {
        success: false,
        affectedCount: 0,
        errors: [{ id: 'undo', error: String(error) }],
        undoToken: null,
      }
    }
  }

  async getPendingSync(): Promise<SyncOperation[]> {
    return this.db.select<SyncOperation[]>(
      `SELECT
        id, operation_id as "operationId",
        entity_type as "entityType", entity_id as "entityId",
        operation, payload, base_revision as "baseRevision",
        batch_id as "batchId",
        created_at as "createdAt", synced_at as "syncedAt"
      FROM sync_outbox WHERE synced_at IS NULL ORDER BY created_at ASC`
    )
  }

  async markSynced(operationIds: string[]): Promise<void> {
    const now = new Date().toISOString()
    for (const opId of operationIds) {
      await this.db.execute(
        'UPDATE sync_outbox SET synced_at = $1 WHERE operation_id = $2',
        [now, opId]
      )
    }
  }

  private async addToSyncOutbox(
    entityType: string,
    entityId: string,
    operation: string,
    payload: unknown,
    batchId?: string
  ): Promise<void> {
    await addToSyncOutbox(this.db, entityType, entityId, operation, payload, batchId)
  }

  /**
   * Execute multiple task mutations in a single SQLite transaction.
   * On any failure the entire transaction rolls back — no partial state.
   */
  async runInTransaction(fn: () => Promise<void>): Promise<void> {
    await this.db.transaction(async () => {
      await fn()
    })
  }
}

export class SQLiteProjectRepository implements ProjectRepository {
  private db: Database

  constructor(db: Database) {
    this.db = db
  }

  async create(request: CreateProjectRequest): Promise<Project> {
    const now = new Date().toISOString()
    const id = generateId()

    const project: Project = {
      id,
      name: request.name.trim(),
      color: request.color || null,
      icon: request.icon || null,
      sortOrder: 0,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    }

    await this.db.transaction(async () => {
      await this.db.execute(
        `INSERT INTO projects (id, name, color, icon, sort_order, created_at, updated_at, deleted_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [project.id, project.name, project.color, project.icon, project.sortOrder,
         project.createdAt, project.updatedAt, project.deletedAt]
      )
      await addToSyncOutbox(this.db, 'project', id, 'create', project)
    })

    return project
  }

  async findById(id: string): Promise<Project | null> {
    const result = await this.db.select<Project[]>(
      `SELECT id, name, color, icon, sort_order as "sortOrder",
       created_at as "createdAt", updated_at as "updatedAt", deleted_at as "deletedAt"
       FROM projects WHERE id = $1`,
      [id]
    )
    return result[0] || null
  }

  async findAll(): Promise<Project[]> {
    return this.db.select<Project[]>(
      `SELECT id, name, color, icon, sort_order as "sortOrder",
       created_at as "createdAt", updated_at as "updatedAt", deleted_at as "deletedAt"
       FROM projects WHERE deleted_at IS NULL ORDER BY sort_order ASC, name ASC`
    )
  }

  async update(id: string, updates: UpdateProjectRequest): Promise<Project> {
    const now = new Date().toISOString()
    const fields: string[] = []
    const values: unknown[] = []
    let paramIndex = 1

    if (updates.name !== undefined) {
      fields.push(`name = $${paramIndex++}`)
      values.push(updates.name.trim())
    }
    if (updates.color !== undefined) {
      fields.push(`color = $${paramIndex++}`)
      values.push(updates.color)
    }
    if (updates.icon !== undefined) {
      fields.push(`icon = $${paramIndex++}`)
      values.push(updates.icon)
    }
    if (updates.sortOrder !== undefined) {
      fields.push(`sort_order = $${paramIndex++}`)
      values.push(updates.sortOrder)
    }

    fields.push(`updated_at = $${paramIndex++}`)
    values.push(now)
    values.push(id)

    let project: Project
    await this.db.transaction(async () => {
      await this.db.execute(
        `UPDATE projects SET ${fields.join(', ')} WHERE id = $${paramIndex}`,
        values
      )

      const result = await this.db.select<Project[]>(
        `SELECT id, name, color, icon, sort_order as "sortOrder",
         created_at as "createdAt", updated_at as "updatedAt", deleted_at as "deletedAt"
         FROM projects WHERE id = $1`,
        [id]
      )
      if (!result[0]) throw new Error(`Project not found: ${id}`)
      project = result[0]
      await addToSyncOutbox(this.db, 'project', id, 'update', project)
    })
    return project!
  }

  async delete(id: string): Promise<void> {
    const now = new Date().toISOString()
    await this.db.transaction(async () => {
      await this.db.execute(
        `UPDATE projects SET deleted_at = $1, updated_at = $1 WHERE id = $2`,
        [now, id]
      )
      await addToSyncOutbox(this.db, 'project', id, 'update', { deletedAt: now })
    })
  }
}

export class SQLiteTagRepository implements TagRepository {
  private db: Database

  constructor(db: Database) {
    this.db = db
  }

  async create(request: CreateTagRequest): Promise<Tag> {
    const now = new Date().toISOString()
    const id = generateId()

    const tag: Tag = {
      id,
      name: request.name.trim(),
      color: request.color || null,
      createdAt: now,
    }

    await this.db.transaction(async () => {
      await this.db.execute(
        `INSERT INTO tags (id, name, color, created_at) VALUES ($1, $2, $3, $4)`,
        [tag.id, tag.name, tag.color, tag.createdAt]
      )
      await addToSyncOutbox(this.db, 'tag', id, 'create', tag)
    })

    return tag
  }

  async findById(id: string): Promise<Tag | null> {
    const result = await this.db.select<Tag[]>(
      `SELECT id, name, color, created_at as "createdAt" FROM tags WHERE id = $1`,
      [id]
    )
    return result[0] || null
  }

  async findAll(): Promise<Tag[]> {
    return this.db.select<Tag[]>(
      `SELECT id, name, color, created_at as "createdAt" FROM tags ORDER BY name ASC`
    )
  }

  async findByTaskId(taskId: string): Promise<Tag[]> {
    return this.db.select<Tag[]>(
      `SELECT t.id, t.name, t.color, t.created_at as "createdAt"
       FROM tags t JOIN task_tags tt ON t.id = tt.tag_id
       WHERE tt.task_id = $1 ORDER BY t.name ASC`,
      [taskId]
    )
  }

  async update(id: string, updates: UpdateTagRequest): Promise<Tag> {
    const fields: string[] = []
    const values: unknown[] = []
    let paramIndex = 1

    if (updates.name !== undefined) {
      fields.push(`name = $${paramIndex++}`)
      values.push(updates.name.trim())
    }
    if (updates.color !== undefined) {
      fields.push(`color = $${paramIndex++}`)
      values.push(updates.color)
    }

    values.push(id)

    let tag: Tag
    await this.db.transaction(async () => {
      await this.db.execute(
        `UPDATE tags SET ${fields.join(', ')} WHERE id = $${paramIndex}`,
        values
      )

      const result = await this.db.select<Tag[]>(
        `SELECT id, name, color, created_at as "createdAt" FROM tags WHERE id = $1`,
        [id]
      )
      if (!result[0]) throw new Error(`Tag not found: ${id}`)
      tag = result[0]
      await addToSyncOutbox(this.db, 'tag', id, 'update', tag)
    })
    return tag!
  }

  async delete(id: string): Promise<void> {
    await this.db.transaction(async () => {
      await this.db.execute('DELETE FROM tags WHERE id = $1', [id])
      await addToSyncOutbox(this.db, 'tag', id, 'delete', { id })
    })
  }

  async addToTask(taskId: string, tagId: string): Promise<void> {
    await this.db.execute(
      'INSERT INTO task_tags (task_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [taskId, tagId]
    )
  }

  async removeFromTask(taskId: string, tagId: string): Promise<void> {
    await this.db.execute(
      'DELETE FROM task_tags WHERE task_id = $1 AND tag_id = $2',
      [taskId, tagId]
    )
  }

  async batchAddTag(taskIds: string[], tagId: string, batchId?: string): Promise<BatchResult> {
    const bid = batchId || generateId()
    try {
      await this.db.transaction(async () => {
        for (const taskId of taskIds) {
          const task = await this.db.select<Array<{ id: string }>>(
            'SELECT id FROM tasks WHERE id = $1',
            [taskId],
          )
          if (task.length === 0) throw new Error(`Task not found: ${taskId}`)
          await this.db.execute(
            'INSERT INTO task_tags (task_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [taskId, tagId]
          )
          await this.addTaskTagOutbox(taskId, tagId, true, bid)
        }
      })
      return { success: true, affectedCount: taskIds.length, errors: [], undoToken: bid }
    } catch (e) {
      return { success: false, affectedCount: 0, errors: [{ id: 'batch', error: String(e) }], undoToken: null }
    }
  }

  async batchRemoveTag(taskIds: string[], tagId: string, batchId?: string): Promise<BatchResult> {
    const bid = batchId || generateId()
    try {
      await this.db.transaction(async () => {
        for (const taskId of taskIds) {
          const task = await this.db.select<Array<{ id: string }>>(
            'SELECT id FROM tasks WHERE id = $1',
            [taskId],
          )
          if (task.length === 0) throw new Error(`Task not found: ${taskId}`)
          await this.db.execute(
            'DELETE FROM task_tags WHERE task_id = $1 AND tag_id = $2',
            [taskId, tagId]
          )
          await this.addTaskTagOutbox(taskId, tagId, false, bid)
        }
      })
      return { success: true, affectedCount: taskIds.length, errors: [], undoToken: bid }
    } catch (e) {
      return { success: false, affectedCount: 0, errors: [{ id: 'batch', error: String(e) }], undoToken: null }
    }
  }

  private async addTaskTagOutbox(
    taskId: string,
    tagId: string,
    attached: boolean,
    batchId: string,
  ): Promise<void> {
    const now = new Date().toISOString()
    await this.db.execute(
      `INSERT INTO sync_outbox
       (id, operation_id, entity_type, entity_id, operation, payload, batch_id, created_at)
       VALUES ($1, $2, 'task', $3, 'update', $4, $5, $6)`,
      [generateId(), generateId(), taskId, JSON.stringify({ tagId, attached }), batchId, now],
    )
  }
}

export class SQLiteSettingsRepository implements SettingsRepository {
  private db: Database

  constructor(db: Database) {
    this.db = db
  }

  async get(key: string): Promise<string | null> {
    const result = await this.db.select<{ value: string }[]>(
      'SELECT value FROM settings WHERE key = $1',
      [key]
    )
    return result[0]?.value || null
  }

  async set(key: string, value: string): Promise<void> {
    const now = new Date().toISOString()
    await this.db.execute(
      `INSERT INTO settings (key, value, updated_at) VALUES ($1, $2, $3)
       ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = $3`,
      [key, value, now]
    )
  }

  async delete(key: string): Promise<void> {
    await this.db.execute('DELETE FROM settings WHERE key = $1', [key])
  }

  async getAll(): Promise<Record<string, string>> {
    const rows = await this.db.select<{ key: string; value: string }[]>(
      'SELECT key, value FROM settings'
    )
    const result: Record<string, string> = {}
    for (const row of rows) {
      result[row.key] = row.value
    }
    return result
  }
}

// Factory function
export function createSQLiteRepositories(db: Database): Repositories {
  return {
    tasks: new SQLiteTaskRepository(db),
    projects: new SQLiteProjectRepository(db),
    tags: new SQLiteTagRepository(db),
    settings: new SQLiteSettingsRepository(db),
  }
}
