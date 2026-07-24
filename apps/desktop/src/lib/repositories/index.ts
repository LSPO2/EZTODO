/**
 * Repositories index
 * Provides unified access to data layer
 */

// Types
export * from './types'

// Factory
export { getRepositories, resetRepositories, isDemoMode } from './factory'

// Implementations (for direct use in tests)
export { BrowserTaskRepository, BrowserProjectRepository, BrowserTagRepository, BrowserSettingsRepository, createBrowserRepositories } from './browser-repository'
export { SQLiteTaskRepository, SQLiteProjectRepository, SQLiteTagRepository, SQLiteSettingsRepository, createSQLiteRepositories } from './sqlite-repository'

export { getSqlRepository } from './sql-repository'
export type { SqlRepository } from './sql-repository'
