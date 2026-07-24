import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import type { Task } from './lib/repositories'

const perf = vi.hoisted(() => ({
  tasks: Array.from({ length: 10_000 }, (_, index) => ({
    id: `task-${index}`, parentId: null, projectId: null, title: `Task ${index}`, note: null,
    status: 'todo', priority: 'none', sortOrder: index, scheduledDate: '2026-07-23',
    scheduledAt: null, dueAt: null, isAllDay: true, timezone: 'UTC', estimatedMinutes: null,
    createdAt: '2026-07-23T00:00:00.000Z', updatedAt: '2026-07-23T00:00:00.000Z',
    completedAt: null, deletedAt: null, revision: 1, source: 'manual', sourceCaptureId: null,
  })) as Task[],
  action: () => vi.fn(),
}))
vi.mock('./stores/task-store', () => ({
  useTaskStore: () => ({
    tasks: perf.tasks, currentTask: null, currentView: 'today', selectedTaskIds: new Set<string>(),
    isLoading: false, error: null, warnings: [], undoableBatch: null, filters: {},
    setView: perf.action(), setFilters: perf.action(), clearFilters: perf.action(), loadTasks: perf.action(),
    createTask: perf.action(), updateTask: perf.action(), deleteTask: perf.action(), completeTask: perf.action(),
    uncompleteTask: perf.action(), restoreTask: perf.action(), permanentlyDelete: perf.action(), searchTasks: perf.action(),
    setCurrentTask: perf.action(), toggleSelection: perf.action(), selectAll: perf.action(), clearSelection: perf.action(),
    batchComplete: perf.action(), batchDelete: perf.action(), batchSetPriority: perf.action(), batchMoveToProject: perf.action(),
    batchAddTag: perf.action(), batchRemoveTag: perf.action(), undoLastBatch: perf.action(), indentTask: perf.action(),
    outdentTask: perf.action(), copyTask: perf.action(), reorderSiblingTasks: perf.action(),
  }),
}))
vi.mock('./stores/project-store', () => ({ useProjectStore: () => ({ projects: [], loadProjects: perf.action() }) }))
vi.mock('./stores/tag-store', () => ({ useTagStore: () => ({ tags: [], loadTags: perf.action() }) }))
vi.mock('./lib/export', () => ({ exportTasks: perf.action(), downloadExport: perf.action() }))
vi.mock('./lib/import', () => ({ importTasks: perf.action() }))

afterEach(cleanup)

describe('P0-2 10,000 task render performance', () => {
  it('keeps initial App render bounded to the first viewport page', () => {
    for (let index = 0; index < 3; index++) {
      const warmup = render(<App />)
      warmup.unmount()
    }
    const samples: number[] = []
    for (let index = 0; index < 10; index++) {
      const start = performance.now()
      const view = render(<App />)
      samples.push(performance.now() - start)
      expect(view.getByText('Task 19')).toBeInTheDocument()
      expect(view.queryByText('Task 20')).not.toBeInTheDocument()
      view.unmount()
    }
    samples.sort((a, b) => a - b)
    const p50 = samples[Math.ceil(samples.length * 0.5) - 1]
    const p95 = samples[Math.ceil(samples.length * 0.95) - 1]
    console.log(`App render 10k dataset (20 visible): P50=${p50.toFixed(2)}ms P95=${p95.toFixed(2)}ms max=${samples.at(-1)!.toFixed(2)}ms`)
    expect(p95).toBeLessThan(250)
  })
})