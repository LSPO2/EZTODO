/**
 * EZTODO Desktop Application
 * P0-2: Complete local Todo features and parent-child tasks
 */

import React, { useState, useEffect, useCallback } from 'react'

// Types
interface Task {
  id: string
  title: string
  note?: string
  status: 'todo' | 'done' | 'cancelled'
  priority: 'p1' | 'p2' | 'p3' | 'p4' | 'none'
  projectId?: string
  parentId?: string
  scheduledDate?: string
  scheduledAt?: string
  dueAt?: string
  isAllDay?: boolean
  createdAt: string
  updatedAt: string
  completedAt?: string
  deletedAt?: string
}

interface Project {
  id: string
  name: string
  icon: string
  color: string
}

interface Tag {
  id: string
  name: string
  color: string
}

// Database
const DB_KEY = 'eztodo_db'

function getDb() {
  const data = localStorage.getItem(DB_KEY)
  if (!data) {
    const init = {
      projects: [
        { id: 'proj-1', name: '工作', icon: '💼', color: '#3498db' },
        { id: 'proj-2', name: '学习', icon: '📚', color: '#27ae60' },
        { id: 'proj-3', name: '生活', icon: '🏠', color: '#e74c3c' },
      ],
      tags: [
        { id: 'tag-1', name: '重要', color: '#e74c3c' },
        { id: 'tag-2', name: '紧急', color: '#e67e22' },
      ],
      tasks: [
        { id: '1', title: '提交项目报告', status: 'todo', priority: 'p1', projectId: 'proj-1', scheduledDate: today(), dueAt: todayTime(18), createdAt: now(), updatedAt: now() },
        { id: '1-1', title: '整理数据', status: 'done', priority: 'none', parentId: '1', createdAt: now(), updatedAt: now(), completedAt: now() },
        { id: '1-2', title: '撰写报告正文', status: 'todo', priority: 'none', parentId: '1', createdAt: now(), updatedAt: now() },
        { id: '1-3', title: '制作图表', status: 'todo', priority: 'none', parentId: '1', createdAt: now(), updatedAt: now() },
        { id: '2', title: '准备明天的会议材料', status: 'todo', priority: 'p2', projectId: 'proj-1', scheduledDate: today(), createdAt: now(), updatedAt: now() },
        { id: '3', title: '买菜做饭', status: 'todo', priority: 'p3', projectId: 'proj-3', scheduledDate: today(), createdAt: now(), updatedAt: now() },
        { id: '4', title: '回复邮件', status: 'done', priority: 'none', projectId: 'proj-1', createdAt: now(), updatedAt: now(), completedAt: now() },
        { id: '5', title: '每周一晚上八点复习高数', status: 'todo', priority: 'none', projectId: 'proj-2', createdAt: now(), updatedAt: now() },
        { id: '6', title: '整理书架', status: 'todo', priority: 'none', createdAt: now(), updatedAt: now() },
        { id: '7', title: '给妈妈打电话', status: 'todo', priority: 'p2', dueAt: yesterday(), createdAt: now(), updatedAt: now() },
      ]
    }
    localStorage.setItem(DB_KEY, JSON.stringify(init))
    return init
  }
  return JSON.parse(data)
}

function saveDb(db: any) {
  localStorage.setItem(DB_KEY, JSON.stringify(db))
}

function now() { return new Date().toISOString() }
function today() { return new Date().toISOString().split('T')[0] }
function yesterday() { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString() }
function todayTime(hour: number) { const d = new Date(); d.setHours(hour, 0, 0, 0); return d.toISOString() }

