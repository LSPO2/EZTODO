/**
 * Task store using Zustand
 */

import { create } from 'zustand'
import { taskRepository } from '../lib/repositories'
import type { Task, CreateTaskRequest, UpdateTaskRequest, ViewType, TaskFilters } from '../lib/repositories'

interface TaskState {
  // State
  tasks: Task[]
  currentTask: Task | null
  currentView: ViewType
  filters: TaskFilters
  isLoading: boolean
  error: string | null

  // Actions
  setView: (view: ViewType) => void
  setFilters: (filters: TaskFilters) => void
  loadTasks: () => Promise<void>
  createTask: (request: CreateTaskRequest) => Promise<Task>
  updateTask: (id: string, updates: UpdateTaskRequest) => Promise<Task>
  deleteTask: (id: string) => Promise<void>
  restoreTask: (id: string) => Promise<Task>
  completeTask: (id: string) => Promise<Task>
  uncompleteTask: (id: string) => Promise<Task>
  setCurrentTask: (task: Task | null) => void
  searchTasks: (query: string) => Promise<void>
  batchComplete: (ids: string[]) => Promise<void>
  batchDelete: (ids: string[]) => Promise<void>
  batchRestore: (ids: string[]) => Promise<void>
}

export const useTaskStore = create<TaskState>((set, get) => ({
  // Initial state
  tasks: [],
  currentTask: null,
  currentView: 'inbox',
  filters: {},
  isLoading: false,
  error: null,

  // Set current view
  setView: (view: ViewType) => {
    set({ currentView: view })
    get().loadTasks()
  },

  // Set filters
  setFilters: (filters: TaskFilters) => {
    set({ filters })
    get().loadTasks()
  },

  // Load tasks for current view
  loadTasks: async () => {
    set({ isLoading: true, error: null })
    try {
      const { currentView, filters } = get()
      const tasks = await taskRepository.findByView(currentView, filters)
      set({ tasks, isLoading: false })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load tasks',
        isLoading: false,
      })
    }
  },

  // Create a new task
  createTask: async (request: CreateTaskRequest) => {
    set({ isLoading: true, error: null })
    try {
      const task = await taskRepository.create(request)
      set((state) => ({
        tasks: [task, ...state.tasks],
        isLoading: false,
      }))
      return task
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to create task',
        isLoading: false,
      })
      throw error
    }
  },

  // Update a task
  updateTask: async (id: string, updates: UpdateTaskRequest) => {
    set({ isLoading: true, error: null })
    try {
      const task = await taskRepository.update(id, updates)
      set((state) => ({
        tasks: state.tasks.map((t) => (t.id === id ? task : t)),
        currentTask: state.currentTask?.id === id ? task : state.currentTask,
        isLoading: false,
      }))
      return task
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to update task',
        isLoading: false,
      })
      throw error
    }
  },

  // Delete a task (soft delete)
  deleteTask: async (id: string) => {
    set({ isLoading: true, error: null })
    try {
      await taskRepository.delete(id)
      set((state) => ({
        tasks: state.tasks.filter((t) => t.id !== id),
        currentTask: state.currentTask?.id === id ? null : state.currentTask,
        isLoading: false,
      }))
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to delete task',
        isLoading: false,
      })
      throw error
    }
  },

  // Restore a deleted task
  restoreTask: async (id: string) => {
    set({ isLoading: true, error: null })
    try {
      const task = await taskRepository.restore(id)
      set((state) => ({
        tasks: state.tasks.filter((t) => t.id !== id),
        isLoading: false,
      }))
      return task
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to restore task',
        isLoading: false,
      })
      throw error
    }
  },

  // Complete a task
  completeTask: async (id: string) => {
    return get().updateTask(id, { status: 'done' })
  },

  // Uncomplete a task
  uncompleteTask: async (id: string) => {
    return get().updateTask(id, { status: 'todo' })
  },

  // Set current task
  setCurrentTask: (task: Task | null) => {
    set({ currentTask: task })
  },

  // Search tasks
  searchTasks: async (query: string) => {
    set({ isLoading: true, error: null })
    try {
      if (query.trim()) {
        const tasks = await taskRepository.search(query)
        set({ tasks, isLoading: false })
      } else {
        get().loadTasks()
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to search tasks',
        isLoading: false,
      })
    }
  },

  // Batch complete tasks
  batchComplete: async (ids: string[]) => {
    set({ isLoading: true, error: null })
    try {
      await taskRepository.batchUpdate(ids, { status: 'done' })
      set((state) => ({
        tasks: state.tasks.map((t) =>
          ids.includes(t.id)
            ? { ...t, status: 'done' as const, completedAt: new Date().toISOString() }
            : t
        ),
        isLoading: false,
      }))
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to complete tasks',
        isLoading: false,
      })
      throw error
    }
  },

  // Batch delete tasks
  batchDelete: async (ids: string[]) => {
    set({ isLoading: true, error: null })
    try {
      await taskRepository.batchDelete(ids)
      set((state) => ({
        tasks: state.tasks.filter((t) => !ids.includes(t.id)),
        currentTask: state.currentTask && ids.includes(state.currentTask.id)
          ? null
          : state.currentTask,
        isLoading: false,
      }))
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to delete tasks',
        isLoading: false,
      })
      throw error
    }
  },

  // Batch restore tasks
  batchRestore: async (ids: string[]) => {
    set({ isLoading: true, error: null })
    try {
      await taskRepository.batchRestore(ids)
      set((state) => ({
        tasks: state.tasks.filter((t) => !ids.includes(t.id)),
        isLoading: false,
      }))
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to restore tasks',
        isLoading: false,
      })
      throw error
    }
  },
}))
