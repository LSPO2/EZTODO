/**
 * Database utility functions
 */

import { getSqlRepository } from '../repositories/sql-repository'

/**
 * Check if database is initialized
 */
export async function isDatabaseInitialized(): Promise<boolean> {
  try {
    const db = await getSqlRepository()
    const result = await db.select(
      "SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name='tasks'"
    )
    return result[0]?.count > 0
  } catch {
    return false
  }
}

/**
 * Get database statistics
 */
export async function getDatabaseStats(): Promise<{
  totalTasks: number
  activeTasks: number
  completedTasks: number
  deletedTasks: number
  totalProjects: number
  totalTags: number
}> {
  const db = await getSqlRepository()

  const [tasks, projects, tags] = await Promise.all([
    db.select(
      `SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'todo' AND deleted_at IS NULL THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN status = 'done' AND deleted_at IS NULL THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN deleted_at IS NOT NULL THEN 1 ELSE 0 END) as deleted
      FROM tasks`
    ),
    db.select(
      "SELECT COUNT(*) as count FROM projects WHERE deleted_at IS NULL"
    ),
    db.select(
      "SELECT COUNT(*) as count FROM tags"
    ),
  ])

  return {
    totalTasks: tasks[0]?.total || 0,
    activeTasks: tasks[0]?.active || 0,
    completedTasks: tasks[0]?.completed || 0,
    deletedTasks: tasks[0]?.deleted || 0,
    totalProjects: projects[0]?.count || 0,
    totalTags: tags[0]?.count || 0,
  }
}

/**
 * Backup database to JSON
 */
export async function exportDatabaseToJson(): Promise<string> {
  const db = await getSqlRepository()

  const [tasks, projects, tags, reminders, recurrenceRules] = await Promise.all([
    db.select('SELECT * FROM tasks'),
    db.select('SELECT * FROM projects'),
    db.select('SELECT * FROM tags'),
    db.select('SELECT * FROM reminders'),
    db.select('SELECT * FROM recurrence_rules'),
  ])

  const backup = {
    version: 1,
    exportedAt: new Date().toISOString(),
    tasks,
    projects,
    tags,
    reminders,
    recurrenceRules,
  }

  return JSON.stringify(backup, null, 2)
}

/**
 * Import database from JSON
 */
export async function importDatabaseFromJson(json: string): Promise<{
  tasks: number
  projects: number
  tags: number
  reminders: number
  recurrenceRules: number
}> {
  const db = await getSqlRepository()
  const backup = JSON.parse(json)

  if (!backup.version || backup.version !== 1) {
    throw new Error('Unsupported backup version')
  }

  await db.execute('BEGIN TRANSACTION')
  try {
    // Import projects
    for (const project of backup.projects || []) {
      await db.execute(
        `INSERT OR REPLACE INTO projects (id, name, color, icon, sort_order, created_at, updated_at, deleted_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [project.id, project.name, project.color, project.icon, project.sort_order,
         project.created_at, project.updated_at, project.deleted_at]
      )
    }

    // Import tasks
    for (const task of backup.tasks || []) {
      await db.execute(
        `INSERT OR REPLACE INTO tasks (
          id, parent_id, project_id, title, note, status, priority, sort_order,
          scheduled_date, scheduled_at, due_at, is_all_day, timezone, estimated_minutes,
          created_at, updated_at, completed_at, deleted_at, revision, source, source_capture_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)`,
        [task.id, task.parent_id, task.project_id, task.title, task.note,
         task.status, task.priority, task.sort_order,
         task.scheduled_date, task.scheduled_at, task.due_at, task.is_all_day,
         task.timezone, task.estimated_minutes,
         task.created_at, task.updated_at, task.completed_at, task.deleted_at,
         task.revision, task.source, task.source_capture_id]
      )
    }

    // Import tags
    for (const tag of backup.tags || []) {
      await db.execute(
        `INSERT OR REPLACE INTO tags (id, name, color, created_at) VALUES ($1, $2, $3, $4)`,
        [tag.id, tag.name, tag.color, tag.created_at]
      )
    }

    // Import reminders
    for (const reminder of backup.reminders || []) {
      await db.execute(
        `INSERT OR REPLACE INTO reminders (id, task_id, remind_at, status, snoozed_until, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [reminder.id, reminder.task_id, reminder.remind_at, reminder.status,
         reminder.snoozed_until, reminder.created_at, reminder.updated_at]
      )
    }

    // Import recurrence rules
    for (const rule of backup.recurrenceRules || []) {
      await db.execute(
        `INSERT OR REPLACE INTO recurrence_rules (
          id, task_id, frequency, interval, days_of_week, day_of_month,
          month_of_year, start_date, end_date, max_occurrences, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [rule.id, rule.task_id, rule.frequency, rule.interval, rule.days_of_week,
         rule.day_of_month, rule.month_of_year, rule.start_date, rule.end_date,
         rule.max_occurrences, rule.created_at, rule.updated_at]
      )
    }

    await db.execute('COMMIT')

    return {
      tasks: backup.tasks?.length || 0,
      projects: backup.projects?.length || 0,
      tags: backup.tags?.length || 0,
      reminders: backup.reminders?.length || 0,
      recurrenceRules: backup.recurrenceRules?.length || 0,
    }
  } catch (error) {
    await db.execute('ROLLBACK')
    throw error
  }
}

/**
 * Clean up old deleted tasks (older than 30 days)
 */
export async function cleanupOldDeletedTasks(): Promise<number> {
  const db = await getSqlRepository()

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const result = await db.execute(
    `DELETE FROM tasks WHERE deleted_at IS NOT NULL AND deleted_at < $1`,
    [thirtyDaysAgo.toISOString()]
  )

  return result.rowsAffected
}

/**
 * Get database size
 */
export async function getDatabaseSize(): Promise<number> {
  const db = await getSqlRepository()

  const result = await db.select(
    'PRAGMA page_count; PRAGMA page_size;'
  )

  return (result[0]?.page_count || 0) * (result[0]?.page_size || 0)
}
