/**
 * Batch operations module
 */

import { taskRepository } from './repositories'
import type { Task, UpdateTaskRequest } from './repositories'

export interface BatchOperation {
  type: 'complete' | 'uncomplete' | 'delete' | 'restore' | 'move' | 'update'
  taskIds: string[]
  data?: any
}

export interface BatchResult {
  success: boolean
  affectedCount: number
  errors: Array<{ taskId: string; error: string }>
}

// Undo stack for batch operations
let undoStack: BatchOperation[] = []
const MAX_UNDO_STACK = 50

/**
 * Batch complete tasks
 */
export async function batchComplete(taskIds: string[]): Promise<BatchResult> {
  try {
    // Save for undo
    const tasks = await Promise.all(taskIds.map((id) => taskRepository.findById(id)))
    const validTasks = tasks.filter((t): t is Task => t !== null)

    pushToUndoStack({
      type: 'uncomplete',
      taskIds: validTasks.filter((t) => t.status === 'done').map((t) => t.id),
    })

    // Execute batch complete
    await taskRepository.batchUpdate(taskIds, { status: 'done' })

    return {
      success: true,
      affectedCount: taskIds.length,
      errors: [],
    }
  } catch (error) {
    return {
      success: false,
      affectedCount: 0,
      errors: [{ taskId: 'batch', error: String(error) }],
    }
  }
}

/**
 * Batch uncomplete tasks
 */
export async function batchUncomplete(taskIds: string[]): Promise<BatchResult> {
  try {
    // Save for undo
    const tasks = await Promise.all(taskIds.map((id) => taskRepository.findById(id)))
    const validTasks = tasks.filter((t): t is Task => t !== null)

    pushToUndoStack({
      type: 'complete',
      taskIds: validTasks.filter((t) => t.status === 'todo').map((t) => t.id),
    })

    // Execute batch uncomplete
    await taskRepository.batchUpdate(taskIds, { status: 'todo' })

    return {
      success: true,
      affectedCount: taskIds.length,
      errors: [],
    }
  } catch (error) {
    return {
      success: false,
      affectedCount: 0,
      errors: [{ taskId: 'batch', error: String(error) }],
    }
  }
}

/**
 * Batch delete tasks
 */
export async function batchDelete(taskIds: string[]): Promise<BatchResult> {
  try {
    // Save for undo
    pushToUndoStack({
      type: 'restore',
      taskIds,
    })

    // Execute batch delete
    await taskRepository.batchDelete(taskIds)

    return {
      success: true,
      affectedCount: taskIds.length,
      errors: [],
    }
  } catch (error) {
    return {
      success: false,
      affectedCount: 0,
      errors: [{ taskId: 'batch', error: String(error) }],
    }
  }
}

/**
 * Batch restore tasks
 */
export async function batchRestore(taskIds: string[]): Promise<BatchResult> {
  try {
    // Save for undo
    pushToUndoStack({
      type: 'delete',
      taskIds,
    })

    // Execute batch restore
    await taskRepository.batchRestore(taskIds)

    return {
      success: true,
      affectedCount: taskIds.length,
      errors: [],
    }
  } catch (error) {
    return {
      success: false,
      affectedCount: 0,
      errors: [{ taskId: 'batch', error: String(error) }],
    }
  }
}

/**
 * Batch move tasks to project
 */
export async function batchMoveToProject(
  taskIds: string[],
  projectId: string
): Promise<BatchResult> {
  try {
    // Save for undo
    const tasks = await Promise.all(taskIds.map((id) => taskRepository.findById(id)))
    const validTasks = tasks.filter((t): t is Task => t !== null)

    pushToUndoStack({
      type: 'update',
      taskIds,
      data: { projectId: validTasks[0]?.projectId },
    })

    // Execute batch move
    await taskRepository.batchUpdate(taskIds, { projectId })

    return {
      success: true,
      affectedCount: taskIds.length,
      errors: [],
    }
  } catch (error) {
    return {
      success: false,
      affectedCount: 0,
      errors: [{ taskId: 'batch', error: String(error) }],
    }
  }
}

/**
 * Batch update priority
 */
export async function batchUpdatePriority(
  taskIds: string[],
  priority: string
): Promise<BatchResult> {
  try {
    // Save for undo
    const tasks = await Promise.all(taskIds.map((id) => taskRepository.findById(id)))
    const validTasks = tasks.filter((t): t is Task => t !== null)

    pushToUndoStack({
      type: 'update',
      taskIds,
      data: { priority: validTasks[0]?.priority },
    })

    // Execute batch update
    await taskRepository.batchUpdate(taskIds, { priority: priority as any })

    return {
      success: true,
      affectedCount: taskIds.length,
      errors: [],
    }
  } catch (error) {
    return {
      success: false,
      affectedCount: 0,
      errors: [{ taskId: 'batch', error: String(error) }],
    }
  }
}

/**
 * Batch update tasks
 */
export async function batchUpdate(
  taskIds: string[],
  updates: UpdateTaskRequest
): Promise<BatchResult> {
  try {
    // Save for undo
    const tasks = await Promise.all(taskIds.map((id) => taskRepository.findById(id)))
    const validTasks = tasks.filter((t): t is Task => t !== null)

    const undoData: UpdateTaskRequest = {}
    if (updates.status) {
      undoData.status = validTasks[0]?.status ?? undefined
    }
    if (updates.priority) {
      undoData.priority = validTasks[0]?.priority ?? undefined
    }
    if (updates.projectId !== undefined) {
      undoData.projectId = validTasks[0]?.projectId ?? undefined
    }

    pushToUndoStack({
      type: 'update',
      taskIds,
      data: undoData,
    })

    // Execute batch update
    await taskRepository.batchUpdate(taskIds, updates)

    return {
      success: true,
      affectedCount: taskIds.length,
      errors: [],
    }
  } catch (error) {
    return {
      success: false,
      affectedCount: 0,
      errors: [{ taskId: 'batch', error: String(error) }],
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
      errors: [{ taskId: 'undo', error: 'No operation to undo' }],
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
      return batchUpdate(operation.taskIds, operation.data || {})
    default:
      return {
        success: false,
        affectedCount: 0,
        errors: [{ taskId: 'undo', error: 'Unknown operation type' }],
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

/**
 * Get selected tasks
 */
export async function getSelectedTasks(taskIds: string[]): Promise<Task[]> {
  const tasks = await Promise.all(taskIds.map((id) => taskRepository.findById(id)))
  return tasks.filter((t): t is Task => t !== null)
}

/**
 * Validate batch operation
 */
export function validateBatchOperation(
  operation: BatchOperation
): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (operation.taskIds.length === 0) {
    errors.push('No tasks selected')
  }

  if (operation.type === 'move' && !operation.data?.projectId) {
    errors.push('No project specified')
  }

  if (operation.type === 'update' && !operation.data) {
    errors.push('No update data specified')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
