import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as batchService from '../batch-service'
import { getRepositories } from '../../repositories'

vi.mock('../../repositories', () => ({
  getRepositories: vi.fn(),
}))

vi.mock('../task-service', () => ({
  TaskService: vi.fn().mockImplementation(() => ({
    completeTask: vi.fn().mockResolvedValue({ success: true, data: {} }),
    deleteTask: vi.fn().mockResolvedValue({ success: true }),
    restoreTask: vi.fn().mockResolvedValue({ success: true, data: {} }),
  })),
}))

vi.mock('uuid', () => ({
  v4: vi.fn(() => 'test-uuid-' + Math.random().toString(36).slice(2, 8)),
  v7: vi.fn(() => 'test-uuid-' + Math.random().toString(36).slice(2, 8)),
}))

const mockedGetRepositories = vi.mocked(getRepositories)

/* eslint-disable @typescript-eslint/no-explicit-any */
function makeRepos(overrides: Record<string, unknown> = {}) {
  return {
    tasks: {
      batchComplete: vi.fn().mockResolvedValue({ success: true, affectedCount: 2, errors: [], undoToken: null }),
      batchDelete: vi.fn().mockResolvedValue({ success: true, affectedCount: 2, errors: [], undoToken: null }),
      batchRestore: vi.fn().mockResolvedValue({ success: true, affectedCount: 2, errors: [], undoToken: null }),
      batchUpdate: vi.fn().mockResolvedValue({ success: true, affectedCount: 2, errors: [], undoToken: null }),
      restoreSnapshots: vi.fn().mockImplementation(async (snapshots: unknown[], batchId: string) => ({ success: true, affectedCount: snapshots.length, errors: [], undoToken: batchId })),
      getSnapshots: vi.fn().mockResolvedValue([
        { id: 'a', status: 'todo', priority: 'p1', projectId: null, parentId: null, deletedAt: null, tagIds: [] },
        { id: 'b', status: 'todo', priority: 'p2', projectId: 'proj1', parentId: null, deletedAt: null, tagIds: ['tag1'] },
      ]),
      update: vi.fn().mockResolvedValue({}),
      restore: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue(undefined),
    },
    tags: {
      addToTask: vi.fn().mockResolvedValue(undefined),
      removeFromTask: vi.fn().mockResolvedValue(undefined),
      findByTaskId: vi.fn().mockResolvedValue([]),
      batchAddTag: vi.fn().mockResolvedValue({ success: true, affectedCount: 2, errors: [], undoToken: null }),
      batchRemoveTag: vi.fn().mockResolvedValue({ success: true, affectedCount: 2, errors: [], undoToken: null }),
    },
    ...overrides,
  } as any
}

