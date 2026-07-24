/**
 * Repository type definitions
 * All repositories must implement these interfaces
 */

// Task types
export type TaskStatus = 'todo' | 'done' | 'cancelled'
export type TaskPriority = 'p1' | 'p2' | 'p3' | 'p4' | 'none'
export type TaskSource = 'manual' | 'ai' | 'import' | 'api' | 'recurrence'

export interface Task {
  id: string
  parentId: string | null
  projectId: string | null
  title: string
  note: string | null
  status: TaskStatus
  priority: TaskPriority
  sortOrder: number
  scheduledDate: string | null
  scheduledAt: string | null
  dueAt: string | null
  isAllDay: boolean
  timezone: string
  estimatedMinutes: number | null
  createdAt: string
  updatedAt: string
  completedAt: string | null
  deletedAt: string | null
  revision: number
  source: TaskSource
  sourceCaptureId: string | null
}

export interface CreateTaskRequest {
  title: string
  parentId?: string
  projectId?: string
  note?: string
  priority?: TaskPriority
  sortOrder?: number
  scheduledDate?: string
  scheduledAt?: string
  dueAt?: string
  isAllDay?: boolean
  timezone?: string
  estimatedMinutes?: number
  source?: TaskSource
  sourceCaptureId?: string
}

export interface UpdateTaskRequest {
  title?: string
  parentId?: string | null
  projectId?: string | null
  note?: string | null
  status?: TaskStatus
  priority?: TaskPriority
  sortOrder?: number
  scheduledDate?: string | null
  scheduledAt?: string | null
  dueAt?: string | null
  isAllDay?: boolean
  timezone?: string
  estimatedMinutes?: number | null
}

// Project types
export interface Project {
  id: string
  name: string
  color: string | null
  icon: string | null
  sortOrder: number
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface CreateProjectRequest {
  name: string
  color?: string
  icon?: string
}

export interface UpdateProjectRequest {
  name?: string
  color?: string
  icon?: string
  sortOrder?: number
}

// Tag types
export interface Tag {
  id: string
  name: string
  color: string | null
  createdAt: string
}

export interface CreateTagRequest {
  name: string
  color?: string
}

export interface UpdateTagRequest {
  name?: string
  color?: string
}

// View and filter types
export type ViewType = 'inbox' | 'today' | 'week' | 'overdue' | 'no-date' | 'completed' | 'trash'

export interface TaskFilters {
  projectId?: string
  tagIds?: string[]
  priority?: TaskPriority
  status?: TaskStatus
  search?: string
  /** If true, only return root tasks (parent_id IS NULL) regardless of view */
  parentOnly?: boolean
  /** Sort specification; defaults to { field: 'sortOrder', direction: 'asc' } */
  sort?: SortOptions
}

export type SortField = 'scheduledDate' | 'dueAt' | 'createdAt' | 'sortOrder' | 'priority'
export type SortDirection = 'asc' | 'desc'

export interface SortOptions {
  field: SortField
  direction: SortDirection
}

// Sync types
export interface SyncOperation {
  id: string
  operationId: string
  entityType: 'task' | 'reminder' | 'recurrence_rule' | 'project' | 'tag'
  entityId: string
  operation: 'create' | 'update' | 'delete'
  payload: Record<string, unknown>
  baseRevision: number | null
  /** Groups multiple outbox rows from the same batch operation */
  batchId: string | null
  createdAt: string
  syncedAt: string | null
}

// Batch operation result
export interface BatchResult {
  success: boolean
  affectedCount: number
  errors: Array<{ id: string; error: string }>
  /** Unique token that identifies this batch for undo purposes */
  undoToken: string | null
}

/** Describes one undoable batch so the UI can present "Undo" */
export interface UndoableBatch {
  undoToken: string
  operation: string
  taskIds: string[]
  snapshot: TaskSnapshot[]
  createdAt: string
}

/** Captures enough state to reverse a single task change */
export interface TaskSnapshot {
  id: string
  status: TaskStatus
  priority: TaskPriority
  projectId: string | null
  parentId: string | null
  deletedAt: string | null
  tagIds: string[]
}

// Repository interfaces
export interface TaskRepository {
  // CRUD
  create(request: CreateTaskRequest): Promise<Task>
  findById(id: string): Promise<Task | null>
  update(id: string, updates: UpdateTaskRequest): Promise<Task>
  delete(id: string): Promise<void>  // soft delete
  restore(id: string): Promise<Task>
  permanentlyDelete(id: string): Promise<void>

  // Query
  findByView(view: ViewType, filters?: TaskFilters): Promise<Task[]>
  search(query: string): Promise<Task[]>
  findByParentId(parentId: string): Promise<Task[]>

  // Batch (batchId groups outbox rows from the same operation)
  batchComplete(ids: string[], batchId?: string): Promise<BatchResult>
  batchDelete(ids: string[], batchId?: string): Promise<BatchResult>
  batchRestore(ids: string[], batchId?: string): Promise<BatchResult>
  batchUpdate(ids: string[], updates: UpdateTaskRequest, batchId?: string): Promise<BatchResult>

