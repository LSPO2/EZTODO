/**
 * One-time localStorage to Repository migration.
 * The completion marker is written only after every required record is present
 * in the target repository. Legacy data is deliberately retained as recovery
 * material.
 */

import type { Repositories, TaskPriority, TaskStatus } from '../repositories/types'

const MIGRATION_KEY = 'eztodo_migration_version'
const CURRENT_MIGRATION_VERSION = 1
const LEGACY_STORAGE_KEY = 'eztodo_db'

type LegacyRecord = Record<string, unknown>

export interface MigrationError {
  entity: 'task' | 'project' | 'tag' | 'setting' | 'task_tag' | 'storage'
  legacyId: string | null
  field: string | null
  reason: string
}

export interface MigrationResult {
  success: boolean
  version: number
  tasksMigrated: number
  projectsMigrated: number
  tagsMigrated: number
  settingsMigrated: number
  errors: MigrationError[]
}

export interface LegacyData {
  tasks?: LegacyRecord[]
  projects?: LegacyRecord[]
  tags?: LegacyRecord[]
  settings?: Record<string, unknown>
  taskTags?: LegacyRecord[]
  task_tags?: LegacyRecord[]
}

const statuses = new Set<TaskStatus>(['todo', 'done', 'cancelled'])
const priorities = new Set<TaskPriority>(['p1', 'p2', 'p3', 'p4', 'none'])

function isRecord(value: unknown): value is LegacyRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function stringValue(record: LegacyRecord, key: string): string | undefined {
  const value = record[key]
  return typeof value === 'string' ? value : undefined
}

function optionalString(record: LegacyRecord, key: string): string | undefined {
  const value = stringValue(record, key)
  return value && value.trim() ? value : undefined
}

function asRecords(value: unknown): LegacyRecord[] | undefined {
  return Array.isArray(value) && value.every(isRecord) ? value : undefined
}

export function needsMigration(): boolean {
  try {
    const version = localStorage.getItem(MIGRATION_KEY)
    return !version || Number.parseInt(version, 10) < CURRENT_MIGRATION_VERSION
  } catch {
    return false
  }
}

export function getLegacyData(): LegacyData | null {
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed)) return null
    const settings = isRecord(parsed.settings) ? parsed.settings : undefined
    return {
      tasks: asRecords(parsed.tasks),
      projects: asRecords(parsed.projects),
      tags: asRecords(parsed.tags),
      settings,
      taskTags: asRecords(parsed.taskTags),
      task_tags: asRecords(parsed.task_tags),
    }
  } catch {
    return null
  }
}

function error(entity: MigrationError['entity'], record: LegacyRecord, reason: string, field: string | null = null): MigrationError {
  return { entity, legacyId: stringValue(record, 'id') ?? null, field, reason }
}

function validDate(value: string | undefined): string | undefined {
  if (!value) return undefined
  return Number.isNaN(Date.parse(value)) ? undefined : value
}

async function migrateProjects(data: LegacyRecord[], repos: Repositories, ids: Map<string, string>, errors: MigrationError[]): Promise<number> {
  let count = 0
  for (const record of data) {
    const id = optionalString(record, 'id')
    const name = optionalString(record, 'name')
    if (!id || !name) {
      errors.push(error('project', record, 'Project requires id and name', !id ? 'id' : 'name'))
      continue
    }
    try {
      const existing = await repos.projects.findById(id)
      const project = existing ?? await repos.projects.create({ name, color: optionalString(record, 'color'), icon: optionalString(record, 'icon') })
      ids.set(id, project.id)
      if (!existing) count++
    } catch (cause) {
      errors.push(error('project', record, cause instanceof Error ? cause.message : String(cause)))
    }
  }
  return count
}

async function migrateTags(data: LegacyRecord[], repos: Repositories, ids: Map<string, string>, errors: MigrationError[]): Promise<number> {
  let count = 0
  for (const record of data) {
    const id = optionalString(record, 'id')
    const name = optionalString(record, 'name')
    if (!id || !name) {
      errors.push(error('tag', record, 'Tag requires id and name', !id ? 'id' : 'name'))
      continue
    }
    try {
      const existing = await repos.tags.findById(id)
      const tag = existing ?? await repos.tags.create({ name, color: optionalString(record, 'color') })
      ids.set(id, tag.id)
      if (!existing) count++
    } catch (cause) {
      errors.push(error('tag', record, cause instanceof Error ? cause.message : String(cause)))
    }
  }
  return count
}

