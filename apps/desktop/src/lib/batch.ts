/**
 * Batch operations module
 * Uses Repository pattern for data access
 *
 * NOTE: The primary batch + undo flow now lives in services/batch-service.
 * This module is retained for backward compatibility and legacy tests.
 */

import { getRepositories } from './repositories'
import type { Task, UpdateTaskRequest, BatchResult } from './repositories'

export interface BatchOperation {
  type: 'complete' | 'uncomplete' | 'delete' | 'restore' | 'move' | 'update'
  taskIds: string[]
  data?: Record<string, unknown>
}

// Re-export BatchResult for backward compatibility
export type { BatchResult }

// Undo stack for batch operations
let undoStack: BatchOperation[] = []
const MAX_UNDO_STACK = 50

/**
 * Batch complete tasks
 */
export async function batchComplete(taskIds: string[]): Promise<BatchResult> {
  try {
    const repos = await getRepositories()

    // Save for undo
    const tasks = await Promise.all(taskIds.map((id) => repos.tasks.findById(id)))
    const validTasks = tasks.filter((t): t is Task => t !== null)

    pushToUndoStack({
      type: 'uncomplete',
      taskIds: validTasks.filter((t) => t.status === 'done').map((t) => t.id),
    })

    // Execute batch complete
    return await repos.tasks.batchComplete(taskIds)
  } catch (error) {
    return {
      success: false,
      affectedCount: 0,
      errors: [{ id: 'batch', error: String(error) }],
      undoToken: null,
    }
  }
}

/**
 * Batch uncomplete tasks
 */
export async function batchUncomplete(taskIds: string[]): Promise<BatchResult> {
  try {
    const repos = await getRepositories()

    // Save for undo
    const tasks = await Promise.all(taskIds.map((id) => repos.tasks.findById(id)))
    const validTasks = tasks.filter((t): t is Task => t !== null)

    pushToUndoStack({
      type: 'complete',
      taskIds: validTasks.filter((t) => t.status === 'todo').map((t) => t.id),
    })

    // Execute batch uncomplete
    return await repos.tasks.batchUpdate(taskIds, { status: 'todo' })
  } catch (error) {
    return {
      success: false,
      affectedCount: 0,
      errors: [{ id: 'batch', error: String(error) }],
      undoToken: null,
    }
  }
}

/**
 * Batch delete tasks
 */
export async function batchDelete(taskIds: string[]): Promise<BatchResult> {
  try {
    const repos = await getRepositories()

    // Save for undo
    pushToUndoStack({
      type: 'restore',
      taskIds,
    })

    // Execute batch delete
    return await repos.tasks.batchDelete(taskIds)
  } catch (error) {
    return {
      success: false,
      affectedCount: 0,
      errors: [{ id: 'batch', error: String(error) }],
      undoToken: null,
    }
  }
}

/**
 * Batch restore tasks
 */
export async function batchRestore(taskIds: string[]): Promise<BatchResult> {
  try {
    const repos = await getRepositories()

    // Save for undo
    pushToUndoStack({
      type: 'delete',
      taskIds,
    })

    // Execute batch restore
    return await repos.tasks.batchRestore(taskIds)
  } catch (error) {
    return {
      success: false,
      affectedCount: 0,
      errors: [{ id: 'batch', error: String(error) }],
      undoToken: null,
    }
  }
}

/**
 * Batch update tasks
 */
export async function batchUpdate(taskIds: string[], updates: UpdateTaskRequest): Promise<BatchResult> {
  try {
    const repos = await getRepositories()

    // Save for undo
    const tasks = await Promise.all(taskIds.map((id) => repos.tasks.findById(id)))
    const validTasks = tasks.filter((t): t is Task => t !== null)

    if (validTasks.length > 0) {
      const undoData: UpdateTaskRequest = {}
      if (updates.status) undoData.status = validTasks[0].status
      if (updates.priority) undoData.priority = validTasks[0].priority

      pushToUndoStack({
        type: 'update',
        taskIds,
        data: undoData as Record<string, unknown>,
      })
    }

    // Execute batch update
    return await repos.tasks.batchUpdate(taskIds, updates)
  } catch (error) {
    return {
      success: false,
      affectedCount: 0,
      errors: [{ id: 'batch', error: String(error) }],
      undoToken: null,
    }
  }
}

/**
 * Undo last batch operation
 */
export async function undoLastBatch(): Promise<BatchResult> {
  const operation = undoStack.pop()
  if (!operation) {
    return {
      success: false,
      affectedCount: 0,
      errors: [{ id: 'undo', error: 'No operation to undo' }],
      undoToken: null,
    }
  }

  switch (operation.type) {
    case 'complete':
      return batchComplete(operation.taskIds)
    case 'uncomplete':
      return batchUncomplete(operation.taskIds)
    case 'delete':
      return batchDelete(operation.taskIds)
    case 'restore':
      return batchRestore(operation.taskIds)
    case 'update':
      return batchUpdate(operation.taskIds, (operation.data as UpdateTaskRequest) || {})
    default:
      return {
        success: false,
        affectedCount: 0,
        errors: [{ id: 'undo', error: 'Unknown operation type' }],
        undoToken: null,
      }
  }
}

/**
 * Check if undo is available
 */
export function canUndo(): boolean {
  return undoStack.length > 0
}

/**
 * Get undo stack size
 */
export function getUndoStackSize(): number {
  return undoStack.length
}

/**
 * Clear undo stack
 */
export function clearUndoStack(): void {
  undoStack = []
}

/**
 * Push operation to undo stack
 */
function pushToUndoStack(operation: BatchOperation): void {
  undoStack.push(operation)

  // Trim stack if too large
  if (undoStack.length > MAX_UNDO_STACK) {
    undoStack = undoStack.slice(-MAX_UNDO_STACK)
  }
}
