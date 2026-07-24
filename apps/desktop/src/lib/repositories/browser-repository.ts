/**
 * Browser-compatible repository using localStorage
 * DEMO/TEST ONLY - Not for production use
 */

import { v7 as uuidv7 } from 'uuid'
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

const STORAGE_KEY = 'eztodo_db'

function getDb(): any {
  const data = localStorage.getItem(STORAGE_KEY)
  return data ? JSON.parse(data) : { tasks: [], projects: [], tags: [], taskTags: [], settings: {} }
}

function saveDb(db: any): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db))
}

function generateId(): string {
  return uuidv7()
}

export class BrowserTaskRepository implements TaskRepository {
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

    const db = getDb()
    const now = new Date().toISOString()

    const task: Task = {
      id: generateId(),
      parentId: request.parentId || null,
      projectId: request.projectId || null,
      title: request.title.trim(),
      note: request.note?.trim() || null,
      status: 'todo',
      priority: request.priority || 'none',
      sortOrder: request.sortOrder || db.tasks.length,
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

    db.tasks.push(task)
    saveDb(db)
    return task
  }

  async findById(id: string): Promise<Task | null> {
    const db = getDb()
    return db.tasks.find((t: Task) => t.id === id) || null
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

    const db = getDb()
    const now = new Date().toISOString()
    const index = db.tasks.findIndex((t: Task) => t.id === id)

    if (index === -1) throw new Error(`Task not found: ${id}`)

    const task = db.tasks[index]
    const updated: Task = {
      ...task,
      ...updates,
      updatedAt: now,
      revision: task.revision + 1,
    }

    if (updates.status === 'done' && task.status !== 'done') {
      updated.completedAt = now
    } else if (updates.status === 'todo' && task.status === 'done') {
      updated.completedAt = null
    }

    db.tasks[index] = updated
    saveDb(db)
    return updated
  }

  async delete(id: string): Promise<void> {
    const db = getDb()
    const now = new Date().toISOString()
    const index = db.tasks.findIndex((t: Task) => t.id === id)

    if (index !== -1) {
      db.tasks[index].deletedAt = now
      saveDb(db)
    }
  }

  async restore(id: string): Promise<Task> {
    const db = getDb()
    const now = new Date().toISOString()
    const index = db.tasks.findIndex((t: Task) => t.id === id)

    if (index === -1) throw new Error(`Task not found: ${id}`)

    db.tasks[index].deletedAt = null
    db.tasks[index].updatedAt = now
    saveDb(db)
    return db.tasks[index]
  }

  async permanentlyDelete(id: string): Promise<void> {
    const db = getDb()
    db.tasks = db.tasks.filter((t: Task) => t.id !== id)
    saveDb(db)
  }

