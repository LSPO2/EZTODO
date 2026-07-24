import { beforeEach, describe, expect, it, vi } from 'vitest'
import { taskService } from '../task-service'
import { getRepositories } from '../../repositories'

vi.mock('../../repositories', () => ({
  getRepositories: vi.fn(),
  validateTaskTitle: () => ({ valid: true }),
}))

vi.mock('../../recurrence', () => ({ generateNextInstance: vi.fn().mockResolvedValue(null) }))
vi.mock('../../reminder', () => ({ reminderScheduler: { syncTask: vi.fn(), cancelTask: vi.fn() } }))

const mockedGetRepositories = vi.mocked(getRepositories)

function makeTask(overrides: Record<string, unknown> = {}) {
  return {
    id: 'task-1', parentId: null, projectId: null, title: 'Test', note: null,
    status: 'todo', priority: 'none', sortOrder: 0, scheduledDate: null,
    scheduledAt: null, dueAt: null, isAllDay: false, timezone: 'UTC',
    estimatedMinutes: null, createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(), completedAt: null, deletedAt: null,
    revision: 1, source: 'manual', sourceCaptureId: null, ...overrides,
  }
}

describe('TaskService copyTask', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('copies a task with new ID and reset fields', async () => {
    const source = makeTask({ id: 'src', title: 'Original', projectId: 'proj-1', priority: 'p1' })
    const createdCopy = makeTask({ id: 'copy', title: 'Original (副本)', projectId: 'proj-1', priority: 'p1' })
    const create = vi.fn().mockResolvedValue(createdCopy)

    mockedGetRepositories.mockResolvedValue({
      tasks: {
        findById: vi.fn().mockResolvedValue(source),
        create,
        findByParentId: vi.fn().mockResolvedValue([]),
        findByView: vi.fn().mockResolvedValue([source]),
        moveTask: vi.fn(),
      },
    } as never)

    const result = await taskService.copyTask('src')

    expect(result.success).toBe(true)
    expect(result.data!.title).toBe('Original (副本)')
    expect(result.data!.id).not.toBe('src')
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Original (副本)',
      projectId: 'proj-1',
      priority: 'p1',
    }))
  })

  it('returns error for non-existent source', async () => {
    mockedGetRepositories.mockResolvedValue({
      tasks: { findById: vi.fn().mockResolvedValue(null) },
    } as never)

    const result = await taskService.copyTask('missing')
    expect(result.success).toBe(false)
    expect(result.error).toContain('不存在')
  })

  it('copies children when withChildren is true', async () => {
    const parent = makeTask({ id: 'parent', title: 'Parent' })
    const child = makeTask({ id: 'child', title: 'Child', parentId: 'parent' })
    const parentCopy = makeTask({ id: 'parent-copy', title: 'Parent (副本)' })
    const childCopy = makeTask({ id: 'child-copy', title: 'Child (副本)' })

    const create = vi.fn()
      .mockResolvedValueOnce(parentCopy)
      .mockResolvedValueOnce(childCopy)
    const moveTask = vi.fn().mockResolvedValue(undefined)

    mockedGetRepositories.mockResolvedValue({
      tasks: {
        findById: vi.fn(async (id: string) => {
          if (id === 'parent') return parent
          if (id === 'child') return child
          return null
        }),
        create,
        findByParentId: vi.fn(async (id: string) => id === 'parent' ? [child] : []),
        findByView: vi.fn().mockResolvedValue([parent]),
        moveTask,
      },
    } as never)

    const result = await taskService.copyTask('parent', true)

    expect(result.success).toBe(true)
    expect(moveTask).toHaveBeenCalledWith('child-copy', 'parent-copy')
  })
})

describe('TaskService reorderSiblingTasks', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('reorders siblings with contiguous sort_order', async () => {
    const a = makeTask({ id: 'a', sortOrder: 0 })
    const b = makeTask({ id: 'b', sortOrder: 1 })
    const c = makeTask({ id: 'c', sortOrder: 2 })
    const update = vi.fn(async (id: string, updates: Record<string, unknown>) => {
      return makeTask({ id, sortOrder: updates.sortOrder as number })
    })

    mockedGetRepositories.mockResolvedValue({
      tasks: {
        findByParentId: vi.fn().mockResolvedValue([a, b, c]),
        findByView: vi.fn()
          .mockResolvedValueOnce([a, b, c])
          .mockResolvedValueOnce([]),
        update,
      },
    } as never)

    const result = await taskService.reorderSiblingTasks(null, ['c', 'a', 'b'])

    expect(result.success).toBe(true)
    expect(update).toHaveBeenCalledWith('c', { sortOrder: 0 })
    expect(update).toHaveBeenCalledWith('a', { sortOrder: 1 })
    expect(update).toHaveBeenCalledWith('b', { sortOrder: 2 })
  })

  it('reorders a visible subset while preserving hidden sibling slots', async () => {
    const a = makeTask({ id: 'a', sortOrder: 0 })
    const b = makeTask({ id: 'b', sortOrder: 1 })
    const c = makeTask({ id: 'c', sortOrder: 2 })
    const d = makeTask({ id: 'd', sortOrder: 3 })
    const update = vi.fn(async (id: string, updates: Record<string, unknown>) => {
      return makeTask({ id, sortOrder: updates.sortOrder as number })
    })

    mockedGetRepositories.mockResolvedValue({
      tasks: {
        findByParentId: vi.fn().mockResolvedValue([a, b, c, d]),
        findByView: vi.fn()
          .mockResolvedValueOnce([a, b, c, d])
          .mockResolvedValueOnce([]),
        update,
      },
    } as never)

    const result = await taskService.reorderSiblingTasks(null, ['d', 'b'])

    expect(result.success).toBe(true)
    expect(update.mock.calls.map(([id, updates]) => [id, updates.sortOrder])).toEqual([
      ['a', 0],
      ['d', 1],
      ['c', 2],
      ['b', 3],
    ])
  })
  it('rejects when orderedIds contains unknown id', async () => {
    mockedGetRepositories.mockResolvedValue({
      tasks: {
        findByParentId: vi.fn().mockResolvedValue([
          makeTask({ id: 'a' }), makeTask({ id: 'b' }),
        ]),
        findByView: vi.fn().mockResolvedValue([
          makeTask({ id: 'a' }), makeTask({ id: 'b' }),
        ]),
      },
    } as never)

    const result = await taskService.reorderSiblingTasks(null, ['a', 'x'])
    expect(result.success).toBe(false)
    expect(result.error).toContain('不是当前层级')
  })
  it('rejects duplicate ordered ids', async () => {
    mockedGetRepositories.mockResolvedValue({
      tasks: {
        findByParentId: vi.fn().mockResolvedValue([
          makeTask({ id: 'a' }), makeTask({ id: 'b' }),
        ]),
        findByView: vi.fn()
          .mockResolvedValueOnce([makeTask({ id: 'a' }), makeTask({ id: 'b' })])
          .mockResolvedValueOnce([]),
      },
    } as never)

    const result = await taskService.reorderSiblingTasks(null, ['a', 'a'])
    expect(result.success).toBe(false)
    expect(result.error).toContain('重复')
  })
})
