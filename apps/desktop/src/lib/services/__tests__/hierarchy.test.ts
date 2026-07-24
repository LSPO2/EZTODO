import { beforeEach, describe, expect, it, vi } from 'vitest'
import { taskService } from '../task-service'
import { getRepositories } from '../../repositories'

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

function makeTask(overrides: Record<string, unknown> = {}) {
  return {
    id: 'task-1',
    parentId: null,
    projectId: null,
    title: 'Test',
    note: null,
    status: 'todo',
    priority: 'none',
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
    source: 'manual',
    sourceCaptureId: null,
    ...overrides,
  }
}

describe('TaskService hierarchy rules', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('depth validation (max 3 levels)', () => {
    it('allows creating a child at level 1', async () => {
      const parent = makeTask({ id: 'parent', parentId: null })
      mockedGetRepositories.mockResolvedValue({
        tasks: {
          findById: vi.fn().mockResolvedValue(parent),
          create: vi.fn().mockResolvedValue(makeTask({ id: 'child', parentId: 'parent' })),
        },
      } as never)

      const result = await taskService.createTask({ title: 'Child', parentId: 'parent' })
      expect(result.success).toBe(true)
    })

    it('allows creating a grandchild at level 2', async () => {
      const parent = makeTask({ id: 'root', parentId: null })
      const child = makeTask({ id: 'child', parentId: 'root' })
      mockedGetRepositories.mockResolvedValue({
        tasks: {
          findById: vi.fn(async (id: string) => {
            if (id === 'child') return child
            if (id === 'root') return parent
            return null
          }),
          create: vi.fn().mockResolvedValue(makeTask({ id: 'grandchild', parentId: 'child' })),
        },
      } as never)

      const result = await taskService.createTask({ title: 'Grandchild', parentId: 'child' })
      expect(result.success).toBe(true)
    })

    it('rejects creating a great-grandchild at level 3 (would be level 4)', async () => {
      const root = makeTask({ id: 'root', parentId: null })
      const child = makeTask({ id: 'child', parentId: 'root' })
      const grandchild = makeTask({ id: 'grandchild', parentId: 'child' })
      mockedGetRepositories.mockResolvedValue({
        tasks: {
          findById: vi.fn(async (id: string) => {
            if (id === 'root') return root
            if (id === 'child') return child
            if (id === 'grandchild') return grandchild
            return null
          }),
          create: vi.fn(),
        },
      } as never)

      const result = await taskService.createTask({ title: 'Too deep', parentId: 'grandchild' })
      expect(result.success).toBe(false)
      expect(result.error).toContain('层级')
    })

    it('rejects moving a task that would exceed 3 levels', async () => {
      const root = makeTask({ id: 'root', parentId: null })
      const child = makeTask({ id: 'child', parentId: 'root' })
      const grandchild = makeTask({ id: 'grandchild', parentId: 'child' })
      const movable = makeTask({ id: 'movable', parentId: null })

      mockedGetRepositories.mockResolvedValue({
        tasks: {
          findById: vi.fn(async (id: string) => {
            if (id === 'root') return root
            if (id === 'child') return child
            if (id === 'grandchild') return grandchild
            if (id === 'movable') return movable
            return null
          }),
          getDescendants: vi.fn().mockResolvedValue([]),
          findByParentId: vi.fn().mockResolvedValue([]),
          moveTask: vi.fn(),
        },
      } as never)

      const result = await taskService.moveTask('movable', 'grandchild')
      expect(result.success).toBe(false)
      expect(result.error).toContain('层级')
    })
  })

  describe('cycle prevention', () => {
    it('rejects moving a task under itself', async () => {
      mockedGetRepositories.mockResolvedValue({
        tasks: {
          findById: vi.fn().mockResolvedValue(makeTask({ id: 'a' })),
          getDescendants: vi.fn().mockResolvedValue([]),
          findByParentId: vi.fn().mockResolvedValue([]),
          moveTask: vi.fn(),
        },
      } as never)

      const result = await taskService.moveTask('a', 'a')
      expect(result.success).toBe(false)
      expect(result.error).toContain('自己')
    })

    it('rejects moving a task under its own descendant', async () => {
      const parent = makeTask({ id: 'parent' })
      const child = makeTask({ id: 'child', parentId: 'parent' })
      mockedGetRepositories.mockResolvedValue({
        tasks: {
          findById: vi.fn().mockResolvedValue(parent),
          getDescendants: vi.fn().mockResolvedValue([child]),
          findByParentId: vi.fn().mockResolvedValue([]),
          moveTask: vi.fn(),
        },
      } as never)

      const result = await taskService.moveTask('parent', 'child')
      expect(result.success).toBe(false)
      expect(result.error).toContain('后代')
    })
  })

  describe('complete with uncompleted children', () => {
    it('returns HAS_UNCOMPLETED_CHILDREN when children are not all done', async () => {
      const parent = makeTask({ id: 'parent', status: 'todo' })
      const child = makeTask({ id: 'child', parentId: 'parent', status: 'todo' })
      mockedGetRepositories.mockResolvedValue({
        tasks: {
          findById: vi.fn().mockResolvedValue(parent),
          update: vi.fn().mockResolvedValue({ ...parent, status: 'done' }),
          findByParentId: vi.fn().mockResolvedValue([child]),
        },
      } as never)

      const result = await taskService.completeTask('parent')
      expect(result.success).toBe(false)
      expect(result.error).toBe('HAS_UNCOMPLETED_CHILDREN')
    })

    it('completes only parent when mode is self', async () => {
      const parent = makeTask({ id: 'parent', status: 'todo' })
      const child = makeTask({ id: 'child', parentId: 'parent', status: 'todo' })
      const update = vi.fn().mockImplementation(async (id: string) => {
        if (id === 'parent') return { ...parent, status: 'done' }
        return { ...child, status: 'done' }
      })
      mockedGetRepositories.mockResolvedValue({
        tasks: {
          findById: vi.fn(async (id: string) => id === 'parent' ? parent : child),
          update,
          findByParentId: vi.fn().mockResolvedValue([child]),
        },
      } as never)

      const result = await taskService.completeTask('parent', 'self')
      expect(result.success).toBe(true)
      // Only parent should be completed, not the child
      expect(update).toHaveBeenCalledWith('parent', { status: 'done' })
      expect(update).not.toHaveBeenCalledWith('child', { status: 'done' })
    })

    it('completes parent and all descendants when mode is withChildren', async () => {
      const parent = makeTask({ id: 'parent', status: 'todo' })
      const child = makeTask({ id: 'child', parentId: 'parent', status: 'todo' })
      const update = vi.fn().mockImplementation(async (id: string) => ({ ...(id === 'parent' ? parent : child), status: 'done' }))
      const batchUpdate = vi.fn().mockResolvedValue({ success: true, affectedCount: 2, errors: [], undoToken: 'batch' })
      mockedGetRepositories.mockResolvedValue({
        tasks: {
          findById: vi.fn(async (id: string) => id === 'parent' ? parent : child),
          update,
          batchUpdate,
          findByParentId: vi.fn().mockResolvedValue([child]),
          getDescendants: vi.fn().mockResolvedValue([child]),
        },
      } as never)

      const result = await taskService.completeTask('parent', 'withChildren')
      expect(result.success).toBe(true)
      expect(batchUpdate).toHaveBeenCalledWith(['parent', 'child'], { status: 'done' })
    })

    it('completes without asking when all children are already done', async () => {
      const parent = makeTask({ id: 'parent', status: 'todo' })
      const child = makeTask({ id: 'child', parentId: 'parent', status: 'done' })
      mockedGetRepositories.mockResolvedValue({
        tasks: {
          findById: vi.fn().mockResolvedValue(parent),
          update: vi.fn().mockResolvedValue({ ...parent, status: 'done' }),
          findByParentId: vi.fn().mockResolvedValue([child]),
        },
      } as never)

      const result = await taskService.completeTask('parent')
      expect(result.success).toBe(true)
    })
  })

  describe('reopen with children option', () => {
    it('reopens only parent when reopenChildren is false', async () => {
      const parent = makeTask({ id: 'parent', status: 'done' })
      const child = makeTask({ id: 'child', parentId: 'parent', status: 'done' })
      const update = vi.fn().mockImplementation(async (id: string) => ({ ...(id === 'parent' ? parent : child), status: 'todo' }))
      mockedGetRepositories.mockResolvedValue({
        tasks: {
          findById: vi.fn(async (id: string) => id === 'parent' ? parent : child),
          update,
          findByParentId: vi.fn().mockResolvedValue([child]),
        },
      } as never)

      const result = await taskService.reopenTask('parent', false)
      expect(result.success).toBe(true)
      expect(update).toHaveBeenCalledWith('parent', { status: 'todo' })
      // Child should NOT be reopened
      expect(update).not.toHaveBeenCalledWith('child', { status: 'todo' })
    })

    it('reopens parent and completed children when reopenChildren is true', async () => {
      const parent = makeTask({ id: 'parent', status: 'done' })
      const child = makeTask({ id: 'child', parentId: 'parent', status: 'done' })
      const update = vi.fn().mockImplementation(async (id: string) => ({ ...(id === 'parent' ? parent : child), status: 'todo' }))
      const batchUpdate = vi.fn().mockResolvedValue({ success: true, affectedCount: 2, errors: [], undoToken: 'batch' })
      mockedGetRepositories.mockResolvedValue({
        tasks: {
          findById: vi.fn(async (id: string) => id === 'parent' ? parent : child),
          update,
          batchUpdate,
          findByParentId: vi.fn().mockResolvedValue([child]),
          getDescendants: vi.fn().mockResolvedValue([child]),
        },
      } as never)

      const result = await taskService.reopenTask('parent', true)
      expect(result.success).toBe(true)
      expect(batchUpdate).toHaveBeenCalledWith(['child', 'parent'], { status: 'todo' })
    })
  })

  describe('auto-complete parent', () => {
    it('auto-completes parent when last child is completed', async () => {
      const child = makeTask({ id: 'child', status: 'todo', parentId: 'parent' })
      const parent = makeTask({ id: 'parent', status: 'todo', parentId: null })
      const batchUpdate = vi.fn().mockResolvedValue({ success: true, affectedCount: 2, errors: [], undoToken: 'batch' })
      mockedGetRepositories.mockResolvedValue({
        tasks: {
          findById: vi.fn(async (id: string) => id === 'child' ? child : parent),
          update: vi.fn(async (id: string) => ({ ...(id === 'child' ? child : parent), status: 'done' })),
          batchUpdate,
          findByParentId: vi.fn().mockResolvedValue([{ id: 'child', status: 'done', deletedAt: null }]),
        },
      } as never)

      const result = await taskService.completeTask('child')
      expect(result.success).toBe(true)
      expect(batchUpdate).toHaveBeenCalledWith(['child', 'parent'], { status: 'done' })
    })
  })
})