  async findByView(view: ViewType, filters?: TaskFilters): Promise<Task[]> {
    const db = getDb()
    const now = new Date()
    const today = now.toISOString().split('T')[0]

    let tasks: Task[] = db.tasks.filter((t: Task) => !t.deletedAt)

    // Apply view filter
    switch (view) {
      case 'inbox':
        tasks = tasks.filter((t: Task) => !t.projectId && !t.parentId && t.status === 'todo')
        break
      case 'today':
        tasks = tasks.filter((t: Task) =>
          !t.parentId && t.status === 'todo' &&
          (t.scheduledDate === today || !t.scheduledDate)
        )
        break
      case 'week': {
        const weekLater = new Date(now)
        weekLater.setDate(weekLater.getDate() + 7)
        const weekStr = weekLater.toISOString().split('T')[0]
        tasks = tasks.filter((t: Task) =>
          !t.parentId && t.status === 'todo' &&
          t.scheduledDate && t.scheduledDate <= weekStr
        )
        break
      }
      case 'overdue':
        tasks = tasks.filter((t: Task) =>
          !t.parentId && t.status === 'todo' &&
          t.dueAt && new Date(t.dueAt) < now
        )
        break
      case 'no-date':
        tasks = tasks.filter((t: Task) =>
          !t.parentId && t.status === 'todo' &&
          !t.scheduledDate && !t.dueAt
        )
        break
      case 'completed':
        tasks = tasks.filter((t: Task) => !t.parentId && t.status === 'done')
        break
      case 'trash':
        tasks = db.tasks.filter((t: Task) => t.deletedAt)
        break
    }

    // parentOnly override
    if (filters?.parentOnly) {
      tasks = tasks.filter((t: Task) => !t.parentId)
    }

    // Apply filters
    if (filters?.projectId) {
      tasks = tasks.filter((t: Task) => t.projectId === filters.projectId)
    }
    if (filters?.priority) {
      tasks = tasks.filter((t: Task) => t.priority === filters.priority)
    }
    if (filters?.status && view !== 'trash') {
      tasks = tasks.filter((t: Task) => t.status === filters.status)
    }
    if (filters?.search) {
      const q = filters.search.toLowerCase()
      tasks = tasks.filter((t: Task) =>
        t.title.toLowerCase().includes(q) ||
        (t.note && t.note.toLowerCase().includes(q))
      )
    }
    // Tag filtering (AND semantics: task must have ALL specified tags)
    if (filters?.tagIds && filters.tagIds.length > 0) {
      const taskTags = db.taskTags || []
      tasks = tasks.filter((t: Task) => {
        const myTagIds = taskTags
          .filter((link: { taskId: string }) => link.taskId === t.id)
          .map((link: { tagId: string }) => link.tagId)
        return filters.tagIds!.every(tagId => myTagIds.includes(tagId))
      })
    }

    // Sort
    const sort = filters?.sort
    const sortField = sort?.field || 'sortOrder'
    const sortDir = sort?.direction === 'desc' ? -1 : 1
    tasks.sort((a, b) => {
      const getVal = (t: Task, field: string): string | number | null => {
        switch (field) {
          case 'sortOrder': return t.sortOrder
          case 'createdAt': return t.createdAt
          case 'scheduledDate': return t.scheduledDate
          case 'dueAt': return t.dueAt
          case 'priority': {
            const order: Record<string, number> = { p1: 1, p2: 2, p3: 3, p4: 4, none: 5 }
            return order[t.priority] ?? 5
          }
          default: return t.sortOrder
        }
      }
      const va = getVal(a, sortField)
      const vb = getVal(b, sortField)
      if (va === vb) return 0
      if (va === null) return 1
      if (vb === null) return -1
      return va < vb ? -sortDir : sortDir
    })

    return tasks
  }

  async search(query: string): Promise<Task[]> {
    const db = getDb()
    const q = query.toLowerCase()
    return db.tasks.filter((t: Task) =>
      !t.deletedAt &&
      (t.title.toLowerCase().includes(q) || (t.note && t.note.toLowerCase().includes(q)))
    )
  }

  async findByParentId(parentId: string): Promise<Task[]> {
    const db = getDb()
    return db.tasks.filter((t: Task) => t.parentId === parentId && !t.deletedAt)
  }

  async batchComplete(ids: string[], _batchId?: string): Promise<BatchResult> {
    const errors: Array<{ id: string; error: string }> = []
    let affected = 0

    for (const id of ids) {
      try {
        await this.update(id, { status: 'done' })
        affected++
      } catch (e) {
        errors.push({ id, error: String(e) })
      }
    }

    return { success: errors.length === 0, affectedCount: affected, errors, undoToken: null }
  }

  async batchDelete(ids: string[], _batchId?: string): Promise<BatchResult> {
    const errors: Array<{ id: string; error: string }> = []
    let affected = 0

    for (const id of ids) {
      try {
        await this.delete(id)
        affected++
      } catch (e) {
        errors.push({ id, error: String(e) })
      }
    }

    return { success: errors.length === 0, affectedCount: affected, errors, undoToken: null }
  }

  async batchRestore(ids: string[], _batchId?: string): Promise<BatchResult> {
    const errors: Array<{ id: string; error: string }> = []
    let affected = 0

    for (const id of ids) {
      try {
        await this.restore(id)
        affected++
      } catch (e) {
        errors.push({ id, error: String(e) })
      }
    }

    return { success: errors.length === 0, affectedCount: affected, errors, undoToken: null }
  }

  async batchUpdate(ids: string[], updates: UpdateTaskRequest, _batchId?: string): Promise<BatchResult> {
    const errors: Array<{ id: string; error: string }> = []
    let affected = 0

    for (const id of ids) {
      try {
        await this.update(id, updates)
        affected++
      } catch (e) {
        errors.push({ id, error: String(e) })
      }
    }

    return { success: errors.length === 0, affectedCount: affected, errors, undoToken: null }
  }

