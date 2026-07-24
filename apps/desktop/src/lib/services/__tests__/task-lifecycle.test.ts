import { beforeEach, describe, expect, it, vi } from 'vitest'
import { taskService } from '../task-service'
import { getRepositories } from '../../repositories'
import { generateNextInstance } from '../../recurrence'
import { reminderScheduler } from '../../reminder'

vi.mock('../../repositories', () => ({
  getRepositories: vi.fn(),
  validateTaskTitle: () => ({ valid: true }),
}))

vi.mock('../../recurrence', () => ({
  generateNextInstance: vi.fn().mockResolvedValue(null),
}))

vi.mock('../../reminder', () => ({
  reminderScheduler: {
    syncTask: vi.fn(),
    cancelTask: vi.fn(),
  },
}))

const mockedGetRepositories = vi.mocked(getRepositories)
const mockedGenerateNextInstance = vi.mocked(generateNextInstance)
const mockedReminderScheduler = vi.mocked(reminderScheduler)

describe('TaskService lifecycle integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('schedules a reminder after task creation', async () => {
    const created = { id: 'task-1', status: 'todo', dueAt: '2026-07-24T10:00:00.000Z' }
    mockedGetRepositories.mockResolvedValue({
      tasks: { create: vi.fn().mockResolvedValue(created) },
    } as never)

    const result = await taskService.createTask({ title: 'Task' })

    expect(result).toEqual({ success: true, data: created })
    expect(mockedReminderScheduler.syncTask).toHaveBeenCalledWith(created)
  })

  it('reschedules a reminder after task update', async () => {
    const previous = { id: 'task-1', status: 'todo' }
    const updated = { ...previous, dueAt: '2026-07-25T10:00:00.000Z' }
    mockedGetRepositories.mockResolvedValue({
      tasks: {
        findById: vi.fn().mockResolvedValue(previous),
        update: vi.fn().mockResolvedValue(updated),
      },
    } as never)

    const result = await taskService.updateTask('task-1', { dueAt: updated.dueAt })

    expect(result.success).toBe(true)
    expect(mockedReminderScheduler.syncTask).toHaveBeenCalledWith(updated)
  })

  it('rejects an update when the task no longer exists', async () => {
    const update = vi.fn()
    mockedGetRepositories.mockResolvedValue({
      tasks: {
        findById: vi.fn().mockResolvedValue(null),
        update,
      },
    } as never)

    const result = await taskService.updateTask('missing', { title: 'Changed' })

    expect(result).toEqual({ success: false, error: '\u4efb\u52a1\u4e0d\u5b58\u5728' })
    expect(update).not.toHaveBeenCalled()
  })

  it('cancels the reminder and advances recurrence on first completion', async () => {
    const task = { id: 'task-1', status: 'todo', parentId: null }
    const completed = { ...task, status: 'done' }
    mockedGetRepositories.mockResolvedValue({
      tasks: {
        findById: vi.fn().mockResolvedValue(task),
        update: vi.fn().mockResolvedValue(completed),
        findByParentId: vi.fn().mockResolvedValue([]),
      },
    } as never)

    const result = await taskService.completeTask('task-1')

    expect(result.success).toBe(true)
    expect(mockedReminderScheduler.cancelTask).toHaveBeenCalledWith('task-1')
    expect(mockedGenerateNextInstance).toHaveBeenCalledWith('task-1')
  })

  it('does not generate a duplicate recurrence when completion is retried', async () => {
    const task = { id: 'task-1', status: 'done', parentId: null }
    mockedGetRepositories.mockResolvedValue({
      tasks: {
        findById: vi.fn().mockResolvedValue(task),
        update: vi.fn().mockResolvedValue(task),
        findByParentId: vi.fn().mockResolvedValue([]),
      },
    } as never)

    const result = await taskService.completeTask('task-1')

    expect(result.success).toBe(true)
    expect(mockedGenerateNextInstance).not.toHaveBeenCalled()
  })

  it('reschedules a reminder when a task is reopened', async () => {
    const reopened = { id: 'task-1', status: 'todo' }
    mockedGetRepositories.mockResolvedValue({
      tasks: {
        findById: vi.fn().mockResolvedValue(reopened),
        update: vi.fn().mockResolvedValue(reopened),
        findByParentId: vi.fn().mockResolvedValue([]),
      },
    } as never)

    const result = await taskService.reopenTask('task-1')

    expect(result.success).toBe(true)
    expect(mockedReminderScheduler.syncTask).toHaveBeenCalledWith(reopened)
  })
  it('runs the full lifecycle when the last child auto-completes its parent', async () => {
    const child = { id: 'child', status: 'todo', parentId: 'parent' }
    const parent = { id: 'parent', status: 'todo', parentId: null }
    mockedGetRepositories.mockResolvedValue({
      tasks: {
        findById: vi.fn(async (id: string) => id === 'child' ? child : parent),
        update: vi.fn(async (id: string) => ({ ...(id === 'child' ? child : parent), status: 'done' })),
        batchUpdate: vi.fn().mockResolvedValue({ success: true, affectedCount: 2, errors: [], undoToken: 'batch' }),
        findByParentId: vi.fn().mockResolvedValue([{ id: 'child', status: 'done', deletedAt: null }]),
      },
    } as never)

    const result = await taskService.completeTask('child')

    expect(result.success).toBe(true)
    expect(mockedReminderScheduler.cancelTask).toHaveBeenCalledWith('child')
    expect(mockedReminderScheduler.cancelTask).toHaveBeenCalledWith('parent')
    expect(mockedGenerateNextInstance).toHaveBeenCalledWith('child')
    expect(mockedGenerateNextInstance).toHaveBeenCalledWith('parent')
  })
})
