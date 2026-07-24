import { describe, expect, it, vi } from 'vitest'
import { SQLiteTaskRepository, SQLiteTagRepository, type Database } from '../sqlite-repository'
import type { Task } from '../types'

function task(id: string): Task {
  return {
    id, parentId: null, projectId: null, title: id, note: null, status: 'todo',
    priority: 'none', sortOrder: 0, scheduledDate: null, scheduledAt: null,
    dueAt: null, isAllDay: false, timezone: 'UTC', estimatedMinutes: null,
    createdAt: '2026-07-23T00:00:00.000Z', updatedAt: '2026-07-23T00:00:00.000Z',
    completedAt: null, deletedAt: null, revision: 1, source: 'manual', sourceCaptureId: null,
  }
}

function makeDb(options: { failTaskId?: string } = {}) {
  const outboxParams: unknown[][] = []
  let commits = 0
  let rollbacks = 0
  const execute = vi.fn(async (sql: string, params: unknown[] = []) => {
    if (sql.startsWith('UPDATE tasks') && params.includes(options.failTaskId)) {
      throw new Error(`forced failure: ${options.failTaskId}`)
    }
    if (sql.includes('INSERT INTO sync_outbox')) outboxParams.push(params)
    return { rowsAffected: 1 }
  })
  const select = vi.fn(async (sql: string, params: unknown[] = []) => {
    if (sql.includes('FROM tasks') && params[0]) return [task(String(params[0]))]
    if (sql.includes('FROM task_tags')) return []
    return []
  })
  const transaction = vi.fn(async <T>(fn: () => Promise<T>) => {
    try {
      const result = await fn()
      commits++
      return result
    } catch (error) {
      rollbacks++
      throw error
    }
  })
  return {
    db: { execute, select, transaction } as Database,
    execute, select, transaction, outboxParams,
    get commits() { return commits },
    get rollbacks() { return rollbacks },
  }
}

describe('SQLite transactional P0-2 batches', () => {
  it('commits one transaction and writes one shared batch id to every outbox row', async () => {
    const fake = makeDb()
    const repo = new SQLiteTaskRepository(fake.db)

    const result = await repo.batchComplete(['a', 'b'], 'batch-1')

    expect(result.success).toBe(true)
    expect(fake.transaction).toHaveBeenCalledTimes(1)
    expect(fake.commits).toBe(1)
    expect(fake.rollbacks).toBe(0)
    expect(fake.outboxParams).toHaveLength(2)
    expect(fake.outboxParams.every(params => params[6] === 'batch-1')).toBe(true)
  })

  it('reports zero affected rows when a transaction body fails', async () => {
    const fake = makeDb({ failTaskId: 'b' })
    const repo = new SQLiteTaskRepository(fake.db)

    const result = await repo.batchComplete(['a', 'b'], 'batch-fail')

    expect(result.success).toBe(false)
    expect(result.affectedCount).toBe(0)
    expect(fake.commits).toBe(0)
    expect(fake.rollbacks).toBe(1)
  })

  it('restores all snapshot fields and records undo in one outbox batch', async () => {
    const fake = makeDb()
    const repo = new SQLiteTaskRepository(fake.db)
    const snapshot = {
      id: 'a', status: 'todo' as const, priority: 'p2' as const, projectId: 'project-1',
      parentId: null, deletedAt: null, tagIds: ['tag-1'],
    }

    const result = await repo.restoreSnapshots([snapshot], 'undo-1')

    expect(result.success).toBe(true)
    expect(fake.transaction).toHaveBeenCalledTimes(1)
    expect(fake.outboxParams).toHaveLength(1)
    expect(fake.outboxParams[0][6]).toBe('undo-1')
  })

  it('combines deterministic SQLite filters with AND tag semantics and requested sorting', async () => {
    const fake = makeDb()
    const repo = new SQLiteTaskRepository(fake.db)

    await repo.findByView('today', {
      projectId: 'project-1', tagIds: ['tag-1', 'tag-2'], priority: 'p1',
      status: 'todo', search: 'report', sort: { field: 'dueAt', direction: 'desc' },
    })

    const sql = String(fake.select.mock.calls[0][0])
    const params = fake.select.mock.calls[0][1]
    expect(sql).toContain("date('now', 'localtime')")
    expect(sql).not.toContain('INTERVAL')
    expect(sql.match(/EXISTS \(SELECT 1 FROM task_tags/g)).toHaveLength(2)
    expect(sql).toContain('ORDER BY t.due_at DESC')
    expect(params).toEqual(['project-1', 'p1', 'todo', '%report%', 'tag-1', 'tag-2'])
  })
  it('writes tag relationship changes to outbox with the same batch id', async () => {
    const fake = makeDb()
    const repo = new SQLiteTagRepository(fake.db)

    const result = await repo.batchAddTag(['a', 'b'], 'tag-1', 'tag-batch')

    expect(result.success).toBe(true)
    expect(fake.outboxParams).toHaveLength(2)
    expect(fake.outboxParams.every(params => params[4] === 'tag-batch')).toBe(true)
  })
})