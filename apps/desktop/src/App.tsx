/**
 * EZTODO Desktop Application
 * Full-featured Todo app with Repository pattern
 */

import React, { useState, useEffect, useCallback, useRef } from 'react'
import './task-detail-panel.css'
import { useTaskStore } from './stores/task-store'
import { useProjectStore } from './stores/project-store'
import type { Task, Project, ViewType, TaskPriority, TaskStatus, SortField } from './lib/repositories'
import { exportTasks, downloadExport } from './lib/export'
import { importTasks } from './lib/import'
import { AISettingsPanel } from './components/settings'
import { parseTaskWithAI, type AIParsedTask } from './lib/ai-client'
import {
  DEFAULT_AI_SETTINGS,
  getSessionApiKey,
  loadAISettings,
  loadRememberedApiKey,
  type AIProviderSettings,
} from './lib/ai-settings'
import { subscribeToTrayNavigation } from './lib/tray-navigation'
import { registerWindowCloseGuard } from './lib/window'
import { REMINDER_PRESETS, calculateReminderTime, reminderScheduler, type PlannedReminderInput, type ReminderKind } from './lib/reminder'

const INITIAL_VISIBLE_TASKS = 20

type ReminderMode = 'none' | 'offset' | 'exact'

interface ReminderDraft {
  mode: ReminderMode
  offsetHours: number
  offsetMinutes: number
  exactAt: string
}

interface TaskDetailDraft {
  title: string
  note: string
  priority: TaskPriority
  projectId: string
  categoryName: string
  scheduledAt: string
  dueAt: string
  startReminder: ReminderDraft
  dueReminder: ReminderDraft
}

function toDateTimeLocal(value: string | null): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value.slice(0, 16)
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

function emptyReminderDraft(): ReminderDraft {
  return { mode: 'none', offsetHours: 0, offsetMinutes: 30, exactAt: '' }
}

function reminderDraftFromTimes(baseAt: string | null, remindAt: string | null): ReminderDraft {
  if (!remindAt) return emptyReminderDraft()
  if (baseAt) {
    const totalMinutes = Math.max(0, Math.round((new Date(baseAt).getTime() - new Date(remindAt).getTime()) / 60_000))
    return {
      mode: 'offset',
      offsetHours: Math.floor(totalMinutes / 60),
      offsetMinutes: totalMinutes % 60,
      exactAt: toDateTimeLocal(remindAt),
    }
  }
  return { ...emptyReminderDraft(), mode: 'exact', exactAt: toDateTimeLocal(remindAt) }
}

function resolveReminderAt(baseAt: string | null, draft: ReminderDraft): string | null {
  if (draft.mode === 'none') return null
  if (draft.mode === 'exact') return draft.exactAt ? new Date(draft.exactAt).toISOString() : null
  if (!baseAt) return null
  return calculateReminderTime(baseAt, Math.max(0, draft.offsetHours) * 60 + Math.max(0, draft.offsetMinutes))
}
function toTaskDetailDraft(task: Task, projects: Project[]): TaskDetailDraft {
  const scheduledAt = task.scheduledAt
    ? toDateTimeLocal(task.scheduledAt)
    : task.scheduledDate ? `${task.scheduledDate}T00:00` : ''
  return {
    title: task.title,
    note: task.note ?? '',
    priority: task.priority,
    projectId: task.projectId ?? '',
    categoryName: projects.find(project => project.id === task.projectId)?.name ?? '',
    scheduledAt,
    dueAt: toDateTimeLocal(task.dueAt),
    startReminder: emptyReminderDraft(),
    dueReminder: emptyReminderDraft(),
  }
}

