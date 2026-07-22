/**
 * Browser-compatible repository using localStorage
 */

import { v4 as uuidv4 } from 'uuid'
import type {
  Task,
  CreateTaskRequest,
  UpdateTaskRequest,
  TaskFilters,
  ViewType,
  Project,
  Tag,
} from './types'

const STORAGE_KEY = 'eztodo_db'

function getDb(): any {
  const data = localStorage.getItem(STORAGE_KEY)
  return data ? JSON.parse(data) : { tasks: [], projects: [], tags: [] }
}

function saveDb(db: any): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db))
}

export class BrowserTaskRepository {
  async create(request: CreateTaskRequest): Promise<Task> {
    const db = getDb()
    const now = new Date().toISOString()

    const task: Task = {
      id: uuidv4(),
      parentId: request.parentId || null,
      projectId: request.projectId || null,
      title: request.title.trim(),
      note: request.note?.trim() || null,
      status: 'todo',
      priority: request.priority || 'none',
      sortOrder: db.tasks.length,
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

  async update(id: string, updates: UpdateTaskRequest): Promise<Task> {
    const db = getDb()
    const now = new Date().toISOString()

    const index = db.tasks.findIndex((t: Task) => t.id === id)
    if (index === -1) {
      throw new Error(`Task not found: ${id}`)
    }

    const task = db.tasks[index]
    const updatedTask: Task = {
      ...task,
      ...updates,
      updatedAt: now,
      revision: task.revision + 1,
    }

    if (updates.status === 'done' && task.status !== 'done') {
      updatedTask.completedAt = now
    } else if (updates.status === 'todo' && task.status === 'done') {
      updatedTask.completedAt = null
    }

    db.tasks[index] = updatedTask
    saveDb(db)

    return updatedTask
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
    if (index !== -1) {
      db.tasks[index].deletedAt = null
      db.tasks[index].updatedAt = now
      saveDb(db)
      return db.tasks[index]
    }

    throw new Error(`Task not found: ${id}`)
  }

  async findById(id: string): Promise<Task | null> {
    const db = getDb()
    return db.tasks.find((t: Task) => t.id === id) || null
  }

  async findByView(view: ViewType, filters?: TaskFilters): Promise<Task[]> {
    const db = getDb()
    const now = new Date()
    const today = now.toISOString().split('T')[0]
    const weekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

    let tasks: Task[] = db.tasks.filter((t: Task) => !t.deletedAt)

    switch (view) {
      case 'inbox':
        tasks = tasks.filter((t: Task) => !t.projectId && t.status === 'todo')
        break
      case 'today':
        tasks = tasks.filter((t: Task) => {
          const isToday = t.scheduledDate === today
          const isDueToday = t.dueAt && new Date(t.dueAt).toISOString().split('T')[0] === today
          const isOverdue = t.dueAt && new Date(t.dueAt) < now && t.status === 'todo'
          return (isToday || isDueToday || isOverdue) && t.status === 'todo'
        })
        break
      case 'week':
        tasks = tasks.filter((t: Task) => {
          if (!t.scheduledDate) return false
          const date = new Date(t.scheduledDate)
          return date >= now && date <= weekLater && t.status === 'todo'
        })
        break
      case 'overdue':
        tasks = tasks.filter((t: Task) => {
          return t.dueAt && new Date(t.dueAt) < now && t.status === 'todo'
        })
        break
      case 'completed':
        tasks = tasks.filter((t: Task) => t.status === 'done')
        break
      case 'trash':
        tasks = db.tasks.filter((t: Task) => t.deletedAt)
        break
    }

    // Apply filters
    if (filters?.projectId) {
      tasks = tasks.filter((t: Task) => t.projectId === filters.projectId)
    }
    if (filters?.priority) {
      tasks = tasks.filter((t: Task) => t.priority === filters.priority)
    }
    if (filters?.status) {
      tasks = tasks.filter((t: Task) => t.status === filters.status)
    }
    if (filters?.search) {
      const search = filters.search.toLowerCase()
      tasks = tasks.filter((t: Task) =>
        t.title.toLowerCase().includes(search) ||
        (t.note && t.note.toLowerCase().includes(search))
      )
    }

    return tasks
  }

  async search(query: string): Promise<Task[]> {
    const db = getDb()
    const search = query.toLowerCase()

    return db.tasks.filter((t: Task) =>
      !t.deletedAt &&
      (t.title.toLowerCase().includes(search) ||
        (t.note && t.note.toLowerCase().includes(search)))
    )
  }

  async getChildren(parentId: string): Promise<Task[]> {
    const db = getDb()
    return db.tasks.filter((t: Task) => t.parentId === parentId && !t.deletedAt)
  }

  async batchUpdate(ids: string[], updates: UpdateTaskRequest): Promise<void> {
    const db = getDb()
    const now = new Date().toISOString()

    ids.forEach(id => {
      const index = db.tasks.findIndex((t: Task) => t.id === id)
      if (index !== -1) {
        db.tasks[index] = {
          ...db.tasks[index],
          ...updates,
          updatedAt: now,
          revision: db.tasks[index].revision + 1,
        }
      }
    })

    saveDb(db)
  }

  async batchDelete(ids: string[]): Promise<void> {
    const db = getDb()
    const now = new Date().toISOString()

    ids.forEach(id => {
      const index = db.tasks.findIndex((t: Task) => t.id === id)
      if (index !== -1) {
        db.tasks[index].deletedAt = now
      }
    })

    saveDb(db)
  }

  async batchRestore(ids: string[]): Promise<void> {
    const db = getDb()
    const now = new Date().toISOString()

    ids.forEach(id => {
      const index = db.tasks.findIndex((t: Task) => t.id === id)
      if (index !== -1) {
        db.tasks[index].deletedAt = null
        db.tasks[index].updatedAt = now
      }
    })

    saveDb(db)
  }
}

export class BrowserProjectRepository {
  async findAll(): Promise<Project[]> {
    const db = getDb()
    return db.projects.filter((p: Project) => !p.deletedAt)
  }

  async create(request: { name: string; color?: string; icon?: string }): Promise<Project> {
    const db = getDb()
    const now = new Date().toISOString()

    const project: Project = {
      id: uuidv4(),
      name: request.name,
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
}

export class BrowserTagRepository {
  async findAll(): Promise<Tag[]> {
    const db = getDb()
    return db.tags || []
  }

  async create(request: { name: string; color?: string }): Promise<Tag> {
    const db = getDb()
    const now = new Date().toISOString()

    const tag: Tag = {
      id: uuidv4(),
      name: request.name,
      color: request.color || null,
      createdAt: now,
    }

    if (!db.tags) db.tags = []
    db.tags.push(tag)
    saveDb(db)

    return tag
  }
}
