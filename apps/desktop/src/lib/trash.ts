/**
 * Trash/Recycle bin module
 * Handles soft delete, restore, and permanent delete
 */

import { getDatabase } from './database'
import { v4 as uuidv4 } from 'uuid'

export type EntityType = 'task' | 'project' | 'tag'

export interface TrashItem {
  id: string
  entityType: EntityType
  entityId: string
  entityData: string  // JSON string
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

/**
 * Move item to trash
 */
export async function moveToTrash(
  entityType: EntityType,
  entityId: string,
  entityData: any,
  parentId?: string | null,
  originalProjectId?: string | null
): Promise<string> {
  const db = await getDatabase()
  const now = new Date()
  const deletedAt = now.toISOString()
  const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()
  const trashId = uuidv4()

  await db.execute(
    `INSERT INTO trash (id, entity_type, entity_id, entity_data, parent_id, original_project_id, deleted_at, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [trashId, entityType, entityId, JSON.stringify(entityData), parentId || null, originalProjectId || null, deletedAt, expiresAt]
  )

  // Mark original entity as deleted
  switch (entityType) {
    case 'task':
      await db.execute(
        `UPDATE tasks SET deleted_at = $1, updated_at = $1, revision = revision + 1 WHERE id = $2`,
        [deletedAt, entityId]
      )
      // Also mark child tasks
      await db.execute(
        `UPDATE tasks SET deleted_at = $1, updated_at = $1, revision = revision + 1
         WHERE parent_id = $2 OR id IN (
           SELECT id FROM tasks WHERE parent_id IN (
             SELECT id FROM tasks WHERE parent_id = $2
           )
         )`,
        [deletedAt, entityId]
      )
      break

    case 'project':
      await db.execute(
        `UPDATE projects SET deleted_at = $1, updated_at = $1 WHERE id = $2`,
        [deletedAt, entityId]
      )
      break

    case 'tag':
      await db.execute(
        `DELETE FROM tags WHERE id = $1`,
        [entityId]
      )
      break
  }

  return trashId
}

/**
 * Get all trash items
 */
export async function getTrashItems(
  entityType?: EntityType,
  limit = 100,
  offset = 0
): Promise<TrashItem[]> {
  const db = await getDatabase()

  let query = `SELECT * FROM trash WHERE expires_at > $1`
  const params: any[] = [new Date().toISOString()]

  if (entityType) {
    query += ` AND entity_type = $${params.length + 1}`
    params.push(entityType)
  }

  query += ` ORDER BY deleted_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`
  params.push(limit, offset)

  const result = await db.select(query, params)

  return result.map((row: any) => ({
    id: row.id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    entityData: row.entity_data,
    parentId: row.parent_id,
    originalProjectId: row.original_project_id,
    deletedAt: row.deleted_at,
    expiresAt: row.expires_at,
    syncedAt: row.synced_at,
  }))
}

/**
 * Get trash item by entity ID
 */
export async function getTrashItemByEntityId(entityId: string): Promise<TrashItem | null> {
  const db = await getDatabase()

  const result = await db.select(
    `SELECT * FROM trash WHERE entity_id = $1`,
    [entityId]
  )

  if (result.length === 0) {
    return null
  }

  const row = result[0]
  return {
    id: row.id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    entityData: row.entity_data,
    parentId: row.parent_id,
    originalProjectId: row.original_project_id,
    deletedAt: row.deleted_at,
    expiresAt: row.expires_at,
    syncedAt: row.synced_at,
  }
}

/**
 * Restore item from trash
 */
export async function restoreFromTrash(trashId: string): Promise<boolean> {
  const db = await getDatabase()

  // Get trash item
  const result = await db.select(
    `SELECT * FROM trash WHERE id = $1`,
    [trashId]
  )

  if (result.length === 0) {
    return false
  }

  const trashItem = result[0]
  const entityData = JSON.parse(trashItem.entity_data)
  const now = new Date().toISOString()

  // Restore based on entity type
  switch (trashItem.entity_type) {
    case 'task': {
      // Restore task
      await db.execute(
        `UPDATE tasks SET deleted_at = NULL, updated_at = $1, revision = revision + 1 WHERE id = $2`,
        [now, trashItem.entity_id]
      )

      // Restore child tasks
      const childTasks = await db.select(
        `SELECT id FROM tasks WHERE parent_id = $1 AND deleted_at IS NOT NULL`,
        [trashItem.entity_id]
      )

      for (const child of childTasks) {
        await db.execute(
          `UPDATE tasks SET deleted_at = NULL, updated_at = $1, revision = revision + 1 WHERE id = $2`,
          [now, child.id]
        )
      }
      break
    }

    case 'project':
      await db.execute(
        `UPDATE projects SET deleted_at = NULL, updated_at = $1 WHERE id = $2`,
        [now, trashItem.entity_id]
      )
      break

    case 'tag':
      // Re-insert tag
      await db.execute(
        `INSERT INTO tags (id, name, color, created_at) VALUES ($1, $2, $3, $4)`,
        [entityData.id, entityData.name, entityData.color, entityData.created_at]
      )
      break
  }

  // Remove from trash
  await db.execute(`DELETE FROM trash WHERE id = $1`, [trashId])

  return true
}

/**
 * Restore multiple items from trash
 */
export async function restoreMultipleFromTrash(trashIds: string[]): Promise<number> {
  let restored = 0

  for (const trashId of trashIds) {
    const success = await restoreFromTrash(trashId)
    if (success) {
      restored++
    }
  }

  return restored
}

/**
 * Permanently delete item from trash
 */
export async function permanentlyDelete(trashId: string): Promise<boolean> {
  const db = await getDatabase()

  // Get trash item
  const result = await db.select(
    `SELECT * FROM trash WHERE id = $1`,
    [trashId]
  )

  if (result.length === 0) {
    return false
  }

  const trashItem = result[0]

  // Permanently delete based on entity type
  switch (trashItem.entity_type) {
    case 'task':
      // Delete task permanently (cascade will handle children)
      await db.execute(`DELETE FROM tasks WHERE id = $1`, [trashItem.entity_id])
      break

    case 'project':
      await db.execute(`DELETE FROM projects WHERE id = $1`, [trashItem.entity_id])
      break

    case 'tag':
      // Already deleted
      break
  }

  // Remove from trash
  await db.execute(`DELETE FROM trash WHERE id = $1`, [trashId])

  return true
}

/**
 * Permanently delete multiple items
 */
export async function permanentlyDeleteMultiple(trashIds: string[]): Promise<number> {
  let deleted = 0

  for (const trashId of trashIds) {
    const success = await permanentlyDelete(trashId)
    if (success) {
      deleted++
    }
  }

  return deleted
}

/**
 * Empty trash (delete all items)
 */
export async function emptyTrash(): Promise<number> {
  const db = await getDatabase()

  // Get all trash items
  const items = await db.select(`SELECT * FROM trash`)

  // Delete each item
  let deleted = 0
  for (const item of items) {
    const success = await permanentlyDelete(item.id)
    if (success) {
      deleted++
    }
  }

  return deleted
}

/**
 * Get trash statistics
 */
export async function getTrashStats(): Promise<TrashStats> {
  const db = await getDatabase()

  const stats = await db.select(
    `SELECT
       COUNT(*) as total,
       SUM(CASE WHEN entity_type = 'task' THEN 1 ELSE 0 END) as tasks,
       SUM(CASE WHEN entity_type = 'project' THEN 1 ELSE 0 END) as projects,
       SUM(CASE WHEN entity_type = 'tag' THEN 1 ELSE 0 END) as tags,
       MIN(deleted_at) as oldest,
       MAX(deleted_at) as newest
     FROM trash
     WHERE expires_at > $1`,
    [new Date().toISOString()]
  )

  return {
    totalItems: stats[0]?.total || 0,
    tasks: stats[0]?.tasks || 0,
    projects: stats[0]?.projects || 0,
    tags: stats[0]?.tags || 0,
    oldestItem: stats[0]?.oldest || null,
    newestItem: stats[0]?.newest || null,
  }
}

/**
 * Clean up expired trash items
 */
export async function cleanupExpiredTrash(): Promise<number> {
  const db = await getDatabase()
  const now = new Date().toISOString()

  // Get expired items
  const expiredItems = await db.select(
    `SELECT * FROM trash WHERE expires_at <= $1`,
    [now]
  )

  // Delete each expired item
  let cleaned = 0
  for (const item of expiredItems) {
    // Check if synced before deleting
    if (item.synced_at) {
      const success = await permanentlyDelete(item.id)
      if (success) {
        cleaned++
      }
    }
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
  const db = await getDatabase()

  const result = await db.select(
    `SELECT COUNT(*) as count FROM trash WHERE expires_at > $1`,
    [new Date().toISOString()]
  )

  return (result[0]?.count || 0) > 0
}