const App: React.FC = () => {
  const {
    tasks, currentTask, currentView, selectedTaskIds,
    isLoading, error, warnings, undoableBatch, filters,
    setView, setFilters, clearFilters, loadTasks, createTask, updateTask, deleteTask,
    completeTask, uncompleteTask, restoreTask, permanentlyDelete,
    searchTasks, setCurrentTask,
    toggleSelection, selectAll, clearSelection,
    batchComplete, batchDelete, batchSetPriority, batchMoveToProject,
    undoLastBatch, dismissUndoableBatch, indentTask, outdentTask, copyTask, reorderSiblingTasks,
  } = useTaskStore()

  const { projects, isLoading: projectsLoading, error: projectsError, loadProjects, createProject, deleteProject, reorderProjects } = useProjectStore()
  const [inputValue, setInputValue] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [showPage, setShowPage] = useState<'tasks' | 'settings'>('tasks')
  const [settingsSection, setSettingsSection] = useState<'ai' | 'data' | 'trash'>('ai')
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set())
  const [showFilters, setShowFilters] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [aiSettings, setAiSettings] = useState<AIProviderSettings>(DEFAULT_AI_SETTINGS)
  const [showDetail, setShowDetail] = useState(false)
  const [visibleTaskCount, setVisibleTaskCount] = useState(INITIAL_VISIBLE_TASKS)
  const [detailDraft, setDetailDraft] = useState<TaskDetailDraft | null>(null)
  const [detailMode, setDetailMode] = useState<'create' | 'edit'>('edit')
  const [priorityMenuTaskId, setPriorityMenuTaskId] = useState<string | null>(null)
  const [detailBaseline, setDetailBaseline] = useState<string | null>(null)
  const [pendingDetailExit, setPendingDetailExit] = useState<{ action: () => void; isAppExit: boolean; cancelAction?: () => void } | null>(null)
  const [completionChoiceTaskId, setCompletionChoiceTaskId] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [showCategoryManager, setShowCategoryManager] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [categoryManagerError, setCategoryManagerError] = useState<string | null>(null)
  const quickAddInputRef = useRef<HTMLInputElement>(null)
  const detailDraftSignature = detailDraft ? JSON.stringify(detailDraft) : null
  const hasUnsavedDetail = Boolean(showDetail && detailDraftSignature && detailBaseline !== null && detailDraftSignature !== detailBaseline)

  // Load initial data
  useEffect(() => {
    loadTasks()
    loadProjects()
    loadAISettings().then(setAiSettings).catch(error => {
      console.error('Failed to load AI settings:', error)
    })
    loadRememberedApiKey().catch(error => {
      console.error('Failed to load remembered AI API key:', error)
    })
  }, [])

  useEffect(() => {
    setVisibleTaskCount(INITIAL_VISIBLE_TASKS)
  }, [currentView, filters])

  useEffect(() => {
    if (!undoableBatch) return
    const timer = window.setTimeout(dismissUndoableBatch, 7_000)
    return () => window.clearTimeout(timer)
  }, [dismissUndoableBatch, undoableBatch])

  useEffect(() => {
    if (!toastMessage) return
    const timer = window.setTimeout(() => setToastMessage(null), 5_000)
    return () => window.clearTimeout(timer)
  }, [toastMessage])

  // Filtering is handled by the store/repository layer via setFilters
  const rootTasks = tasks.filter(t => !t.parentId)
  const trashTasks = tasks.filter(t => t.deletedAt)
  const currentTaskSiblings = currentTask
    ? tasks.filter(task => task.parentId === currentTask.parentId && !task.deletedAt)
    : []
  const canMakeChildOfPrevious = currentTask
    ? currentTaskSiblings.findIndex(task => task.id === currentTask.id) > 0
    : false
  const canMoveToParentLevel = Boolean(currentTask?.parentId)
  const parentTask = currentTask?.parentId
    ? tasks.find(task => task.id === currentTask.parentId) ?? null
    : null

  // Category management
  const handleCreateCategory = useCallback(async () => {
    const name = newCategoryName.trim()
    if (!name) { setCategoryManagerError('请输入分类名称'); return }
    try {
      await createProject({ name })
      setNewCategoryName('')
      setCategoryManagerError(null)
      setToastMessage(`已创建分类“${name}”`)
    } catch (error) {
      setCategoryManagerError(error instanceof Error ? error.message : '创建分类失败')
    }
  }, [createProject, newCategoryName])

  const handleDeleteCategory = useCallback(async (project: Project) => {
    if (!window.confirm(`确定删除分类“${project.name}”吗？该分类下的任务会保留并转为未分类。`)) return
    try {
      await deleteProject(project.id)
      if (filters.projectId === project.id) {
        setView('today')
        setFilters({ ...filters, projectId: undefined })
      }
      await loadTasks()
      setCategoryManagerError(null)
      setToastMessage(`已删除分类“${project.name}”`)
    } catch (error) {
      setCategoryManagerError(error instanceof Error ? error.message : '删除分类失败')
    }
  }, [deleteProject, filters, loadTasks, setFilters, setView])

  const handleMoveCategory = useCallback(async (projectId: string, direction: -1 | 1) => {
    const index = projects.findIndex(project => project.id === projectId)
    const targetIndex = index + direction
    if (index < 0 || targetIndex < 0 || targetIndex >= projects.length) return
    const ids = projects.map(project => project.id)
    ;[ids[index], ids[targetIndex]] = [ids[targetIndex], ids[index]]
    try {
      await reorderProjects(ids)
      setCategoryManagerError(null)
    } catch (error) {
      setCategoryManagerError(error instanceof Error ? error.message : '分类排序失败')
    }
  }, [projects, reorderProjects])

  // Task operations
  const handleQuickAddTask = useCallback(async () => {
    if (!inputValue.trim()) return
    try {
      await createTask({ title: inputValue.trim() })
      setInputValue('')
    } catch (error) {
      console.error('Failed to create task:', error)
    }
  }, [inputValue, createTask])

  const closeDetail = useCallback(() => {
    setShowDetail(false)
    setDetailDraft(null)
    setDetailBaseline(null)
    setCurrentTask(null)
  }, [setCurrentTask])

  const requestDetailExit = useCallback((action: () => void, isAppExit = false) => {
    if (hasUnsavedDetail) {
      setPendingDetailExit({ action, isAppExit })
      return
    }
    action()
  }, [hasUnsavedDetail])

  const handleAdvancedAdd = useCallback(() => {
    if (!inputValue.trim()) return
    const draft: TaskDetailDraft = {
      title: inputValue.trim(),
      note: '',
      priority: 'none',
      projectId: '',
      categoryName: '',
      scheduledAt: '',
      dueAt: '',
      startReminder: emptyReminderDraft(),
      dueReminder: emptyReminderDraft(),
    }
    const open = () => {
      setCurrentTask(null)
      setDetailMode('create')
      setDetailDraft(draft)
      setDetailBaseline(JSON.stringify(draft))
      setShowDetail(true)
    }
    requestDetailExit(open)
  }, [inputValue, requestDetailExit, setCurrentTask])

  const handleToggleTask = useCallback(async (id: string) => {
    const task = tasks.find(t => t.id === id)
    if (!task) return
    try {
      if (task.status === 'done') {
        const reopenChildren = window.confirm('是否同时恢复已完成的子任务？')
        await uncompleteTask(id, reopenChildren)
      } else {
        await completeTask(id)
      }
    } catch (error) {
      if (error instanceof Error && error.message === 'HAS_UNCOMPLETED_CHILDREN') {
        setCompletionChoiceTaskId(id)
      } else {
        console.error('Failed to toggle task:', error)
      }
    }
  }, [tasks, completeTask, uncompleteTask])

  const resolveCompletionChoice = useCallback(async (mode: 'self' | 'withChildren' | 'cancel') => {
    const taskId = completionChoiceTaskId
    setCompletionChoiceTaskId(null)
    if (!taskId || mode === 'cancel') return
    await completeTask(taskId, mode)
  }, [completeTask, completionChoiceTaskId])

  const handleDeleteTask = useCallback(async (id: string) => {
    try {
      await deleteTask(id)
      if (currentTask?.id === id) closeDetail()
    } catch (error) {
      console.error('Failed to delete task:', error)
    }
  }, [closeDetail, currentTask, deleteTask])

  const openTaskDetail = useCallback((task: Task) => {
    const initialDraft = toTaskDetailDraft(task, projects)
    setCurrentTask(task)
    setDetailMode('edit')
    setDetailDraft(initialDraft)
    setDetailBaseline(JSON.stringify(initialDraft))
    setShowDetail(true)
    void reminderScheduler.getTaskReminderPlans(task.id).then(plans => {
      setDetailDraft(current => {
        if (!current) return current
        const nextDraft = {
          ...current,
          startReminder: reminderDraftFromTimes(task.scheduledAt, plans.start),
          dueReminder: reminderDraftFromTimes(task.dueAt, plans.due),
        }
        if (JSON.stringify(current) === JSON.stringify(initialDraft)) setDetailBaseline(JSON.stringify(nextDraft))
        return nextDraft
      })
    })
  }, [projects, setCurrentTask])

  const handleSelectTask = useCallback((task: Task) => {
    if (showDetail && currentTask?.id === task.id) return
    requestDetailExit(() => openTaskDetail(task))
  }, [currentTask?.id, openTaskDetail, requestDetailExit, showDetail])
  useEffect(() => subscribeToTrayNavigation(destination => {
    requestDetailExit(() => {
      closeDetail()
      clearSelection()
      if (destination === 'settings') {
        setSettingsSection('ai')
        setShowPage('settings')
        return
      }
      setShowPage('tasks')
      if (destination === 'today') {
        setView('today')
        return
      }
      requestAnimationFrame(() => quickAddInputRef.current?.focus())
    })
  }), [clearSelection, closeDetail, requestDetailExit, setView])
  // Debounced search to avoid querying on every keystroke
  const searchTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query)
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }
    searchTimeoutRef.current = setTimeout(() => {
      if (query.trim()) {
        searchTasks(query)
      } else {
        loadTasks()
      }
    }, 300)
  }, [searchTasks, loadTasks])

  const handleBatchComplete = useCallback(async () => {
    try {
      await batchComplete()
    } catch (error) {
      console.error('Batch complete failed:', error)
    }
  }, [batchComplete])

  const handleBatchDelete = useCallback(async () => {
    if (confirm(`确定要删除选中的 ${selectedTaskIds.size} 个任务吗？`)) {
      try {
        await batchDelete()
      } catch (error) {
        console.error('Batch delete failed:', error)
      }
    }
  }, [batchDelete, selectedTaskIds])

  const createAIParsedTask = useCallback(async (
    task: AIParsedTask,
    parentId?: string,
    categoryCache: Map<string, string> = new Map(projects.map(project => [project.name.toLocaleLowerCase(), project.id])),
  ): Promise<Task> => {
    let projectId: string | undefined
    if (task.categoryName) {
      const key = task.categoryName.toLocaleLowerCase()
      projectId = categoryCache.get(key)
      if (!projectId) {
        const category = await createProject({ name: task.categoryName })
        projectId = category.id
        categoryCache.set(key, projectId)
      }
    }

    const created = await createTask({
      title: task.title,
      parentId,
      projectId,
      note: task.note,
      priority: task.priority,
      scheduledDate: task.scheduledDate ?? (task.scheduledAt ? toDateTimeLocal(task.scheduledAt).slice(0, 10) : undefined),
      scheduledAt: task.scheduledAt,
      dueAt: task.dueAt,
      estimatedMinutes: task.estimatedMinutes,
      source: 'ai',
    })

    for (const subtask of task.subtasks) {
      await createAIParsedTask(subtask, created.id, categoryCache)
    }
    return created
  }, [createProject, createTask, projects])

  const handleAIAdd = useCallback(async () => {
    if (!inputValue.trim() || aiLoading) return
    if (!getSessionApiKey()) {
      setAiError('请先在设置中填写 API Key')
      setSettingsSection('ai')
      setShowPage('settings')
      return
    }

    setAiLoading(true)
    setAiError(null)
    try {
      const result = await parseTaskWithAI(
        inputValue.trim(),
        aiSettings,
        getSessionApiKey(),
        projects.map(project => project.name),
      )
      if (result.tasks.length === 0) throw new Error('AI 没有识别出可创建的任务')

      const categoryCache = new Map(projects.map(project => [project.name.toLocaleLowerCase(), project.id]))
      let firstCreated: Task | null = null
      let firstParsed: AIParsedTask | null = null
      for (const task of result.tasks) {
        const created = await createAIParsedTask(task, undefined, categoryCache)
        if (!firstCreated) {
          firstCreated = created
          firstParsed = task
        }
      }

      if (firstCreated) {
        setInputValue('')
        setCurrentTask(firstCreated)
        setDetailMode('edit')
        const draft = toTaskDetailDraft(firstCreated, projects)
        const aiDraft = { ...draft, categoryName: firstParsed?.categoryName ?? draft.categoryName }
        setDetailDraft(aiDraft)
        setDetailBaseline(JSON.stringify(aiDraft))
        setShowDetail(true)
      }
    } catch (error) {
      console.error('AI add failed:', error)
      setAiError(error instanceof Error ? error.message : 'AI 创建任务失败')
    } finally {
      setAiLoading(false)
    }
  }, [aiLoading, aiSettings, createAIParsedTask, inputValue, projects, setCurrentTask])
  const handleSaveDetail = useCallback(async (showSuccess = true): Promise<boolean> => {
    if (!detailDraft?.title.trim()) {
      setAiError('任务标题不能为空')
      return false
    }

    const scheduledAt = detailDraft.scheduledAt ? new Date(detailDraft.scheduledAt).toISOString() : null
    const dueAt = detailDraft.dueAt ? new Date(detailDraft.dueAt).toISOString() : null
    const reminderInputs: PlannedReminderInput[] = []
    const reminderDefinitions: Array<{ kind: ReminderKind; label: string; baseAt: string | null; draft: ReminderDraft }> = [
      { kind: 'start', label: '开始提醒', baseAt: scheduledAt, draft: detailDraft.startReminder },
      { kind: 'due', label: '截止提醒', baseAt: dueAt, draft: detailDraft.dueReminder },
    ]

    for (const definition of reminderDefinitions) {
      if (definition.draft.mode === 'none') continue
      if (definition.draft.mode === 'offset' && !definition.baseAt) {
        setAiError(`请先设置对应的计划时间，再启用${definition.label}`)
        return false
      }
      const remindAt = resolveReminderAt(definition.baseAt, definition.draft)
      if (!remindAt) {
        setAiError(`请完整填写${definition.label}时间`)
        return false
      }
      if (new Date(remindAt) <= new Date()) {
        setAiError(`${definition.label}必须晚于当前时间`)
        return false
      }
      reminderInputs.push({ kind: definition.kind, remindAt })
    }

    try {
      let projectId = detailDraft.projectId || null
      const categoryName = detailDraft.categoryName.trim()
      if (categoryName) {
        const existing = projects.find(project => project.name.toLocaleLowerCase() === categoryName.toLocaleLowerCase())
        projectId = existing?.id ?? (await createProject({ name: categoryName })).id
      }

      const values = {
        title: detailDraft.title.trim(),
        note: detailDraft.note || null,
        priority: detailDraft.priority,
        projectId,
        scheduledDate: detailDraft.scheduledAt ? detailDraft.scheduledAt.slice(0, 10) : null,
        scheduledAt,
        dueAt,
      }

      let savedTask: Task | null = null
      if (detailMode === 'create') {
        savedTask = await createTask({
          title: values.title,
          note: values.note ?? undefined,
          priority: values.priority,
          projectId: values.projectId ?? undefined,
          scheduledDate: values.scheduledDate ?? undefined,
          scheduledAt: values.scheduledAt ?? undefined,
          dueAt: values.dueAt ?? undefined,
        })
        setInputValue('')
      } else if (currentTask) {
        savedTask = await updateTask(currentTask.id, values)
      }

      if (savedTask) await reminderScheduler.setTaskReminders(savedTask, reminderInputs)

      setAiError(null)
      setShowDetail(false)
      setDetailDraft(null)
      setDetailBaseline(null)
      setCurrentTask(null)
      await loadTasks()
      if (showSuccess) setToastMessage('任务已保存')
      return true
    } catch (error) {
      console.error('Failed to save task details:', error)
      setAiError(error instanceof Error ? error.message : '保存任务失败')
      return false
    }
  }, [createProject, createTask, currentTask, detailDraft, detailMode, loadTasks, projects, setCurrentTask, updateTask])
  useEffect(() => registerWindowCloseGuard(() => new Promise<boolean>(resolve => {
    if (!hasUnsavedDetail) {
      resolve(true)
      return
    }
    setPendingDetailExit({ action: () => resolve(true), cancelAction: () => resolve(false), isAppExit: true })
  })), [hasUnsavedDetail])
  // Export via service
  const handleExport = async () => {
    try {
      const result = await exportTasks({ format: 'json', includeCompleted: true })
      downloadExport(result)
    } catch (error) {
      console.error('Export failed:', error)
    }
  }

  // Import via service
  const handleImport = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json,.csv,.md'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = async (ev) => {
        try {
          const content = ev.target?.result as string
          const format = file.name.endsWith('.csv') ? 'csv' : file.name.endsWith('.md') ? 'markdown' : 'json'
          const result = await importTasks(content, { format, encoding: 'utf-8' })
          if (result.success) {
            alert(`✅ 导入 ${result.imported} 个任务`)
          } else {
            alert(`⚠️ 导入 ${result.imported} 个，${result.errors.length} 个失败`)
          }
          await loadTasks()
        } catch {
          alert('❌ 导入失败')
        }
      }
      reader.readAsText(file)
    }
    input.click()
  }

  // Helpers
  const getPriorityColor = (p: string) => {
    switch (p) {
      case 'p1': return '#e74c3c'
      case 'p2': return '#e67e22'
      case 'p3': return '#f1c40f'
      case 'p4': return '#3498db'
      default: return '#95a5a6'
    }
  }


  const getProjectName = (id?: string | null) => {
    if (!id) return '📥 收件箱'
    const p = projects.find(x => x.id === id)
    return p ? `${p.icon || '📁'} ${p.name}` : '📥 收件箱'
  }

  const getChildren = (parentId: string) => tasks
    .filter(t => t.parentId === parentId)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt))

  const getProgress = (taskId: string) => {
    const children = getChildren(taskId)
    if (children.length === 0) return null
    const done = children.filter(t => t.status === 'done').length
    return { done, total: children.length }
  }

  const toggleExpand = useCallback((id: string) => {
    setExpandedTasks(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const moveTaskRelative = useCallback(async (task: Task, direction: -1 | 1) => {
    const siblings = tasks
      .filter(candidate => candidate.parentId === task.parentId)
      .sort((a, b) => a.sortOrder - b.sortOrder)
    const index = siblings.findIndex(candidate => candidate.id === task.id)
    const targetIndex = index + direction
    if (index < 0 || targetIndex < 0 || targetIndex >= siblings.length) return
    const orderedIds = siblings.map(candidate => candidate.id)
    ;[orderedIds[index], orderedIds[targetIndex]] = [orderedIds[targetIndex], orderedIds[index]]
    await reorderSiblingTasks(task.parentId, orderedIds)
  }, [tasks, reorderSiblingTasks])

  const updateReminderDraft = (kind: ReminderKind, updates: Partial<ReminderDraft>) => {
    if (!detailDraft) return
    const key = kind === 'start' ? 'startReminder' : 'dueReminder'
    setDetailDraft({ ...detailDraft, [key]: { ...detailDraft[key], ...updates } })
  }

  const renderReminderEditor = (kind: ReminderKind, label: string, baseAt: string) => {
    if (!detailDraft) return null
    const draft = kind === 'start' ? detailDraft.startReminder : detailDraft.dueReminder
    const offsetTotal = draft.offsetHours * 60 + draft.offsetMinutes
    const resolvedAt = resolveReminderAt(baseAt ? new Date(baseAt).toISOString() : null, draft)

    return (
      <div className="task-detail-reminder" data-testid={`${kind}-reminder-editor`}>
        <div className="task-detail-reminder__label">
          <span>{label}</span>
          <small>{kind === 'start' ? '以计划开始时间为基准' : '以计划截止时间为基准'}</small>
        </div>
        <div className="task-detail-reminder__presets" aria-label={`${label}快捷选择`}>
          <button type="button" className={draft.mode === 'none' ? 'active' : ''}
            aria-pressed={draft.mode === 'none'} onClick={() => updateReminderDraft(kind, { mode: 'none' })}>不提醒</button>
          {REMINDER_PRESETS.map(preset => (
            <button type="button" key={preset.minutes}
              className={draft.mode === 'offset' && offsetTotal === preset.minutes ? 'active' : ''}
              aria-pressed={draft.mode === 'offset' && offsetTotal === preset.minutes}
              onClick={() => updateReminderDraft(kind, {
                mode: 'offset',
                offsetHours: Math.floor(preset.minutes / 60),
                offsetMinutes: preset.minutes % 60,
              })}>{preset.label}</button>
          ))}
        </div>
        <div className="task-detail-reminder__manual-tabs">
          <button type="button" className={draft.mode === 'offset' ? 'active' : ''}
            onClick={() => updateReminderDraft(kind, { mode: 'offset' })}>自定义提前量</button>
          <button type="button" className={draft.mode === 'exact' ? 'active' : ''}
            onClick={() => updateReminderDraft(kind, { mode: 'exact' })}>指定日期时间</button>
        </div>
        {draft.mode === 'offset' && (
          <div className="task-detail-reminder__offset">
            <span>提前</span>
            <input aria-label={`${label}提前小时`} type="number" min="0" max="999" value={draft.offsetHours}
              onChange={event => updateReminderDraft(kind, { offsetHours: Math.max(0, Number(event.target.value) || 0) })} />
            <span>小时</span>
            <input aria-label={`${label}提前分钟`} type="number" min="0" max="59" value={draft.offsetMinutes}
              onChange={event => updateReminderDraft(kind, { offsetMinutes: Math.min(59, Math.max(0, Number(event.target.value) || 0)) })} />
            <span>分钟</span>
          </div>
        )}
        {draft.mode === 'exact' && (
          <input className="task-detail-reminder__exact" aria-label={`${label}指定时间`} type="datetime-local"
            value={draft.exactAt} onChange={event => updateReminderDraft(kind, { exactAt: event.target.value })} />
        )}
        {draft.mode !== 'none' && (
          resolvedAt
            ? <p className="task-detail-reminder__result">将在 {new Date(resolvedAt).toLocaleString('zh-CN')} 提醒</p>
            : <p className="task-detail-reminder__hint">{draft.mode === 'offset' ? '请先填写对应的计划时间' : '请选择提醒日期和时间'}</p>
        )}
      </div>
    )
  }
  // Render task card
  const renderTask = (task: Task, depth = 0) => {    const children = getChildren(task.id)
    const isExpanded = expandedTasks.has(task.id)
    const progress = getProgress(task.id)
    const isSelected = selectedTaskIds.has(task.id)
    const orderedSiblings = tasks.filter(item => item.parentId === task.parentId).sort((a, b) => a.sortOrder - b.sortOrder)
    const siblingIndex = orderedSiblings.findIndex(item => item.id === task.id)
    const canMoveUp = siblingIndex > 0
    const canMoveDown = siblingIndex >= 0 && siblingIndex < orderedSiblings.length - 1

    return (
      <React.Fragment key={task.id}>
        <div
          className="task-list-card"
          data-testid={`task-card-${task.id}`}
          onClick={() => { setPriorityMenuTaskId(null); handleSelectTask(task) }}
          style={{
            background: 'white', borderRadius: '8px', padding: '9px 12px', marginBottom: '6px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderLeft: `4px solid ${getPriorityColor(task.priority)}`,
            marginLeft: `${depth * 22}px`, display: 'flex', alignItems: 'center', gap: '8px',
            cursor: 'pointer', opacity: task.status === 'done' ? 0.7 : 1,
          }}
        >
          <div
            role="button" tabIndex={0} aria-label={`${task.status === 'done' ? '恢复' : '完成'}任务 ${task.title}`}
            onClick={(e) => { e.stopPropagation(); handleToggleTask(task.id) }}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); void handleToggleTask(task.id) } }}
            style={{
              width: '20px', height: '20px',
              border: `2px solid ${task.status === 'done' ? '#27ae60' : '#ddd'}`,
              borderRadius: '50%',
              background: task.status === 'done' ? '#27ae60' : 'transparent',
              cursor: 'pointer', flexShrink: 0,
            }}
          />
          {children.length > 0 && (
            <button type="button" className="task-expand-button"
              aria-expanded={isExpanded}
              aria-label={`${isExpanded ? '收起' : '展开'}子任务`}
              onClick={(e) => { e.stopPropagation(); toggleExpand(task.id) }}
            >
              {isExpanded ? '▼' : '▶'}
            </button>
          )}
          <div style={{ flex: 1 }}>
            <div style={{
              fontWeight: 500,
              textDecoration: task.status === 'done' ? 'line-through' : 'none',
              color: task.status === 'done' ? '#999' : '#333',
            }}>
              {task.title}
            </div>
            {task.note && <div className="task-card-note">{task.note}</div>}
            <div style={{ fontSize: '12px', color: '#999', marginTop: '4px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <div className="task-priority-control" onClick={event => event.stopPropagation()}>
                <button type="button"
                  className="task-priority-square"
                  style={{ background: getPriorityColor(task.priority) }}
                  aria-label={`调整优先级 ${task.title}`}
                  aria-haspopup="menu"
                  aria-expanded={priorityMenuTaskId === task.id}
                  onClick={() => setPriorityMenuTaskId(current => current === task.id ? null : task.id)}
                >
                  {task.priority === 'none' ? '无' : task.priority.toUpperCase()}
                </button>
                {priorityMenuTaskId === task.id && (
                  <div className="task-priority-menu" role="menu" aria-label={`选择 ${task.title} 的优先级`}>
                    {(['p1', 'p2', 'p3', 'p4', 'none'] as TaskPriority[]).map(priority => (
                      <button type="button" key={priority} role="menuitem"
                        className={task.priority === priority ? 'active' : ''}
                        onClick={() => {
                          setPriorityMenuTaskId(null)
                          void updateTask(task.id, { priority })
                        }}
                      >
                        <span style={{ background: getPriorityColor(priority) }} />
                        {priority === 'none' ? '无优先级' : priority.toUpperCase()}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {task.projectId && <span>{getProjectName(task.projectId)}</span>}
              {task.scheduledAt
                ? <span>🕐 {new Date(task.scheduledAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                : task.scheduledDate && <span>📅 {task.scheduledDate}</span>}
              {progress && <span>📊 {progress.done}/{progress.total}</span>}
            </div>
          </div>
          <time className="task-created-at" dateTime={task.createdAt}>创建于 {task.createdAt ? new Date(task.createdAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '--'}</time>
          <div className="task-order-controls" onClick={event => event.stopPropagation()}>
            <button className="task-order-button delayed-tooltip" data-tooltip="将任务上移一位" aria-label="上移任务" disabled={!canMoveUp} onClick={() => { void moveTaskRelative(task, -1) }}><span aria-hidden="true">↑</span>上移</button>
            <button className="task-order-button delayed-tooltip" data-tooltip="将任务下移一位" aria-label="下移任务" disabled={!canMoveDown} onClick={() => { void moveTaskRelative(task, 1) }}><span aria-hidden="true">↓</span>下移</button>
          </div>
          <div
            onClick={(e) => { e.stopPropagation(); toggleSelection(task.id) }}            style={{
              width: '18px', height: '18px',
              border: `2px solid ${isSelected ? '#3498db' : '#ddd'}`,
              borderRadius: '4px',
              background: isSelected ? '#3498db' : 'transparent',
              cursor: 'pointer', flexShrink: 0,
            }}
          />
        </div>
        {isExpanded && children.map(child => renderTask(child, depth + 1))}
      </React.Fragment>
    )
  }

  return (
    <div style={{ display: 'flex', width: '100%', height: '100%', overflow: 'hidden', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      {/* Sidebar */}
      <div style={{ width: '240px', flexShrink: 0, minHeight: 0, background: '#2c3e50', color: 'white', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px', borderBottom: '1px solid #34495e' }}>
          <h2 style={{ margin: 0 }}>📋 EZTODO</h2>
          <div style={{ fontSize: '12px', opacity: 0.7, marginTop: '5px' }}>v2.0.0</div>
        </div>

        <nav style={{ flex: 1, padding: '10px', overflow: 'auto' }}>
          {[
            { id: 'today' as ViewType, icon: '🔴', label: '今天' },
            { id: 'week' as ViewType, icon: '📆', label: '未来 7 天' },
            { id: 'overdue' as ViewType, icon: '⚠️', label: '已逾期' },
            { id: 'completed' as ViewType, icon: '✅', label: '已完成' },
          ].map(item => (
            <div
              key={item.id}
              onClick={() => requestDetailExit(() => { closeDetail(); setView(item.id); setShowPage('tasks'); clearSelection() })}
              style={{
                padding: '10px 12px', borderRadius: '6px', cursor: 'pointer', marginBottom: '4px',
                background: currentView === item.id && showPage === 'tasks' && !filters.projectId ? '#3498db' : 'transparent',
              }}
            >
              <span style={{ marginRight: '10px' }}>{item.icon}</span>
              {item.label}
            </div>
          ))}

          <div className="category-section-header">
            <span>分类</span>
            <button type="button" aria-label="管理分类" onClick={() => requestDetailExit(() => {
              closeDetail()
              setCategoryManagerError(null)
              setShowCategoryManager(true)
            })}>管理</button>
          </div>
          {projects.length === 0 && (
            <div style={{ padding: '8px 12px', fontSize: '12px', opacity: 0.55 }}>暂无分类</div>
          )}
          {projects.map(project => (
            <div key={project.id}
              onClick={() => requestDetailExit(() => {
                closeDetail()
                setView('all')
                setFilters({ projectId: project.id })
                setShowPage('tasks')
                clearSelection()
              })}
              style={{
                padding: '10px 12px', borderRadius: '6px', cursor: 'pointer', marginBottom: '4px',
                background: showPage === 'tasks' && filters.projectId === project.id ? '#3498db' : 'transparent',
              }}>
              <span style={{ marginRight: '10px' }}>{project.icon || '🏷️'}</span>
              {project.name}
            </div>
          ))}
        </nav>

        <button
          onClick={() => requestDetailExit(() => { closeDetail(); setSettingsSection('ai'); setShowPage('settings'); clearSelection() })}
          style={{ margin: '10px', padding: '11px 12px', textAlign: 'left', color: 'white', background: showPage === 'settings' ? '#3498db' : 'transparent', border: '1px solid #4a6075', borderRadius: '6px', cursor: 'pointer' }}>
          ⚙️ 设置
        </button>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#f5f5f5' }}>
        {/* Header */}
        <div style={{ padding: '15px 20px', background: 'white', borderBottom: '1px solid #ddd', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ margin: 0, fontSize: '20px' }}>
            {showPage === 'tasks' && (
              <>
                {currentView === 'all' && `🏷️ 分类：${projects.find(project => project.id === filters.projectId)?.name ?? '全部'}`}
                {currentView === 'today' && '🔴 今天'}
                {currentView === 'week' && '📆 未来 7 天'}
                {currentView === 'overdue' && '⚠️ 已逾期'}
                {currentView === 'completed' && '✅ 已完成'}
              </>
            )}
            {showPage === 'settings' && '⚙️ 设置'}
          </h1>
          <div className="task-header-actions">
            <input
              className="task-search-input"
              aria-label="搜索任务"
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="🔍 搜索..."
            />
            <button
              className="task-filter-toggle"
              aria-expanded={showFilters}
              onClick={() => setShowFilters(!showFilters)}
              style={{ background: showFilters ? '#3498db' : '#f8f9fa', color: showFilters ? '#fff' : '#344054' }}
            >
              🔽 筛选
            </button>
          </div>
        </div>

        {/* Filters and sorting — all state is passed through Store -> Repository */}
        {showFilters && (
          <div className="task-filter-panel">
            <select aria-label="分类筛选" value={filters.projectId || ''} onChange={(e) => setFilters({ ...filters, projectId: e.target.value || undefined })}>
              <option value="">所有分类</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.icon || '📁'} {p.name}</option>)}
            </select>
            <select aria-label="优先级筛选" value={filters.priority || ''} onChange={(e) => setFilters({ ...filters, priority: (e.target.value || undefined) as TaskPriority | undefined })}>
              <option value="">所有优先级</option>
              <option value="p1">🔴 P1</option><option value="p2">🟠 P2</option>
              <option value="p3">🟡 P3</option><option value="p4">🔵 P4</option>
              <option value="none">无优先级</option>
            </select>
            <select aria-label="状态筛选" value={filters.status || ''} onChange={(e) => setFilters({ ...filters, status: (e.target.value || undefined) as TaskStatus | undefined })}>
              <option value="">所有状态</option>
              <option value="todo">待办</option><option value="done">已完成</option><option value="cancelled">已取消</option>
            </select>
            <select aria-label="排序字段" value={filters.sort?.field || 'sortOrder'} onChange={(e) => setFilters({ ...filters, sort: { field: e.target.value as SortField, direction: filters.sort?.direction || 'asc' } })}>
              <option value="sortOrder">手动顺序</option><option value="scheduledDate">计划时间</option>
              <option value="dueAt">截止时间</option><option value="createdAt">创建时间</option>
            </select>
            <button aria-label="切换排序方向" onClick={() => setFilters({ ...filters, sort: { field: filters.sort?.field || 'sortOrder', direction: filters.sort?.direction === 'desc' ? 'asc' : 'desc' } })}>
              {filters.sort?.direction === 'desc' ? '降序 ↓' : '升序 ↑'}
            </button>
            <label className="task-filter-checkbox">
              <input type="checkbox" checked={Boolean(filters.parentOnly)} onChange={(e) => setFilters({ ...filters, parentOnly: e.target.checked || undefined })} />
              仅父任务
            </label>
            <button onClick={() => setExpandedTasks(new Set(tasks.map(task => task.id)))}>展开全部子任务</button>
            <button onClick={() => setExpandedTasks(new Set())}>收起全部</button>
            {(filters.projectId || filters.priority || filters.status || filters.search || filters.parentOnly || filters.sort) && (
              <button className="task-filter-clear" onClick={() => { setSearchQuery(''); clearFilters() }}>
                清除筛选
              </button>
            )}
          </div>
        )}

        {/* Undo banner — visible whenever there is something to undo, independent of selection */}
        {undoableBatch && (
          <div data-testid="undo-banner" className="undo-banner" role="status">
            <span>↩️ 上次操作：{undoableBatch.operation}（{undoableBatch.count} 项）</span>
            <button className="undo-banner__undo" onClick={() => void undoLastBatch()} data-testid="undo-button">撤销</button>
            <button className="undo-banner__dismiss" onClick={dismissUndoableBatch} aria-label="删除撤销提示">删除</button>
          </div>
        )}

        {/* Batch toolbar — only when tasks are selected */}
        {selectedTaskIds.size > 0 && (
          <div style={{ padding: '10px 20px', background: '#e3f2fd', borderBottom: '1px solid #bbdefb', display: 'flex', alignItems: 'center', gap: '15px' }}>
            <span style={{ fontSize: '14px', color: '#1976d2' }}>已选择 {selectedTaskIds.size} 项</span>
            <button onClick={handleBatchComplete}
              style={{ padding: '6px 12px', background: '#27ae60', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>
              ✅ 批量完成
            </button>
            <button onClick={handleBatchDelete}
              style={{ padding: '6px 12px', background: '#e74c3c', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>
              🗑️ 批量删除
            </button>
            <select
              aria-label="批量修改分类"
              defaultValue=""
              onChange={(event) => {
                const value = event.currentTarget.value
                event.currentTarget.value = ''
                if (value) void batchMoveToProject(value === '__none__' ? null : value)
              }}
              style={{ padding: '6px 10px', border: '1px solid #90caf9', borderRadius: '4px', fontSize: '12px' }}
            >
              <option value="" disabled>🏷️ 修改分类</option>
              <option value="__none__">无分类</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>{project.icon || '📁'} {project.name}</option>
              ))}
            </select>
            <select
              aria-label="批量修改优先级"
              defaultValue=""
              onChange={(event) => {
                const value = event.currentTarget.value as TaskPriority | ''
                event.currentTarget.value = ''
                if (value) void batchSetPriority(value)
              }}
              style={{ padding: '6px 10px', border: '1px solid #90caf9', borderRadius: '4px', fontSize: '12px' }}
            >
              <option value="" disabled>🔴 修改优先级</option>
              <option value="p1">P1</option>
              <option value="p2">P2</option>
              <option value="p3">P3</option>
              <option value="p4">P4</option>
              <option value="none">无优先级</option>
            </select>            <button onClick={selectAll}
              style={{ padding: '6px 12px', background: '#3498db', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>
              全选
            </button>
            <button onClick={clearSelection}
              style={{ padding: '6px 12px', background: '#95a5a6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>
              取消选择
            </button>
          </div>
        )}

        {/* Add task */}
        {showPage === 'tasks' && (
          <>
            <div style={{ padding: '12px 20px', background: 'white', borderBottom: '1px solid #ddd', display: 'flex', gap: '10px' }}>
              <input
                ref={quickAddInputRef}
                aria-label="添加任务内容"
                type="text"
                value={inputValue}
                onChange={(e) => { setInputValue(e.target.value); setAiError(null) }}
                onKeyDown={(e) => e.key === 'Enter' && void handleQuickAddTask()}
                placeholder="输入任务内容..."
                style={{ flex: 1, padding: '10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px' }}
              />
              <button className="delayed-tooltip" data-tooltip="立即创建一个基础 TODO 任务" aria-label="快速添加" onClick={() => void handleQuickAddTask()}
                style={{ padding: '10px 16px', background: '#3498db', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
                快速添加
              </button>
              <button className="delayed-tooltip" data-tooltip="打开任务详情并设置备注、时间和提醒" aria-label="高级" onClick={handleAdvancedAdd}
                style={{ padding: '10px 16px', background: '#6c757d', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
                高级
              </button>
              <button className="delayed-tooltip" data-tooltip="使用 AI 识别并创建结构化任务" aria-label="AI 添加" onClick={() => void handleAIAdd()} disabled={aiLoading || !inputValue.trim()}
                style={{ padding: '10px 16px', background: aiLoading ? '#95a5a6' : '#9b59b6', color: 'white', border: 'none', borderRadius: '6px', cursor: aiLoading ? 'wait' : 'pointer' }}>
                {aiLoading ? 'AI 识别中…' : 'AI 添加'}
              </button>
            </div>
            {aiError && (
              <div role="alert" style={{ padding: '8px 20px', background: '#fef3f2', color: '#b42318', borderBottom: '1px solid #fecdca', fontSize: '13px' }}>
                ⚠️ {aiError}
              </div>
            )}
          </>
        )}
        {/* Content */}
        <div style={{ flex: 1, minWidth: 0, minHeight: 0, overflow: 'auto', padding: '15px 20px' }}>
          {/* Error display */}
          {error && (
            <div style={{ padding: '10px 15px', background: '#fee2e2', color: '#dc2626', borderRadius: '6px', marginBottom: '15px', fontSize: '14px' }}>
              ⚠️ {error}
            </div>
          )}

          {/* Tasks View */}
          {showPage === 'tasks' && (
            <>
              {isLoading ? (
                <div style={{ textAlign: 'center', padding: '60px', color: '#999' }}>
                  <div style={{ fontSize: '24px', marginBottom: '15px' }}>⏳</div>
                  <p>加载中...</p>
                </div>
              ) : rootTasks.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px', color: '#999' }}>
                  <div style={{ fontSize: '48px', marginBottom: '15px' }}>📝</div>
                  <h3>暂无任务</h3>
                  <p>点击上方输入框添加</p>
                </div>
              ) : (
                <>
                  {rootTasks.slice(0, visibleTaskCount).map(task => renderTask(task))}
                  {visibleTaskCount < rootTasks.length && (
                    <button onClick={() => setVisibleTaskCount(count => count + INITIAL_VISIBLE_TASKS)} style={{ width: '100%', padding: '10px', marginTop: '8px' }}>
                      加载更多（已显示 {visibleTaskCount}/{rootTasks.length}）
                    </button>
                  )}
                </>
              )}
            </>
          )}

          {/* Settings: AI, data management, and trash */}
          {showPage === 'settings' && (
            <div style={{ maxWidth: '760px', margin: '0 auto' }}>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '18px', background: 'white', padding: '10px', borderRadius: '8px' }}>
                {[
                  { id: 'ai' as const, label: 'AI 设置' },
                  { id: 'data' as const, label: '数据管理' },
                  { id: 'trash' as const, label: '回收站' },
                ].map(section => (
                  <button key={section.id} onClick={() => {
                    setSettingsSection(section.id)
                    if (section.id === 'trash') setView('trash')
                  }}
                    style={{ flex: 1, padding: '9px 12px', background: settingsSection === section.id ? '#3498db' : '#f5f5f5', color: settingsSection === section.id ? 'white' : '#344054', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
                    {section.label}
                  </button>
                ))}
              </div>

              {settingsSection === 'ai' && (
                <AISettingsPanel settings={aiSettings} onSaved={setAiSettings} />
              )}

              {settingsSection === 'data' && (
                <div>
                  <div style={{ background: 'white', borderRadius: '8px', padding: '20px', marginBottom: '20px' }}>
                    <h3 style={{ margin: '0 0 15px' }}>📤 导出数据</h3>
                    <button onClick={handleExport}
                      style={{ padding: '10px 20px', background: '#3498db', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
                      📄 导出 JSON
                    </button>
                  </div>
                  <div style={{ background: 'white', borderRadius: '8px', padding: '20px' }}>
                    <h3 style={{ margin: '0 0 15px' }}>📥 导入数据</h3>
                    <button onClick={handleImport}
                      style={{ padding: '10px 20px', background: '#27ae60', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
                      📂 选择文件导入
                    </button>
                  </div>
                </div>
              )}

              {settingsSection === 'trash' && (
                <div>
                  {trashTasks.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '60px', color: '#999', background: 'white', borderRadius: '8px' }}>
                      <div style={{ fontSize: '48px', marginBottom: '15px' }}>🗑️</div>
                      <h3>回收站为空</h3>
                    </div>
                  ) : trashTasks.map(task => (
                    <div key={task.id} style={{ background: 'white', borderRadius: '8px', padding: '16px', marginBottom: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontWeight: 500 }}>{task.title}</div>
                        <div style={{ fontSize: '12px', color: '#999', marginTop: '5px' }}>
                          删除于 {task.deletedAt ? new Date(task.deletedAt).toLocaleDateString('zh-CN') : '-'}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button onClick={() => void restoreTask(task.id)}
                          style={{ padding: '8px 16px', background: '#27ae60', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>
                          恢复
                        </button>
                        <button onClick={() => { if (confirm('确定要永久删除吗？')) void permanentlyDelete(task.id) }}
                          style={{ padding: '8px 16px', background: '#e74c3c', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>
                          永久删除
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {toastMessage && <div className="app-toast" role="status">✓ {toastMessage}</div>}

      {showCategoryManager && (
        <div className="category-manager-backdrop" role="presentation">
          <section className="category-manager" role="dialog" aria-modal="true" aria-labelledby="category-manager-title">
            <header className="category-manager__header">
              <div>
                <span>ORGANIZE</span>
                <h2 id="category-manager-title">分类管理</h2>
                <p>快速创建、删除分类，或调整左侧栏显示顺序。</p>
              </div>
              <button type="button" aria-label="关闭分类管理" onClick={() => setShowCategoryManager(false)}>✕</button>
            </header>

            <form className="category-manager__create" onSubmit={(event) => { event.preventDefault(); void handleCreateCategory() }}>
              <label htmlFor="new-category-name">新分类名称</label>
              <div>
                <input id="new-category-name" aria-label="新分类名称" value={newCategoryName}
                  onChange={event => { setNewCategoryName(event.target.value); setCategoryManagerError(null) }}
                  maxLength={80} autoFocus placeholder="例如：工作、学习、生活" />
                <button type="submit" disabled={projectsLoading || !newCategoryName.trim()}>创建分类</button>
              </div>
            </form>

            {(categoryManagerError || projectsError) && (
              <div className="category-manager__error" role="alert">{categoryManagerError || projectsError}</div>
            )}

            <div className="category-manager__list" aria-label="分类排序列表">
              {projects.length === 0 ? (
                <div className="category-manager__empty">暂无分类，在上方输入名称即可创建。</div>
              ) : projects.map((project, index) => (
                <div className="category-manager__row" key={project.id}>
                  <span className="category-manager__icon">{project.icon || '🏷️'}</span>
                  <span className="category-manager__name">{project.name}</span>
                  <div className="category-manager__order">
                    <button type="button" aria-label={`上移分类 ${project.name}`} disabled={projectsLoading || index === 0}
                      onClick={() => void handleMoveCategory(project.id, -1)}>↑</button>
                    <button type="button" aria-label={`下移分类 ${project.name}`} disabled={projectsLoading || index === projects.length - 1}
                      onClick={() => void handleMoveCategory(project.id, 1)}>↓</button>
                  </div>
                  <button type="button" className="category-manager__delete" aria-label={`删除分类 ${project.name}`}
                    disabled={projectsLoading} onClick={() => void handleDeleteCategory(project)}>删除</button>
                </div>
              ))}
            </div>

            <footer className="category-manager__footer">
              <span>删除分类不会删除任务，关联任务会转为未分类。</span>
              <button type="button" onClick={() => setShowCategoryManager(false)}>完成</button>
            </footer>
          </section>
        </div>
      )}

      {completionChoiceTaskId && (
        <div className="app-dialog-backdrop" role="presentation">
          <section className="app-dialog" role="dialog" aria-modal="true" aria-labelledby="completion-dialog-title">
            <div className="app-dialog__icon app-dialog__icon--warning">!</div>
            <div className="app-dialog__content">
              <h2 id="completion-dialog-title">还有未完成的子任务</h2>
              <p>“{tasks.find(task => task.id === completionChoiceTaskId)?.title}”包含未完成的子任务，请选择本次完成范围。</p>
            </div>
            <div className="app-dialog__actions app-dialog__actions--three">
              <button className="button-secondary" onClick={() => void resolveCompletionChoice('self')}>仅完成父任务</button>
              <button className="button-primary" onClick={() => void resolveCompletionChoice('withChildren')}>完成全部子任务</button>
              <button className="button-ghost" onClick={() => void resolveCompletionChoice('cancel')}>取消</button>
            </div>
          </section>
        </div>
      )}

      {pendingDetailExit && (
        <div className="app-dialog-backdrop" role="presentation">
          <section className="app-dialog" role="dialog" aria-modal="true" aria-labelledby="unsaved-dialog-title">
            <div className="app-dialog__icon">✎</div>
            <div className="app-dialog__content">
              <h2 id="unsaved-dialog-title">保存任务详情的改动？</h2>
              <p>你填写的内容尚未保存。保存后继续、不保存并继续，或取消本次操作。</p>
            </div>
            <div className="app-dialog__actions app-dialog__actions--three">
              <button className="button-primary" onClick={() => {
                const pending = pendingDetailExit
                void handleSaveDetail(!pending.isAppExit).then(saved => {
                  if (!saved) return
                  setPendingDetailExit(null)
                  pending.action()
                })
              }}>保存</button>
              <button className="button-secondary" onClick={() => {
                const pending = pendingDetailExit
                setPendingDetailExit(null)
                pending.action()
              }}>不保存</button>
              <button className="button-ghost" onClick={() => { pendingDetailExit.cancelAction?.(); setPendingDetailExit(null) }}>取消</button>
            </div>
          </section>
        </div>
      )}
      {/* Task Detail Panel */}
      {showDetail && detailDraft && showPage === 'tasks' && (
        <aside data-testid="task-detail-panel" className="task-detail-panel">
          <header className="task-detail-panel__header">
            <div>
              <span className="task-detail-panel__eyebrow">TODO</span>
              <h2>{detailMode === 'create' ? '新建任务详情' : '任务详情'}</h2>
            </div>
            <button className="task-detail-close" aria-label="关闭任务详情"
              onClick={() => requestDetailExit(closeDetail)}>✕</button>
          </header>

          <div className="task-detail-panel__body">
            {aiError && <div className="task-detail-inline-error" role="alert">⚠️ {aiError}</div>}

            <section className="task-detail-card">
              <div className="task-detail-card__heading">
                <span className="task-detail-card__icon">✎</span>
                <div><h3>基本信息</h3><p>任务名称、优先级和所属分类</p></div>
              </div>
              <div className="task-detail-field task-detail-field--full">
                <label htmlFor="detail-title">标题</label>
                <input id="detail-title" aria-label="任务标题" value={detailDraft.title}
                  onChange={(e) => setDetailDraft({ ...detailDraft, title: e.target.value })} />
              </div>
              <div className="task-detail-two-column">
                <div className="task-detail-field">
                  <label htmlFor="detail-priority">优先级</label>
                  <select id="detail-priority" aria-label="任务优先级" value={detailDraft.priority}
                    onChange={(e) => setDetailDraft({ ...detailDraft, priority: e.target.value as TaskPriority })}>
                    <option value="none">无优先级</option>
                    <option value="p1">🔴 P1</option><option value="p2">🟠 P2</option>
                    <option value="p3">🟡 P3</option><option value="p4">🔵 P4</option>
                  </select>
                </div>
                <div className="task-detail-field">
                  <label htmlFor="detail-category-select">已有分类</label>
                  <select id="detail-category-select" aria-label="已有分类" value={detailDraft.projectId}
                    onChange={(e) => {
                      const project = projects.find(item => item.id === e.target.value)
                      setDetailDraft({ ...detailDraft, projectId: project?.id ?? '', categoryName: project?.name ?? '' })
                    }}>
                    <option value="">未分类</option>
                    {projects.map(project => <option key={project.id} value={project.id}>{project.icon || '🏷️'} {project.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="task-detail-field task-detail-field--full">
                <label htmlFor="detail-category-name">新建或修改分类</label>
                <input id="detail-category-name" aria-label="新分类名称" value={detailDraft.categoryName}
                  onChange={(e) => {
                    const categoryName = e.target.value
                    const existing = projects.find(project => project.name.toLocaleLowerCase() === categoryName.trim().toLocaleLowerCase())
                    setDetailDraft({ ...detailDraft, categoryName, projectId: existing?.id ?? '' })
                  }} placeholder="输入分类名称，保存任务时自动添加" />
              </div>
            </section>

            <section className="task-detail-card">
              <div className="task-detail-card__heading task-detail-card__heading--action">
                <span className="task-detail-card__icon">◷</span>
                <div><h3>计划时间</h3><p>安排开始、截止和 Windows 提醒</p></div>
                {parentTask && (
                  <button type="button" className="task-detail-sync" onClick={() => setDetailDraft({
                    ...detailDraft,
                    scheduledAt: parentTask.scheduledAt
                      ? toDateTimeLocal(parentTask.scheduledAt)
                      : parentTask.scheduledDate ? `${parentTask.scheduledDate}T00:00` : '',
                    dueAt: toDateTimeLocal(parentTask.dueAt),
                  })}>与主任务同步</button>
                )}
              </div>
              <div className="task-detail-two-column task-detail-time-grid">
                <div className="task-detail-field">
                  <label htmlFor="detail-start">计划开始时间</label>
                  <input id="detail-start" aria-label="计划开始时间" type="datetime-local" value={detailDraft.scheduledAt}
                    onChange={(e) => setDetailDraft({ ...detailDraft, scheduledAt: e.target.value })} />
                </div>
                <div className="task-detail-field">
                  <label htmlFor="detail-due">计划截止时间</label>
                  <input id="detail-due" aria-label="计划截止时间" type="datetime-local" value={detailDraft.dueAt}
                    onChange={(e) => setDetailDraft({ ...detailDraft, dueAt: e.target.value })} />
                </div>
              </div>
              {warnings.length > 0 && <div data-testid="due-date-warning" className="task-detail-warning">⚠️ {warnings.join('; ')}</div>}

              {renderReminderEditor('start', '开始提醒', detailDraft.scheduledAt)}
              {renderReminderEditor('due', '截止提醒', detailDraft.dueAt)}            </section>

            <section className="task-detail-card">
              <div className="task-detail-card__heading">
                <span className="task-detail-card__icon">☰</span>
                <div><h3>补充内容</h3><p>备注和子任务</p></div>
              </div>
              <div className="task-detail-field task-detail-field--full">
                <label htmlFor="detail-note">备注</label>
                <textarea id="detail-note" aria-label="任务备注" value={detailDraft.note}
                  onChange={(e) => setDetailDraft({ ...detailDraft, note: e.target.value })}
                  placeholder="补充任务背景、要求或相关信息…" />
              </div>

              {currentTask && (
                <div className="task-detail-subtasks">
                  <div className="task-detail-subtasks__title">子任务 <span>{getChildren(currentTask.id).length}</span></div>
                  {getChildren(currentTask.id).map(child => (
                    <div key={child.id} className="task-detail-subtask-row">
                      <button aria-label={`切换子任务 ${child.title}`} onClick={() => handleToggleTask(child.id)}
                        className={child.status === 'done' ? 'subtask-check done' : 'subtask-check'} />
                      <span className={child.status === 'done' ? 'done' : ''}>{child.title}</span>
                      <button type="button" className="subtask-advanced" aria-label={`打开子任务详情 ${child.title}`}
                        onClick={(event) => { event.stopPropagation(); handleSelectTask(child) }}>高级</button>
                      <button aria-label={`删除子任务 ${child.title}`} className="subtask-delete"
                        onClick={() => handleDeleteTask(child.id)}>✕</button>
                    </div>
                  ))}
                  <input aria-label="添加子任务" type="text" placeholder="输入子任务后按 Enter"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                        void createTask({ title: e.currentTarget.value.trim(), parentId: currentTask.id })
                        e.currentTarget.value = ''
                      }
                    }} />
                </div>
              )}
            </section>

            {currentTask && (
              <section className="task-detail-card task-detail-operations">
                <div className="task-detail-card__heading">
                  <span className="task-detail-card__icon">⋯</span>
                  <div><h3>任务操作</h3><p>调整层级或管理当前任务</p></div>
                </div>
                <div className="task-detail-operation-grid">
                  <button className="success" onClick={() => handleToggleTask(currentTask.id)}>
                    {currentTask.status === 'done' ? '恢复任务' : '完成任务'}
                  </button>
                  <button onClick={() => void copyTask(currentTask.id, true)}>复制任务</button>
                  <button onClick={() => indentTask(currentTask.id).catch((e) => alert(e.message || '设为子任务失败'))}
                    disabled={!canMakeChildOfPrevious}
                    title={canMakeChildOfPrevious ? '把当前任务放到上一条同级任务下面' : '前面没有同级任务，不能设为子任务'}>
                    设为上一项的子任务
                  </button>
                  <button onClick={() => outdentTask(currentTask.id).catch((e) => alert(e.message || '移到上一级失败'))}
                    disabled={!canMoveToParentLevel}
                    title={canMoveToParentLevel ? '把当前任务移到其上级任务所在的层级' : '当前已经是顶级任务'}>
                    移到上一级
                  </button>
                  <button className="danger" onClick={() => handleDeleteTask(currentTask.id)}>删除任务</button>
                </div>
              </section>
            )}
          </div>

          <footer className="task-detail-panel__footer">
            <button className="task-detail-cancel" onClick={() => requestDetailExit(closeDetail)}>取消</button>
            <button className="task-detail-save" aria-label="保存" onClick={() => void handleSaveDetail()}>保存任务</button>
          </footer>
        </aside>
      )}
    </div>
  )
}

export default App
