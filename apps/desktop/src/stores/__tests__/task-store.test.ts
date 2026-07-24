import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useTaskStore } from '../task-store'
import { getRepositories } from '../../lib/repositories'
import * as batchService from '../../lib/services/batch-service'

vi.mock('../../lib/repositories', () => ({
  getRepositories: vi.fn(),
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

const mockedGetRepositories = vi.mocked(getRepositories)
const mockedBatchService = vi.mocked(batchService)

describe('task store batch actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useTaskStore.setState({
      tasks: [],
      selectedTaskIds: new Set(),
      currentView: 'today',
      filters: {},
      isLoading: false,
      error: null,
      undoableBatch: null,
    })
    mockedGetRepositories.mockResolvedValue({
      tasks: { findByView: vi.fn().mockResolvedValue([]) },
    } as never)
  })

  it('keeps only failed tasks selected after a partial priority update', async () => {
    mockedBatchService.batchSetPriority.mockResolvedValue({
      success: false,
      affectedCount: 1,
      errors: [{ id: 'failed', error: 'locked' }],
      undoToken: 'tok-1',
    })
    mockedBatchService.getLastUndoableBatch.mockReturnValue({
      undoToken: 'tok-1', operation: 'setPriority', taskIds: ['ok', 'failed'],
      snapshot: [], createdAt: new Date().toISOString(),
    })
    useTaskStore.setState({ selectedTaskIds: new Set(['ok', 'failed']) })

    const result = await useTaskStore.getState().batchSetPriority('p1')

    expect(mockedBatchService.batchSetPriority).toHaveBeenCalledWith(['ok', 'failed'], 'p1')
    expect(result.success).toBe(false)
    expect([...useTaskStore.getState().selectedTaskIds]).toEqual(['failed'])
    expect(useTaskStore.getState().error).toBe('1 succeeded, 1 failed')
  })

  it('clears selection after a successful project move', async () => {
    mockedBatchService.batchMoveToProject.mockResolvedValue({
      success: true,
      affectedCount: 2,
      errors: [],
      undoToken: 'tok-2',
    })
    mockedBatchService.getLastUndoableBatch.mockReturnValue({
      undoToken: 'tok-2', operation: 'moveToProject', taskIds: ['one', 'two'],
      snapshot: [], createdAt: new Date().toISOString(),
    })
    useTaskStore.setState({ selectedTaskIds: new Set(['one', 'two']) })

    await useTaskStore.getState().batchMoveToProject('project-1')

    expect(mockedBatchService.batchMoveToProject).toHaveBeenCalledWith(['one', 'two'], 'project-1')
    expect(useTaskStore.getState().selectedTaskIds.size).toBe(0)
    expect(useTaskStore.getState().error).toBeNull()
  })

  it('surfaces partial failures from batch completion', async () => {
    mockedBatchService.batchComplete.mockResolvedValue({
      success: false,
      affectedCount: 1,
      errors: [{ id: 'failed', error: 'not found' }],
      undoToken: 'tok-3',
    })
    mockedBatchService.getLastUndoableBatch.mockReturnValue({
      undoToken: 'tok-3', operation: 'complete', taskIds: ['ok', 'failed'],
      snapshot: [], createdAt: new Date().toISOString(),
    })
    useTaskStore.setState({ selectedTaskIds: new Set(['ok', 'failed']) })

    await useTaskStore.getState().batchComplete()

    expect([...useTaskStore.getState().selectedTaskIds]).toEqual(['failed'])
    expect(useTaskStore.getState().error).toBe('1 succeeded, 1 failed')
  })

  it('keeps a failed task selected after a partial tag update', async () => {
    mockedBatchService.batchAddTag.mockResolvedValue({
      success: false,
      affectedCount: 1,
      errors: [{ id: 'failed', error: 'locked' }],
      undoToken: 'tok-4',
    })
    mockedBatchService.getLastUndoableBatch.mockReturnValue({
      undoToken: 'tok-4', operation: 'addTag', taskIds: ['ok', 'failed'],
      snapshot: [], createdAt: new Date().toISOString(),
    })
    useTaskStore.setState({ selectedTaskIds: new Set(['ok', 'failed']) })

    await useTaskStore.getState().batchAddTag('tag-1')

    expect(mockedBatchService.batchAddTag).toHaveBeenCalledWith(['ok', 'failed'], 'tag-1')
    expect([...useTaskStore.getState().selectedTaskIds]).toEqual(['failed'])
    expect(useTaskStore.getState().error).toBe('1 succeeded, 1 failed')
  })

  it('sets undoableBatch state after a successful batch complete', async () => {
    mockedBatchService.batchComplete.mockResolvedValue({
      success: true, affectedCount: 2, errors: [], undoToken: 'tok-5',
    })
    mockedBatchService.getLastUndoableBatch.mockReturnValue({
      undoToken: 'tok-5', operation: 'complete', taskIds: ['a', 'b'],
      snapshot: [], createdAt: new Date().toISOString(),
    })
    useTaskStore.setState({ selectedTaskIds: new Set(['a', 'b']) })

    await useTaskStore.getState().batchComplete()

    expect(useTaskStore.getState().undoableBatch).toEqual({ operation: 'complete', count: 2 })
  })

  it('combines search text with existing filters in the repository query', async () => {
    const findByView = vi.fn().mockResolvedValue([])
    mockedGetRepositories.mockResolvedValue({ tasks: { findByView } } as never)
    useTaskStore.setState({ filters: { projectId: 'project-1', priority: 'p1' } })

    await useTaskStore.getState().searchTasks(' report ')

    expect(findByView).toHaveBeenCalledWith('today', {
      projectId: 'project-1', priority: 'p1', search: 'report', parentOnly: true,
    })
  })
  it('clears undoableBatch after undoLastBatch with no remaining batches', async () => {
    mockedBatchService.undoLastBatch.mockResolvedValue({
      success: true, affectedCount: 2, errors: [], undoToken: null,
    })
    mockedBatchService.getLastUndoableBatch.mockReturnValue(null)
    useTaskStore.setState({ undoableBatch: { operation: 'complete', count: 2 } })

    await useTaskStore.getState().undoLastBatch()

    expect(useTaskStore.getState().undoableBatch).toBeNull()
  })
})