  // Hierarchy
  getChildren(parentId: string): Promise<Task[]>
  getDescendants(parentId: string): Promise<Task[]>
  moveTask(id: string, newParentId: string | null): Promise<void>

  // Snapshot (for undo support)
  getSnapshots(ids: string[]): Promise<TaskSnapshot[]>
  /** Restore task fields and tag links from snapshots as one atomic undo operation. */
  restoreSnapshots(snapshots: TaskSnapshot[], batchId: string): Promise<BatchResult>

  // Sync
  getPendingSync(): Promise<SyncOperation[]>
  markSynced(operationIds: string[]): Promise<void>
}

export interface ProjectRepository {
  create(request: CreateProjectRequest): Promise<Project>
  findById(id: string): Promise<Project | null>
  findAll(): Promise<Project[]>
  update(id: string, updates: UpdateProjectRequest): Promise<Project>
  delete(id: string): Promise<void>
}

export interface TagRepository {
  create(request: CreateTagRequest): Promise<Tag>
  findById(id: string): Promise<Tag | null>
  findAll(): Promise<Tag[]>
  findByTaskId(taskId: string): Promise<Tag[]>
  update(id: string, updates: UpdateTagRequest): Promise<Tag>
  delete(id: string): Promise<void>
  addToTask(taskId: string, tagId: string): Promise<void>
  removeFromTask(taskId: string, tagId: string): Promise<void>
  /** Transactional batch add tag */
  batchAddTag(taskIds: string[], tagId: string, batchId?: string): Promise<BatchResult>
  /** Transactional batch remove tag */
  batchRemoveTag(taskIds: string[], tagId: string, batchId?: string): Promise<BatchResult>
}

export interface SettingsRepository {
  get(key: string): Promise<string | null>
  set(key: string, value: string): Promise<void>
  delete(key: string): Promise<void>
  getAll(): Promise<Record<string, string>>
}

// Repository container
export interface Repositories {
  tasks: TaskRepository
  projects: ProjectRepository
  tags: TagRepository
  settings: SettingsRepository
}

// Validation helpers
export function validateTaskTitle(title: string): { valid: boolean; error?: string } {
  const trimmed = title.trim()
  if (!trimmed) return { valid: false, error: '标题不能为空' }
  if (trimmed.length > 500) return { valid: false, error: '标题不能超过500字符' }
  return { valid: true }
}

export function validateTaskPriority(priority: string): priority is TaskPriority {
  return ['p1', 'p2', 'p3', 'p4', 'none'].includes(priority)
}

export function validateTaskStatus(status: string): status is TaskStatus {
  return ['todo', 'done', 'cancelled'].includes(status)
}

// Hierarchy validation
export function validateHierarchy(taskId: string, newParentId: string | null, tasks: Task[]): { valid: boolean; error?: string } {
  if (!newParentId) return { valid: true }

  // Cannot move to self
  if (taskId === newParentId) {
    return { valid: false, error: '不能将任务移动到自己下面' }
  }

  // Check if newParentId is a descendant of taskId
  const isDescendant = (parentId: string, targetId: string): boolean => {
    const children = tasks.filter(t => t.parentId === parentId)
    for (const child of children) {
      if (child.id === targetId) return true
      if (isDescendant(child.id, targetId)) return true
    }
    return false
  }

  if (isDescendant(taskId, newParentId)) {
    return { valid: false, error: '不能将任务移动到自己的子任务下面' }
  }

  // Check max depth (3 levels)
  const getDepth = (taskId: string): number => {
    const task = tasks.find(t => t.id === taskId)
    if (!task || !task.parentId) return 0
    return 1 + getDepth(task.parentId)
  }

  const targetDepth = getDepth(newParentId)
  const maxDescendantDepth = getMaxDescendantDepth(taskId, tasks)

  if (targetDepth + 1 + maxDescendantDepth > 3) {
    return { valid: false, error: '移动后层级超过3级' }
  }

  return { valid: true }
}

function getMaxDescendantDepth(taskId: string, tasks: Task[]): number {
  const children = tasks.filter(t => t.parentId === taskId)
  if (children.length === 0) return 0
  return 1 + Math.max(...children.map(c => getMaxDescendantDepth(c.id, tasks)))
}

// Task completion helpers
export function shouldAutoCompleteParent(parentId: string, tasks: Task[]): boolean {
  const children = tasks.filter(t => t.parentId === parentId && !t.deletedAt)
  return children.length > 0 && children.every(t => t.status === 'done')
}

export function hasUncompletedChildren(parentId: string, tasks: Task[]): boolean {
  const children = tasks.filter(t => t.parentId === parentId && !t.deletedAt)
  return children.some(t => t.status !== 'done')
}

// Trash helpers
export function isExpired(deletedAt: string, retentionDays: number = 30): boolean {
  const deleted = new Date(deletedAt)
  const expires = new Date(deleted.getTime() + retentionDays * 24 * 60 * 60 * 1000)
  return expires < new Date()
}
