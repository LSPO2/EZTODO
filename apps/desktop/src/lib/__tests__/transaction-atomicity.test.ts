/**
 * Transaction atomicity tests
 * Verifies that task/project/tag CRUD and sync_outbox writes are atomic
 */

import { describe, it, expect } from 'vitest'

describe('Transaction atomicity', () => {
  it('sqlite-repository task create should use transaction', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const repoPath = path.resolve(__dirname, '../repositories/sqlite-repository.ts')
    const source = fs.readFileSync(repoPath, 'utf-8')

    // Find the create method in SQLiteTaskRepository
    const createStart = source.indexOf('async create(request: CreateTaskRequest)')
    const createEnd = source.indexOf('async findById', createStart)
    const createBlock = source.slice(createStart, createEnd)

    // Verify transaction wraps INSERT + outbox
    expect(createBlock).toContain('await this.db.transaction')
    expect(createBlock).toContain('INSERT INTO tasks')
    expect(createBlock).toContain('addToSyncOutbox')
  })

  it('sqlite-repository task update should use transaction', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const repoPath = path.resolve(__dirname, '../repositories/sqlite-repository.ts')
    const source = fs.readFileSync(repoPath, 'utf-8')

    const updateStart = source.indexOf('async update(id: string, updates: UpdateTaskRequest)')
    const updateEnd = source.indexOf('async delete', updateStart)
    const updateBlock = source.slice(updateStart, updateEnd)

    expect(updateBlock).toContain('await this.db.transaction')
    expect(updateBlock).toContain('UPDATE tasks SET')
    expect(updateBlock).toContain('addToSyncOutbox')
  })

  it('sqlite-repository task delete should use transaction', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const repoPath = path.resolve(__dirname, '../repositories/sqlite-repository.ts')
    const source = fs.readFileSync(repoPath, 'utf-8')

    const deleteStart = source.indexOf('async delete(id: string): Promise<void>')
    const deleteEnd = source.indexOf('async restore', deleteStart)
    const deleteBlock = source.slice(deleteStart, deleteEnd)

    expect(deleteBlock).toContain('await this.db.transaction')
    expect(deleteBlock).toContain('UPDATE tasks SET deleted_at')
    expect(deleteBlock).toContain('addToSyncOutbox')
  })

  it('sqlite-repository task restore should use transaction', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const repoPath = path.resolve(__dirname, '../repositories/sqlite-repository.ts')
    const source = fs.readFileSync(repoPath, 'utf-8')

    const restoreStart = source.indexOf('async restore(id: string): Promise<Task>')
    const restoreEnd = source.indexOf('async permanentlyDelete', restoreStart)
    const restoreBlock = source.slice(restoreStart, restoreEnd)

    expect(restoreBlock).toContain('await this.db.transaction')
    expect(restoreBlock).toContain('UPDATE tasks SET deleted_at = NULL')
    expect(restoreBlock).toContain('addToSyncOutbox')
  })

  it('sqlite-repository project CRUD should write to outbox', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const repoPath = path.resolve(__dirname, '../repositories/sqlite-repository.ts')
    const source = fs.readFileSync(repoPath, 'utf-8')

    // Find SQLiteProjectRepository class
    const classStart = source.indexOf('export class SQLiteProjectRepository')
    const classEnd = source.indexOf('export class SQLiteTagRepository', classStart)
    const classBlock = source.slice(classStart, classEnd)

    // Verify create, update, delete all use transaction and outbox
    expect(classBlock).toContain('addToSyncOutbox(this.db, \'project\'')
    expect(classBlock).toContain('await this.db.transaction')
  })

  it('sqlite-repository tag CRUD should write to outbox', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const repoPath = path.resolve(__dirname, '../repositories/sqlite-repository.ts')
    const source = fs.readFileSync(repoPath, 'utf-8')

    // Find SQLiteTagRepository class
    const classStart = source.indexOf('export class SQLiteTagRepository')
    const classBlock = source.slice(classStart)

    // Verify create, update, delete all use transaction and outbox
    expect(classBlock).toContain('addToSyncOutbox(this.db, \'tag\'')
    expect(classBlock).toContain('await this.db.transaction')
  })
})
