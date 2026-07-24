/**
 * EZTODO Desktop Application
 * Full-featured Todo app with Repository pattern
 */

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useTaskStore } from './stores/task-store'
import { useProjectStore } from './stores/project-store'
import { useTagStore } from './stores/tag-store'
import type { Task, ViewType, TaskPriority, TaskStatus, SortField } from './lib/repositories'
import { exportTasks, downloadExport } from './lib/export'
import { importTasks } from './lib/import'
import { AISettingsPanel } from './components/settings'
import { parseTaskWithAI, type AIParsedTask, type AIParseResult } from './lib/ai-client'
import {
  DEFAULT_AI_SETTINGS,
  getSessionApiKey,
  loadAISettings,
  type AIProviderSettings,
} from './lib/ai-settings'

const INITIAL_VISIBLE_TASKS = 20

/**
 * Debounced text input — saves after 400ms of inactivity instead of every keystroke
 */
function DebouncedInput({ value, onSave, style, placeholder }: { value: string; onSave: (val: string) => void; style?: React.CSSProperties; placeholder?: string }) {
  const [localValue, setLocalValue] = useState(value)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { setLocalValue(value) }, [value])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = e.target.value
    setLocalValue(newVal)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => onSave(newVal), 400)
  }

  return <input type="text" value={localValue} onChange={handleChange} style={style} placeholder={placeholder} />
}

/**
 * Debounced textarea — saves after 400ms of inactivity instead of every keystroke
 */
function DebouncedTextarea({ value, onSave, style, placeholder }: { value: string; onSave: (val: string) => void; style?: React.CSSProperties; placeholder?: string }) {
  const [localValue, setLocalValue] = useState(value)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { setLocalValue(value) }, [value])

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newVal = e.target.value
    setLocalValue(newVal)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => onSave(newVal), 400)
  }

  return <textarea value={localValue} onChange={handleChange} style={style} placeholder={placeholder} />
}

