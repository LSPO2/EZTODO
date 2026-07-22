/**
 * Tag repository implementation
 */

import { v4 as uuidv4 } from 'uuid'
import { getDatabase } from '../database'
import type { Tag, CreateTagRequest, UpdateTagRequest } from './types'

export class TagRepository {
  /**
   * Create a new tag
   */
  async create(request: CreateTagRequest): Promise<Tag> {
    const db = await getDatabase()
    const now = new Date().toISOString()
    const id = uuidv4()

    const tag: Tag = {
      id,
      name: request.name.trim(),
      color: request.color || null,
      createdAt: now,
    }

    await db.execute(
      `INSERT INTO tags (id, name, color, created_at) VALUES ($1, $2, $3, $4)`,
      [tag.id, tag.name, tag.color, tag.createdAt]
    )

    return tag
  }

  /**
   * Update a tag
   */
  async update(id: string, updates: UpdateTagRequest): Promise<Tag> {
    const db = await getDatabase()

    const fields: string[] = []
    const values: unknown[] = []
    let paramIndex = 1

    if (updates.name !== undefined) {
      fields.push(`name = $${paramIndex++}`)
      values.push(updates.name.trim())
    }
    if (updates.color !== undefined) {
      fields.push(`color = $${paramIndex++}`)
      values.push(updates.color)
    }

    values.push(id)
    await db.execute(
      `UPDATE tags SET ${fields.join(', ')} WHERE id = $${paramIndex}`,
      values
    )

    const tag = await this.findById(id)
    if (!tag) {
      throw new Error(`Tag not found: ${id}`)
    }

    return tag
  }

  /**
   * Delete a tag
   */
  async delete(id: string): Promise<void> {
    const db = await getDatabase()

    await db.execute('DELETE FROM tags WHERE id = $1', [id])
  }

  /**
   * Find all tags
   */
  async findAll(): Promise<Tag[]> {
    const db = await getDatabase()

    return db.select<Tag[]>(
      `SELECT id, name, color, created_at as createdAt FROM tags ORDER BY name ASC`
    )
  }

  /**
   * Find tag by ID
   */
  async findById(id: string): Promise<Tag | null> {
    const db = await getDatabase()

    const result = await db.select<Tag[]>(
      `SELECT id, name, color, created_at as createdAt FROM tags WHERE id = $1`,
      [id]
    )

    return result[0] || null
  }

  /**
   * Find tags by task ID
   */
  async findByTaskId(taskId: string): Promise<Tag[]> {
    const db = await getDatabase()

    return db.select<Tag[]>(
      `SELECT t.id, t.name, t.color, t.created_at as createdAt
       FROM tags t
       JOIN task_tags tt ON t.id = tt.tag_id
       WHERE tt.task_id = $1
       ORDER BY t.name ASC`,
      [taskId]
    )
  }

  /**
   * Add tag to task
   */
  async addToTask(taskId: string, tagId: string): Promise<void> {
    const db = await getDatabase()

    await db.execute(
      `INSERT INTO task_tags (task_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [taskId, tagId]
    )
  }

  /**
   * Remove tag from task
   */
  async removeFromTask(taskId: string, tagId: string): Promise<void> {
    const db = await getDatabase()

    await db.execute(
      `DELETE FROM task_tags WHERE task_id = $1 AND tag_id = $2`,
      [taskId, tagId]
    )
  }
}

// Export singleton instance
export const tagRepository = new TagRepository()
