/**
 * EZTODO Desktop Application - Full Featured Version
 */

import React, { useState, useEffect, useCallback } from 'react'

// Types
interface Task {
  id: string
  title: string
  note?: string
  status: 'todo' | 'done' | 'cancelled'
  priority: 'p1' | 'p2' | 'p3' | 'p4' | 'none'
  project_id?: string
  scheduled_date?: string
  due_at?: string
  created_at: string
  updated_at: string
  completed_at?: string
  deleted_at?: string
}

interface Project {
  id: string
  name: string
  color: string
  icon: string
}

type ViewType = 'inbox' | 'today' | 'week' | 'overdue' | 'completed' | 'trash'
type PageType = 'tasks' | 'trash' | 'data' | 'ai'

const App: React.FC = () => {
  // State
  const [tasks, setTasks] = useState<Task[]>([])
  const [projects] = useState<Project[]>([
    { id: 'proj-1', name: '工作', color: '#3498db', icon: '💼' },
    { id: 'proj-2', name: '学习', color: '#27ae60', icon: '📚' },
    { id: 'proj-3', name: '生活', color: '#e74c3c', icon: '🏠' },
  ])
  const [currentView, setCurrentView] = useState<ViewType>('today')
  const [currentPage, setCurrentPage] = useState<PageType>('tasks')
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [inputValue, setInputValue] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [_showTrash, setShowTrash] = useState(false)
  const [_showDataPanel, setShowDataPanel] = useState(false)
  const [_showAIPanel, setShowAIPanel] = useState(false)
  const [aiInput, setAiInput] = useState('')
  const [aiLoading, setAiLoading] = useState(false)

  // Load data
  useEffect(() => {
    const db = localStorage.getItem('eztodo_db')
    if (db) {
      const data = JSON.parse(db)
      setTasks(data.tasks || [])
    } else {
      const sampleTasks: Task[] = [
        { id: '1', title: '提交项目报告', note: '包含 Q2 的销售数据', status: 'todo', priority: 'p1', project_id: 'proj-1', scheduled_date: new Date().toISOString().split('T')[0], due_at: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        { id: '2', title: '准备明天的会议材料', note: '需要准备 PPT', status: 'todo', priority: 'p2', project_id: 'proj-1', scheduled_date: new Date().toISOString().split('T')[0], created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        { id: '3', title: '买菜做饭', note: '晚上做红烧肉', status: 'todo', priority: 'p3', project_id: 'proj-3', scheduled_date: new Date().toISOString().split('T')[0], created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        { id: '4', title: '回复邮件', status: 'done', priority: 'none', project_id: 'proj-1', created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), updated_at: new Date().toISOString(), completed_at: new Date().toISOString() },
        { id: '5', title: '每周一晚上八点复习高数', note: '第七章内容', status: 'todo', priority: 'none', project_id: 'proj-2', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      ]
      saveTasks(sampleTasks)
    }
  }, [])

  const saveTasks = (newTasks: Task[]) => {
    setTasks(newTasks)
    localStorage.setItem('eztodo_db', JSON.stringify({ tasks: newTasks, projects, tags: [] }))
  }

  // Task operations
  const addTask = useCallback(() => {
    if (!inputValue.trim()) return
    const newTask: Task = {
      id: Date.now().toString(),
      title: inputValue.trim(),
      status: 'todo',
      priority: 'none',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    saveTasks([...tasks, newTask])
    setInputValue('')
  }, [inputValue, tasks])

  const toggleTask = useCallback((taskId: string) => {
    const updatedTasks = tasks.map(t => {
      if (t.id === taskId) {
        const newStatus: Task['status'] = t.status === 'done' ? 'todo' : 'done'
        return {
          ...t,
          status: newStatus,
          completed_at: newStatus === 'done' ? new Date().toISOString() : undefined,
          updated_at: new Date().toISOString()
        }
      }
      return t
    })
    saveTasks(updatedTasks)
  }, [tasks])

  const deleteTask = useCallback((taskId: string) => {
    const task = tasks.find(t => t.id === taskId)
    if (task) {
      const updatedTasks = tasks.map(t =>
        t.id === taskId ? { ...t, deleted_at: new Date().toISOString() } : t
      )
      saveTasks(updatedTasks)
      if (selectedTask?.id === taskId) setSelectedTask(null)
    }
  }, [tasks, selectedTask])

  const restoreTask = useCallback((taskId: string) => {
    const updatedTasks = tasks.map(t =>
      t.id === taskId ? { ...t, deleted_at: undefined } : t
    )
    saveTasks(updatedTasks)
  }, [tasks])

  const permanentDelete = useCallback((taskId: string) => {
    const updatedTasks = tasks.filter(t => t.id !== taskId)
    saveTasks(updatedTasks)
  }, [tasks])

  const updateTask = useCallback((taskId: string, updates: Partial<Task>) => {
    const updatedTasks = tasks.map(t =>
      t.id === taskId ? { ...t, ...updates, updated_at: new Date().toISOString() } : t
    )
    saveTasks(updatedTasks)
    if (selectedTask?.id === taskId) {
      setSelectedTask({ ...selectedTask, ...updates })
    }
  }, [tasks, selectedTask])

  // AI Parse
  const handleAIParse = async () => {
    if (!aiInput.trim()) return
    setAiLoading(true)

    // Simulate AI parsing
    await new Promise(resolve => setTimeout(resolve, 1000))

    const input = aiInput.toLowerCase()
    let title = aiInput
    let priority: Task['priority'] = 'none'
    let scheduledDate: string | undefined

    // Extract priority
    if (input.includes('紧急') || input.includes('重要')) priority = 'p1'
    else if (input.includes('尽快')) priority = 'p2'
    else if (input.includes('有空')) priority = 'p3'

    // Extract date
    const today = new Date()
    if (input.includes('明天')) {
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)
      scheduledDate = tomorrow.toISOString().split('T')[0]
    } else if (input.includes('后天')) {
      const dayAfter = new Date(today)
      dayAfter.setDate(dayAfter.getDate() + 2)
      scheduledDate = dayAfter.toISOString().split('T')[0]
    } else if (input.includes('今天') || input.includes('今晚')) {
      scheduledDate = today.toISOString().split('T')[0]
    }

    // Clean title
    title = title.replace(/明天|后天|今天|今晚|紧急|重要|尽快|有空/g, '').trim()

    const newTask: Task = {
      id: Date.now().toString(),
      title: title || aiInput,
      status: 'todo',
      priority,
      scheduled_date: scheduledDate,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    saveTasks([...tasks, newTask])
    setAiInput('')
    setAiLoading(false)
    setShowAIPanel(false)
    alert(`✅ 已创建任务: ${newTask.title}`)
  }

  // Export
  const handleExport = (format: 'json' | 'csv') => {
    const activeTasks = tasks.filter(t => !t.deleted_at)
    let content: string
    let filename: string

    if (format === 'json') {
      content = JSON.stringify({ version: '1.0', exportedAt: new Date().toISOString(), tasks: activeTasks }, null, 2)
      filename = `eztodo-export-${new Date().toISOString().split('T')[0]}.json`
    } else {
      const headers = ['id', 'title', 'status', 'priority', 'scheduled_date', 'due_at']
      const rows = activeTasks.map(t => headers.map(h => String(t[h as keyof Task] || '')).join(','))
      content = [headers.join(','), ...rows].join('\n')
      filename = `eztodo-export-${new Date().toISOString().split('T')[0]}.csv`
    }

    const blob = new Blob([content], { type: format === 'json' ? 'application/json' : 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  // Import
  const handleImport = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json,.csv'
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return

      const reader = new FileReader()
      reader.onload = (event) => {
        try {
          const content = event.target?.result as string
          if (file.name.endsWith('.json')) {
            const data = JSON.parse(content)
            if (data.tasks) {
              saveTasks([...tasks, ...data.tasks])
              alert(`✅ 已导入 ${data.tasks.length} 个任务`)
            }
          }
        } catch (error) {
          alert('❌ 导入失败: 文件格式错误')
        }
      }
      reader.readAsText(file)
    }
    input.click()
  }

  // Backup
  const handleBackup = () => {
    const backup = {
      version: '1.0',
      createdAt: new Date().toISOString(),
      tasks,
      projects,
    }
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `eztodo-backup-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Restore
  const handleRestore = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return

      const reader = new FileReader()
      reader.onload = (event) => {
        try {
          const backup = JSON.parse(event.target?.result as string)
          if (backup.tasks) {
            if (confirm(`确定要恢复备份吗？这将覆盖当前 ${tasks.length} 个任务`)) {
              saveTasks(backup.tasks)
              alert(`✅ 已恢复 ${backup.tasks.length} 个任务`)
            }
          }
        } catch (error) {
          alert('❌ 恢复失败: 文件格式错误')
        }
      }
      reader.readAsText(file)
    }
    input.click()
  }

  // Helpers
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'p1': return '#e74c3c'
      case 'p2': return '#e67e22'
      case 'p3': return '#f1c40f'
      case 'p4': return '#3498db'
      default: return '#95a5a6'
    }
  }

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'p1': return '🔴'
      case 'p2': return '🟠'
      case 'p3': return '🟡'
      case 'p4': return '🔵'
      default: return '⚪'
    }
  }

  const getProjectName = (projectId?: string) => {
    const project = projects.find(p => p.id === projectId)
    return project ? `${project.icon} ${project.name}` : '📥 收件箱'
  }

  // Filter tasks
  const getFilteredTasks = () => {
    let filtered = tasks.filter(t => !t.deleted_at)

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(t =>
        t.title.toLowerCase().includes(query) ||
        (t.note && t.note.toLowerCase().includes(query))
      )
    }

    const today = new Date().toISOString().split('T')[0]
    switch (currentView) {
      case 'inbox':
        return filtered.filter(t => !t.project_id && t.status === 'todo')
      case 'today':
        return filtered.filter(t => t.status === 'todo' && (t.scheduled_date === today || !t.scheduled_date))
      case 'week':
        const weekLater = new Date()
        weekLater.setDate(weekLater.getDate() + 7)
        return filtered.filter(t => t.status === 'todo' && t.scheduled_date && t.scheduled_date <= weekLater.toISOString().split('T')[0])
      case 'overdue':
        return filtered.filter(t => t.status === 'todo' && t.due_at && new Date(t.due_at) < new Date())
      case 'completed':
        return filtered.filter(t => t.status === 'done')
      case 'trash':
        return tasks.filter(t => t.deleted_at)
      default:
        return filtered.filter(t => t.status === 'todo')
    }
  }

  const filteredTasks = getFilteredTasks()
  const trashTasks = tasks.filter(t => t.deleted_at)
  const activeTasks = tasks.filter(t => !t.deleted_at)

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      {/* Sidebar */}
      <div style={{ width: '240px', background: '#2c3e50', color: 'white', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px', borderBottom: '1px solid #34495e' }}>
          <h2 style={{ margin: 0, fontSize: '20px' }}>📋 EZTODO</h2>
          <div style={{ marginTop: '10px', fontSize: '12px', opacity: 0.7 }}>v1.0.0</div>
        </div>

        <nav style={{ flex: 1, padding: '10px', overflow: 'auto' }}>
          <div style={{ marginBottom: '15px' }}>
            <div style={{ fontSize: '11px', opacity: 0.6, padding: '5px 10px', textTransform: 'uppercase' }}>视图</div>
            {[
              { id: 'inbox' as ViewType, icon: '📥', label: '收件箱', count: activeTasks.filter(t => !t.project_id && t.status === 'todo').length },
              { id: 'today' as ViewType, icon: '📅', label: '今天', count: activeTasks.filter(t => t.status === 'todo' && t.scheduled_date === new Date().toISOString().split('T')[0]).length },
              { id: 'week' as ViewType, icon: '📆', label: '未来 7 天' },
              { id: 'overdue' as ViewType, icon: '⚠️', label: '已逾期', count: activeTasks.filter(t => t.status === 'todo' && t.due_at && new Date(t.due_at) < new Date()).length },
              { id: 'completed' as ViewType, icon: '✅', label: '已完成', count: activeTasks.filter(t => t.status === 'done').length },
            ].map(item => (
              <div
                key={item.id}
                onClick={() => { setCurrentView(item.id); setCurrentPage('tasks'); setShowTrash(false); setShowDataPanel(false); setShowAIPanel(false) }}
                style={{
                  padding: '10px 12px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  marginBottom: '4px',
                  background: currentView === item.id && currentPage === 'tasks' ? '#3498db' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <div>
                  <span style={{ marginRight: '10px' }}>{item.icon}</span>
                  {item.label}
                </div>
                {item.count !== undefined && item.count > 0 && (
                  <span style={{ background: 'rgba(255,255,255,0.2)', padding: '2px 8px', borderRadius: '10px', fontSize: '11px' }}>
                    {item.count}
                  </span>
                )}
              </div>
            ))}
          </div>

          <div style={{ marginBottom: '15px' }}>
            <div style={{ fontSize: '11px', opacity: 0.6, padding: '5px 10px', textTransform: 'uppercase' }}>项目</div>
            {projects.map(project => (
              <div
                key={project.id}
                style={{
                  padding: '10px 12px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  marginBottom: '4px',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <span style={{ marginRight: '10px' }}>{project.icon}</span>
                {project.name}
              </div>
            ))}
          </div>

          <div style={{ borderTop: '1px solid #34495e', paddingTop: '10px' }}>
            <div
              onClick={() => { setShowTrash(true); setCurrentPage('trash'); setShowDataPanel(false); setShowAIPanel(false) }}
              style={{
                padding: '10px 12px',
                borderRadius: '6px',
                cursor: 'pointer',
                marginBottom: '4px',
                background: currentPage === 'trash' ? '#3498db' : 'transparent'
              }}
            >
              🗑️ 回收站
              {trashTasks.length > 0 && (
                <span style={{ background: 'rgba(255,255,255,0.2)', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', marginLeft: '10px' }}>
                  {trashTasks.length}
                </span>
              )}
            </div>
            <div
              onClick={() => { setShowDataPanel(true); setCurrentPage('data'); setShowTrash(false); setShowAIPanel(false) }}
              style={{
                padding: '10px 12px',
                borderRadius: '6px',
                cursor: 'pointer',
                marginBottom: '4px',
                background: currentPage === 'data' ? '#3498db' : 'transparent'
              }}
            >
              📦 数据管理
            </div>
            <div
              onClick={() => { setShowAIPanel(true); setCurrentPage('ai'); setShowTrash(false); setShowDataPanel(false) }}
              style={{
                padding: '10px 12px',
                borderRadius: '6px',
                cursor: 'pointer',
                marginBottom: '4px',
                background: currentPage === 'ai' ? '#3498db' : 'transparent'
              }}
            >
              🤖 AI 创建
            </div>
          </div>
        </nav>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f5f5f5' }}>
        {/* Header */}
        <div style={{ padding: '20px', background: 'white', borderBottom: '1px solid #ddd', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '24px' }}>
              {currentPage === 'tasks' && (
                <>
                  {currentView === 'inbox' && '📥 收件箱'}
                  {currentView === 'today' && '📅 今天'}
                  {currentView === 'week' && '📆 未来 7 天'}
                  {currentView === 'overdue' && '⚠️ 已逾期'}
                  {currentView === 'completed' && '✅ 已完成'}
                </>
              )}
              {currentPage === 'trash' && '🗑️ 回收站'}
              {currentPage === 'data' && '📦 数据管理'}
              {currentPage === 'ai' && '🤖 AI 创建'}
            </h1>
            <p style={{ margin: '5px 0 0', color: '#666', fontSize: '14px' }}>
              {new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="🔍 搜索..."
              style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: '6px', width: '200px' }}
            />
          </div>
        </div>

        {/* Quick Add (only on tasks page) */}
        {currentPage === 'tasks' && (
          <div style={{ padding: '15px 20px', background: 'white', borderBottom: '1px solid #ddd', display: 'flex', gap: '10px' }}>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addTask()}
              placeholder="添加任务..."
              style={{ flex: 1, padding: '12px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px' }}
            />
            <button
              onClick={addTask}
              style={{ padding: '12px 24px', background: '#3498db', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 500 }}
            >
              添加
            </button>
          </div>
        )}

        {/* Content Area */}
        <div style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
          {/* Tasks Page */}
          {currentPage === 'tasks' && (
            <>
              {filteredTasks.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: '#999' }}>
                  <div style={{ fontSize: '48px', marginBottom: '15px' }}>📝</div>
                  <h3 style={{ margin: '0 0 10px' }}>暂无任务</h3>
                  <p>点击上方输入框添加新任务</p>
                </div>
              ) : (
                filteredTasks.map(task => (
                  <div
                    key={task.id}
                    onClick={() => setSelectedTask(task)}
                    style={{
                      background: 'white',
                      borderRadius: '8px',
                      padding: '16px',
                      marginBottom: '12px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                      borderLeft: `4px solid ${getPriorityColor(task.priority)}`,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px'
                    }}
                  >
                    <div
                      onClick={(e) => { e.stopPropagation(); toggleTask(task.id) }}
                      style={{
                        width: '20px',
                        height: '20px',
                        border: '2px solid #ddd',
                        borderRadius: '50%',
                        cursor: 'pointer',
                        background: task.status === 'done' ? '#27ae60' : 'transparent',
                        borderColor: task.status === 'done' ? '#27ae60' : '#ddd',
                        flexShrink: 0
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontWeight: 500,
                        textDecoration: task.status === 'done' ? 'line-through' : 'none',
                        color: task.status === 'done' ? '#999' : '#333'
                      }}>
                        {task.title}
                      </div>
                      <div style={{ fontSize: '12px', color: '#999', marginTop: '5px', display: 'flex', gap: '10px' }}>
                        <span>{getPriorityIcon(task.priority)}</span>
                        <span>{getProjectName(task.project_id)}</span>
                        {task.scheduled_date && <span>📅 {task.scheduled_date}</span>}
                      </div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteTask(task.id) }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', color: '#e74c3c', padding: '5px', opacity: 0.6 }}
                    >
                      🗑️
                    </button>
                  </div>
                ))
              )}
            </>
          )}

          {/* Trash Page */}
          {currentPage === 'trash' && (
            <>
              {trashTasks.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: '#999' }}>
                  <div style={{ fontSize: '48px', marginBottom: '15px' }}>🗑️</div>
                  <h3 style={{ margin: '0 0 10px' }}>回收站为空</h3>
                  <p>删除的任务会出现在这里</p>
                </div>
              ) : (
                trashTasks.map(task => (
                  <div
                    key={task.id}
                    style={{
                      background: 'white',
                      borderRadius: '8px',
                      padding: '16px',
                      marginBottom: '12px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 500 }}>{task.title}</div>
                      <div style={{ fontSize: '12px', color: '#999', marginTop: '5px' }}>
                        删除于 {new Date(task.deleted_at!).toLocaleDateString('zh-CN')}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button
                        onClick={() => restoreTask(task.id)}
                        style={{ padding: '8px 16px', background: '#27ae60', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                      >
                        恢复
                      </button>
                      <button
                        onClick={() => permanentDelete(task.id)}
                        style={{ padding: '8px 16px', background: '#e74c3c', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                      >
                        永久删除
                      </button>
                    </div>
                  </div>
                ))
              )}
            </>
          )}

          {/* Data Management Page */}
          {currentPage === 'data' && (
            <div style={{ maxWidth: '600px', margin: '0 auto' }}>
              <div style={{ background: 'white', borderRadius: '8px', padding: '20px', marginBottom: '20px' }}>
                <h3 style={{ margin: '0 0 15px' }}>📤 导出数据</h3>
                <p style={{ color: '#666', marginBottom: '15px' }}>导出所有任务数据</p>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={() => handleExport('json')} style={{ padding: '10px 20px', background: '#3498db', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
                    📄 导出 JSON
                  </button>
                  <button onClick={() => handleExport('csv')} style={{ padding: '10px 20px', background: '#27ae60', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
                    📊 导出 CSV
                  </button>
                </div>
              </div>

              <div style={{ background: 'white', borderRadius: '8px', padding: '20px', marginBottom: '20px' }}>
                <h3 style={{ margin: '0 0 15px' }}>📥 导入数据</h3>
                <p style={{ color: '#666', marginBottom: '15px' }}>从 JSON 文件导入任务</p>
                <button onClick={handleImport} style={{ padding: '10px 20px', background: '#9b59b6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
                  📂 选择文件导入
                </button>
              </div>

              <div style={{ background: 'white', borderRadius: '8px', padding: '20px', marginBottom: '20px' }}>
                <h3 style={{ margin: '0 0 15px' }}>💾 备份恢复</h3>
                <p style={{ color: '#666', marginBottom: '15px' }}>创建完整备份或从备份恢复</p>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={handleBackup} style={{ padding: '10px 20px', background: '#e67e22', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
                    💾 创建备份
                  </button>
                  <button onClick={handleRestore} style={{ padding: '10px 20px', background: '#e74c3c', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
                    🔄 恢复备份
                  </button>
                </div>
              </div>

              <div style={{ background: 'white', borderRadius: '8px', padding: '20px' }}>
                <h3 style={{ margin: '0 0 15px' }}>📊 数据统计</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px' }}>
                  <div style={{ textAlign: 'center', padding: '15px', background: '#f8f9fa', borderRadius: '6px' }}>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#3498db' }}>{activeTasks.filter(t => t.status === 'todo').length}</div>
                    <div style={{ fontSize: '12px', color: '#666' }}>待办任务</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: '15px', background: '#f8f9fa', borderRadius: '6px' }}>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#27ae60' }}>{activeTasks.filter(t => t.status === 'done').length}</div>
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

          {/* AI Page */}
          {currentPage === 'ai' && (
            <div style={{ maxWidth: '600px', margin: '0 auto' }}>
              <div style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', borderRadius: '8px', padding: '30px', color: 'white', marginBottom: '20px' }}>
                <h2 style={{ margin: '0 0 10px', fontSize: '24px' }}>🤖 AI 智能创建</h2>
                <p style={{ margin: 0, opacity: 0.9 }}>输入自然语言，AI 自动解析任务</p>
              </div>

              <div style={{ background: 'white', borderRadius: '8px', padding: '20px', marginBottom: '20px' }}>
                <h3 style={{ margin: '0 0 15px' }}>输入任务描述</h3>
                <textarea
                  value={aiInput}
                  onChange={(e) => setAiInput(e.target.value)}
                  placeholder="例如：明天下午三点开会，提前一小时提醒"
                  style={{ width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '6px', minHeight: '100px', resize: 'vertical', fontSize: '14px' }}
                />
                <button
                  onClick={handleAIParse}
                  disabled={aiLoading || !aiInput.trim()}
                  style={{
                    marginTop: '15px',
                    padding: '12px 24px',
                    background: aiLoading ? '#95a5a6' : '#9b59b6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: aiLoading ? 'not-allowed' : 'pointer',
                    width: '100%',
                    fontSize: '16px'
                  }}
                >
                  {aiLoading ? '⏳ 解析中...' : '🤖 AI 创建任务'}
                </button>
              </div>

              <div style={{ background: 'white', borderRadius: '8px', padding: '20px' }}>
                <h3 style={{ margin: '0 0 15px' }}>💡 示例输入</h3>
                <div style={{ display: 'grid', gap: '10px' }}>
                  {[
                    '明天下午三点交报告',
                    '每周一三五晚上八点跑步',
                    '下周五前交报告，提前一天提醒',
                    '月底完成实习报告，分为整理照片、写正文、调整格式',
                  ].map((example, index) => (
                    <div
                      key={index}
                      onClick={() => setAiInput(example)}
                      style={{
                        padding: '12px',
                        background: '#f8f9fa',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        transition: 'background 0.2s'
                      }}
                    >
                      💬 {example}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Task Detail Panel */}
      {selectedTask && currentPage === 'tasks' && (
        <div style={{ width: '350px', background: 'white', borderLeft: '1px solid #ddd', padding: '20px', overflow: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ margin: 0, fontSize: '18px' }}>任务详情</h2>
            <button
              onClick={() => setSelectedTask(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px' }}
            >
              ✕
            </button>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <input
              type="text"
              value={selectedTask.title}
              onChange={(e) => updateTask(selectedTask.id, { title: e.target.value })}
              style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '16px', fontWeight: 500 }}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '5px' }}>优先级</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {(['p1', 'p2', 'p3', 'p4', 'none'] as const).map(p => (
                <button
                  key={p}
                  onClick={() => updateTask(selectedTask.id, { priority: p })}
                  style={{
                    padding: '8px 12px',
                    border: selectedTask.priority === p ? `2px solid ${getPriorityColor(p)}` : '2px solid #ddd',
                    borderRadius: '6px',
                    background: selectedTask.priority === p ? `${getPriorityColor(p)}20` : 'white',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  {getPriorityIcon(p)} {p.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '5px' }}>计划日期</label>
            <input
              type="date"
              value={selectedTask.scheduled_date || ''}
              onChange={(e) => updateTask(selectedTask.id, { scheduled_date: e.target.value })}
              style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px' }}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '5px' }}>截止时间</label>
            <input
              type="datetime-local"
              value={selectedTask.due_at ? selectedTask.due_at.slice(0, 16) : ''}
              onChange={(e) => updateTask(selectedTask.id, { due_at: e.target.value ? new Date(e.target.value).toISOString() : undefined })}
              style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px' }}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '5px' }}>备注</label>
            <textarea
              value={selectedTask.note || ''}
              onChange={(e) => updateTask(selectedTask.id, { note: e.target.value })}
              placeholder="添加备注..."
              style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', minHeight: '80px', resize: 'vertical' }}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '5px' }}>状态</label>
            <div style={{
              padding: '10px',
              background: selectedTask.status === 'done' ? '#d4edda' : '#e3f2fd',
              color: selectedTask.status === 'done' ? '#155724' : '#004085',
              borderRadius: '6px',
              textAlign: 'center'
            }}>
              {selectedTask.status === 'done' ? '✅ 已完成' : '📝 待办'}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => toggleTask(selectedTask.id)}
              style={{
                flex: 1,
                padding: '12px',
                background: selectedTask.status === 'done' ? '#6c757d' : '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              {selectedTask.status === 'done' ? '恢复任务' : '完成任务'}
            </button>
            <button
              onClick={() => deleteTask(selectedTask.id)}
              style={{
                padding: '12px 20px',
                background: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              删除
            </button>
          </div>

          <div style={{ marginTop: '20px', padding: '15px', background: '#f8f9fa', borderRadius: '6px', fontSize: '12px', color: '#666' }}>
            <div>创建时间: {new Date(selectedTask.created_at).toLocaleString('zh-CN')}</div>
            <div>更新时间: {new Date(selectedTask.updated_at).toLocaleString('zh-CN')}</div>
            {selectedTask.completed_at && <div>完成时间: {new Date(selectedTask.completed_at).toLocaleString('zh-CN')}</div>}
          </div>
        </div>
      )}
    </div>
  )
}

export default App
