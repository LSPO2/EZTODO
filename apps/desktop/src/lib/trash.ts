/**
 * Trash/Recycle bin module
 * Uses repository-layer soft-delete (deleted_at column) instead of a separate trash table.
 * Compatible with the existing SQLite migration schema.
 */

import { getSqlRepository } from './repositories/sql-repository'

export type EntityType = 'task' | 'project' | 'tag'

export interface TrashItem {
  id: string
  entityType: EntityType
  entityId: string
  entityData: string  // JSON string of the entity
  parentId: string | null
  originalProjectId: string | null
  deletedAt: string
  expiresAt: string
  syncedAt: string | null
}

export interface TrashStats {
  totalItems: number
  tasks: number
  projects: number
  tags: number
  oldestItem: string | null
  newestItem: string | null
}

const TRASH_TTL_DAYS = 30

/**
 * Move a task to trash (soft-delete with subtree)
 */
export async function moveToTrash(
  entityType: EntityType,
  entityId: string,
  _entityData?: any,
  _parentId?: string | null,
  _originalProjectId?: string | null
): Promise<string> {
  const db = await getSqlRepository()
  const now = new Date().toISOString()

  switch (entityType) {
    case 'task': {
      // Soft-delete the task and all descendants
      await db.execute(
        `UPDATE tasks SET deleted_at = $1, updated_at = $1, revision = revision + 1
         WHERE id = $2 OR parent_id = $2 OR parent_id IN (
           SELECT id FROM tasks WHERE parent_id = $2
         )`,
        [now, entityId]
      )
      break
    }
    case 'project': {
      await db.execute(
        `UPDATE projects SET deleted_at = $1, updated_at = $1 WHERE id = $2`,
        [now, entityId]
      )
      break
    }
    case 'tag': {
      // Tags use hard delete (no deleted_at column in tags table)
      await db.execute('DELETE FROM tags WHERE id = $1', [entityId])
      break
    }
  }

  return entityId
}

/**
 * Get all trash items (deleted tasks and projects)
 */
