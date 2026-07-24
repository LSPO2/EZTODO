/**
 * Trash service layer
 * Handles trash operations with Repository pattern
 */

import { getRepositories } from '../repositories'
import type { Task } from '../repositories'
import { isExpired } from '../repositories'

export interface TrashItem {
  task: Task
  deletedAt: string
  expiresAt: string
  remainingDays: number
}

export interface TrashServiceResult<T> {
  success: boolean
  data?: T
  error?: string
}

export class TrashService {
  /**
   * Get all trash items with metadata
   */
  async getTrashItems(): Promise<TrashItem[]> {
    try {
      const repos = await getRepositories()
      const tasks = await repos.tasks.findByView('trash')

      return tasks.map(task => {
        const deletedAt = task.deletedAt || new Date().toISOString()
        const expiresAt = new Date(new Date(deletedAt).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()
        const remainingDays = Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000)))

        return {
          task,
          deletedAt,
          expiresAt,
          remainingDays,
        }
      })
    } catch (error) {
      console.error('Failed to get trash items:', error)
      return []
    }
  }

  /**
   * Restore a single task
   */
  async restoreTask(taskId: string): Promise<TrashServiceResult<Task>> {
    try {
      const repos = await getRepositories()
      const task = await repos.tasks.restore(taskId)

      // Restore children
      const children = await repos.tasks.findByParentId(taskId)
      for (const child of children) {
        if (child.deletedAt) {
          await repos.tasks.restore(child.id)
        }
      }

      return { success: true, data: task }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  }

  /**
   * Restore multiple tasks
   */
  async restoreMultiple(taskIds: string[]): Promise<TrashServiceResult<number>> {
    try {
      const repos = await getRepositories()
      const result = await repos.tasks.batchRestore(taskIds)
      return { success: true, data: result.affectedCount }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  }

  /**
   * Permanently delete a task
   */
  async permanentlyDelete(taskId: string): Promise<TrashServiceResult<void>> {
    try {
      const repos = await getRepositories()
      await repos.tasks.permanentlyDelete(taskId)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  }

  /**
   * Permanently delete multiple tasks
   */
  async permanentlyDeleteMultiple(taskIds: string[]): Promise<TrashServiceResult<number>> {
    try {
      const repos = await getRepositories()
      let count = 0
      for (const id of taskIds) {
        await repos.tasks.permanentlyDelete(id)
        count++
      }
      return { success: true, data: count }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  }

  /**
   * Empty trash (permanently delete all)
   */
  async emptyTrash(): Promise<TrashServiceResult<number>> {
    try {
      const trashItems = await this.getTrashItems()
      const expiredItems = trashItems.filter(item => isExpired(item.deletedAt))

      if (expiredItems.length === 0) {
        return { success: true, data: 0 }
      }

      const repos = await getRepositories()
      let count = 0
      for (const item of expiredItems) {
        await repos.tasks.permanentlyDelete(item.task.id)
        count++
      }

      return { success: true, data: count }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  }

  /**
   * Cleanup expired trash items
   */
  async cleanupExpired(): Promise<TrashServiceResult<number>> {
    try {
      const trashItems = await this.getTrashItems()
      const expiredItems = trashItems.filter(item => isExpired(item.deletedAt))

      if (expiredItems.length === 0) {
        return { success: true, data: 0 }
      }

      const repos = await getRepositories()
      let count = 0
      for (const item of expiredItems) {
        await repos.tasks.permanentlyDelete(item.task.id)
        count++
      }

      return { success: true, data: count }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  }

  /**
   * Get trash statistics
   */
  async getTrashStats(): Promise<{ total: number; expired: number; active: number }> {
    const trashItems = await this.getTrashItems()
    const expired = trashItems.filter(item => isExpired(item.deletedAt)).length
    return {
      total: trashItems.length,
      expired,
      active: trashItems.length - expired,
    }
  }
}

// Singleton instance
export const trashService = new TrashService()