const App: React.FC = () => {
  const {
    tasks, currentTask, currentView, selectedTaskIds,
    isLoading, error, warnings, undoableBatch, filters,
    setView, setFilters, clearFilters, loadTasks, createTask, updateTask, deleteTask,
    completeTask, uncompleteTask, restoreTask, permanentlyDelete,
    searchTasks, setCurrentTask,
    toggleSelection, selectAll, clearSelection,
    batchComplete, batchDelete, batchSetPriority, batchMoveToProject, batchAddTag, batchRemoveTag,
    undoLastBatch, indentTask, outdentTask, copyTask, reorderSiblingTasks,
  } = useTaskStore()

  const { projects, loadProjects } = useProjectStore()
  const { tags, loadTags } = useTagStore()

  const [inputValue, setInputValue] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [showPage, setShowPage] = useState<'tasks' | 'trash' | 'data' | 'ai' | 'settings'>('tasks')
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set())
  const [showFilters, setShowFilters] = useState(false)
  const [aiInput, setAiInput] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiCreating, setAiCreating] = useState(false)
  const [aiResult, setAiResult] = useState<AIParseResult | null>(null)
  const [aiError, setAiError] = useState<string | null>(null)
  const [aiSettings, setAiSettings] = useState<AIProviderSettings>(DEFAULT_AI_SETTINGS)
  const [showDetail, setShowDetail] = useState(false)
  const [visibleTaskCount, setVisibleTaskCount] = useState(INITIAL_VISIBLE_TASKS)

  // Load initial data
  useEffect(() => {
    loadTasks()
    loadProjects()
    loadTags()
    loadAISettings().then(setAiSettings).catch(error => {
      console.error('Failed to load AI settings:', error)
    })
  }, [])

  useEffect(() => {
    setVisibleTaskCount(INITIAL_VISIBLE_TASKS)
  }, [currentView, filters])

  // Filtering is handled by the store/repository layer via setFilters
  const rootTasks = tasks.filter(t => !t.parentId)
  const trashTasks = tasks.filter(t => t.deletedAt)

  // Task operations
  const handleAddTask = useCallback(async () => {
    if (!inputValue.trim()) return
    try {
      await createTask({ title: inputValue.trim() })
      setInputValue('')
    } catch (error) {
      console.error('Failed to create task:', error)
    }
  }, [inputValue, createTask])

  const handleToggleTask = useCallback(async (id: string) => {
    const task = tasks.find(t => t.id === id)
    if (!task) return
    try {
      if (task.status === 'done') {
        // Ask if user wants to reopen completed children too
        const reopenChildren = window.confirm('是否同时恢复已完成的子任务？')
        await uncompleteTask(id, reopenChildren)
      } else {
        await completeTask(id)
      }
    } catch (error) {
      if (error instanceof Error && error.message === 'HAS_UNCOMPLETED_CHILDREN') {
        // Show 3-option dialog
        const choice = window.prompt(
          '该任务有未完成的子任务，请选择：\n1 = 仅完成父任务\n2 = 同时完成所有子任务\n3 = 取消',
          '3'
        )
        if (choice === '1') {
          await completeTask(id, 'self')
        } else if (choice === '2') {
          await completeTask(id, 'withChildren')
        }
        // choice === '3' or cancel → do nothing
      } else {
        console.error('Failed to toggle task:', error)
      }
    }
  }, [tasks, completeTask, uncompleteTask])

  const handleDeleteTask = useCallback(async (id: string) => {
    try {
      await deleteTask(id)
      if (currentTask?.id === id) {
        setCurrentTask(null)
        setShowDetail(false)
      }
    } catch (error) {
      console.error('Failed to delete task:', error)
    }
  }, [deleteTask, currentTask, setCurrentTask])

  const handleSelectTask = useCallback((task: Task) => {
    setCurrentTask(task)
    setShowDetail(true)
  }, [setCurrentTask])

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

  /** AI Parse → editable confirmation card (does not write to DB). */
  const handleAIParse = async () => {
    if (!aiInput.trim()) return
    if (!getSessionApiKey()) {
      setAiError('请先在设置中填写 API Key')
      setShowPage('settings')
      return
    }

    setAiLoading(true)
    setAiError(null)
    setAiResult(null)
    try {
      const result = await parseTaskWithAI(aiInput, aiSettings, getSessionApiKey())
      setAiResult(result)
    } catch (error) {
      console.error('AI parse failed:', error)
      setAiError(error instanceof Error ? error.message : 'AI 解析失败')
    } finally {
      setAiLoading(false)
    }
  }

  const updateAIParsedTask = (index: number, updates: Partial<AIParsedTask>) => {
    setAiResult(current => current ? {
      ...current,
      tasks: current.tasks.map((task, taskIndex) => taskIndex === index ? { ...task, ...updates } : task),
    } : current)
  }

  const createAIParsedTask = useCallback(async (task: AIParsedTask, parentId?: string): Promise<void> => {
    const created = await createTask({
      title: task.title,
      parentId,
      note: task.note,
      priority: task.priority,
      scheduledDate: task.scheduledDate,
      scheduledAt: task.scheduledAt,
      dueAt: task.dueAt,
      estimatedMinutes: task.estimatedMinutes,
      source: 'ai',
    })

    for (const subtask of task.subtasks) {
      await createAIParsedTask(subtask, created.id)
    }
  }, [createTask])

  // Confirm AI-parsed tasks and write only after explicit user confirmation.
  const handleAIConfirm = useCallback(async () => {
    if (!aiResult || aiCreating) return
    const invalidTask = aiResult.tasks.find(task => !task.title.trim())
    if (invalidTask) {
      setAiError('任务标题不能为空')
      return
    }

    setAiCreating(true)
    setAiError(null)
    try {
      for (const task of aiResult.tasks) {
        await createAIParsedTask(task)
      }
      setAiResult(null)
      setAiInput('')
      setShowPage('tasks')
    } catch (error) {
      console.error('AI confirm failed:', error)
      setAiError(error instanceof Error ? error.message : '创建任务失败')
    } finally {
      setAiCreating(false)
    }
  }, [aiResult, aiCreating, createAIParsedTask])

  // Cancel AI confirmation (no DB write)
  const handleAICancel = useCallback(() => {
    setAiResult(null)
    setAiError(null)
  }, [])

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

  const getPriorityIcon = (p: string) => {
    switch (p) {
      case 'p1': return '🔴'
      case 'p2': return '🟠'
      case 'p3': return '🟡'
      case 'p4': return '🔵'
      default: return '⚪'
    }
  }

  const getProjectName = (id?: string | null) => {
    if (!id) return '📥 收件箱'
    const p = projects.find(x => x.id === id)
    return p ? `${p.icon || '📁'} ${p.name}` : '📥 收件箱'
  }

  const getChildren = (parentId: string) => tasks.filter(t => t.parentId === parentId)

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

  // Render task card
  const renderTask = (task: Task, depth = 0) => {    const children = getChildren(task.id)
    const isExpanded = expandedTasks.has(task.id)
    const progress = getProgress(task.id)
    const isSelected = selectedTaskIds.has(task.id)

    return (
      <React.Fragment key={task.id}>
        <div
          onClick={() => handleSelectTask(task)}
          style={{
            background: 'white', borderRadius: '8px', padding: '12px 16px', marginBottom: '8px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderLeft: `4px solid ${getPriorityColor(task.priority)}`,
            marginLeft: `${depth * 24}px`, display: 'flex', alignItems: 'center', gap: '10px',
            cursor: 'pointer', opacity: task.status === 'done' ? 0.7 : 1,
          }}
        >
          <div
            onClick={(e) => { e.stopPropagation(); handleToggleTask(task.id) }}
            style={{
              width: '20px', height: '20px',
              border: `2px solid ${task.status === 'done' ? '#27ae60' : '#ddd'}`,
              borderRadius: '50%',
              background: task.status === 'done' ? '#27ae60' : 'transparent',
              cursor: 'pointer', flexShrink: 0,
            }}
          />
          {children.length > 0 && (
            <div
              onClick={(e) => { e.stopPropagation(); toggleExpand(task.id) }}
              style={{ cursor: 'pointer', fontSize: '12px', color: '#666' }}
            >
              {isExpanded ? '▼' : '▶'}
            </div>
          )}
          <div style={{ flex: 1 }}>
            <div style={{
              fontWeight: 500,
              textDecoration: task.status === 'done' ? 'line-through' : 'none',
              color: task.status === 'done' ? '#999' : '#333',
            }}>
              {task.title}
            </div>
            <div style={{ fontSize: '12px', color: '#999', marginTop: '4px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <span>{getPriorityIcon(task.priority)}</span>
              {task.projectId && <span>{getProjectName(task.projectId)}</span>}
              {task.scheduledDate && <span>📅 {task.scheduledDate}</span>}
              {progress && <span>📊 {progress.done}/{progress.total}</span>}
            </div>
          </div>
          <button aria-label="上移任务" onClick={(e) => { e.stopPropagation(); void moveTaskRelative(task, -1) }} style={{ border: 0, background: 'transparent', cursor: 'pointer' }}>↑</button>
          <button aria-label="下移任务" onClick={(e) => { e.stopPropagation(); void moveTaskRelative(task, 1) }} style={{ border: 0, background: 'transparent', cursor: 'pointer' }}>↓</button>
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
    <div style={{ display: 'flex', height: '100vh', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      {/* Sidebar */}
      <div style={{ width: '240px', background: '#2c3e50', color: 'white', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px', borderBottom: '1px solid #34495e' }}>
          <h2 style={{ margin: 0 }}>📋 EZTODO</h2>
          <div style={{ fontSize: '12px', opacity: 0.7, marginTop: '5px' }}>v1.0.0 | P0-2</div>
        </div>

        <nav style={{ flex: 1, padding: '10px', overflow: 'auto' }}>
          <div style={{ fontSize: '11px', opacity: 0.6, padding: '5px 10px', textTransform: 'uppercase' }}>视图</div>
          {[
            { id: 'inbox' as ViewType, icon: '📥', label: '收件箱' },
            { id: 'today' as ViewType, icon: '📅', label: '今天' },
            { id: 'week' as ViewType, icon: '📆', label: '未来 7 天' },
            { id: 'overdue' as ViewType, icon: '⚠️', label: '已逾期' },
            { id: 'no-date' as ViewType, icon: '📋', label: '无日期' },
            { id: 'completed' as ViewType, icon: '✅', label: '已完成' },
          ].map(item => (
            <div
              key={item.id}
              onClick={() => { setView(item.id); setShowPage('tasks'); clearSelection() }}
              style={{
                padding: '10px 12px', borderRadius: '6px', cursor: 'pointer', marginBottom: '4px',
                background: currentView === item.id && showPage === 'tasks' ? '#3498db' : 'transparent',
              }}
            >
              <span style={{ marginRight: '10px' }}>{item.icon}</span>
              {item.label}
            </div>
          ))}

          <div style={{ fontSize: '11px', opacity: 0.6, padding: '15px 10px 5px', textTransform: 'uppercase' }}>项目</div>
          {projects.map(p => (
            <div key={p.id} style={{ padding: '10px 12px', borderRadius: '6px', cursor: 'pointer', marginBottom: '4px' }}>
              <span style={{ marginRight: '10px' }}>{p.icon || '📁'}</span>
              {p.name}
            </div>
          ))}

          <div style={{ borderTop: '1px solid #34495e', marginTop: '15px', paddingTop: '10px' }}>
            {[
              { id: 'trash' as const, icon: '🗑️', label: '回收站' },
              { id: 'data' as const, icon: '📦', label: '数据管理' },
              { id: 'ai' as const, icon: '🤖', label: 'AI 创建' },
              { id: 'settings' as const, icon: '⚙️', label: '设置' },
            ].map(item => (
              <div
                key={item.id}
                onClick={() => { setShowPage(item.id); clearSelection() }}
                style={{
                  padding: '10px 12px', borderRadius: '6px', cursor: 'pointer', marginBottom: '4px',
                  background: showPage === item.id ? '#3498db' : 'transparent',
                }}
              >
                {item.icon} {item.label}
              </div>
            ))}
          </div>
        </nav>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f5f5f5' }}>
        {/* Header */}
        <div style={{ padding: '15px 20px', background: 'white', borderBottom: '1px solid #ddd', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ margin: 0, fontSize: '20px' }}>
            {showPage === 'tasks' && (
              <>
                {currentView === 'inbox' && '📥 收件箱'}
                {currentView === 'today' && '📅 今天'}
                {currentView === 'week' && '📆 未来 7 天'}
                {currentView === 'overdue' && '⚠️ 已逾期'}
                {currentView === 'no-date' && '📋 无日期'}
                {currentView === 'completed' && '✅ 已完成'}
              </>
            )}
            {showPage === 'trash' && '🗑️ 回收站'}
            {showPage === 'data' && '📦 数据管理'}
            {showPage === 'ai' && '🤖 AI 创建'}
            {showPage === 'settings' && '⚙️ 设置'}
          </h1>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="🔍 搜索..."
              style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: '6px', width: '180px' }}
            />
            <button
              onClick={() => setShowFilters(!showFilters)}
              style={{ padding: '8px 12px', background: showFilters ? '#3498db' : '#f8f9fa', border: '1px solid #ddd', borderRadius: '6px', cursor: 'pointer' }}
            >
              🔽 筛选
            </button>
          </div>
        </div>

        {/* Filters and sorting — all state is passed through Store -> Repository */}
        {showFilters && (
          <div style={{ padding: '10px 20px', background: '#f8f9fa', borderBottom: '1px solid #ddd', display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
            <select aria-label="项目筛选" value={filters.projectId || ''} onChange={(e) => setFilters({ ...filters, projectId: e.target.value || undefined })}>
              <option value="">所有项目</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.icon || '📁'} {p.name}</option>)}
            </select>
            <select aria-label="标签筛选" value={filters.tagIds?.[0] || ''} onChange={(e) => setFilters({ ...filters, tagIds: e.target.value ? [e.target.value] : undefined })}>
              <option value="">所有标签</option>
              {tags.map(tag => <option key={tag.id} value={tag.id}>{tag.name}</option>)}
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
            <label style={{ display: 'flex', gap: '5px', alignItems: 'center', fontSize: '13px' }}>
              <input type="checkbox" checked={Boolean(filters.parentOnly)} onChange={(e) => setFilters({ ...filters, parentOnly: e.target.checked || undefined })} />
              仅父任务
            </label>
            <button onClick={() => setExpandedTasks(new Set(tasks.map(task => task.id)))}>展开全部子任务</button>
            <button onClick={() => setExpandedTasks(new Set())}>收起全部</button>
            {(filters.projectId || filters.priority || filters.status || filters.tagIds?.length || filters.search || filters.parentOnly || filters.sort) && (
              <button onClick={() => { setSearchQuery(''); clearFilters() }}
                style={{ padding: '6px 10px', background: '#e74c3c', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>
                清除筛选
              </button>
            )}
          </div>
        )}

        {/* Undo banner — visible whenever there is something to undo, independent of selection */}
        {undoableBatch && (
          <div data-testid="undo-banner" style={{ padding: '10px 20px', background: '#fff3e0', borderBottom: '1px solid #ffe0b2', display: 'flex', alignItems: 'center', gap: '15px' }}>
            <span style={{ fontSize: '14px', color: '#e65100' }}>
              ↩️ 上次操作：{undoableBatch.operation}（{undoableBatch.count} 项）
            </span>
            <button
              onClick={() => undoLastBatch()}
              data-testid="undo-button"
              style={{ padding: '6px 16px', background: '#ff9800', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>
              撤销
            </button>
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
              aria-label="批量移动到项目"
              defaultValue=""
              onChange={(event) => {
                const value = event.currentTarget.value
                event.currentTarget.value = ''
                if (value) void batchMoveToProject(value === '__none__' ? null : value)
              }}
              style={{ padding: '6px 10px', border: '1px solid #90caf9', borderRadius: '4px', fontSize: '12px' }}
            >
              <option value="" disabled>📁 移动项目</option>
              <option value="__none__">无项目</option>
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
            </select>            <select
              aria-label="批量添加标签"
              defaultValue=""
              onChange={(event) => {
                const tagId = event.currentTarget.value
                event.currentTarget.value = ''
                if (tagId) void batchAddTag(tagId)
              }}
              style={{ padding: '6px 10px', border: '1px solid #90caf9', borderRadius: '4px', fontSize: '12px' }}
            >
              <option value="" disabled>🏷️ 添加标签</option>
              {tags.map((tag) => <option key={tag.id} value={tag.id}>{tag.name}</option>)}
            </select>
            <select
              aria-label="批量移除标签"
              defaultValue=""
              onChange={(event) => {
                const tagId = event.currentTarget.value
                event.currentTarget.value = ''
                if (tagId) void batchRemoveTag(tagId)
              }}
              style={{ padding: '6px 10px', border: '1px solid #90caf9', borderRadius: '4px', fontSize: '12px' }}
            >
              <option value="" disabled>🏷️ 移除标签</option>
              {tags.map((tag) => <option key={tag.id} value={tag.id}>{tag.name}</option>)}
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

        {/* Quick Add */}
        {showPage === 'tasks' && (
          <div style={{ padding: '12px 20px', background: 'white', borderBottom: '1px solid #ddd', display: 'flex', gap: '10px' }}>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddTask()}
              placeholder="添加任务..."
              style={{ flex: 1, padding: '10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px' }}
            />
            <button onClick={handleAddTask}
              style={{ padding: '10px 20px', background: '#3498db', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
              添加
            </button>
          </div>
        )}

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '15px 20px' }}>
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

          {/* Trash View */}
          {showPage === 'trash' && (
            <>
              {trashTasks.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px', color: '#999' }}>
                  <div style={{ fontSize: '48px', marginBottom: '15px' }}>🗑️</div>
                  <h3>回收站为空</h3>
                </div>
              ) : (
                trashTasks.map(task => (
                  <div key={task.id} style={{
                    background: 'white', borderRadius: '8px', padding: '16px', marginBottom: '12px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  }}>
                    <div>
                      <div style={{ fontWeight: 500 }}>{task.title}</div>
                      <div style={{ fontSize: '12px', color: '#999', marginTop: '5px' }}>
                        删除于 {task.deletedAt ? new Date(task.deletedAt).toLocaleDateString('zh-CN') : '-'}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button onClick={() => restoreTask(task.id)}
                        style={{ padding: '8px 16px', background: '#27ae60', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>
                        恢复
                      </button>
                      <button onClick={() => { if (confirm('确定要永久删除吗？')) permanentlyDelete(task.id) }}
                        style={{ padding: '8px 16px', background: '#e74c3c', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>
                        永久删除
                      </button>
                    </div>
                  </div>
                ))
              )}
            </>
          )}

          {/* Data Management View */}
          {showPage === 'data' && (
            <div style={{ maxWidth: '600px', margin: '0 auto' }}>
              <div style={{ background: 'white', borderRadius: '8px', padding: '20px', marginBottom: '20px' }}>
                <h3 style={{ margin: '0 0 15px' }}>📤 导出数据</h3>
                <button onClick={handleExport}
                  style={{ padding: '10px 20px', background: '#3498db', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
                  📄 导出 JSON
                </button>
              </div>
              <div style={{ background: 'white', borderRadius: '8px', padding: '20px', marginBottom: '20px' }}>
                <h3 style={{ margin: '0 0 15px' }}>📥 导入数据</h3>
                <button onClick={handleImport}
                  style={{ padding: '10px 20px', background: '#27ae60', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
                  📂 选择文件导入
                </button>
              </div>
              <div style={{ background: 'white', borderRadius: '8px', padding: '20px' }}>
                <h3 style={{ margin: '0 0 15px' }}>📊 统计</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px' }}>
                  <div style={{ textAlign: 'center', padding: '15px', background: '#f8f9fa', borderRadius: '6px' }}>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#3498db' }}>{tasks.filter(t => t.status === 'todo').length}</div>
                    <div style={{ fontSize: '12px', color: '#666' }}>待办</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: '15px', background: '#f8f9fa', borderRadius: '6px' }}>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#27ae60' }}>{tasks.filter(t => t.status === 'done').length}</div>
                    <div style={{ fontSize: '12px', color: '#666' }}>已完成</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: '15px', background: '#f8f9fa', borderRadius: '6px' }}>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#e74c3c' }}>{trashTasks.length}</div>
                    <div style={{ fontSize: '12px', color: '#666' }}>回收站</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* AI View */}
          {showPage === 'ai' && (
            <div style={{ maxWidth: '600px', margin: '0 auto' }}>
              {aiError && (
                <div role="alert" style={{ padding: '12px 15px', background: '#fef3f2', color: '#b42318', borderRadius: '6px', marginBottom: '15px' }}>
                  ⚠️ {aiError}
                </div>
              )}
              <div style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', borderRadius: '8px', padding: '30px', color: 'white', marginBottom: '20px' }}>
                <h2 style={{ margin: '0 0 10px' }}>🤖 AI 智能创建</h2>
                <p style={{ margin: 0, opacity: 0.9 }}>使用 {aiSettings.providerName} / {aiSettings.model} 解析，确认后才会创建任务</p>
              </div>
              <div style={{ background: 'white', borderRadius: '8px', padding: '20px' }}>
                <textarea
                  value={aiInput}
                  onChange={(e) => { setAiInput(e.target.value); setAiResult(null); setAiError(null) }}
                  placeholder="例如：明天下午三点开会，提前一小时提醒"
                  style={{ width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '6px', minHeight: '100px', fontSize: '14px', resize: 'vertical' }}
                />
                <button
                  onClick={handleAIParse}
                  disabled={aiLoading || !aiInput.trim()}
                  style={{ marginTop: '15px', padding: '12px 24px', background: aiLoading ? '#95a5a6' : '#9b59b6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', width: '100%', fontSize: '16px' }}
                >
                  {aiLoading ? '⏳ 解析中...' : '🤖 解析'}
                </button>

                {/* Confirmation Card — user must confirm before task is created */}
                {aiResult && (
                  <div style={{ marginTop: '20px', border: '2px solid #9b59b6', borderRadius: '8px', padding: '16px', background: '#f8f0ff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#9b59b6' }}>📋 确认创建 {aiResult.tasks.length} 个任务</div>
                      <span style={{ fontSize: '12px', color: '#667085' }}>置信度：{aiResult.confidence}</span>
                    </div>
                    {aiResult.warnings.map((warning, index) => (
                      <div key={index} style={{ fontSize: '12px', color: '#8a5a00', marginBottom: '8px' }}>⚠️ {warning}</div>
                    ))}
                    {aiResult.tasks.map((task, index) => (
                      <div key={index} style={{ background: 'white', border: '1px solid #e4d7f4', borderRadius: '6px', padding: '12px', marginBottom: '10px' }}>
                        <label style={{ fontSize: '12px', color: '#666' }}>标题</label>
                        <input
                          aria-label={`AI 任务 ${index + 1} 标题`}
                          type="text"
                          value={task.title}
                          onChange={(e) => updateAIParsedTask(index, { title: e.target.value })}
                          style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', margin: '4px 0 8px' }}
                        />
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                          <select
                            aria-label={`AI 任务 ${index + 1} 优先级`}
                            value={task.priority}
                            onChange={(e) => updateAIParsedTask(index, { priority: e.target.value as TaskPriority })}
                            style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                          >
                            <option value="none">无优先级</option>
                            <option value="p1">🔴 P1</option><option value="p2">🟠 P2</option>
                            <option value="p3">🟡 P3</option><option value="p4">🔵 P4</option>
                          </select>
                          <input
                            aria-label={`AI 任务 ${index + 1} 计划日期`}
                            type="date"
                            value={task.scheduledDate || ''}
                            onChange={(e) => updateAIParsedTask(index, { scheduledDate: e.target.value || undefined })}
                            style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                          />
                        </div>
                        {task.subtasks.length > 0 && (
                          <div style={{ fontSize: '12px', color: '#667085', marginTop: '8px' }}>
                            子任务：{task.subtasks.map(subtask => subtask.title).join('、')}
                          </div>
                        )}
                      </div>
                    ))}
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button onClick={handleAIConfirm} disabled={aiCreating}
                        style={{ flex: 1, padding: '10px', background: '#27ae60', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' }}>
                        {aiCreating ? '创建中…' : '✅ 确认创建'}
                      </button>
                      <button onClick={handleAICancel} disabled={aiCreating}
                        style={{ flex: 1, padding: '10px', background: '#e74c3c', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' }}>
                        ❌ 取消
                      </button>
                    </div>
                  </div>
                )}

                <div style={{ marginTop: '20px' }}>
                  <div style={{ fontSize: '12px', color: '#666', marginBottom: '10px' }}>💡 示例：</div>
                  {['明天下午三点交报告', '每周一三五晚上八点跑步', '做实验报告，分成收集数据、画图、写分析'].map((ex, i) => (
                    <div key={i} onClick={() => setAiInput(ex)}
                      style={{ padding: '10px', background: '#f8f9fa', borderRadius: '6px', cursor: 'pointer', marginBottom: '8px', fontSize: '14px' }}>
                      💬 {ex}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Settings View */}
          {showPage === 'settings' && (
            <AISettingsPanel settings={aiSettings} onSaved={setAiSettings} />
          )}
        </div>
      </div>

      {/* Task Detail Panel */}
      {showDetail && currentTask && showPage === 'tasks' && (
        <div style={{ width: '350px', background: 'white', borderLeft: '1px solid #ddd', padding: '20px', overflow: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
            <h2 style={{ margin: 0, fontSize: '16px' }}>任务详情</h2>
            <button onClick={() => { setShowDetail(false); setCurrentTask(null) }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px' }}>✕</button>
          </div>

          <div style={{ marginBottom: '15px' }}>
            <DebouncedInput
              value={currentTask.title}
              onSave={(val) => updateTask(currentTask.id, { title: val })}
              style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '15px' }}
            />
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '5px' }}>优先级</label>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {(['p1', 'p2', 'p3', 'p4', 'none'] as const).map(p => (
                <button key={p} onClick={() => updateTask(currentTask.id, { priority: p })}
                  style={{
                    padding: '6px 10px', fontSize: '11px',
                    border: currentTask.priority === p ? `2px solid ${getPriorityColor(p)}` : '2px solid #ddd',
                    borderRadius: '4px', cursor: 'pointer',
                    background: currentTask.priority === p ? `${getPriorityColor(p)}20` : 'white',
                  }}>
                  {getPriorityIcon(p)} {p.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '5px' }}>项目</label>
            <select value={currentTask.projectId || ''} onChange={(e) => updateTask(currentTask.id, { projectId: e.target.value || undefined })}
              style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '6px' }}>
              <option value="">无项目</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.icon || '📁'} {p.name}</option>)}
            </select>
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '5px' }}>计划日期</label>
            <input type="date" value={currentTask.scheduledDate || ''}
              onChange={(e) => updateTask(currentTask.id, { scheduledDate: e.target.value || undefined })}
              style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '6px' }} />
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '5px' }}>截止时间</label>
            <input type="datetime-local" value={currentTask.dueAt ? currentTask.dueAt.slice(0, 16) : ''}
              onChange={(e) => updateTask(currentTask.id, { dueAt: e.target.value ? new Date(e.target.value).toISOString() : undefined })}
              style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '6px' }} />
            {warnings.length > 0 && (
              <div data-testid="due-date-warning" style={{ marginTop: '6px', padding: '6px 10px', background: '#fff3cd', color: '#856404', borderRadius: '4px', fontSize: '12px' }}>
                ⚠️ {warnings.join('; ')}
              </div>
            )}
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '5px' }}>备注</label>
            <DebouncedTextarea
              value={currentTask.note || ''}
              onSave={(val) => updateTask(currentTask.id, { note: val })}
              placeholder="添加备注..."
              style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '6px', minHeight: '60px' }}
            />
          </div>

          {/* Subtasks */}
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '5px' }}>子任务</label>
            {getChildren(currentTask.id).map(child => (
              <div key={child.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0', borderBottom: '1px solid #f0f0f0' }}>
                <div onClick={() => handleToggleTask(child.id)}
                  style={{ width: '16px', height: '16px', border: `2px solid ${child.status === 'done' ? '#27ae60' : '#ddd'}`,
                    borderRadius: '50%', background: child.status === 'done' ? '#27ae60' : 'transparent', cursor: 'pointer' }} />
                <span style={{ flex: 1, fontSize: '13px', textDecoration: child.status === 'done' ? 'line-through' : 'none' }}>{child.title}</span>
                <button onClick={() => handleDeleteTask(child.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', color: '#e74c3c' }}>✕</button>
              </div>
            ))}
            <div style={{ display: 'flex', gap: '5px', marginTop: '8px' }}>
              <input type="text" placeholder="添加子任务..."
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    const input = e.target as HTMLInputElement
                    createTask({ title: input.value, parentId: currentTask.id })
                    input.value = ''
                  }
                }}
                style={{ flex: 1, padding: '6px 8px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '12px' }} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
            <button onClick={() => handleToggleTask(currentTask.id)}
              style={{ flex: 1, padding: '10px', background: currentTask.status === 'done' ? '#6c757d' : '#28a745', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
              {currentTask.status === 'done' ? '恢复' : '完成'}
            </button>
            <button onClick={() => void copyTask(currentTask.id, true)}
              style={{ padding: '10px 15px', background: '#3498db', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
              复制
            </button>
            <button onClick={() => handleDeleteTask(currentTask.id)}              style={{ padding: '10px 15px', background: '#dc3545', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
              删除
            </button>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={() => indentTask(currentTask.id).catch((e) => alert(e.message || '缩进失败'))}
              style={{ flex: 1, padding: '8px', background: '#6c757d', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>
              → 缩进
            </button>
            <button onClick={() => outdentTask(currentTask.id).catch((e) => alert(e.message || '提升失败'))}
              disabled={!currentTask.parentId}
              style={{ flex: 1, padding: '8px', background: currentTask.parentId ? '#6c757d' : '#ccc', color: 'white', border: 'none', borderRadius: '6px', cursor: currentTask.parentId ? 'pointer' : 'default', fontSize: '12px' }}>
              ← 提升
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