export async function getTrashItems(
  entityType?: EntityType,
  limit = 100,
  offset = 0
): Promise<TrashItem[]> {
  const db = await getSqlRepository()
  const cutoff = new Date(Date.now() - TRASH_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const items: TrashItem[] = []

  if (!entityType || entityType === 'task') {
    const tasks = await db.select(
      `SELECT id, parent_id, project_id, title, note, status, priority, sort_order,
              scheduled_date, scheduled_at, due_at, is_all_day, timezone, estimated_minutes,
              created_at, updated_at, completed_at, deleted_at, revision, source, source_capture_id
       FROM tasks WHERE deleted_at IS NOT NULL AND deleted_at >= $1
       ORDER BY deleted_at DESC LIMIT $2 OFFSET $3`,
      [cutoff, limit, offset]
    )
    for (const t of tasks) {
      items.push({
        id: `task-${t.id}`,
        entityType: 'task',
        entityId: t.id,
        entityData: JSON.stringify(t),
        parentId: t.parent_id,
        originalProjectId: t.project_id,
        deletedAt: t.deleted_at,
        expiresAt: new Date(new Date(t.deleted_at).getTime() + TRASH_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString(),
        syncedAt: null,
      })
    }
  }

  if (!entityType || entityType === 'project') {
    const projects = await db.select(
      `SELECT id, name, color, icon, sort_order, created_at, updated_at, deleted_at
       FROM projects WHERE deleted_at IS NOT NULL AND deleted_at >= $1
       ORDER BY deleted_at DESC LIMIT $2 OFFSET $3`,
      [cutoff, limit, offset]
    )
    for (const p of projects) {
      items.push({
        id: `project-${p.id}`,
        entityType: 'project',
        entityId: p.id,
        entityData: JSON.stringify(p),
        parentId: null,
        originalProjectId: null,
        deletedAt: p.deleted_at,
        expiresAt: new Date(new Date(p.deleted_at).getTime() + TRASH_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString(),
        syncedAt: null,
      })
    }
  }

  // Sort by deletedAt descending
  items.sort((a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime())

  return items.slice(0, limit)
}

/**
 * Get trash item by entity ID
 */
export async function getTrashItemByEntityId(entityId: string): Promise<TrashItem | null> {
  const items = await getTrashItems(undefined, 1000)
  return items.find(item => item.entityId === entityId) || null
}

/**
 * Restore item from trash
 */
export async function restoreFromTrash(trashId: string): Promise<boolean> {
  const db = await getSqlRepository()
  const now = new Date().toISOString()

  // Parse trashId format: "task-{id}" or "project-{id}"
  const [entityType, entityId] = trashId.split('-', 2)
  if (!entityId) return false

  switch (entityType) {
    case 'task': {
      // Restore task and all deleted descendants
      await db.execute(
        `UPDATE tasks SET deleted_at = NULL, updated_at = $1, revision = revision + 1
         WHERE id = $2 OR (parent_id = $2 AND deleted_at IS NOT NULL)`,
        [now, entityId]
      )
      break
    }
    case 'project': {
      await db.execute(
        `UPDATE projects SET deleted_at = NULL, updated_at = $1 WHERE id = $2`,
        [now, entityId]
      )
      break
    }
    default:
      return false
  }

  return true
}

/**
 * Restore multiple items from trash
 */
export async function restoreMultipleFromTrash(trashIds: string[]): Promise<number> {
  let restored = 0
  for (const trashId of trashIds) {
    const success = await restoreFromTrash(trashId)
    if (success) restored++
  }
  return restored
}

/**
 * Permanently delete item from trash
 */
export async function permanentlyDelete(trashId: string): Promise<boolean> {
  const db = await getSqlRepository()

  const [entityType, entityId] = trashId.split('-', 2)
  if (!entityId) return false

  switch (entityType) {
    case 'task':
      await db.execute('DELETE FROM tasks WHERE id = $1', [entityId])
      break
    case 'project':
      await db.execute('DELETE FROM projects WHERE id = $1', [entityId])
      break
    default:
      return false
  }

  return true
}

/**
 * Permanently delete multiple items
 */
export async function permanentlyDeleteMultiple(trashIds: string[]): Promise<number> {
  let deleted = 0
  for (const trashId of trashIds) {
    const success = await permanentlyDelete(trashId)
    if (success) deleted++
  }
  return deleted
}

/**
 * Empty trash (permanently delete all soft-deleted items)
 */
export async function emptyTrash(): Promise<number> {
  const db = await getSqlRepository()

  const tasks = await db.select(`SELECT id FROM tasks WHERE deleted_at IS NOT NULL`)
  const projects = await db.select(`SELECT id FROM projects WHERE deleted_at IS NOT NULL`)

  let deleted = 0
  for (const t of tasks) {
    await db.execute('DELETE FROM tasks WHERE id = $1', [t.id])
    deleted++
  }
  for (const p of projects) {
    await db.execute('DELETE FROM projects WHERE id = $1', [p.id])
    deleted++
  }

  return deleted
}

/**
 * Get trash statistics
 */
export async function getTrashStats(): Promise<TrashStats> {
  const db = await getSqlRepository()

  const taskStats = await db.select(
    `SELECT COUNT(*) as count, MIN(deleted_at) as oldest, MAX(deleted_at) as newest
     FROM tasks WHERE deleted_at IS NOT NULL`
  )
  const projectStats = await db.select(
    `SELECT COUNT(*) as count, MIN(deleted_at) as oldest, MAX(deleted_at) as newest
     FROM projects WHERE deleted_at IS NOT NULL`
  )

  const tCount = taskStats[0]?.count || 0
  const pCount = projectStats[0]?.count || 0
  const tOldest = taskStats[0]?.oldest
  const pOldest = projectStats[0]?.oldest
  const tNewest = taskStats[0]?.newest
  const pNewest = projectStats[0]?.newest

  const allOldest = [tOldest, pOldest].filter(Boolean).sort()[0] || null
  const allNewest = [tNewest, pNewest].filter(Boolean).sort().reverse()[0] || null

  return {
    totalItems: tCount + pCount,
    tasks: tCount,
    projects: pCount,
    tags: 0, // Tags use hard delete
    oldestItem: allOldest,
    newestItem: allNewest,
  }
}

/**
 * Clean up expired trash items (older than 30 days)
 */
export async function cleanupExpiredTrash(): Promise<number> {
  const db = await getSqlRepository()
  const cutoff = new Date(Date.now() - TRASH_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString()

  const expiredTasks = await db.select(
    `SELECT id FROM tasks WHERE deleted_at IS NOT NULL AND deleted_at < $1`, [cutoff]
  )
  const expiredProjects = await db.select(
    `SELECT id FROM projects WHERE deleted_at IS NOT NULL AND deleted_at < $1`, [cutoff]
  )

  let cleaned = 0
  for (const t of expiredTasks) {
    await db.execute('DELETE FROM tasks WHERE id = $1', [t.id])
    cleaned++
  }
  for (const p of expiredProjects) {
    await db.execute('DELETE FROM projects WHERE id = $1', [p.id])
    cleaned++
  }

  return cleaned
}

/**
 * Get remaining days for trash item
 */
export function getRemainingDays(expiresAt: string): number {
  const now = new Date()
  const expires = new Date(expiresAt)
  const diffMs = expires.getTime() - now.getTime()
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
  return Math.max(0, diffDays)
}

/**
 * Check if trash has items
 */
export async function hasTrashItems(): Promise<boolean> {
  const db = await getSqlRepository()

  const taskCount = await db.select(`SELECT COUNT(*) as count FROM tasks WHERE deleted_at IS NOT NULL`)
  const projectCount = await db.select(`SELECT COUNT(*) as count FROM projects WHERE deleted_at IS NOT NULL`)

  return ((taskCount[0]?.count || 0) + (projectCount[0]?.count || 0)) > 0
}
