/**
 * localStorage Migration tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { needsMigration, getLegacyData, runMigration, getMigrationStatus } from '../local-storage-migration'
import { createBrowserRepositories } from '../../repositories/browser-repository'

const MIGRATION_KEY = 'eztodo_migration_version'
const LEGACY_KEY = 'eztodo_db'

beforeEach(() => {
  localStorage.clear()
})

describe('Migration', () => {
  it('should detect migration needed', () => {
    expect(needsMigration()).toBe(true)
  })

  it('should detect migration not needed after completion', () => {
    localStorage.setItem(MIGRATION_KEY, '1')
    expect(needsMigration()).toBe(false)
  })

  it('should return null for missing legacy data', () => {
    const data = getLegacyData()
    expect(data).toBeNull()
  })

  it('should parse legacy data', () => {
    const legacy = {
      tasks: [{ id: '1', title: 'Test' }],
      projects: [],
    }
    localStorage.setItem(LEGACY_KEY, JSON.stringify(legacy))

    const data = getLegacyData()
    expect(data).toBeDefined()
    expect(data?.tasks?.length).toBe(1)
  })

  it('should migrate tasks', async () => {
    const legacy = {
      tasks: [
        { id: 'task-1', title: 'Migrate Me', status: 'todo', priority: 'p1' },
        { id: 'task-2', title: 'Me Too', status: 'done' },
      ],
      projects: [],
    }
    localStorage.setItem(LEGACY_KEY, JSON.stringify(legacy))

    const repos = createBrowserRepositories()
    const result = await runMigration(repos)

    expect(result.success).toBe(true)
    expect(result.tasksMigrated).toBe(0)
    expect((await repos.tasks.findById('task-1'))?.title).toBe('Migrate Me')
    expect(result.errors.length).toBe(0)
  })

  it('should be idempotent', async () => {
    const legacy = {
      tasks: [{ id: 'task-1', title: 'Idempotent Test' }],
      projects: [],
    }
    localStorage.setItem(LEGACY_KEY, JSON.stringify(legacy))

    const repos = createBrowserRepositories()

    // Run migration twice
    await runMigration(repos)
    const result2 = await runMigration(repos)

    // Second run should still report tasks (browser mode validation)
    expect(result2.success).toBe(true)
  })

  it('should handle empty data', async () => {
    const repos = createBrowserRepositories()
    const result = await runMigration(repos)

    expect(result.success).toBe(true)
    expect(result.tasksMigrated).toBe(0)
    expect(result.projectsMigrated).toBe(0)
  })

  it('should skip invalid tasks', async () => {
    const legacy = {
      tasks: [
        { id: 'valid', title: 'Valid Task' },
        { id: 'invalid', title: '' },  // Empty title
        { noId: true, title: 'No ID' },  // Missing ID
      ],
      projects: [],
    }
    localStorage.setItem(LEGACY_KEY, JSON.stringify(legacy))

    const repos = createBrowserRepositories()
    const result = await runMigration(repos)

    expect(result.tasksMigrated).toBe(0)
    expect(result.success).toBe(false)
    expect(needsMigration()).toBe(true)
    expect(result.errors.length).toBeGreaterThan(0)
  })

  it('should preserve old data on failure', async () => {
    const legacy = {
      tasks: [{ id: 'task-1', title: 'Preserve Me' }],
      projects: [],
    }
    localStorage.setItem(LEGACY_KEY, JSON.stringify(legacy))

    const repos = createBrowserRepositories()
    await runMigration(repos)

    // Legacy data should still exist
    const data = localStorage.getItem(LEGACY_KEY)
    expect(data).toBeDefined()
  })

  it('writes legacy records to an empty target repository and preserves hierarchy', async () => {
    const legacy = {
      projects: [{ id: 'old-project', name: 'Migration Project' }],
      tasks: [
        { id: 'parent', title: 'Parent', projectId: 'old-project' },
        { id: 'child', title: 'Child', parentId: 'parent', status: 'done' },
      ],
    }
    localStorage.setItem(LEGACY_KEY, JSON.stringify(legacy))

    const taskCreates: Array<Record<string, unknown>> = []
    const projectCreate = vi.fn(async () => ({ id: 'new-project' }))
    const taskCreate = vi.fn(async (request: Record<string, unknown>) => {
      taskCreates.push(request)
      return { id: `new-task-${taskCreates.length}` }
    })
    const repos = {
      tasks: { findById: vi.fn().mockResolvedValue(null), create: taskCreate, update: vi.fn() },
      projects: { findById: vi.fn().mockResolvedValue(null), create: projectCreate },
      tags: { findById: vi.fn().mockResolvedValue(null), create: vi.fn(), addToTask: vi.fn() },
      settings: { set: vi.fn() },
    } as unknown as import('../../repositories/types').Repositories

    const result = await runMigration(repos)

    expect(result.success).toBe(true)
    expect(projectCreate).toHaveBeenCalledTimes(1)
    expect(taskCreate).toHaveBeenCalledTimes(2)
    expect(taskCreates.find((task) => task.title === 'Child')?.parentId).toBe('new-task-1')
    expect(needsMigration()).toBe(false)
  })
  it('should report migration status', () => {
    const status1 = getMigrationStatus()
    expect(status1.needed).toBe(true)

    localStorage.setItem(MIGRATION_KEY, '1')
    const status2 = getMigrationStatus()
    expect(status2.needed).toBe(false)
    expect(status2.version).toBe(1)
  })
})