async function migrateTasks(data: LegacyRecord[], repos: Repositories, projectIds: Map<string, string>, taskIds: Map<string, string>, errors: MigrationError[]): Promise<number> {
  let count = 0
  const pending = [...data]
  while (pending.length > 0) {
    let progressed = false
    for (let index = pending.length - 1; index >= 0; index--) {
      const record = pending[index]
      const id = optionalString(record, 'id')
      const title = optionalString(record, 'title')
      if (!id || !title) {
        errors.push(error('task', record, 'Task requires id and title', !id ? 'id' : 'title'))
        pending.splice(index, 1)
        continue
      }
      const oldParentId = optionalString(record, 'parentId')
      if (oldParentId && !taskIds.has(oldParentId)) continue
      const statusValue = optionalString(record, 'status') ?? 'todo'
      const priorityValue = optionalString(record, 'priority') ?? 'none'
      if (!statuses.has(statusValue as TaskStatus) || !priorities.has(priorityValue as TaskPriority)) {
        errors.push(error('task', record, 'Invalid status or priority', !statuses.has(statusValue as TaskStatus) ? 'status' : 'priority'))
        pending.splice(index, 1)
        continue
      }
      const oldProjectId = optionalString(record, 'projectId')
      if (oldProjectId && !projectIds.has(oldProjectId)) {
        errors.push(error('task', record, 'Referenced project was not migrated', 'projectId'))
        pending.splice(index, 1)
        continue
      }
      const dateFields = ['scheduledDate', 'scheduledAt', 'dueAt'] as const
      const invalidDate = dateFields.find((key) => optionalString(record, key) && !validDate(optionalString(record, key)))
      if (invalidDate) {
        errors.push(error('task', record, 'Invalid date value', invalidDate))
        pending.splice(index, 1)
        continue
      }
      try {
        const existing = await repos.tasks.findById(id)
        const task = existing ?? await repos.tasks.create({
          title,
          parentId: oldParentId ? taskIds.get(oldParentId) : undefined,
          projectId: oldProjectId ? projectIds.get(oldProjectId) : undefined,
          note: optionalString(record, 'note'),
          priority: priorityValue as TaskPriority,
          scheduledDate: optionalString(record, 'scheduledDate'),
          scheduledAt: optionalString(record, 'scheduledAt'),
          dueAt: optionalString(record, 'dueAt'),
          isAllDay: record.isAllDay === true,
          timezone: optionalString(record, 'timezone'),
          source: 'manual',
        })
        if (!existing && statusValue !== 'todo') await repos.tasks.update(task.id, { status: statusValue as TaskStatus })
        taskIds.set(id, task.id)
        if (!existing) count++
      } catch (cause) {
        errors.push(error('task', record, cause instanceof Error ? cause.message : String(cause)))
      }
      pending.splice(index, 1)
      progressed = true
    }
    if (!progressed) {
      for (const record of pending) errors.push(error('task', record, 'Parent task was not migrated', 'parentId'))
      break
    }
  }
  return count
}

async function migrateSettings(settings: Record<string, unknown> | undefined, repos: Repositories, errors: MigrationError[]): Promise<number> {
  if (!settings) return 0
  let count = 0
  for (const [key, value] of Object.entries(settings)) {
    if (typeof value !== 'string') {
      errors.push({ entity: 'setting', legacyId: key, field: 'value', reason: 'Setting value must be a string' })
      continue
    }
    try { await repos.settings.set(key, value); count++ } catch (cause) {
      errors.push({ entity: 'setting', legacyId: key, field: 'value', reason: cause instanceof Error ? cause.message : String(cause) })
    }
  }
  return count
}

export async function runMigration(repos: Repositories): Promise<MigrationResult> {
  const result: MigrationResult = { success: false, version: CURRENT_MIGRATION_VERSION, tasksMigrated: 0, projectsMigrated: 0, tagsMigrated: 0, settingsMigrated: 0, errors: [] }
  const legacy = getLegacyData()
  if (!legacy) {
    localStorage.setItem(MIGRATION_KEY, String(CURRENT_MIGRATION_VERSION))
    return { ...result, success: true }
  }
  const projects = new Map<string, string>()
  const tags = new Map<string, string>()
  const tasks = new Map<string, string>()
  result.projectsMigrated = await migrateProjects(legacy.projects ?? [], repos, projects, result.errors)
  result.tagsMigrated = await migrateTags(legacy.tags ?? [], repos, tags, result.errors)
  result.tasksMigrated = await migrateTasks(legacy.tasks ?? [], repos, projects, tasks, result.errors)
  result.settingsMigrated = await migrateSettings(legacy.settings, repos, result.errors)
  for (const link of [...(legacy.taskTags ?? []), ...(legacy.task_tags ?? [])]) {
    const taskId = optionalString(link, 'taskId') ?? optionalString(link, 'task_id')
    const tagId = optionalString(link, 'tagId') ?? optionalString(link, 'tag_id')
    if (!taskId || !tagId || !tasks.has(taskId) || !tags.has(tagId)) {
      result.errors.push(error('task_tag', link, 'Task or tag relation references an unmigrated record'))
      continue
    }
    try { await repos.tags.addToTask(tasks.get(taskId)!, tags.get(tagId)!) } catch (cause) {
      result.errors.push(error('task_tag', link, cause instanceof Error ? cause.message : String(cause)))
    }
  }
  if (result.errors.length === 0) {
    localStorage.setItem(MIGRATION_KEY, String(CURRENT_MIGRATION_VERSION))
    result.success = true
  }
  return result
}

export function getMigrationStatus(): { version: number; needed: boolean } {
  const version = Number.parseInt(localStorage.getItem(MIGRATION_KEY) ?? '0', 10) || 0
  return { version, needed: version < CURRENT_MIGRATION_VERSION }
}