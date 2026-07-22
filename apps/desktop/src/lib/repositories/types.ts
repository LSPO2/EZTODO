/**
 * Repository type definitions
 */

// Task status
export type TaskStatus = 'todo' | 'done' | 'cancelled'

// Task priority
export type TaskPriority = 'p1' | 'p2' | 'p3' | 'p4' | 'none'

// Task source
export type TaskSource = 'manual' | 'ai' | 'import' | 'api'

// Task interface
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

// Create task request
export interface CreateTaskRequest {
  title: string
  parentId?: string
  projectId?: string
  note?: string
  priority?: TaskPriority
  scheduledDate?: string
  scheduledAt?: string
  dueAt?: string
  isAllDay?: boolean
  timezone?: string
  estimatedMinutes?: number
  source?: TaskSource
  sourceCaptureId?: string
}

// Update task request
export interface UpdateTaskRequest {
  title?: string
  parentId?: string
  projectId?: string
  note?: string
  status?: TaskStatus
  priority?: TaskPriority
  sortOrder?: number
  scheduledDate?: string
  scheduledAt?: string
  dueAt?: string
  isAllDay?: boolean
  timezone?: string
  estimatedMinutes?: number
}

// Project interface
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

// Create project request
export interface CreateProjectRequest {
  name: string
  color?: string
  icon?: string
}

// Update project request
export interface UpdateProjectRequest {
  name?: string
  color?: string
  icon?: string
  sortOrder?: number
}

// Tag interface
export interface Tag {
  id: string
  name: string
  color: string | null
  createdAt: string
}

// Create tag request
export interface CreateTagRequest {
  name: string
  color?: string
}

// Update tag request
export interface UpdateTagRequest {
  name?: string
  color?: string
}

// Reminder interface
export interface Reminder {
  id: string
  taskId: string
  remindAt: string
  status: 'pending' | 'triggered' | 'confirmed' | 'snoozed' | 'cancelled'
  snoozedUntil: string | null
  createdAt: string
  updatedAt: string
}

// Create reminder request
export interface CreateReminderRequest {
  taskId: string
  remindAt: string
}

// Update reminder request
export interface UpdateReminderRequest {
  remindAt?: string
  status?: Reminder['status']
  snoozedUntil?: string
}

// Recurrence rule interface
export interface RecurrenceRule {
  id: string
  taskId: string
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom'
  interval: number
  daysOfWeek: number[] | null
  dayOfMonth: number | null
  monthOfYear: number | null
  startDate: string
  endDate: string | null
  maxOccurrences: number | null
  createdAt: string
  updatedAt: string
}

// Create recurrence rule request
export interface CreateRecurrenceRuleRequest {
  taskId: string
  frequency: RecurrenceRule['frequency']
  interval?: number
  daysOfWeek?: number[]
  dayOfMonth?: number
  monthOfYear?: number
  startDate: string
  endDate?: string
  maxOccurrences?: number
}

// View types
export type ViewType = 'inbox' | 'today' | 'week' | 'overdue' | 'no-date' | 'completed' | 'trash'

// Filters
export interface TaskFilters {
  projectId?: string
  tagIds?: string[]
  priority?: TaskPriority
  status?: TaskStatus
  search?: string
}

// Sort options
export type SortField = 'scheduledDate' | 'dueAt' | 'createdAt' | 'sortOrder' | 'priority'
export type SortDirection = 'asc' | 'desc'

export interface SortOptions {
  field: SortField
  direction: SortDirection
}

// Sync operation
export interface SyncOperation {
  id: string
  operationId: string
  entityType: 'task' | 'reminder' | 'recurrence_rule' | 'project' | 'tag'
  entityId: string
  operation: 'create' | 'update' | 'delete'
  payload: Record<string, unknown>
  baseRevision: number | null
  createdAt: string
  syncedAt: string | null
}
