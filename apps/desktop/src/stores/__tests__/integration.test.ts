/**
 * P0-2 integration tests: Store + Service interactions
 * Covers: CRUD, filters, batch ops with undo, hierarchy, AI confirm/cancel
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useTaskStore } from '../task-store'
import { getRepositories } from '../../lib/repositories'
import { taskService } from '../../lib/services/task-service'
import * as batchService from '../../lib/services/batch-service'

vi.mock('../../lib/repositories', () => ({
  getRepositories: vi.fn(),
}))

vi.mock('../../lib/services/task-service', () => ({
  taskService: {
    createTask: vi.fn(),
    updateTask: vi.fn(),
    completeTask: vi.fn(),
    reopenTask: vi.fn(),
    deleteTask: vi.fn(),
    restoreTask: vi.fn(),
    moveTask: vi.fn(),
  },
}))

vi.mock('../../lib/services/batch-service', () => ({
  batchComplete: vi.fn(),
  batchDelete: vi.fn(),
  batchRestore: vi.fn(),
  batchSetPriority: vi.fn(),
  batchMoveToProject: vi.fn(),
  batchAddTag: vi.fn(),
  batchRemoveTag: vi.fn(),
  undoLastBatch: vi.fn(),
  getLastUndoableBatch: vi.fn().mockReturnValue(null),
  canUndo: vi.fn().mockReturnValue(false),
  clearUndoStack: vi.fn(),
}))

const mockedTaskService = vi.mocked(taskService)
const mockedBatchService = vi.mocked(batchService)
const mockedGetRepositories = vi.mocked(getRepositories)

function makeTask(overrides: Record<string, unknown> = {}) {
  return {
    id: 'task-1',
    parentId: null,
    projectId: null,
    title: 'Test Task',
    note: null,
    status: 'todo' as const,
    priority: 'none' as const,
    sortOrder: 0,
    scheduledDate: null,
    scheduledAt: null,
    dueAt: null,
    isAllDay: false,
    timezone: 'UTC',
    estimatedMinutes: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: null,
    deletedAt: null,
    revision: 1,
    source: 'manual' as const,
    sourceCaptureId: null,
    ...overrides,
  }
}

describe('P0-2 Store Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useTaskStore.setState({
      tasks: [],
      currentTask: null,
      currentView: 'today',
      filters: {},
      selectedTaskIds: new Set(),
      isLoading: false,
      error: null,
      undoableBatch: null,
    })
    mockedGetRepositories.mockResolvedValue({
      tasks: { findByView: vi.fn().mockResolvedValue([]) },
    } as never)
  })

  // ── CRUD ────────────────────────────────────────────────────────
  describe('CRUD lifecycle', () => {
    it('creates a task and adds it to the store', async () => {
      const task = makeTask({ id: 'new-1', title: 'Buy milk' })
      mockedTaskService.createTask.mockResolvedValue({ success: true, data: task })

      const result = await useTaskStore.getState().createTask({ title: 'Buy milk' })

      expect(result.id).toBe('new-1')
      expect(useTaskStore.getState().tasks).toContainEqual(task)
    })

    it('updates a task in the store', async () => {
      const original = makeTask({ id: 't1', title: 'Old' })
      const updated = makeTask({ id: 't1', title: 'New' })
      useTaskStore.setState({ tasks: [original] })
      mockedTaskService.updateTask.mockResolvedValue({ success: true, data: updated })

      const result = await useTaskStore.getState().updateTask('t1', { title: 'New' })

      expect(result.title).toBe('New')
      expect(useTaskStore.getState().tasks.find(t => t.id === 't1')?.title).toBe('New')
    })

    it('completes a task', async () => {
      const task = makeTask({ id: 't1', status: 'todo' })
      const completed = makeTask({ id: 't1', status: 'done' })
      useTaskStore.setState({ tasks: [task] })
      mockedTaskService.completeTask.mockResolvedValue({ success: true, data: completed })
      mockedGetRepositories.mockResolvedValue({
        tasks: { findByView: vi.fn().mockResolvedValue([completed]) },
      } as never)

      await useTaskStore.getState().completeTask('t1')

      expect(mockedTaskService.completeTask).toHaveBeenCalledWith('t1', undefined)
    })

    it('reopens a task', async () => {
      const task = makeTask({ id: 't1', status: 'done' })
      const reopened = makeTask({ id: 't1', status: 'todo' })
      useTaskStore.setState({ tasks: [task] })
      mockedTaskService.reopenTask.mockResolvedValue({ success: true, data: reopened })
      mockedGetRepositories.mockResolvedValue({
        tasks: { findByView: vi.fn().mockResolvedValue([reopened]) },
      } as never)

      await useTaskStore.getState().uncompleteTask('t1', false)

      expect(mockedTaskService.reopenTask).toHaveBeenCalledWith('t1', false)
    })

    it('soft-deletes a task (removes from list, does not filter physically)', async () => {
      const task = makeTask({ id: 't1' })
      useTaskStore.setState({ tasks: [task], currentTask: task })
      mockedTaskService.deleteTask.mockResolvedValue({ success: true })

      await useTaskStore.getState().deleteTask('t1')

      // Task should be removed from the in-memory list after reload
      expect(useTaskStore.getState().tasks.find(t => t.id === 't1')).toBeUndefined()
      expect(useTaskStore.getState().currentTask).toBeNull()
    })

    it('restores a task from trash', async () => {
      const task = makeTask({ id: 't1', deletedAt: new Date().toISOString() })
      useTaskStore.setState({ tasks: [task] })
      mockedTaskService.restoreTask.mockResolvedValue({ success: true, data: makeTask({ id: 't1' }) })

      await useTaskStore.getState().restoreTask('t1')

      // Task should be removed from the trash view list
      expect(useTaskStore.getState().tasks.find(t => t.id === 't1')).toBeUndefined()
    })
  })

  // ── Filters ─────────────────────────────────────────────────────
  describe('combined filters and clear', () => {
    it('sets filters and triggers loadTasks', async () => {
      const findByView = vi.fn().mockResolvedValue([])
      mockedGetRepositories.mockResolvedValue({ tasks: { findByView } } as never)

      useTaskStore.getState().setFilters({ projectId: 'proj-1', priority: 'p1', parentOnly: true })

      // Wait for async loadTasks to complete
      await vi.waitFor(() => {
        expect(findByView).toHaveBeenCalledWith('today', { projectId: 'proj-1', priority: 'p1', parentOnly: true })
      })
    })

    it('clears filters and reloads', async () => {
      const findByView = vi.fn().mockResolvedValue([])
      mockedGetRepositories.mockResolvedValue({ tasks: { findByView } } as never)
      useTaskStore.setState({ filters: { projectId: 'proj-1' } })

      useTaskStore.getState().clearFilters()

      await vi.waitFor(() => {
        expect(useTaskStore.getState().filters).toEqual({})
        expect(findByView).toHaveBeenCalledWith('today', { parentOnly: true })
      })
    })
  })

  // ── Batch operations with undo ──────────────────────────────────
  describe('batch operations and undo', () => {
    it('batch complete records undoableBatch state', async () => {
      mockedBatchService.batchComplete.mockResolvedValue({
        success: true, affectedCount: 2, errors: [], undoToken: 'tok-1',
      })
      mockedBatchService.getLastUndoableBatch.mockReturnValue({
        undoToken: 'tok-1', operation: 'complete', taskIds: ['a', 'b'],
        snapshot: [], createdAt: new Date().toISOString(),
      })
      useTaskStore.setState({ selectedTaskIds: new Set(['a', 'b']) })

      await useTaskStore.getState().batchComplete()

      expect(useTaskStore.getState().undoableBatch).toEqual({ operation: 'complete', count: 2 })
    })

    it('undo reverts the last batch', async () => {
      mockedBatchService.undoLastBatch.mockResolvedValue({
        success: true, affectedCount: 2, errors: [], undoToken: null,
      })
      mockedBatchService.getLastUndoableBatch.mockReturnValue(null)
      useTaskStore.setState({ undoableBatch: { operation: 'complete', count: 2 } })
      mockedGetRepositories.mockResolvedValue({
        tasks: { findByView: vi.fn().mockResolvedValue([]) },
      } as never)

      await useTaskStore.getState().undoLastBatch()

      expect(mockedBatchService.undoLastBatch).toHaveBeenCalled()
      expect(useTaskStore.getState().undoableBatch).toBeNull()
    })

    it('batch delete with partial failure keeps failed selection', async () => {
      mockedBatchService.batchDelete.mockResolvedValue({
        success: false, affectedCount: 1,
        errors: [{ id: 'b', error: 'locked' }], undoToken: 'tok-2',
      })
      mockedBatchService.getLastUndoableBatch.mockReturnValue({
        undoToken: 'tok-2', operation: 'delete', taskIds: ['a', 'b'],
        snapshot: [], createdAt: new Date().toISOString(),
      })
      useTaskStore.setState({ selectedTaskIds: new Set(['a', 'b']) })

      await useTaskStore.getState().batchDelete()

      expect([...useTaskStore.getState().selectedTaskIds]).toEqual(['b'])
      expect(useTaskStore.getState().error).toContain('failed')
    })
  })

  // ── Hierarchy indent/outdent ────────────────────────────────────
  describe('parent-child indent/outdent', () => {
    it('indentTask moves task under previous sibling', async () => {
      const taskA = makeTask({ id: 'a', parentId: null, sortOrder: 0 })
      const taskB = makeTask({ id: 'b', parentId: null, sortOrder: 1 })
      useTaskStore.setState({ tasks: [taskA, taskB], currentView: 'today' })
      mockedGetRepositories.mockResolvedValue({
        tasks: {
          findById: vi.fn().mockResolvedValue(taskB),
          findByView: vi.fn().mockResolvedValue([taskA, taskB]),
        },
      } as never)
      mockedTaskService.moveTask.mockResolvedValue({ success: true })

      await useTaskStore.getState().indentTask('b')

      expect(mockedTaskService.moveTask).toHaveBeenCalledWith('b', 'a')
    })

    it('outdentTask moves task to parent\'s parent', async () => {
      const parent = makeTask({ id: 'parent', parentId: null })
      const child = makeTask({ id: 'child', parentId: 'parent' })
      useTaskStore.setState({ tasks: [parent, child] })
      mockedGetRepositories.mockResolvedValue({
        tasks: {
          findById: vi.fn(async (id: string) => id === 'child' ? child : parent),
        },
      } as never)
      mockedTaskService.moveTask.mockResolvedValue({ success: true })

      await useTaskStore.getState().outdentTask('child')

      expect(mockedTaskService.moveTask).toHaveBeenCalledWith('child', null)
    })

    it('outdentTask fails when task has no parent', async () => {
      const task = makeTask({ id: 't1', parentId: null })
      useTaskStore.setState({ tasks: [task] })
      mockedGetRepositories.mockResolvedValue({
        tasks: { findById: vi.fn().mockResolvedValue(task) },
      } as never)

      await expect(useTaskStore.getState().outdentTask('t1')).rejects.toThrow()
    })
  })

  // ── Parent completion with 3 options ────────────────────────────
  describe('parent completion options', () => {
    it('passes mode=self to completeTask for "complete only parent"', async () => {
      const task = makeTask({ id: 'parent' })
      useTaskStore.setState({ tasks: [task] })
      mockedTaskService.completeTask.mockResolvedValue({
        success: true, data: makeTask({ id: 'parent', status: 'done' }),
      })
      mockedGetRepositories.mockResolvedValue({
        tasks: { findByView: vi.fn().mockResolvedValue([]) },
      } as never)

      await useTaskStore.getState().completeTask('parent', 'self')

      expect(mockedTaskService.completeTask).toHaveBeenCalledWith('parent', 'self')
    })

    it('passes mode=withChildren to completeTask for "complete all"', async () => {
      const task = makeTask({ id: 'parent' })
      useTaskStore.setState({ tasks: [task] })
      mockedTaskService.completeTask.mockResolvedValue({
        success: true, data: makeTask({ id: 'parent', status: 'done' }),
      })
      mockedGetRepositories.mockResolvedValue({
        tasks: { findByView: vi.fn().mockResolvedValue([]) },
      } as never)

      await useTaskStore.getState().completeTask('parent', 'withChildren')

      expect(mockedTaskService.completeTask).toHaveBeenCalledWith('parent', 'withChildren')
    })

    it('throws HAS_UNCOMPLETED_CHILDREN when no mode specified and children exist', async () => {
      const task = makeTask({ id: 'parent' })
      useTaskStore.setState({ tasks: [task] })
      mockedTaskService.completeTask.mockResolvedValue({
        success: false, error: 'HAS_UNCOMPLETED_CHILDREN',
      })

      await expect(useTaskStore.getState().completeTask('parent')).rejects.toThrow('HAS_UNCOMPLETED_CHILDREN')
    })
  })

  // ── Reopen with children option ─────────────────────────────────
  describe('reopen with children', () => {
    it('passes reopenChildren=true to reopenTask', async () => {
      const task = makeTask({ id: 'parent', status: 'done' })
      useTaskStore.setState({ tasks: [task] })
      mockedTaskService.reopenTask.mockResolvedValue({
        success: true, data: makeTask({ id: 'parent', status: 'todo' }),
      })
      mockedGetRepositories.mockResolvedValue({
        tasks: { findByView: vi.fn().mockResolvedValue([]) },
      } as never)

      await useTaskStore.getState().uncompleteTask('parent', true)

      expect(mockedTaskService.reopenTask).toHaveBeenCalledWith('parent', true)
    })
  })
})