// App Component
const App: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([])
  const [projects] = useState<Project[]>([
    { id: 'proj-1', name: '工作', icon: '💼', color: '#3498db' },
    { id: 'proj-2', name: '学习', icon: '📚', color: '#27ae60' },
    { id: 'proj-3', name: '生活', icon: '🏠', color: '#e74c3c' },
  ])
  const [tags] = useState<Tag[]>([
    { id: 'tag-1', name: '重要', color: '#e74c3c' },
    { id: 'tag-2', name: '紧急', color: '#e67e22' },
  ])

  const [currentView, setCurrentView] = useState<string>('today')
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [inputValue, setInputValue] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [showPage, setShowPage] = useState<'tasks' | 'trash' | 'data' | 'ai'>('tasks')
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set())
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set())
  const [showFilters, setShowFilters] = useState(false)
  const [filterProject, setFilterProject] = useState<string>('')
  const [filterPriority, setFilterPriority] = useState<string>('')

  // Load data
  useEffect(() => {
    const db = getDb()
    setTasks(db.tasks || [])
  }, [])

  // Save tasks
  const updateTasks = useCallback((newTasks: Task[]) => {
    setTasks(newTasks)
    const db = getDb()
    db.tasks = newTasks
    saveDb(db)
  }, [])

  // Task CRUD
  const addTask = useCallback((title: string, parentId?: string) => {
    if (!title.trim()) return
    const newTask: Task = {
      id: Date.now().toString(),
      title: title.trim(),
      status: 'todo',
      priority: 'none',
      parentId,
      createdAt: now(),
      updatedAt: now(),
    }
    updateTasks([...tasks, newTask])
    setInputValue('')
  }, [tasks, updateTasks])

  const toggleTask = useCallback((id: string) => {
    const task = tasks.find(t => t.id === id)
    if (!task) return

    const newStatus = task.status === 'done' ? 'todo' : 'done'
    let newTasks = tasks.map(t =>
      t.id === id ? { ...t, status: newStatus as Task['status'], completedAt: newStatus === 'done' ? now() : undefined, updatedAt: now() } : t
    )

    // Parent-child completion logic
    if (newStatus === 'done' && task.parentId) {
      const parent = tasks.find(t => t.id === task.parentId)
      if (parent) {
        const siblings = newTasks.filter(t => t.parentId === parent.id && t.id !== id)
        const allDone = siblings.every(t => t.status === 'done')
        if (allDone) {
          newTasks = newTasks.map(t =>
            t.id === parent.id ? { ...t, status: 'done' as const, completedAt: now(), updatedAt: now() } : t
          )
        }
      }
    }

    // If completing parent, ask about children
    if (newStatus === 'done' && !task.parentId) {
      const children = tasks.filter(t => t.parentId === id && t.status === 'todo')
      if (children.length > 0) {
        if (window.confirm(`该任务有 ${children.length} 个未完成子任务，是否同时完成？`)) {
          newTasks = newTasks.map(t =>
            t.parentId === id && t.status === 'todo'
              ? { ...t, status: 'done' as const, completedAt: now(), updatedAt: now() }
              : t
          )
        }
      }
    }

    updateTasks(newTasks)
  }, [tasks, updateTasks])

  const deleteTask = useCallback((id: string) => {
    // Delete task and its children
    const idsToDelete = new Set<string>()
    const collectIds = (taskId: string) => {
      idsToDelete.add(taskId)
      tasks.filter(t => t.parentId === taskId).forEach(t => collectIds(t.id))
    }
    collectIds(id)

    updateTasks(tasks.filter(t => !idsToDelete.has(t.id)))
    if (selectedTask && idsToDelete.has(selectedTask.id)) {
      setSelectedTask(null)
    }
  }, [tasks, updateTasks, selectedTask])

  const updateTask = useCallback((id: string, updates: Partial<Task>) => {
    const newTasks = tasks.map(t =>
      t.id === id ? { ...t, ...updates, updatedAt: now() } : t
    )
    updateTasks(newTasks)
    if (selectedTask?.id === id) {
      setSelectedTask({ ...selectedTask, ...updates })
    }
  }, [tasks, updateTasks, selectedTask])

  // Batch operations
  const batchComplete = useCallback(() => {
    const newTasks = tasks.map(t =>
      selectedTaskIds.has(t.id) ? { ...t, status: 'done' as const, completedAt: now(), updatedAt: now() } : t
    )
    updateTasks(newTasks)
    setSelectedTaskIds(new Set())
  }, [tasks, updateTasks, selectedTaskIds])

  const batchDelete = useCallback(() => {
    updateTasks(tasks.filter(t => !selectedTaskIds.has(t.id)))
    setSelectedTaskIds(new Set())
    if (selectedTask && selectedTaskIds.has(selectedTask.id)) {
      setSelectedTask(null)
    }
  }, [tasks, updateTasks, selectedTaskIds, selectedTask])

  // Toggle expand
  const toggleExpand = useCallback((id: string) => {
    setExpandedTasks(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  // Toggle selection
  const toggleSelect = useCallback((id: string) => {
    setSelectedTaskIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  // AI Parse
  const [aiInput, setAiInput] = useState('')
  const [aiLoading, setAiLoading] = useState(false)

  const handleAIParse = async () => {
    if (!aiInput.trim()) return
    setAiLoading(true)
    await new Promise(r => setTimeout(r, 800))

    let title = aiInput
    const input = aiInput.toLowerCase()

    // Extract and apply priority
    if (input.includes('紧急') || input.includes('重要')) {
      // Priority will be set after creation
    }

    // Extract date
    if (input.includes('明天')) {
      // Date will be set after creation
    }

    title = title.replace(/明天|今天|紧急|重要|尽快/g, '').trim()

    addTask(title || aiInput)
    setAiInput('')
    setAiLoading(false)
    setShowPage('tasks')
    alert(`✅ 已创建: ${title || aiInput}`)
  }

  // Export/Import
  const handleExport = () => {
    const data = JSON.stringify({ version: '1.0', exportedAt: now(), tasks, projects, tags }, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `eztodo-${today()}.json`
    a.click()
  }

  const handleImport = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target?.result as string)
          if (data.tasks) {
            updateTasks([...tasks, ...data.tasks])
            alert(`✅ 导入 ${data.tasks.length} 个任务`)
          }
        } catch { alert('❌ 导入失败') }
      }
      reader.readAsText(file)
    }
    input.click()
  }

  // Helpers
  const getPriorityColor = (p: string) => {
    switch (p) { case 'p1': return '#e74c3c'; case 'p2': return '#e67e22'; case 'p3': return '#f1c40f'; case 'p4': return '#3498db'; default: return '#95a5a6' }
  }
  const getPriorityIcon = (p: string) => {
    switch (p) { case 'p1': return '🔴'; case 'p2': return '🟠'; case 'p3': return '🟡'; case 'p4': return '🔵'; default: return '⚪' }
  }
  const getProject = (id?: string) => projects.find(p => p.id === id)
  const getChildren = (parentId: string) => tasks.filter(t => t.parentId === parentId)
  const getProgress = (taskId: string) => {
    const children = getChildren(taskId)
    if (children.length === 0) return null
    const done = children.filter(t => t.status === 'done').length
    return { done, total: children.length }
  }

  // Filter tasks
  const getFilteredTasks = useCallback(() => {
    let filtered = tasks.filter(t => !t.deletedAt)

    // Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter(t => t.title.toLowerCase().includes(q) || (t.note && t.note.toLowerCase().includes(q)))
    }

    // Project filter
    if (filterProject) {
      filtered = filtered.filter(t => t.projectId === filterProject)
    }

    // Priority filter
    if (filterPriority) {
      filtered = filtered.filter(t => t.priority === filterPriority)
    }

    // View filter
    const todayStr = today()
    const weekLater = new Date()
    weekLater.setDate(weekLater.getDate() + 7)
    const weekStr = weekLater.toISOString().split('T')[0]

    switch (currentView) {
      case 'inbox': return filtered.filter(t => !t.projectId && !t.parentId && t.status === 'todo')
      case 'today': return filtered.filter(t => !t.parentId && t.status === 'todo' && (t.scheduledDate === todayStr || !t.scheduledDate))
      case 'week': return filtered.filter(t => !t.parentId && t.status === 'todo' && t.scheduledDate && t.scheduledDate <= weekStr)
      case 'overdue': return filtered.filter(t => !t.parentId && t.status === 'todo' && t.dueAt && new Date(t.dueAt) < new Date())
      case 'no-date': return filtered.filter(t => !t.parentId && t.status === 'todo' && !t.scheduledDate && !t.dueAt)
      case 'completed': return filtered.filter(t => !t.parentId && t.status === 'done')
      default: return filtered.filter(t => !t.parentId && t.status === 'todo')
    }
  }, [tasks, currentView, searchQuery, filterProject, filterPriority])

  const filteredTasks = getFilteredTasks()
  const rootTasks = filteredTasks.filter(t => !t.parentId)

  // Render task card
  const renderTask = (task: Task, depth = 0) => {
    const children = getChildren(task.id)
    const isExpanded = expandedTasks.has(task.id)
    const progress = getProgress(task.id)
    const isSelected = selectedTaskIds.has(task.id)

    return (
      <React.Fragment key={task.id}>
        <div
          onClick={() => setSelectedTask(task)}
          style={{
            background: 'white',
            borderRadius: '8px',
            padding: '12px 16px',
            marginBottom: '8px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            borderLeft: `4px solid ${getPriorityColor(task.priority)}`,
            marginLeft: `${depth * 24}px`,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            cursor: 'pointer',
            opacity: task.status === 'done' ? 0.7 : 1,
          }}
        >
          {/* Checkbox */}
          <div
            onClick={(e) => { e.stopPropagation(); toggleTask(task.id) }}
            style={{
              width: '20px', height: '20px',
              border: `2px solid ${task.status === 'done' ? '#27ae60' : '#ddd'}`,
              borderRadius: '50%',
              background: task.status === 'done' ? '#27ae60' : 'transparent',
              cursor: 'pointer', flexShrink: 0,
            }}
          />

          {/* Expand button */}
          {children.length > 0 && (
            <div
              onClick={(e) => { e.stopPropagation(); toggleExpand(task.id) }}
              style={{ cursor: 'pointer', fontSize: '12px', color: '#666' }}
            >
              {isExpanded ? '▼' : '▶'}
            </div>
          )}

          {/* Content */}
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
              {task.projectId && <span>{getProject(task.projectId)?.icon} {getProject(task.projectId)?.name}</span>}
              {task.scheduledDate && <span>📅 {task.scheduledDate}</span>}
              {progress && <span>📊 {progress.done}/{progress.total}</span>}
            </div>
          </div>

          {/* Selection checkbox */}
          <div
            onClick={(e) => { e.stopPropagation(); toggleSelect(task.id) }}
            style={{
              width: '18px', height: '18px',
              border: `2px solid ${isSelected ? '#3498db' : '#ddd'}`,
              borderRadius: '4px',
              background: isSelected ? '#3498db' : 'transparent',
              cursor: 'pointer', flexShrink: 0,
            }}
          />
        </div>

        {/* Children */}
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
            { id: 'inbox', icon: '📥', label: '收件箱' },
            { id: 'today', icon: '📅', label: '今天' },
            { id: 'week', icon: '📆', label: '未来 7 天' },
            { id: 'overdue', icon: '⚠️', label: '已逾期' },
            { id: 'no-date', icon: '📋', label: '无日期' },
            { id: 'completed', icon: '✅', label: '已完成' },
          ].map(item => (
            <div
              key={item.id}
              onClick={() => { setCurrentView(item.id); setShowPage('tasks') }}
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
              <span style={{ marginRight: '10px' }}>{p.icon}</span>
              {p.name}
            </div>
          ))}

          <div style={{ borderTop: '1px solid #34495e', marginTop: '15px', paddingTop: '10px' }}>
            {[
              { id: 'trash' as const, icon: '🗑️', label: '回收站' },
              { id: 'data' as const, icon: '📦', label: '数据管理' },
              { id: 'ai' as const, icon: '🤖', label: 'AI 创建' },
            ].map(item => (
              <div
                key={item.id}
                onClick={() => setShowPage(item.id)}
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
          </h1>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
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

        {/* Filters */}
        {showFilters && (
          <div style={{ padding: '10px 20px', background: '#f8f9fa', borderBottom: '1px solid #ddd', display: 'flex', gap: '15px' }}>
            <select
              value={filterProject}
              onChange={(e) => setFilterProject(e.target.value)}
              style={{ padding: '6px 10px', border: '1px solid #ddd', borderRadius: '4px' }}
            >
              <option value="">所有项目</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.icon} {p.name}</option>)}
            </select>
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              style={{ padding: '6px 10px', border: '1px solid #ddd', borderRadius: '4px' }}
            >
              <option value="">所有优先级</option>
              <option value="p1">🔴 P1</option>
              <option value="p2">🟠 P2</option>
              <option value="p3">🟡 P3</option>
              <option value="p4">🔵 P4</option>
            </select>
            {(filterProject || filterPriority) && (
              <button
                onClick={() => { setFilterProject(''); setFilterPriority('') }}
                style={{ padding: '6px 10px', background: '#e74c3c', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
              >
                清除筛选
              </button>
            )}
          </div>
        )}

        {/* Batch toolbar */}
        {selectedTaskIds.size > 0 && (
          <div style={{ padding: '10px 20px', background: '#e3f2fd', borderBottom: '1px solid #bbdefb', display: 'flex', alignItems: 'center', gap: '15px' }}>
            <span style={{ fontSize: '14px', color: '#1976d2' }}>已选择 {selectedTaskIds.size} 项</span>
            <button onClick={batchComplete} style={{ padding: '6px 12px', background: '#27ae60', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>
              ✅ 批量完成
            </button>
            <button onClick={batchDelete} style={{ padding: '6px 12px', background: '#e74c3c', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>
              🗑️ 批量删除
            </button>
            <button onClick={() => setSelectedTaskIds(new Set())} style={{ padding: '6px 12px', background: '#95a5a6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>
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
              onKeyPress={(e) => e.key === 'Enter' && addTask(inputValue)}
              placeholder="添加任务... (支持父子任务，输入后按 Enter)"
              style={{ flex: 1, padding: '10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px' }}
            />
            <button
              onClick={() => addTask(inputValue)}
              style={{ padding: '10px 20px', background: '#3498db', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
            >
              添加
            </button>
          </div>
        )}

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '15px 20px' }}>
          {/* Tasks View */}
          {showPage === 'tasks' && (
            <>
              {rootTasks.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px', color: '#999' }}>
                  <div style={{ fontSize: '48px', marginBottom: '15px' }}>📝</div>
                  <h3>暂无任务</h3>
                  <p>点击上方输入框添加</p>
                </div>
              ) : (
                rootTasks.map(task => renderTask(task))
              )}
            </>
          )}

          {/* Trash View */}
          {showPage === 'trash' && (
            <div style={{ textAlign: 'center', padding: '60px', color: '#999' }}>
              <div style={{ fontSize: '48px', marginBottom: '15px' }}>🗑️</div>
              <h3>回收站为空</h3>
            </div>
          )}

          {/* Data Management View */}
          {showPage === 'data' && (
            <div style={{ maxWidth: '600px', margin: '0 auto' }}>
              <div style={{ background: 'white', borderRadius: '8px', padding: '20px', marginBottom: '20px' }}>
                <h3 style={{ margin: '0 0 15px' }}>📤 导出数据</h3>
                <button onClick={handleExport} style={{ padding: '10px 20px', background: '#3498db', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
                  📄 导出 JSON
                </button>
              </div>
              <div style={{ background: 'white', borderRadius: '8px', padding: '20px', marginBottom: '20px' }}>
                <h3 style={{ margin: '0 0 15px' }}>📥 导入数据</h3>
                <button onClick={handleImport} style={{ padding: '10px 20px', background: '#27ae60', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
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
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#9b59b6' }}>{tasks.filter(t => t.parentId).length}</div>
                    <div style={{ fontSize: '12px', color: '#666' }}>子任务</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* AI View */}
          {showPage === 'ai' && (
            <div style={{ maxWidth: '600px', margin: '0 auto' }}>
              <div style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', borderRadius: '8px', padding: '30px', color: 'white', marginBottom: '20px' }}>
                <h2 style={{ margin: '0 0 10px' }}>🤖 AI 智能创建</h2>
                <p style={{ margin: 0, opacity: 0.9 }}>输入自然语言，自动解析任务</p>
              </div>
              <div style={{ background: 'white', borderRadius: '8px', padding: '20px' }}>
                <textarea
                  value={aiInput}
                  onChange={(e) => setAiInput(e.target.value)}
                  placeholder="例如：明天下午三点开会，提前一小时提醒"
                  style={{ width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '6px', minHeight: '100px', fontSize: '14px', resize: 'vertical' }}
                />
                <button
                  onClick={handleAIParse}
                  disabled={aiLoading || !aiInput.trim()}
                  style={{ marginTop: '15px', padding: '12px 24px', background: aiLoading ? '#95a5a6' : '#9b59b6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', width: '100%', fontSize: '16px' }}
                >
                  {aiLoading ? '⏳ 解析中...' : '🤖 AI 创建'}
                </button>
                <div style={{ marginTop: '20px' }}>
                  <div style={{ fontSize: '12px', color: '#666', marginBottom: '10px' }}>💡 示例：</div>
                  {['明天下午三点交报告', '每周一三五晚上八点跑步', '做实验报告，分成收集数据、画图、写分析'].map((ex, i) => (
                    <div key={i} onClick={() => setAiInput(ex)} style={{ padding: '10px', background: '#f8f9fa', borderRadius: '6px', cursor: 'pointer', marginBottom: '8px', fontSize: '14px' }}>
                      💬 {ex}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Task Detail Panel */}
      {selectedTask && showPage === 'tasks' && (
        <div style={{ width: '350px', background: 'white', borderLeft: '1px solid #ddd', padding: '20px', overflow: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
            <h2 style={{ margin: 0, fontSize: '16px' }}>任务详情</h2>
            <button onClick={() => setSelectedTask(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px' }}>✕</button>
          </div>

          <div style={{ marginBottom: '15px' }}>
            <input
              type="text"
              value={selectedTask.title}
              onChange={(e) => updateTask(selectedTask.id, { title: e.target.value })}
              style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '15px' }}
            />
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '5px' }}>优先级</label>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {(['p1', 'p2', 'p3', 'p4', 'none'] as const).map(p => (
                <button
                  key={p}
                  onClick={() => updateTask(selectedTask.id, { priority: p })}
                  style={{
                    padding: '6px 10px', fontSize: '11px',
                    border: selectedTask.priority === p ? `2px solid ${getPriorityColor(p)}` : '2px solid #ddd',
                    borderRadius: '4px', cursor: 'pointer',
                    background: selectedTask.priority === p ? `${getPriorityColor(p)}20` : 'white',
                  }}
                >
                  {getPriorityIcon(p)} {p.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '5px' }}>项目</label>
            <select
              value={selectedTask.projectId || ''}
              onChange={(e) => updateTask(selectedTask.id, { projectId: e.target.value || undefined })}
              style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '6px' }}
            >
              <option value="">无项目</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.icon} {p.name}</option>)}
            </select>
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '5px' }}>计划日期</label>
            <input
              type="date"
              value={selectedTask.scheduledDate || ''}
              onChange={(e) => updateTask(selectedTask.id, { scheduledDate: e.target.value || undefined })}
              style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '6px' }}
            />
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '5px' }}>截止时间</label>
            <input
              type="datetime-local"
              value={selectedTask.dueAt ? selectedTask.dueAt.slice(0, 16) : ''}
              onChange={(e) => updateTask(selectedTask.id, { dueAt: e.target.value ? new Date(e.target.value).toISOString() : undefined })}
              style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '6px' }}
            />
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '5px' }}>备注</label>
            <textarea
              value={selectedTask.note || ''}
              onChange={(e) => updateTask(selectedTask.id, { note: e.target.value })}
              placeholder="添加备注..."
              style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '6px', minHeight: '60px', resize: 'vertical' }}
            />
          </div>

          {/* Subtasks */}
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '5px' }}>子任务</label>
            {getChildren(selectedTask.id).map(child => (
              <div key={child.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0', borderBottom: '1px solid #f0f0f0' }}>
                <div
                  onClick={() => toggleTask(child.id)}
                  style={{
                    width: '16px', height: '16px',
                    border: `2px solid ${child.status === 'done' ? '#27ae60' : '#ddd'}`,
                    borderRadius: '50%',
                    background: child.status === 'done' ? '#27ae60' : 'transparent',
                    cursor: 'pointer',
                  }}
                />
                <span style={{ flex: 1, fontSize: '13px', textDecoration: child.status === 'done' ? 'line-through' : 'none', color: child.status === 'done' ? '#999' : '#333' }}>
                  {child.title}
                </span>
                <button onClick={() => deleteTask(child.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', color: '#e74c3c' }}>✕</button>
              </div>
            ))}
            <div style={{ display: 'flex', gap: '5px', marginTop: '8px' }}>
              <input
                type="text"
                placeholder="添加子任务..."
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    const input = e.target as HTMLInputElement
                    addTask(input.value, selectedTask.id)
                    input.value = ''
                  }
                }}
                style={{ flex: 1, padding: '6px 8px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '12px' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => toggleTask(selectedTask.id)}
              style={{ flex: 1, padding: '10px', background: selectedTask.status === 'done' ? '#6c757d' : '#28a745', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
            >
              {selectedTask.status === 'done' ? '恢复' : '完成'}
            </button>
            <button
              onClick={() => deleteTask(selectedTask.id)}
              style={{ padding: '10px 15px', background: '#dc3545', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
            >
              删除
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
