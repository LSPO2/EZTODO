/**
 * Performance test: 10,000 task dataset (deterministic)
 * Measures search, filter, and view query performance in the Browser repository.
 *
 * Data: deterministic seeded generation — no Math.random()
 * Machine: recorded on each run (OS, CPU count)
 * Target: P95 < 200ms for all queries
 *
 * @vitest-environment jsdom
 */

import { describe, expect, it, beforeAll } from 'vitest'
import { BrowserTaskRepository } from '../repositories/browser-repository'
import type { Task } from '../repositories'

const TASK_COUNT = 10_000

/**
 * Deterministic pseudo-random number generator (mulberry32).
 * Returns a function that produces numbers in [0, 1).
 */
function seededRng(seed: number) {
  let s = seed
  return () => {
    s = (s + 0x6D2B79F5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function generateTasks(count: number): Task[] {
  const rng = seededRng(42) // Fixed seed for reproducibility
  const now = new Date('2026-07-23T12:00:00Z')
  const tasks: Task[] = []
  const priorities = ['p1', 'p2', 'p3', 'p4', 'none'] as const
  const statuses = ['todo', 'done'] as const
  const projectIds = [null, 'proj-1', 'proj-2', 'proj-3', 'proj-4', 'proj-5']
  const taskNames = ['Buy groceries', 'Write report', 'Call client', 'Review PR', 'Fix bug', 'Deploy app', 'Update docs']

  for (let i = 0; i < count; i++) {
    const daysOffset = Math.floor(rng() * 60) - 30 // -30 to +30 days
    const scheduledDate = new Date(now)
    scheduledDate.setDate(scheduledDate.getDate() + daysOffset)
    const dateStr = scheduledDate.toISOString().split('T')[0]

    const r = rng
    const parentId = (i > 100 && r() < 0.15)
      ? `task-${String(Math.floor(r() * Math.min(i, 100))).padStart(5, '0')}`
      : null

    tasks.push({
      id: `task-${String(i).padStart(5, '0')}`,
      parentId,
      projectId: projectIds[Math.floor(r() * projectIds.length)],
      title: `Task ${i}: ${taskNames[i % 7]}`,
      note: i % 3 === 0 ? `Note for task ${i}` : null,
      status: statuses[Math.floor(r() * statuses.length)],
      priority: priorities[Math.floor(r() * priorities.length)],
      sortOrder: i,
      scheduledDate: r() < 0.7 ? dateStr : null,
      scheduledAt: null,
      dueAt: r() < 0.3 ? new Date(scheduledDate.getTime() + 86400000).toISOString() : null,
      isAllDay: r() < 0.5,
      timezone: 'UTC',
      estimatedMinutes: r() < 0.2 ? Math.floor(r() * 120) + 15 : null,
      createdAt: new Date(now.getTime() - r() * 30 * 86400000).toISOString(),
      updatedAt: now.toISOString(),
      completedAt: null,
      deletedAt: r() < 0.05 ? now.toISOString() : null,
      revision: 1,
      source: 'manual',
      sourceCaptureId: null,
    })
  }
  return tasks
}

function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.ceil((p / 100) * sorted.length) - 1
  return sorted[Math.max(0, index)]
}

function max(values: number[]): number {
  return Math.max(...values)
}

const WARMUP = 3
const SAMPLES = 20
const THRESHOLD_MS = 200

describe('Performance: 10,000 tasks (deterministic seed=42)', () => {
  let repo: BrowserTaskRepository
  const timings: Record<string, number[]> = {
    findByView_today: [],
    findByView_inbox: [],
    findByView_completed: [],
    search: [],
    filter_project: [],
    filter_priority: [],
    filter_tag: [],
    filter_combined: [],
  }

  beforeAll(() => {
    const tasks = generateTasks(TASK_COUNT)
    // Verify determinism
    const tasks2 = generateTasks(TASK_COUNT)
    expect(tasks[0].title).toBe(tasks2[0].title)
    expect(tasks[999].title).toBe(tasks2[999].title)

    localStorage.setItem('eztodo_db', JSON.stringify({ tasks, projects: [], tags: [], taskTags: [], settings: {} }))
    repo = new BrowserTaskRepository()
  })

  it(`loads exactly ${TASK_COUNT} deterministic tasks`, () => {
    const db = JSON.parse(localStorage.getItem('eztodo_db') || '{}')
    expect(db.tasks.length).toBe(TASK_COUNT)
    // Verify first task is deterministic
    expect(db.tasks[0].id).toBe('task-00000')
  })

  // Warmup runs
  for (let w = 0; w < WARMUP; w++) {
    it(`warmup ${w + 1}/${WARMUP}`, async () => {
      await repo.findByView('today')
      await repo.search('report')
    })
  }

  it(`findByView(today) P95 < ${THRESHOLD_MS}ms`, async () => {
    for (let i = 0; i < SAMPLES; i++) {
      const start = performance.now()
      await repo.findByView('today')
      timings.findByView_today.push(performance.now() - start)
    }
    const p95 = percentile(timings.findByView_today, 95)
    console.log(`  findByView(today) P95: ${p95.toFixed(2)}ms, max: ${max(timings.findByView_today).toFixed(2)}ms`)
    expect(p95).toBeLessThan(THRESHOLD_MS)
  })

  it(`findByView(inbox) P95 < ${THRESHOLD_MS}ms`, async () => {
    for (let i = 0; i < SAMPLES; i++) {
      const start = performance.now()
      await repo.findByView('inbox')
      timings.findByView_inbox.push(performance.now() - start)
    }
    const p95 = percentile(timings.findByView_inbox, 95)
    console.log(`  findByView(inbox) P95: ${p95.toFixed(2)}ms, max: ${max(timings.findByView_inbox).toFixed(2)}ms`)
    expect(p95).toBeLessThan(THRESHOLD_MS)
  })

  it(`findByView(completed) P95 < ${THRESHOLD_MS}ms`, async () => {
    for (let i = 0; i < SAMPLES; i++) {
      const start = performance.now()
      await repo.findByView('completed')
      timings.findByView_completed.push(performance.now() - start)
    }
    const p95 = percentile(timings.findByView_completed, 95)
    console.log(`  findByView(completed) P95: ${p95.toFixed(2)}ms, max: ${max(timings.findByView_completed).toFixed(2)}ms`)
    expect(p95).toBeLessThan(THRESHOLD_MS)
  })

  it(`search("report") P95 < ${THRESHOLD_MS}ms`, async () => {
    for (let i = 0; i < SAMPLES; i++) {
      const start = performance.now()
      await repo.search('report')
      timings.search.push(performance.now() - start)
    }
    const p95 = percentile(timings.search, 95)
    console.log(`  search("report") P95: ${p95.toFixed(2)}ms, max: ${max(timings.search).toFixed(2)}ms`)
    expect(p95).toBeLessThan(THRESHOLD_MS)
  })

  it(`findByView(today, {projectId}) P95 < ${THRESHOLD_MS}ms`, async () => {
    for (let i = 0; i < SAMPLES; i++) {
      const start = performance.now()
      await repo.findByView('today', { projectId: 'proj-2' })
      timings.filter_project.push(performance.now() - start)
    }
    const p95 = percentile(timings.filter_project, 95)
    console.log(`  filter(projectId) P95: ${p95.toFixed(2)}ms, max: ${max(timings.filter_project).toFixed(2)}ms`)
    expect(p95).toBeLessThan(THRESHOLD_MS)
  })

  it(`findByView(today, {priority}) P95 < ${THRESHOLD_MS}ms`, async () => {
    for (let i = 0; i < SAMPLES; i++) {
      const start = performance.now()
      await repo.findByView('today', { priority: 'p1' })
      timings.filter_priority.push(performance.now() - start)
    }
    const p95 = percentile(timings.filter_priority, 95)
    console.log(`  filter(priority) P95: ${p95.toFixed(2)}ms, max: ${max(timings.filter_priority).toFixed(2)}ms`)
    expect(p95).toBeLessThan(THRESHOLD_MS)
  })

  it(`findByView(today, {tagIds}) P95 < ${THRESHOLD_MS}ms`, async () => {
    for (let i = 0; i < SAMPLES; i++) {
      const start = performance.now()
      await repo.findByView('today', { tagIds: ['tag-1'] })
      timings.filter_tag.push(performance.now() - start)
    }
    const p95 = percentile(timings.filter_tag, 95)
    console.log(`  filter(tagIds) P95: ${p95.toFixed(2)}ms, max: ${max(timings.filter_tag).toFixed(2)}ms`)
    expect(p95).toBeLessThan(THRESHOLD_MS)
  })

  it(`findByView(today, combined filters) P95 < ${THRESHOLD_MS}ms`, async () => {
    for (let i = 0; i < SAMPLES; i++) {
      const start = performance.now()
      await repo.findByView('today', { projectId: 'proj-3', priority: 'p2', search: 'bug' })
      timings.filter_combined.push(performance.now() - start)
    }
    const p95 = percentile(timings.filter_combined, 95)
    console.log(`  filter(combined) P95: ${p95.toFixed(2)}ms, max: ${max(timings.filter_combined).toFixed(2)}ms`)
    expect(p95).toBeLessThan(THRESHOLD_MS)
  })

  it('prints performance summary', () => {
    console.log('\n=== Performance Summary (10,000 tasks, deterministic seed=42) ===')
    console.log(`Tasks: ${TASK_COUNT}, Samples: ${SAMPLES}, Warmup: ${WARMUP}, Threshold: ${THRESHOLD_MS}ms`)
    console.log(`Platform: ${navigator?.platform || 'Node'} | Cores: ${navigator?.hardwareConcurrency || 'N/A'}`)
    for (const [key, values] of Object.entries(timings)) {
      if (values.length > 0) {
        console.log(`  ${key}: P50=${percentile(values, 50).toFixed(2)}ms P95=${percentile(values, 95).toFixed(2)}ms max=${max(values).toFixed(2)}ms`)
      }
    }
  })
})
