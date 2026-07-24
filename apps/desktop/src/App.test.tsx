import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

const mocks = vi.hoisted(() => ({
  setFilters: vi.fn(), loadTasks: vi.fn(), loadProjects: vi.fn(), loadTags: vi.fn(),
  undoLastBatch: vi.fn(), clearFilters: vi.fn(),
}))

vi.mock('./stores/task-store', () => ({
  useTaskStore: () => ({
    tasks: [], currentTask: null, currentView: 'today', selectedTaskIds: new Set<string>(),
    isLoading: false, error: null, warnings: [],
    undoableBatch: { operation: 'complete', count: 2 }, filters: {},
    setView: vi.fn(), setFilters: mocks.setFilters, clearFilters: mocks.clearFilters,
    loadTasks: mocks.loadTasks, createTask: vi.fn(), updateTask: vi.fn(), deleteTask: vi.fn(),
    completeTask: vi.fn(), uncompleteTask: vi.fn(), restoreTask: vi.fn(), permanentlyDelete: vi.fn(),
    searchTasks: vi.fn(), setCurrentTask: vi.fn(), toggleSelection: vi.fn(), selectAll: vi.fn(),
    clearSelection: vi.fn(), batchComplete: vi.fn(), batchDelete: vi.fn(), batchSetPriority: vi.fn(),
    batchMoveToProject: vi.fn(), batchAddTag: vi.fn(), batchRemoveTag: vi.fn(),
    undoLastBatch: mocks.undoLastBatch, indentTask: vi.fn(), outdentTask: vi.fn(),
    copyTask: vi.fn(), reorderSiblingTasks: vi.fn(),
  }),
}))

vi.mock('./stores/project-store', () => ({
  useProjectStore: () => ({ projects: [{ id: 'p1', name: '项目一', icon: null }], loadProjects: mocks.loadProjects }),
}))

vi.mock('./stores/tag-store', () => ({
  useTagStore: () => ({ tags: [{ id: 'tag1', name: '标签一' }], loadTags: mocks.loadTags }),
}))

vi.mock('./lib/export', () => ({ exportTasks: vi.fn(), downloadExport: vi.fn() }))
vi.mock('./lib/import', () => ({ importTasks: vi.fn() }))

describe('P0-2 App interactions', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('keeps the undo action visible after a successful batch clears selection', () => {
    render(<App />)

    expect(screen.getByTestId('undo-banner')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('undo-button'))
    expect(mocks.undoLastBatch).toHaveBeenCalledTimes(1)
  })

  it('wires project, tag, priority, status, sorting and parent controls to the Store', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '🔽 筛选' }))

    expect(screen.getByLabelText('项目筛选')).toBeInTheDocument()
    expect(screen.getByLabelText('标签筛选')).toBeInTheDocument()
    expect(screen.getByLabelText('优先级筛选')).toBeInTheDocument()
    expect(screen.getByLabelText('状态筛选')).toBeInTheDocument()
    expect(screen.getByLabelText('排序字段')).toBeInTheDocument()
    expect(screen.getByLabelText('切换排序方向')).toBeInTheDocument()
    expect(screen.getByText('仅父任务')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '展开全部子任务' })).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('状态筛选'), { target: { value: 'done' } })
    expect(mocks.setFilters).toHaveBeenCalledWith({ status: 'done' })
  })
})