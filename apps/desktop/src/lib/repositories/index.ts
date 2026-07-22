/**
 * Repositories index
 * Auto-selects between Tauri and browser implementations
 */

export * from './types'

// Import browser repositories
import { BrowserTaskRepository, BrowserProjectRepository, BrowserTagRepository } from './browser-repository'

// Export repositories (browser-compatible by default)
export const taskRepository = new BrowserTaskRepository()
export const projectRepository = new BrowserProjectRepository()
export const tagRepository = new BrowserTagRepository()

// Re-export classes
export { BrowserTaskRepository as TaskRepository }
export { BrowserProjectRepository as ProjectRepository }
export { BrowserTagRepository as TagRepository }
