/**
 * Task store using Zustand
 * Uses TaskService for business logic, BatchService for batch + undo
 */

import { create } from 'zustand'
import { getRepositories } from '../lib/repositories'
import type { Task, CreateTaskRequest, UpdateTaskRequest, ViewType, TaskFilters, BatchResult, TaskPriority } from '../lib/repositories'
import { taskService } from '../lib/services/task-service'
import * as batchService from '../lib/services/batch-service'

interface TaskState {
  tasks: Task[]
  currentTask: Task | null
  currentView: ViewType
  filters: TaskFilters
  selectedTaskIds: Set<string>
  isLoading: boolean
  error: string | null
  warnings: string[]
  /** Last undoable batch info, or null when nothing to undo */
  undoableBatch: { operation: string; count: number } | null

  setView: (view: ViewType) => void
  setFilters: (filters: TaskFilters) => void
  clearFilters: () => void
  loadTasks: () => Promise<void>
  createTask: (request: CreateTaskRequest) => Promise<Task>
  updateTask: (id: string, updates: UpdateTaskRequest) => Promise<Task>
  deleteTask: (id: string) => Promise<void>
  restoreTask: (id: string) => Promise<Task>
  permanentlyDelete: (id: string) => Promise<void>
  completeTask: (id: string, mode?: 'self' | 'withChildren') => Promise<Task>
  uncompleteTask: (id: string, reopenChildren?: boolean) => Promise<Task>
  moveTask: (id: string, newParentId: string | null) => Promise<void>
  indentTask: (id: string) => Promise<void>
  outdentTask: (id: string) => Promise<void>
  selectTask: (id: string) => void
  deselectTask: (id: string) => void
  toggleSelection: (id: string) => void
  selectAll: () => void
  clearSelection: () => void
  batchComplete: () => Promise<BatchResult>
  batchDelete: () => Promise<BatchResult>
  batchRestore: () => Promise<BatchResult>
  batchSetPriority: (priority: TaskPriority) => Promise<BatchResult>
  batchMoveToProject: (projectId: string | null) => Promise<BatchResult>
  batchAddTag: (tagId: string) => Promise<BatchResult>
  batchRemoveTag: (tagId: string) => Promise<BatchResult>
  undoLastBatch: () => Promise<BatchResult>
  copyTask: (id: string, withChildren?: boolean) => Promise<Task>
  reorderSiblingTasks: (parentId: string | null, orderedIds: string[]) => Promise<Task[]>
  searchTasks: (query: string) => Promise<void>
  setCurrentTask: (task: Task | null) => void
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  currentTask: null,
  currentView: 'today',
  filters: {},
  selectedTaskIds: new Set(),
  isLoading: false,
  error: null,
  warnings: [],
  undoableBatch: null,

  setView: (view: ViewType) => {
    set({ currentView: view, filters: {} })
    get().loadTasks()
  },

  setFilters: (filters: TaskFilters) => {
    set({ filters })
    get().loadTasks()
  },

  clearFilters: () => {
    set({ filters: {} })
    get().loadTasks()
  },

