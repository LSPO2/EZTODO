/**
 * Backup module
 * Handles database backup and restore
 */

import { getDatabase } from './database'

export interface BackupMetadata {
  version: string
  createdAt: string
  appVersion: string
  checksum: string
  itemCounts: {
    tasks: number
    projects: number
    tags: number
    reminders: number
    recurrenceRules: number
  }
}

export interface BackupFile {
  metadata: BackupMetadata
  data: {
    tasks: any[]
    projects: any[]
    tags: any[]
    reminders: any[]
    recurrenceRules: any[]
  }
}

export interface BackupResult {
  success: boolean
  filename: string
  size: number
  metadata: BackupMetadata
}

export interface RestoreResult {
  success: boolean
  restored: {
    tasks: number
    projects: number
    tags: number
    reminders: number
    recurrenceRules: number
  }
  errors: string[]
}

/**
 * Create backup of database
 */
export async function createBackup(): Promise<BackupResult> {
  const db = await getDatabase()

  // Get all data
  const tasks = await db.select<any[]>(`SELECT * FROM tasks`)
  const projects = await db.select<any[]>(`SELECT * FROM projects`)
  const tags = await db.select<any[]>(`SELECT * FROM tags`)
  const reminders = await db.select<any[]>(`SELECT * FROM reminders`)
  const recurrenceRules = await db.select<any[]>(`SELECT * FROM recurrence_rules`)

  // Create backup data
  const backupData: BackupFile = {
    metadata: {
      version: '1.0',
      createdAt: new Date().toISOString(),
      appVersion: '0.1.0',
      checksum: '',  // Will be calculated
      itemCounts: {
        tasks: tasks.length,
        projects: projects.length,
        tags: tags.length,
        reminders: reminders.length,
        recurrenceRules: recurrenceRules.length,
      },
    },
    data: {
      tasks,
      projects,
      tags,
      reminders,
      recurrenceRules,
    },
  }

  // Calculate checksum
  const content = JSON.stringify(backupData.data)
  backupData.metadata.checksum = await calculateChecksum(content)

  // Create file
  const backupContent = JSON.stringify(backupData, null, 2)
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const filename = `eztodo-backup-${timestamp}.json`

  return {
    success: true,
    filename,
    size: backupContent.length,
    metadata: backupData.metadata,
  }
}

/**
 * Download backup file
 */
