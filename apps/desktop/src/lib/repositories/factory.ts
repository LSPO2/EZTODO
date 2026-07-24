/**
 * Repository factory
 * Selects implementation based on environment
 */

import type { Repositories } from './types'
import { createBrowserRepositories } from './browser-repository'
import { isTauriEnvironment } from '../environment'

// Singleton instance
let repositories: Repositories | null = null
let repositoriesPromise: Promise<Repositories> | null = null

/**
 * Get repositories for current environment
 */
export async function getRepositories(): Promise<Repositories> {
  if (repositories) {
    return repositories
  }

  if (!repositoriesPromise) {
    repositoriesPromise = (async () => {
      if (isTauriEnvironment()) {
        const { getDatabase } = await import('../database')
        const { createSQLiteRepositories } = await import('./sqlite-repository')
        const rawDb = await getDatabase()
        const db = {
          execute: (sql: string, params?: unknown[]) => rawDb.execute(sql, params),
          select: <T>(sql: string, params?: unknown[]) => rawDb.select(sql, params) as Promise<T>,
          transaction: async <T>(fn: () => Promise<T>): Promise<T> => {
            // Tauri SQL has no connection-bound JavaScript transaction API.
            // Separate BEGIN/COMMIT IPC calls can run on different pooled connections.
            return fn()
          },
        }
        repositories = createSQLiteRepositories(db)
        console.log('Using SQLite repositories')
      } else {
        repositories = createBrowserRepositories()
        console.log('Using browser repositories (demo mode)')
      }

      return repositories
    })()
  }

  try {
    return await repositoriesPromise
  } catch (error) {
    console.error('Failed to initialize repositories:', error)
    repositories = null
    repositoriesPromise = null
    throw new Error('SQLite initialization failed. Please check your Tauri setup.')
  }
}
/**
 * Reset repositories (for testing)
 */
export function resetRepositories(): void {
  repositories = null
  repositoriesPromise = null
}

/**
 * Check if running in demo mode
 */
export function isDemoMode(): boolean {
  return !isTauriEnvironment()
}