  async getChildren(parentId: string): Promise<Task[]> {
    return this.findByParentId(parentId)
  }

  async getDescendants(parentId: string): Promise<Task[]> {
    const db = getDb()
    const result: Task[] = []

    const collectDescendants = (pid: string) => {
      const children = db.tasks.filter((t: Task) => t.parentId === pid && !t.deletedAt)
      for (const child of children) {
        result.push(child)
        collectDescendants(child.id)
      }
    }

    collectDescendants(parentId)
    return result
  }

  async moveTask(id: string, newParentId: string | null): Promise<void> {
    const db = getDb()
    const now = new Date().toISOString()
    const index = db.tasks.findIndex((t: Task) => t.id === id)

    if (index !== -1) {
      db.tasks[index].parentId = newParentId
      db.tasks[index].updatedAt = now
      saveDb(db)
    }
  }

  async getSnapshots(ids: string[]): Promise<TaskSnapshot[]> {
    const db = getDb()
    return ids.map((id) => {
      const task = db.tasks.find((t: Task) => t.id === id)
      if (!task) return null
      const tagIds = (db.taskTags || [])
        .filter((link: { taskId: string; tagId: string }) => link.taskId === id)
        .map((link: { tagId: string }) => link.tagId)
      return {
        id: task.id,
        status: task.status,
        priority: task.priority,
        projectId: task.projectId,
        parentId: task.parentId,
        deletedAt: task.deletedAt,
        tagIds,
      }
    }).filter((s): s is TaskSnapshot => s !== null)
  }

  async restoreSnapshots(snapshots: TaskSnapshot[], batchId: string): Promise<BatchResult> {
    const db = getDb()
    const nextDb = structuredClone(db)
    const now = new Date().toISOString()

    try {
      for (const snapshot of snapshots) {
        const index = nextDb.tasks.findIndex((task: Task) => task.id === snapshot.id)
        if (index < 0) throw new Error(`Task not found: ${snapshot.id}`)
        nextDb.tasks[index] = {
          ...nextDb.tasks[index],
          status: snapshot.status,
          priority: snapshot.priority,
          projectId: snapshot.projectId,
          parentId: snapshot.parentId,
          deletedAt: snapshot.deletedAt,
          completedAt: snapshot.status === 'done' ? nextDb.tasks[index].completedAt : null,
          updatedAt: now,
          revision: nextDb.tasks[index].revision + 1,
        }
        nextDb.taskTags = (nextDb.taskTags || []).filter(
          (link: { taskId: string }) => link.taskId !== snapshot.id,
        )
        for (const tagId of snapshot.tagIds) {
          nextDb.taskTags.push({ taskId: snapshot.id, tagId })
        }
      }
      saveDb(nextDb)
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
    // Browser repository doesn't have real sync
    return []
  }

  async markSynced(_operationIds: string[]): Promise<void> {
    // Browser repository doesn't have real sync
  }
}

export class BrowserProjectRepository implements ProjectRepository {
  async create(request: CreateProjectRequest): Promise<Project> {
    const db = getDb()
    const now = new Date().toISOString()

    const project: Project = {
      id: generateId(),
      name: request.name.trim(),
      color: request.color || null,
      icon: request.icon || null,
      sortOrder: db.projects.length,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    }

    db.projects.push(project)
    saveDb(db)
    return project
  }

  async findById(id: string): Promise<Project | null> {
    const db = getDb()
    return db.projects.find((p: Project) => p.id === id) || null
  }

  async findAll(): Promise<Project[]> {
    const db = getDb()
    return db.projects.filter((p: Project) => !p.deletedAt)
  }

  async update(id: string, updates: UpdateProjectRequest): Promise<Project> {
    const db = getDb()
    const now = new Date().toISOString()
    const index = db.projects.findIndex((p: Project) => p.id === id)

    if (index === -1) throw new Error(`Project not found: ${id}`)

    db.projects[index] = {
      ...db.projects[index],
      ...updates,
      updatedAt: now,
    }

    saveDb(db)
    return db.projects[index]
  }

