/**
 * Project repository implementation
 */

import { v4 as uuidv4 } from 'uuid'
import { getDatabase } from '../database'
import type { Project, CreateProjectRequest, UpdateProjectRequest } from './types'

export class ProjectRepository {
  /**
   * Create a new project
   */
  async create(request: CreateProjectRequest): Promise<Project> {
    const db = await getDatabase()
    const now = new Date().toISOString()
    const id = uuidv4()

    const project: Project = {
      id,
      name: request.name.trim(),
      color: request.color || null,
      icon: request.icon || null,
      sortOrder: 0,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    }

    await db.execute(
      `INSERT INTO projects (id, name, color, icon, sort_order, created_at, updated_at, deleted_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [project.id, project.name, project.color, project.icon, project.sortOrder,
       project.createdAt, project.updatedAt, project.deletedAt]
    )

    return project
  }

  /**
   * Update a project
   */
  async update(id: string, updates: UpdateProjectRequest): Promise<Project> {
    const db = await getDatabase()
    const now = new Date().toISOString()

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
    if (updates.icon !== undefined) {
      fields.push(`icon = $${paramIndex++}`)
      values.push(updates.icon)
    }
    if (updates.sortOrder !== undefined) {
      fields.push(`sort_order = $${paramIndex++}`)
      values.push(updates.sortOrder)
    }

    fields.push(`updated_at = $${paramIndex++}`)
    values.push(now)

    values.push(id)
    await db.execute(
      `UPDATE projects SET ${fields.join(', ')} WHERE id = $${paramIndex}`,
      values
    )

    const project = await this.findById(id)
    if (!project) {
      throw new Error(`Project not found: ${id}`)
    }

    return project
  }

  /**
   * Soft delete a project
   */
  async delete(id: string): Promise<void> {
    const db = await getDatabase()
    const now = new Date().toISOString()

    await db.execute(
      `UPDATE projects SET deleted_at = $1, updated_at = $1 WHERE id = $2`,
      [now, id]
    )
  }

  /**
   * Find all projects
   */
  async findAll(): Promise<Project[]> {
    const db = await getDatabase()

    return db.select<Project[]>(
      `SELECT
        id, name, color, icon, sort_order as sortOrder,
        created_at as createdAt, updated_at as updatedAt,
        deleted_at as deletedAt
      FROM projects
      WHERE deleted_at IS NULL
      ORDER BY sort_order ASC, name ASC`
    )
  }

  /**
   * Find project by ID
   */
  async findById(id: string): Promise<Project | null> {
    const db = await getDatabase()

    const result = await db.select<Project[]>(
      `SELECT
        id, name, color, icon, sort_order as sortOrder,
        created_at as createdAt, updated_at as updatedAt,
        deleted_at as deletedAt
      FROM projects
      WHERE id = $1`,
      [id]
    )

    return result[0] || null
  }
}

// Export singleton instance
export const projectRepository = new ProjectRepository()
