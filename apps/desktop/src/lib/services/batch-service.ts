/**
 * Batch service
 * Provides transactional batch operations with undo support.
 *
 * Architecture:
 * - Uses TaskService for complete/delete/restore to ensure parent-child logic,
 *   reminder cleanup, and recurrence advancement are applied.
 * - BatchService captures snapshots BEFORE the operation for undo support.
 * - In-memory undo stack is volatile — app restart clears it.
 */

import { getRepositories } from '../repositories'
import type {
  TaskSnapshot,
  TaskPriority,
  BatchResult,
  UndoableBatch,
} from '../repositories'
import { TaskService } from './task-service'
import { v7 as uuidv7 } from 'uuid'

const taskService = new TaskService()

// ── In-memory undo stack ───────────────────────────────────────────
const undoStack: UndoableBatch[] = []
const MAX_UNDO = 50

export function getLastUndoableBatch(): UndoableBatch | null {
  return undoStack.length > 0 ? undoStack[undoStack.length - 1] : null
}

export function canUndo(): boolean {
  return undoStack.length > 0
}

export function clearUndoStack(): void {
  undoStack.length = 0
}

// ── Snapshot helper ────────────────────────────────────────────────
async function captureSnapshots(ids: string[]): Promise<TaskSnapshot[]> {
  const repos = await getRepositories()
  return repos.tasks.getSnapshots(ids)
}

// ── Core execution helper ──────────────────────────────────────────

/**
 * Execute a batch operation:
 * 1. Capture snapshots (for undo)
 * 2. Generate batchId
 * 3. Execute the repository transactional batch
 * 4. Record undoable batch on success
 * 5. Return result with batchId as undoToken
 */
async function executeBatch(
  operation: string,
  ids: string[],
  mutate: (batchId: string) => Promise<BatchResult>,
): Promise<BatchResult> {
  if (ids.length === 0) {
    return { success: true, affectedCount: 0, errors: [], undoToken: null }
  }

  try {
    // 1. Capture snapshots BEFORE mutation (for undo)
    const snapshots = await captureSnapshots(ids)
    const batchId = uuidv7()

    // 2. Execute the transactional batch
    const result = await mutate(batchId)

    // 3. Record undoable batch on success (at least some tasks affected)
    if (result.success && result.affectedCount > 0) {
      const batch: UndoableBatch = {
        undoToken: batchId,
        operation,
        taskIds: ids,
        snapshot: snapshots,
        createdAt: new Date().toISOString(),
      }
      undoStack.push(batch)
      if (undoStack.length > MAX_UNDO) {
        undoStack.splice(0, undoStack.length - MAX_UNDO)
      }
    }

    return { ...result, undoToken: result.success && result.affectedCount > 0 ? batchId : null }
  } catch (error) {
    return { success: false, affectedCount: 0, errors: [{ id: 'batch', error: String(error) }], undoToken: null }
  }
}

// ── Public API ─────────────────────────────────────────────────────

export async function batchComplete(ids: string[]): Promise<BatchResult> {
  return executeBatch('complete', ids, async (_batchId) => {
    // Use TaskService to get parent-child completion logic, reminder cleanup, recurrence advancement
    let affected = 0
    const errors: { id: string; error: string }[] = []
    for (const id of ids) {
      const result = await taskService.completeTask(id, 'self')
      if (result.success) {
        affected++
      } else if (result.error !== 'HAS_UNCOMPLETED_CHILDREN') {
        errors.push({ id, error: result.error || 'Unknown error' })
      } else {
        // HAS_UNCOMPLETED_CHILDREN means auto-detect mode declined; count as success for batch
        affected++
      }
    }
    return { success: errors.length === 0, affectedCount: affected, errors, undoToken: _batchId }
  })
}

export async function batchDelete(ids: string[]): Promise<BatchResult> {
  return executeBatch('delete', ids, async (_batchId) => {
    // Use TaskService to get subtree deletion and reminder cleanup
    let affected = 0
    const errors: { id: string; error: string }[] = []
    for (const id of ids) {
      const result = await taskService.deleteTask(id)
      if (result.success) {
        affected++
      } else {
        errors.push({ id, error: result.error || 'Unknown error' })
      }
    }
    return { success: errors.length === 0, affectedCount: affected, errors, undoToken: _batchId }
  })
}

export async function batchRestore(ids: string[]): Promise<BatchResult> {
  return executeBatch('restore', ids, async (_batchId) => {
    // Use TaskService to get subtree restoration and reminder sync
    let affected = 0
    const errors: { id: string; error: string }[] = []
    for (const id of ids) {
      const result = await taskService.restoreTask(id)
      if (result.success) {
        affected++
      } else {
        errors.push({ id, error: result.error || 'Unknown error' })
      }
    }
    return { success: errors.length === 0, affectedCount: affected, errors, undoToken: _batchId }
  })
}

export async function batchSetPriority(ids: string[], priority: TaskPriority): Promise<BatchResult> {
  return executeBatch('setPriority', ids, async (batchId) => {
    const repos = await getRepositories()
    return repos.tasks.batchUpdate(ids, { priority }, batchId)
  })
}

export async function batchMoveToProject(ids: string[], projectId: string | null): Promise<BatchResult> {
  return executeBatch('moveToProject', ids, async (batchId) => {
    const repos = await getRepositories()
    return repos.tasks.batchUpdate(ids, { projectId }, batchId)
  })
}

export async function batchAddTag(ids: string[], tagId: string): Promise<BatchResult> {
  return executeBatch('addTag', ids, async (batchId) => {
    const repos = await getRepositories()
    return repos.tags.batchAddTag(ids, tagId, batchId)
  })
}

export async function batchRemoveTag(ids: string[], tagId: string): Promise<BatchResult> {
  return executeBatch('removeTag', ids, async (batchId) => {
    const repos = await getRepositories()
    return repos.tags.batchRemoveTag(ids, tagId, batchId)
  })
}

/**
 * Undo the last batch operation.
 * Uses snapshots to reverse state. The undo itself is transactional.
 * Does NOT push a new undo entry (prevents infinite undo/redo loops).
 */
export async function undoLastBatch(): Promise<BatchResult> {
  const batch = getLastUndoableBatch()
  if (!batch) {
    return { success: false, affectedCount: 0, errors: [{ id: 'undo', error: 'No operation to undo' }], undoToken: null }
  }

  const repos = await getRepositories()
  const undoBatchId = uuidv7()
  const result = await repos.tasks.restoreSnapshots(batch.snapshot, undoBatchId)

  // Keep a failed undo on the stack so the user can retry after resolving the cause.
  if (result.success) {
    undoStack.pop()
  }

  return { ...result, undoToken: null }
}