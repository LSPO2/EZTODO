/**
 * SQL repository adapter.
 *
 * Legacy operational modules depend on this repository contract instead of
 * importing the database singleton. The concrete SQLite/browser adapter stays
 * inside the repository layer while domain modules are migrated incrementally
 * to specialised repositories.
 */

import { getDatabase } from '../database'

export interface SqlRepository {
  select<T = any>(query: string, bindValues?: unknown[]): Promise<T>
  execute(query: string, bindValues?: unknown[]): Promise<any>
  /** Execute a function inside a BEGIN/COMMIT block; ROLLBACK on throw */
  transaction<T>(fn: () => Promise<T>): Promise<T>
}

export async function getSqlRepository(): Promise<SqlRepository> {
  const db = await getDatabase()
  // If the database already has a transaction method (Tauri SQLite), use it directly
  if (typeof db.transaction === 'function') {
    return db as SqlRepository
  }
  // Otherwise, implement transaction using BEGIN/COMMIT/ROLLBACK
  return {
    select: db.select.bind(db),
    execute: db.execute.bind(db),
    async transaction<T>(fn: () => Promise<T>): Promise<T> {
      await db.execute('BEGIN TRANSACTION')
      try {
        const result = await fn()
        await db.execute('COMMIT')
        return result
      } catch (error) {
        await db.execute('ROLLBACK')
        throw error
      }
    },
  } as SqlRepository
}