/**
 * Import module
 * Handles importing tasks from CSV, JSON, and other formats
 */

import { getDatabase } from './database'
import { v4 as uuidv4 } from 'uuid'

export type ImportFormat = 'csv' | 'json' | 'markdown'

export interface ImportOptions {
  format: ImportFormat
  encoding: 'utf-8' | 'utf-8-bom'
  columnMapping?: ColumnMapping[]
  skipDuplicates?: boolean
  batchSize?: number
}

export interface ColumnMapping {
  source: string
  target: string
  transform?: (value: string) => any
}

export interface ImportError {
  row: number
  field: string
  message: string
  value: string
}

export interface ImportResult {
  success: boolean
  batchId: string
  imported: number
  skipped: number
  errors: ImportError[]
  preview?: any[]
}

export interface ImportPreview {
  headers: string[]
  rows: any[][]
  totalRows: number
  suggestedMapping: ColumnMapping[]
}

/**
 * Detect file encoding
 */
export function detectEncoding(buffer: ArrayBuffer): 'utf-8' | 'utf-8-bom' | 'unknown' {
  const bytes = new Uint8Array(buffer)

  // Check for BOM
  if (bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
    return 'utf-8-bom'
  }

  // Check for UTF-8 patterns
  let isUtf8 = true
  for (let i = 0; i < Math.min(bytes.length, 1000); i++) {
    if (bytes[i] > 127) {
      // Check UTF-8 multi-byte sequences
      if ((bytes[i] & 0xE0) === 0xC0) {
        if ((bytes[i + 1] & 0xC0) !== 0x80) {
          isUtf8 = false
          break
        }
      } else if ((bytes[i] & 0xF0) === 0xE0) {
        if ((bytes[i + 1] & 0xC0) !== 0x80 || (bytes[i + 2] & 0xC0) !== 0x80) {
          isUtf8 = false
          break
        }
      }
    }
  }

  return isUtf8 ? 'utf-8' : 'unknown'
}

/**
 * Parse CSV content
 */
export function parseCSV(content: string): { headers: string[]; rows: string[][] } {
  const lines = content.split('\n').filter(line => line.trim())
  if (lines.length === 0) {
    return { headers: [], rows: [] }
  }

  // Parse headers
  const headers = parseCSVLine(lines[0])

  // Parse rows
  const rows: string[][] = []
  for (let i = 1; i < lines.length; i++) {
    rows.push(parseCSVLine(lines[i]))
  }

  return { headers, rows }
}

/**
 * Parse a single CSV line
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }

  result.push(current.trim())
  return result
}

/**
 * Parse JSON content
 */
export function parseJSON(content: string): any {
  try {
    return JSON.parse(content)
  } catch (error) {
    throw new Error(`Invalid JSON: ${error}`)
  }
}

/**
 * Parse Markdown checkboxes
 */
export function parseMarkdown(content: string): any[] {
  const tasks: any[] = []
  const lines = content.split('\n')

  for (const line of lines) {
    const match = line.match(/^(\s*)-\s*\[([ xX])\]\s*(.+)$/)
    if (match) {
      const indent = match[1].length
      const completed = match[2] !== ' '
      const title = match[3].trim()

      tasks.push({
        title,
        status: completed ? 'done' : 'todo',
        level: Math.floor(indent / 2),
      })
    }
  }

  return tasks
}

/**
 * Preview import file
 */
export async function previewImport(
  content: string,
  format: ImportFormat
): Promise<ImportPreview> {
  switch (format) {
    case 'csv': {
      const { headers, rows } = parseCSV(content)
      const suggestedMapping = suggestColumnMapping(headers)
      return {
        headers,
        rows: rows.slice(0, 10),
        totalRows: rows.length,
        suggestedMapping,
      }
    }

    case 'json': {
      const data = parseJSON(content)
      const tasks = Array.isArray(data) ? data : data.tasks || []
      const headers = tasks.length > 0 ? Object.keys(tasks[0]) : []
      const rows = tasks.slice(0, 10).map((t: any) => headers.map(h => String(t[h] || '')))
      return {
        headers,
        rows,
        totalRows: tasks.length,
        suggestedMapping: suggestColumnMapping(headers),
      }
    }

    case 'markdown': {
      const tasks = parseMarkdown(content)
      return {
        headers: ['title', 'status', 'level'],
        rows: tasks.slice(0, 10).map(t => [t.title, t.status, String(t.level)]),
        totalRows: tasks.length,
        suggestedMapping: [
          { source: 'title', target: 'title' },
          { source: 'status', target: 'status' },
        ],
      }
    }

    default:
      throw new Error(`Unsupported format: ${format}`)
  }
}

/**
 * Suggest column mapping based on header names
 */
function suggestColumnMapping(headers: string[]): ColumnMapping[] {
  const mapping: ColumnMapping[] = []
  const fieldMappings: Record<string, string> = {
    'title': 'title',
    'task': 'title',
    'name': 'title',
    '任务': 'title',
    '标题': 'title',
    'note': 'note',
    'description': 'note',
    '备注': 'note',
    '描述': 'note',
    'status': 'status',
    '状态': 'status',
    'priority': 'priority',
    '优先级': 'priority',
    'date': 'scheduled_date',
    'scheduled': 'scheduled_date',
    'due': 'due_at',
    '截止': 'due_at',
    'project': 'project',
    '项目': 'project',
    'tags': 'tags',
    '标签': 'tags',
  }

  for (const header of headers) {
    const lowerHeader = header.toLowerCase().trim()
    const target = fieldMappings[lowerHeader]

    if (target) {
      mapping.push({ source: header, target })
    }
  }

  return mapping
}

