/**
 * Export module
 * Handles exporting tasks to CSV, JSON, and Markdown formats
 */

import { getDatabase } from './database'

export type ExportFormat = 'csv' | 'json' | 'markdown'

export interface ExportOptions {
  format: ExportFormat
  includeCompleted?: boolean
  includeDeleted?: boolean
  projectIds?: string[]
  dateRange?: {
    start: string
    end: string
  }
}

export interface ExportResult {
  success: boolean
  content: string
  filename: string
  mimeType: string
  itemCount: number
}

/**
 * Export tasks to file
 */
export async function exportTasks(options: ExportOptions): Promise<ExportResult> {
  const db = await getDatabase()

  // Build query
  let query = `SELECT * FROM tasks WHERE 1=1`
  const params: any[] = []
  let paramIndex = 1

  if (!options.includeDeleted) {
    query += ` AND deleted_at IS NULL`
  }

  if (!options.includeCompleted) {
    query += ` AND status != 'done'`
  }

  if (options.projectIds && options.projectIds.length > 0) {
    query += ` AND project_id IN (${options.projectIds.map(() => `$${paramIndex++}`).join(',')})`
    params.push(...options.projectIds)
  }

  if (options.dateRange) {
    query += ` AND created_at >= $${paramIndex++} AND created_at <= $${paramIndex++}`
    params.push(options.dateRange.start, options.dateRange.end)
  }

  query += ` ORDER BY created_at DESC`

  const tasks = await db.select<any[]>(query, params)

  // Export based on format
  switch (options.format) {
    case 'csv':
      return exportToCSV(tasks)
    case 'json':
      return exportToJSON(tasks)
    case 'markdown':
      return exportToMarkdown(tasks)
    default:
      throw new Error(`Unsupported format: ${options.format}`)
  }
}

/**
 * Export to CSV format
 */
function exportToCSV(tasks: any[]): ExportResult {
  const headers = [
    'id', 'title', 'note', 'status', 'priority',
    'scheduled_date', 'scheduled_at', 'due_at',
    'is_all_day', 'timezone', 'created_at', 'updated_at',
    'completed_at', 'source'
  ]

  const rows = tasks.map(task =>
    headers.map(header => {
      const value = task[header]
      if (value === null || value === undefined) return ''
      const str = String(value)
      // Escape CSV special characters
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`
      }
      return str
    }).join(',')
  )

  const content = [headers.join(','), ...rows].join('\n')
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)

  return {
    success: true,
    content,
    filename: `eztodo-export-${timestamp}.csv`,
    mimeType: 'text/csv',
    itemCount: tasks.length,
  }
}

/**
 * Export to JSON format
 */
function exportToJSON(tasks: any[]): ExportResult {
  const exportData = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    appVersion: '0.1.0',
    itemCount: tasks.length,
    tasks: tasks.map(task => ({
      id: task.id,
      title: task.title,
      note: task.note,
      status: task.status,
      priority: task.priority,
      scheduledDate: task.scheduled_date,
      scheduledAt: task.scheduled_at,
      dueAt: task.due_at,
      isAllDay: task.is_all_day,
      timezone: task.timezone,
      createdAt: task.created_at,
      updatedAt: task.updated_at,
      completedAt: task.completed_at,
      source: task.source,
    })),
  }

  const content = JSON.stringify(exportData, null, 2)
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)

  return {
    success: true,
    content,
    filename: `eztodo-export-${timestamp}.json`,
    mimeType: 'application/json',
    itemCount: tasks.length,
  }
}

/**
 * Export to Markdown format
 */
function exportToMarkdown(tasks: any[]): ExportResult {
  const lines: string[] = []

  lines.push('# EZTODO Export')
  lines.push('')
  lines.push(`Exported: ${new Date().toLocaleString('zh-CN')}`)
  lines.push(`Total: ${tasks.length} tasks`)
  lines.push('')

  // Group by status
  const todoTasks = tasks.filter(t => t.status === 'todo')
  const doneTasks = tasks.filter(t => t.status === 'done')

  if (todoTasks.length > 0) {
    lines.push('## 待办任务')
    lines.push('')
    for (const task of todoTasks) {
      const priority = task.priority !== 'none' ? ` [${task.priority.toUpperCase()}]` : ''
      const date = task.due_at ? ` (截止: ${new Date(task.due_at).toLocaleDateString('zh-CN')})` : ''
      lines.push(`- [ ] ${task.title}${priority}${date}`)
      if (task.note) {
        lines.push(`  > ${task.note}`)
      }
    }
    lines.push('')
  }

  if (doneTasks.length > 0) {
    lines.push('## 已完成任务')
    lines.push('')
    for (const task of doneTasks) {
      lines.push(`- [x] ${task.title}`)
    }
    lines.push('')
  }

  const content = lines.join('\n')
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)

  return {
    success: true,
    content,
    filename: `eztodo-export-${timestamp}.md`,
    mimeType: 'text/markdown',
    itemCount: tasks.length,
  }
}

/**
 * Download export file
 */
export function downloadExport(result: ExportResult): void {
  const blob = new Blob([result.content], { type: result.mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = result.filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