  async delete(id: string): Promise<void> {
    const db = getDb()
    const now = new Date().toISOString()
    const index = db.projects.findIndex((p: Project) => p.id === id)

    if (index !== -1) {
      db.projects[index].deletedAt = now
      saveDb(db)
    }
  }
}

export class BrowserTagRepository implements TagRepository {
  async create(request: CreateTagRequest): Promise<Tag> {
    const db = getDb()
    const now = new Date().toISOString()

    const tag: Tag = {
      id: generateId(),
      name: request.name.trim(),
      color: request.color || null,
      createdAt: now,
    }

    if (!db.tags) db.tags = []
    db.tags.push(tag)
    saveDb(db)
    return tag
  }

  async findById(id: string): Promise<Tag | null> {
    const db = getDb()
    return (db.tags || []).find((t: Tag) => t.id === id) || null
  }

  async findAll(): Promise<Tag[]> {
    const db = getDb()
    return db.tags || []
  }

  async findByTaskId(taskId: string): Promise<Tag[]> {
    const db = getDb()
    const tagIds = new Set<string>((db.taskTags || []).filter((link: { taskId: string }) => link.taskId === taskId).map((link: { tagId: string }) => link.tagId))
    return (db.tags || []).filter((tag: Tag) => tagIds.has(tag.id))
  }

  async update(id: string, updates: UpdateTagRequest): Promise<Tag> {
    const db = getDb()
    const index = (db.tags || []).findIndex((t: Tag) => t.id === id)

    if (index === -1) throw new Error(`Tag not found: ${id}`)

    db.tags[index] = {
      ...db.tags[index],
      ...updates,
    }

    saveDb(db)
    return db.tags[index]
  }

  async delete(id: string): Promise<void> {
    const db = getDb()
    db.tags = (db.tags || []).filter((t: Tag) => t.id !== id)
    saveDb(db)
  }

  async addToTask(taskId: string, tagId: string): Promise<void> {
    const db = getDb()
    db.taskTags ||= []
    if (!db.taskTags.some((link: { taskId: string; tagId: string }) => link.taskId === taskId && link.tagId === tagId)) {
      db.taskTags.push({ taskId, tagId })
      saveDb(db)
    }
  }

  async removeFromTask(taskId: string, tagId: string): Promise<void> {
    const db = getDb()
    db.taskTags = (db.taskTags || []).filter((link: { taskId: string; tagId: string }) => link.taskId !== taskId || link.tagId !== tagId)
    saveDb(db)
  }

  async batchAddTag(taskIds: string[], tagId: string): Promise<BatchResult> {
    const errors: Array<{ id: string; error: string }> = []
    let affected = 0
    for (const taskId of taskIds) {
      try {
        await this.addToTask(taskId, tagId)
        affected++
      } catch (e) {
        errors.push({ id: taskId, error: String(e) })
      }
    }
    return { success: errors.length === 0, affectedCount: affected, errors, undoToken: null }
  }

  async batchRemoveTag(taskIds: string[], tagId: string): Promise<BatchResult> {
    const errors: Array<{ id: string; error: string }> = []
    let affected = 0
    for (const taskId of taskIds) {
      try {
        await this.removeFromTask(taskId, tagId)
        affected++
      } catch (e) {
        errors.push({ id: taskId, error: String(e) })
      }
    }
    return { success: errors.length === 0, affectedCount: affected, errors, undoToken: null }
  }
}

export class BrowserSettingsRepository implements SettingsRepository {
  async get(key: string): Promise<string | null> {
    const db = getDb()
    return db.settings?.[key] || null
  }

  async set(key: string, value: string): Promise<void> {
    const db = getDb()
    if (!db.settings) db.settings = {}
    db.settings[key] = value
    saveDb(db)
  }

  async delete(key: string): Promise<void> {
    const db = getDb()
    if (db.settings) {
      delete db.settings[key]
      saveDb(db)
    }
  }

  async getAll(): Promise<Record<string, string>> {
    const db = getDb()
    return db.settings || {}
  }
}

// Factory function
export function createBrowserRepositories(): Repositories {
  return {
    tasks: new BrowserTaskRepository(),
    projects: new BrowserProjectRepository(),
    tags: new BrowserTagRepository(),
    settings: new BrowserSettingsRepository(),
  }
}