  loadTasks: async () => {
    set({ isLoading: true, error: null })
    try {
      const repos = await getRepositories()
      const { currentView, filters } = get()
      const roots = await repos.tasks.findByView(currentView, { ...filters, parentOnly: true })
      const tasks = [...roots]

      if (!filters.parentOnly && currentView !== 'trash') {
        // Fetch all descendants for each root in parallel (avoids N+1)
        const descendantPromises = roots.map(root => repos.tasks.getDescendants(root.id))
        const descendantSets = await Promise.all(descendantPromises)
        const seen = new Set(tasks.map((task) => task.id))
        for (const descendants of descendantSets) {
          for (const child of descendants) {
            if (!seen.has(child.id)) {
              seen.add(child.id)
              tasks.push(child)
            }
          }
        }
      }

      set({ tasks, isLoading: false })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load tasks',
        isLoading: false,
      })
    }
  },

  createTask: async (request: CreateTaskRequest) => {
    set({ isLoading: true, error: null })
    try {
      const result = await taskService.createTask(request)
      if (!result.success) {
        throw new Error(result.error)
      }
      const task = result.data!
      set((state) => ({
        tasks: [task, ...state.tasks],
        isLoading: false,
      }))
      return task
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create task'
      set({ error: message, isLoading: false })
      throw error
    }
  },

  updateTask: async (id: string, updates: UpdateTaskRequest) => {
    set({ isLoading: true, error: null, warnings: [] })
    try {
      const result = await taskService.updateTask(id, updates)
      if (!result.success) {
        throw new Error(result.error)
      }
      const task = result.data!
      set((state) => ({
        tasks: state.tasks.map((t) => (t.id === id ? task : t)),
        currentTask: state.currentTask?.id === id ? task : state.currentTask,
        isLoading: false,
        warnings: result.warnings || [],
      }))
      return task
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update task'
      set({ error: message, isLoading: false })
      throw error
    }
  },

  deleteTask: async (id: string) => {
    set({ isLoading: true, error: null })
    try {
      const result = await taskService.deleteTask(id)
      if (!result.success) {
        throw new Error(result.error)
      }
      set((state) => ({
        tasks: state.tasks.filter((t) => t.id !== id),
        currentTask: state.currentTask?.id === id ? null : state.currentTask,
        selectedTaskIds: new Set([...state.selectedTaskIds].filter(sid => sid !== id)),
        isLoading: false,
      }))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete task'
      set({ error: message, isLoading: false })
      throw error
    }
  },

  restoreTask: async (id: string) => {
    set({ isLoading: true, error: null })
    try {
      const result = await taskService.restoreTask(id)
      if (!result.success) {
        throw new Error(result.error)
      }
      const task = result.data!
      set((state) => ({
        tasks: state.tasks.filter((t) => t.id !== id),
        isLoading: false,
      }))
      return task
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to restore task'
      set({ error: message, isLoading: false })
      throw error
    }
  },

  permanentlyDelete: async (id: string) => {
    set({ isLoading: true, error: null })
    try {
      const repos = await getRepositories()
      await repos.tasks.permanentlyDelete(id)
      set((state) => ({
        tasks: state.tasks.filter((t) => t.id !== id),
        isLoading: false,
      }))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to permanently delete task'
      set({ error: message, isLoading: false })
      throw error
    }
  },

  completeTask: async (id: string, mode?: 'self' | 'withChildren') => {
    set({ isLoading: true, error: null })
    try {
      const result = await taskService.completeTask(id, mode)
      if (!result.success) {
        // If HAS_UNCOMPLETED_CHILDREN, throw a special error the UI can catch
        if (result.error === 'HAS_UNCOMPLETED_CHILDREN') {
          set({ isLoading: false })
          throw new Error('HAS_UNCOMPLETED_CHILDREN')
        }
        throw new Error(result.error)
      }
      const task = result.data!
      await get().loadTasks()
      return task
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to complete task'
      if (message !== 'HAS_UNCOMPLETED_CHILDREN') {
        set({ error: message, isLoading: false })
      }
      throw error
    }
  },

  uncompleteTask: async (id: string, reopenChildren: boolean = false) => {
    set({ isLoading: true, error: null })
    try {
      const result = await taskService.reopenTask(id, reopenChildren)
      if (!result.success) {
        throw new Error(result.error)
      }
      const task = result.data!
      await get().loadTasks()
      return task
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to reopen task'
      set({ error: message, isLoading: false })
      throw error
    }
  },

  moveTask: async (id: string, newParentId: string | null) => {
    set({ isLoading: true, error: null })
    try {
      const result = await taskService.moveTask(id, newParentId)
      if (!result.success) {
        throw new Error(result.error)
      }
      await get().loadTasks()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to move task'
      set({ error: message, isLoading: false })
      throw error
    }
  },

  selectTask: (id: string) => {
    set((state) => ({
      selectedTaskIds: new Set([...state.selectedTaskIds, id]),
    }))
  },

  deselectTask: (id: string) => {
    set((state) => {
      const newSet = new Set(state.selectedTaskIds)
      newSet.delete(id)
      return { selectedTaskIds: newSet }
    })
  },

  toggleSelection: (id: string) => {
    const { selectedTaskIds } = get()
    if (selectedTaskIds.has(id)) {
      get().deselectTask(id)
    } else {
      get().selectTask(id)
    }
  },

  selectAll: () => {
    set((state) => ({
      selectedTaskIds: new Set(state.tasks.map((t) => t.id)),
    }))
  },

  clearSelection: () => {
    set({ selectedTaskIds: new Set() })
  },

  batchComplete: async () => {
    const { selectedTaskIds } = get()
    if (selectedTaskIds.size === 0) {
      return { success: true, affectedCount: 0, errors: [], undoToken: null }
    }

    set({ isLoading: true, error: null })
    try {
      const result = await batchService.batchComplete(Array.from(selectedTaskIds))
      await get().loadTasks()
      const failedIds = new Set(result.errors.map((item) => item.id))
      const last = batchService.getLastUndoableBatch()
      set({
        selectedTaskIds: failedIds,
        isLoading: false,
        error: result.errors.length > 0
          ? result.affectedCount + ' succeeded, ' + result.errors.length + ' failed'
          : null,
        undoableBatch: last ? { operation: last.operation, count: last.taskIds.length } : get().undoableBatch,
      })
      return result
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Batch complete failed'
      set({ error: message, isLoading: false })
      throw error
    }
  },
  batchDelete: async () => {
    const { selectedTaskIds } = get()
    if (selectedTaskIds.size === 0) {
      return { success: true, affectedCount: 0, errors: [], undoToken: null }
    }

    set({ isLoading: true, error: null })
    try {
      const result = await batchService.batchDelete(Array.from(selectedTaskIds))
      await get().loadTasks()
      const failedIds = new Set(result.errors.map((item) => item.id))
      const last = batchService.getLastUndoableBatch()
      set({
        selectedTaskIds: failedIds,
        isLoading: false,
        error: result.errors.length > 0
          ? result.affectedCount + ' succeeded, ' + result.errors.length + ' failed'
          : null,
        undoableBatch: last ? { operation: last.operation, count: last.taskIds.length } : get().undoableBatch,
      })
      return result
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Batch delete failed'
      set({ error: message, isLoading: false })
      throw error
    }
  },
  batchRestore: async () => {
    const { selectedTaskIds } = get()
    if (selectedTaskIds.size === 0) {
      return { success: true, affectedCount: 0, errors: [], undoToken: null }
    }

    set({ isLoading: true, error: null })
    try {
      const result = await batchService.batchRestore(Array.from(selectedTaskIds))
      await get().loadTasks()
      const failedIds = new Set(result.errors.map((item) => item.id))
      const last = batchService.getLastUndoableBatch()
      set({
        selectedTaskIds: failedIds,
        isLoading: false,
        error: result.errors.length > 0
          ? result.affectedCount + ' succeeded, ' + result.errors.length + ' failed'
          : null,
        undoableBatch: last ? { operation: last.operation, count: last.taskIds.length } : get().undoableBatch,
      })
      return result
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Batch restore failed'
      set({ error: message, isLoading: false })
      throw error
    }
  },
  batchSetPriority: async (priority: TaskPriority) => {
    const { selectedTaskIds } = get()
    if (selectedTaskIds.size === 0) {
      return { success: true, affectedCount: 0, errors: [], undoToken: null }
    }

    set({ isLoading: true, error: null })
    const result = await batchService.batchSetPriority(Array.from(selectedTaskIds), priority)
    await get().loadTasks()
    const failedIds = new Set(result.errors.map((item) => item.id))
    const last = batchService.getLastUndoableBatch()
    set({
      selectedTaskIds: failedIds,
      isLoading: false,
      error: result.errors.length > 0
        ? `${result.affectedCount} succeeded, ${result.errors.length} failed`
        : null,
      undoableBatch: last ? { operation: last.operation, count: last.taskIds.length } : get().undoableBatch,
    })
    return result
  },

  batchMoveToProject: async (projectId: string | null) => {
    const { selectedTaskIds } = get()
    if (selectedTaskIds.size === 0) {
      return { success: true, affectedCount: 0, errors: [], undoToken: null }
    }

    set({ isLoading: true, error: null })
    const result = await batchService.batchMoveToProject(Array.from(selectedTaskIds), projectId)
    await get().loadTasks()
    const failedIds = new Set(result.errors.map((item) => item.id))
    const last = batchService.getLastUndoableBatch()
    set({
      selectedTaskIds: failedIds,
      isLoading: false,
      error: result.errors.length > 0
        ? `${result.affectedCount} succeeded, ${result.errors.length} failed`
        : null,
      undoableBatch: last ? { operation: last.operation, count: last.taskIds.length } : get().undoableBatch,
    })
    return result
  },

  batchAddTag: async (tagId: string) => {
    const { selectedTaskIds } = get()
    if (selectedTaskIds.size === 0) {
      return { success: true, affectedCount: 0, errors: [], undoToken: null }
    }
    set({ isLoading: true, error: null })
    const result = await batchService.batchAddTag(Array.from(selectedTaskIds), tagId)
    const failedIds = new Set(result.errors.map((item) => item.id))
    const last = batchService.getLastUndoableBatch()
    set({
      selectedTaskIds: failedIds,
      isLoading: false,
      error: result.errors.length > 0
        ? result.affectedCount + ' succeeded, ' + result.errors.length + ' failed'
        : null,
      undoableBatch: last ? { operation: last.operation, count: last.taskIds.length } : get().undoableBatch,
    })
    return result
  },

  batchRemoveTag: async (tagId: string) => {
    const { selectedTaskIds } = get()
    if (selectedTaskIds.size === 0) {
      return { success: true, affectedCount: 0, errors: [], undoToken: null }
    }
    set({ isLoading: true, error: null })
    const result = await batchService.batchRemoveTag(Array.from(selectedTaskIds), tagId)
    const failedIds = new Set(result.errors.map((item) => item.id))
    const last = batchService.getLastUndoableBatch()
    set({
      selectedTaskIds: failedIds,
      isLoading: false,
      error: result.errors.length > 0
        ? result.affectedCount + ' succeeded, ' + result.errors.length + ' failed'
        : null,
      undoableBatch: last ? { operation: last.operation, count: last.taskIds.length } : get().undoableBatch,
    })
    return result
  },

  undoLastBatch: async () => {
    set({ isLoading: true, error: null })
    try {
      const result = await batchService.undoLastBatch()
      await get().loadTasks()
      const last = batchService.getLastUndoableBatch()
      set({
        isLoading: false,
        undoableBatch: last ? { operation: last.operation, count: last.taskIds.length } : null,
        error: result.success ? null : 'Undo partially failed',
      })
      return result
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Undo failed'
      set({ error: message, isLoading: false })
      throw error
    }
  },

  indentTask: async (id: string) => {
    set({ isLoading: true, error: null })
    try {
      const repos = await getRepositories()
      const task = await repos.tasks.findById(id)
      if (!task) throw new Error('Task not found')

      // Find the previous sibling (same parent, lower sort order)
      const siblings = task.parentId
        ? await repos.tasks.findByParentId(task.parentId)
        : (await repos.tasks.findByView(get().currentView)).filter(t => !t.parentId)
      const taskIndex = siblings.findIndex(s => s.id === id)
      if (taskIndex <= 0) throw new Error('No previous sibling to indent under')

      const newParent = siblings[taskIndex - 1]
      const result = await taskService.moveTask(id, newParent.id)
      if (!result.success) throw new Error(result.error)
      await get().loadTasks()
      set({ isLoading: false })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Indent failed'
      set({ error: message, isLoading: false })
      throw error
    }
  },

  outdentTask: async (id: string) => {
    set({ isLoading: true, error: null })
    try {
      const repos = await getRepositories()
      const task = await repos.tasks.findById(id)
      if (!task || !task.parentId) throw new Error('Task has no parent to outdent from')

      const parent = await repos.tasks.findById(task.parentId)
      if (!parent) throw new Error('Parent task not found')

      const result = await taskService.moveTask(id, parent.parentId)
      if (!result.success) throw new Error(result.error)
      await get().loadTasks()
      set({ isLoading: false })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Outdent failed'
      set({ error: message, isLoading: false })
      throw error
    }
  },
  copyTask: async (id: string, withChildren: boolean = false) => {
    set({ isLoading: true, error: null })
    try {
      const result = await taskService.copyTask(id, withChildren)
      if (!result.success) throw new Error(result.error)
      const task = result.data!
      await get().loadTasks()
      return task
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Copy task failed'
      set({ error: message, isLoading: false })
      throw error
    }
  },

  reorderSiblingTasks: async (parentId: string | null, orderedIds: string[]) => {
    set({ isLoading: true, error: null })
    try {
      const result = await taskService.reorderSiblingTasks(parentId, orderedIds)
      if (!result.success) throw new Error(result.error)
      await get().loadTasks()
      return result.data!
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Reorder failed'
      set({ error: message, isLoading: false })
      throw error
    }
  },

  searchTasks: async (query: string) => {
    const search = query.trim() || undefined
    set((state) => ({ filters: { ...state.filters, search } }))
    await get().loadTasks()
  },

  setCurrentTask: (task: Task | null) => {
    set({ currentTask: task })
  },
}))