export async function downloadBackup(): Promise<void> {
  const db = await getDatabase()

  // Get all data
  const tasks = await db.select<any[]>(`SELECT * FROM tasks`)
  const projects = await db.select<any[]>(`SELECT * FROM projects`)
  const tags = await db.select<any[]>(`SELECT * FROM tags`)
  const reminders = await db.select<any[]>(`SELECT * FROM reminders`)
  const recurrenceRules = await db.select<any[]>(`SELECT * FROM recurrence_rules`)

  // Create backup data
  const backupData: BackupFile = {
    metadata: {
      version: '1.0',
      createdAt: new Date().toISOString(),
      appVersion: '0.1.0',
      checksum: '',
      itemCounts: {
        tasks: tasks.length,
        projects: projects.length,
        tags: tags.length,
        reminders: reminders.length,
        recurrenceRules: recurrenceRules.length,
      },
    },
    data: {
      tasks,
      projects,
      tags,
      reminders,
      recurrenceRules,
    },
  }

  // Calculate checksum
  const content = JSON.stringify(backupData.data)
  backupData.metadata.checksum = await calculateChecksum(content)

  // Download file
  const backupContent = JSON.stringify(backupData, null, 2)
  const blob = new Blob([backupContent], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `eztodo-backup-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Preview backup file before restore
 */
export async function previewBackup(content: string): Promise<BackupMetadata> {
  try {
    const backup: BackupFile = JSON.parse(content)

    // Validate structure
    if (!backup.metadata || !backup.data) {
      throw new Error('Invalid backup file structure')
    }

    // Verify checksum
    const dataContent = JSON.stringify(backup.data)
    const calculatedChecksum = await calculateChecksum(dataContent)

    if (calculatedChecksum !== backup.metadata.checksum) {
      throw new Error('Backup file integrity check failed')
    }

    return backup.metadata
  } catch (error) {
    throw new Error(`Failed to preview backup: ${error}`)
  }
}

/**
 * Restore from backup file
 */
export async function restoreFromBackup(content: string): Promise<RestoreResult> {
  const db = await getDatabase()
  const errors: string[] = []
  const restored = {
    tasks: 0,
    projects: 0,
    tags: 0,
    reminders: 0,
    recurrenceRules: 0,
  }

  try {
    const backup: BackupFile = JSON.parse(content)

    // Validate structure
    if (!backup.metadata || !backup.data) {
      throw new Error('Invalid backup file structure')
    }

    // Verify checksum
    const dataContent = JSON.stringify(backup.data)
    const calculatedChecksum = await calculateChecksum(dataContent)

    if (calculatedChecksum !== backup.metadata.checksum) {
      throw new Error('Backup file integrity check failed')
    }

    // Start transaction
    await db.execute('BEGIN TRANSACTION')

    // Clear existing data
    await db.execute('DELETE FROM task_tags')
    await db.execute('DELETE FROM reminders')
    await db.execute('DELETE FROM recurrence_rules')
    await db.execute('DELETE FROM tasks')
    await db.execute('DELETE FROM tags')
    await db.execute('DELETE FROM projects')

    // Restore projects
    for (const project of backup.data.projects) {
      try {
        await db.execute(
          `INSERT INTO projects (id, name, color, icon, sort_order, created_at, updated_at, deleted_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [project.id, project.name, project.color, project.icon, project.sort_order,
           project.created_at, project.updated_at, project.deleted_at]
        )
        restored.projects++
      } catch (error) {
        errors.push(`Project ${project.id}: ${error}`)
      }
    }

    // Restore tags
    for (const tag of backup.data.tags) {
      try {
        await db.execute(
          `INSERT INTO tags (id, name, color, created_at) VALUES ($1, $2, $3, $4)`,
          [tag.id, tag.name, tag.color, tag.created_at]
        )
        restored.tags++
      } catch (error) {
        errors.push(`Tag ${tag.id}: ${error}`)
      }
    }

    // Restore tasks
    for (const task of backup.data.tasks) {
      try {
        await db.execute(
          `INSERT INTO tasks (
            id, parent_id, project_id, title, note, status, priority, sort_order,
            scheduled_date, scheduled_at, due_at, is_all_day, timezone, estimated_minutes,
            created_at, updated_at, completed_at, deleted_at, revision, source, source_capture_id
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)`,
          [
            task.id, task.parent_id, task.project_id, task.title, task.note,
            task.status, task.priority, task.sort_order,
            task.scheduled_date, task.scheduled_at, task.due_at, task.is_all_day,
            task.timezone, task.estimated_minutes,
            task.created_at, task.updated_at, task.completed_at, task.deleted_at,
            task.revision, task.source, task.source_capture_id,
          ]
        )
        restored.tasks++
      } catch (error) {
        errors.push(`Task ${task.id}: ${error}`)
      }
    }

    // Restore reminders
    for (const reminder of backup.data.reminders) {
      try {
        await db.execute(
          `INSERT INTO reminders (id, task_id, remind_at, status, snoozed_until, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [reminder.id, reminder.task_id, reminder.remind_at, reminder.status,
           reminder.snoozed_until, reminder.created_at, reminder.updated_at]
        )
        restored.reminders++
      } catch (error) {
        errors.push(`Reminder ${reminder.id}: ${error}`)
      }
    }

    // Restore recurrence rules
    for (const rule of backup.data.recurrenceRules) {
      try {
        await db.execute(
          `INSERT INTO recurrence_rules (
            id, task_id, frequency, interval, days_of_week, day_of_month,
            month_of_year, start_date, end_date, max_occurrences, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [
            rule.id, rule.task_id, rule.frequency, rule.interval, rule.days_of_week,
            rule.day_of_month, rule.month_of_year, rule.start_date, rule.end_date,
            rule.max_occurrences, rule.created_at, rule.updated_at,
          ]
        )
        restored.recurrenceRules++
      } catch (error) {
        errors.push(`RecurrenceRule ${rule.id}: ${error}`)
      }
    }

    // Commit transaction
    await db.execute('COMMIT')

    return {
      success: errors.length === 0,
      restored,
      errors,
    }
  } catch (error) {
    await db.execute('ROLLBACK')
    throw error
  }
}

/**
 * Calculate SHA-256 checksum
 */
async function calculateChecksum(content: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(content)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Get backup size estimate
 */
export async function getBackupSizeEstimate(): Promise<number> {
  const db = await getDatabase()

  const counts = await db.select<any[]>(
    `SELECT
       (SELECT COUNT(*) FROM tasks) as tasks,
       (SELECT COUNT(*) FROM projects) as projects,
       (SELECT COUNT(*) FROM tags) as tags,
       (SELECT COUNT(*) FROM reminders) as reminders,
       (SELECT COUNT(*) FROM recurrence_rules) as rules`
  )

  // Rough estimate: 500 bytes per task, 200 bytes per project, etc.
  const estimate =
    (counts[0]?.tasks || 0) * 500 +
    (counts[0]?.projects || 0) * 200 +
    (counts[0]?.tags || 0) * 100 +
    (counts[0]?.reminders || 0) * 200 +
    (counts[0]?.rules || 0) * 300

  return estimate
}