/**
 * Validate import data
 */
export function validateImportData(
  data: any[],
  mapping: ColumnMapping[]
): ImportError[] {
  const errors: ImportError[] = []

  for (let i = 0; i < data.length; i++) {
    const row = data[i]

    // Check required fields
    const titleMapping = mapping.find(m => m.target === 'title')
    if (titleMapping) {
      const title = row[titleMapping.source]
      if (!title || String(title).trim() === '') {
        errors.push({
          row: i + 1,
          field: 'title',
          message: 'Title is required',
          value: String(title || ''),
        })
      }
    }

    // Validate dates
    const dateFields = ['scheduled_date', 'due_at', 'scheduled_at']
    for (const field of dateFields) {
      const dateMapping = mapping.find(m => m.target === field)
      if (dateMapping) {
        const value = row[dateMapping.source]
        if (value && isNaN(Date.parse(String(value)))) {
          errors.push({
            row: i + 1,
            field,
            message: 'Invalid date format',
            value: String(value),
          })
        }
      }
    }

    // Validate priority
    const priorityMapping = mapping.find(m => m.target === 'priority')
    if (priorityMapping) {
      const value = row[priorityMapping.source]
      if (value && !['p1', 'p2', 'p3', 'p4', 'none'].includes(String(value).toLowerCase())) {
        errors.push({
          row: i + 1,
          field: 'priority',
          message: 'Invalid priority value',
          value: String(value),
        })
      }
    }
  }

  return errors
}

/**
 * Import tasks from file
 */
export async function importTasks(
  content: string,
  options: ImportOptions
): Promise<ImportResult> {
  const batchId = uuidv4()
  const db = await getDatabase()
  const errors: ImportError[] = []
  let imported = 0
  let skipped = 0

  try {
    // Parse content based on format
    let tasks: any[] = []

    switch (options.format) {
      case 'csv': {
        const { headers, rows } = parseCSV(content)
        tasks = rows.map(row => {
          const task: any = {}
          headers.forEach((header, index) => {
            task[header] = row[index] || ''
          })
          return task
        })
        break
      }

      case 'json': {
        const data = parseJSON(content)
        tasks = Array.isArray(data) ? data : data.tasks || []
        break
      }

      case 'markdown': {
        tasks = parseMarkdown(content)
        break
      }
    }

    // Validate data
    const validationErrors = validateImportData(tasks, options.columnMapping || [])
    if (validationErrors.length > 0) {
      errors.push(...validationErrors)
    }

    // Import in batches
    const batchSize = options.batchSize || 100

    await db.execute('BEGIN TRANSACTION')

    for (let i = 0; i < tasks.length; i += batchSize) {
      const batch = tasks.slice(i, i + batchSize)

      for (const taskData of batch) {
        try {
          // Apply column mapping
          const mappedTask = applyColumnMapping(taskData, options.columnMapping || [])

          // Check for duplicates
          if (options.skipDuplicates) {
            const exists = await checkTaskExists(mappedTask.title)
            if (exists) {
              skipped++
              continue
            }
          }

          // Insert task
          await insertTask(mappedTask, batchId)
          imported++
        } catch (error) {
          errors.push({
            row: i + batch.indexOf(taskData) + 1,
            field: 'general',
            message: error instanceof Error ? error.message : 'Unknown error',
            value: JSON.stringify(taskData),
          })
        }
      }
    }

    await db.execute('COMMIT')

    return {
      success: errors.length === 0,
      batchId,
      imported,
      skipped,
      errors,
    }
  } catch (error) {
    await db.execute('ROLLBACK')
    throw error
  }
}

/**
 * Apply column mapping to task data
 */
function applyColumnMapping(data: any, mapping: ColumnMapping[]): any {
  const result: any = {}

  for (const m of mapping) {
    const value = data[m.source]
    if (value !== undefined) {
      result[m.target] = m.transform ? m.transform(value) : value
    }
  }

  // If no mapping, use data as is
  if (Object.keys(result).length === 0) {
    return data
  }

  return result
}

/**
 * Check if task already exists
 */
async function checkTaskExists(title: string): Promise<boolean> {
  const db = await getDatabase()

  const result = await db.select(
    `SELECT COUNT(*) as count FROM tasks WHERE title = $1 AND deleted_at IS NULL`,
    [title.trim()]
  )

  return (result[0]?.count || 0) > 0
}

/**
 * Insert task into database
 */
async function insertTask(data: any, _batchId: string): Promise<void> {
  const db = await getDatabase()
  const id = uuidv4()
  const now = new Date().toISOString()

  await db.execute(
    `INSERT INTO tasks (
      id, title, note, status, priority, scheduled_date, scheduled_at, due_at,
      is_all_day, timezone, created_at, updated_at, revision, source
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
    [
      id,
      data.title?.trim() || 'Untitled',
      data.note || null,
      data.status || 'todo',
      data.priority || 'none',
      data.scheduled_date || null,
      data.scheduled_at || null,
      data.due_at || null,
      data.is_all_day || false,
      data.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      now,
      now,
      1,
      'import',
    ]
  )
}

/**
 * Undo import by batch ID
 */
export async function undoImport(_batchId: string): Promise<number> {
  const db = await getDatabase()

  const result = await db.execute(
    `DELETE FROM tasks WHERE source = 'import' AND created_at IN (
       SELECT created_at FROM tasks WHERE source = 'import'
       LIMIT 1000
     )`
  )

  return result.rowsAffected
}
