import { beforeEach, describe, expect, it, vi } from 'vitest'
import { taskService } from '../task-service'
import { getRepositories } from '../../repositories'

vi.mock('../../repositories', () => ({
  getRepositories: vi.fn(),
  validateTaskTitle: () => ({ valid: true }),
}))

const mockedGetRepositories = vi.mocked(getRepositories)

describe('TaskService hierarchy safety', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects moving a task under its own descendant', async () => {
    const moveTask = vi.fn()
    mockedGetRepositories.mockResolvedValue({
      tasks: {
        getDescendants: vi.fn().mockResolvedValue([{ id: 'child' }]),
        moveTask,
      },
    } as never)

    const result = await taskService.moveTask('parent', 'child')

    expect(result.success).toBe(false)
    expect(moveTask).not.toHaveBeenCalled()
  })

  it('soft-deletes the complete subtree in one repository batch', async () => {
    const batchDelete = vi.fn().mockResolvedValue({ success: true, affectedCount: 3, errors: [], undoToken: 'batch' })
    mockedGetRepositories.mockResolvedValue({
      tasks: {
        getDescendants: vi.fn().mockResolvedValue([{ id: 'child' }, { id: 'grandchild' }]),
        batchDelete,
      },
    } as never)

    const result = await taskService.deleteTask('parent')

    expect(result.success).toBe(true)
    expect(batchDelete).toHaveBeenCalledWith(['child', 'grandchild', 'parent'])
  })

  it('restores a deleted subtree from the trash view in one repository batch', async () => {
    const batchRestore = vi.fn().mockResolvedValue({ success: true, affectedCount: 3, errors: [], undoToken: 'batch' })
    const restored = { id: 'parent', status: 'todo', dueAt: null }
    mockedGetRepositories.mockResolvedValue({
      tasks: {
        batchRestore,
        findById: vi.fn().mockResolvedValue(restored),
        findByView: vi.fn().mockResolvedValue([
          { id: 'child', parentId: 'parent' },
          { id: 'grandchild', parentId: 'child' },
        ]),
      },
    } as never)

    const result = await taskService.restoreTask('parent')

    expect(result.success).toBe(true)
    expect(batchRestore).toHaveBeenCalledWith(['parent', 'child', 'grandchild'])
  })
})