describe('BatchService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    batchService.clearUndoStack()
  })

  describe('batchComplete', () => {
    it('returns undoToken when operations succeed', async () => {
      mockedGetRepositories.mockResolvedValue(makeRepos())

      const result = await batchService.batchComplete(['a', 'b'])

      expect(result.success).toBe(true)
      expect(result.affectedCount).toBe(2)
      expect(result.undoToken).toBeTruthy()
    })

    it('captures snapshots before mutation', async () => {
      const repos = makeRepos()
      mockedGetRepositories.mockResolvedValue(repos)

      await batchService.batchComplete(['a', 'b'])

      expect(repos.tasks.getSnapshots).toHaveBeenCalledWith(['a', 'b'])
    })

    it('records an undoable batch', async () => {
      mockedGetRepositories.mockResolvedValue(makeRepos())

      await batchService.batchComplete(['a', 'b'])

      const last = batchService.getLastUndoableBatch()
      expect(last).not.toBeNull()
      expect(last!.operation).toBe('complete')
      expect(last!.taskIds).toEqual(['a', 'b'])
    })

    it('returns undoToken=null when no tasks are affected', async () => {
      const repos = makeRepos()
      repos.tasks.batchComplete = vi.fn().mockResolvedValue({ success: true, affectedCount: 0, errors: [], undoToken: null })
      mockedGetRepositories.mockResolvedValue(repos)

      const result = await batchService.batchComplete([])

      expect(result.undoToken).toBeNull()
    })
  })

  describe('batchDelete', () => {
    it('returns undoToken on success', async () => {
      mockedGetRepositories.mockResolvedValue(makeRepos())

      const result = await batchService.batchDelete(['a'])

      expect(result.undoToken).toBeTruthy()
      expect(batchService.getLastUndoableBatch()!.operation).toBe('delete')
    })
  })

  describe('batchRestore', () => {
    it('returns undoToken on success', async () => {
      mockedGetRepositories.mockResolvedValue(makeRepos())

      const result = await batchService.batchRestore(['a'])

      expect(result.undoToken).toBeTruthy()
      expect(batchService.getLastUndoableBatch()!.operation).toBe('restore')
    })
  })

  describe('batchSetPriority', () => {
    it('returns undoToken and captures priority snapshot', async () => {
      mockedGetRepositories.mockResolvedValue(makeRepos())

      const result = await batchService.batchSetPriority(['a', 'b'], 'p1')

      expect(result.undoToken).toBeTruthy()
      expect(batchService.getLastUndoableBatch()!.operation).toBe('setPriority')
    })
  })

  describe('batchMoveToProject', () => {
    it('returns undoToken on success', async () => {
      mockedGetRepositories.mockResolvedValue(makeRepos())

      const result = await batchService.batchMoveToProject(['a'], 'proj-new')

      expect(result.undoToken).toBeTruthy()
      expect(batchService.getLastUndoableBatch()!.operation).toBe('moveToProject')
    })
  })

  describe('batchAddTag', () => {
    it('adds tag and records undoable batch', async () => {
      const repos = makeRepos()
      mockedGetRepositories.mockResolvedValue(repos)

      const result = await batchService.batchAddTag(['a', 'b'], 'tag-new')

      expect(repos.tags.batchAddTag).toHaveBeenCalledWith(['a', 'b'], 'tag-new', expect.any(String))
      expect(result.undoToken).toBeTruthy()
      expect(batchService.getLastUndoableBatch()!.operation).toBe('addTag')
    })
  })

  describe('batchRemoveTag', () => {
    it('removes tag and records undoable batch', async () => {
      const repos = makeRepos()
      mockedGetRepositories.mockResolvedValue(repos)

      const result = await batchService.batchRemoveTag(['a', 'b'], 'tag1')

      expect(repos.tags.batchRemoveTag).toHaveBeenCalledWith(['a', 'b'], 'tag1', expect.any(String))
      expect(result.undoToken).toBeTruthy()
    })
  })

  describe('undoLastBatch', () => {
    it('reverses a complete operation by reopening tasks', async () => {
      const repos = makeRepos()
      repos.tasks.getSnapshots.mockResolvedValue([
        { id: 'a', status: 'todo', priority: 'none', projectId: null, parentId: null, deletedAt: null, tagIds: [] },
      ])
      mockedGetRepositories.mockResolvedValue(repos)

      await batchService.batchComplete(['a'])
      const undoResult = await batchService.undoLastBatch()

      expect(undoResult.success).toBe(true)
      expect(repos.tasks.restoreSnapshots).toHaveBeenCalledWith(expect.any(Array), expect.any(String))
    })

    it('reverses a delete operation by restoring tasks', async () => {
      const repos = makeRepos()
      repos.tasks.getSnapshots.mockResolvedValue([
        { id: 'a', status: 'todo', priority: 'none', projectId: null, parentId: null, deletedAt: null, tagIds: [] },
      ])
      mockedGetRepositories.mockResolvedValue(repos)

      await batchService.batchDelete(['a'])
      const undoResult = await batchService.undoLastBatch()

      expect(undoResult.success).toBe(true)
      expect(repos.tasks.restoreSnapshots).toHaveBeenCalledWith(expect.any(Array), expect.any(String))
    })

    it('reverses a priority change by restoring old priority', async () => {
      const repos = makeRepos()
      repos.tasks.getSnapshots.mockResolvedValue([
        { id: 'a', status: 'todo', priority: 'p3', projectId: null, parentId: null, deletedAt: null, tagIds: [] },
      ])
      mockedGetRepositories.mockResolvedValue(repos)

      await batchService.batchSetPriority(['a'], 'p1')
      const undoResult = await batchService.undoLastBatch()

      expect(undoResult.success).toBe(true)
      expect(repos.tasks.restoreSnapshots).toHaveBeenCalledWith(expect.any(Array), expect.any(String))
    })

    it('reverses a project move by restoring old project', async () => {
      const repos = makeRepos()
      repos.tasks.getSnapshots.mockResolvedValue([
        { id: 'a', status: 'todo', priority: 'none', projectId: 'old-proj', parentId: null, deletedAt: null, tagIds: [] },
      ])
      mockedGetRepositories.mockResolvedValue(repos)

      await batchService.batchMoveToProject(['a'], 'new-proj')
      const undoResult = await batchService.undoLastBatch()

      expect(undoResult.success).toBe(true)
      expect(repos.tasks.restoreSnapshots).toHaveBeenCalledWith(expect.any(Array), expect.any(String))
    })

    it('reverses addTag by removing the added tag', async () => {
      const repos = makeRepos()
      repos.tasks.getSnapshots.mockResolvedValue([
        { id: 'a', status: 'todo', priority: 'none', projectId: null, parentId: null, deletedAt: null, tagIds: [] },
      ])
      repos.tags.findByTaskId.mockResolvedValue([{ id: 'tag-new' }])
      mockedGetRepositories.mockResolvedValue(repos)

      await batchService.batchAddTag(['a'], 'tag-new')
      const undoResult = await batchService.undoLastBatch()

      expect(undoResult.success).toBe(true)
      expect(repos.tasks.restoreSnapshots).toHaveBeenCalledWith(expect.any(Array), expect.any(String))
    })

    it('reverses removeTag by re-adding the removed tag', async () => {
      const repos = makeRepos()
      repos.tasks.getSnapshots.mockResolvedValue([
        { id: 'a', status: 'todo', priority: 'none', projectId: null, parentId: null, deletedAt: null, tagIds: ['tag1'] },
      ])
      repos.tags.findByTaskId.mockResolvedValue([])
      mockedGetRepositories.mockResolvedValue(repos)

      await batchService.batchRemoveTag(['a'], 'tag1')
      const undoResult = await batchService.undoLastBatch()

      expect(undoResult.success).toBe(true)
      expect(repos.tasks.restoreSnapshots).toHaveBeenCalledWith(expect.any(Array), expect.any(String))
    })

    it('does not create a new undo entry when undoing', async () => {
      mockedGetRepositories.mockResolvedValue(makeRepos())

      await batchService.batchComplete(['a'])
      expect(batchService.canUndo()).toBe(true)

      await batchService.undoLastBatch()
      expect(batchService.canUndo()).toBe(false)
    })

    it('returns failure when nothing to undo', async () => {
      mockedGetRepositories.mockResolvedValue(makeRepos())

      const result = await batchService.undoLastBatch()

      expect(result.success).toBe(false)
      expect(result.errors[0].error).toBe('No operation to undo')
    })
  })

  describe('partial failure', () => {
    it('returns success when empty ids array is passed', async () => {
      mockedGetRepositories.mockResolvedValue(makeRepos())

      const result = await batchService.batchComplete([])

      expect(result.success).toBe(true)
      expect(result.affectedCount).toBe(0)
      expect(result.errors).toHaveLength(0)
    })

    it('returns failure when snapshot capture fails', async () => {
      const repos = makeRepos()
      repos.tasks.getSnapshots.mockRejectedValue(new Error('DB error'))
      mockedGetRepositories.mockResolvedValue(repos)

      const result = await batchService.batchComplete(['a', 'b'])

      expect(result.success).toBe(false)
    })
  })

  describe('undo stack limit', () => {
    it('trims old entries beyond MAX_UNDO', async () => {
      mockedGetRepositories.mockResolvedValue(makeRepos())

      // Push 52 entries (MAX is 50)
      for (let i = 0; i < 52; i++) {
        await batchService.batchComplete([`task-${i}`])
      }

      // The oldest should have been trimmed
      // We can verify by undoing 50 times and checking it fails
      let undoCount = 0
      while (batchService.canUndo()) {
        await batchService.undoLastBatch()
        undoCount++
      }
      expect(undoCount).toBe(50)
    })
  })
})
