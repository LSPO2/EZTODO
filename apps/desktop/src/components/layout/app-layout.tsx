/**
 * Main application layout
 * P0-1: Use Repository -> SQLite architecture
 */

import React, { useEffect, useState, useCallback } from 'react'
import { useTaskStore, useProjectStore } from '../../stores'
import type { Task, ViewType } from '../../lib/repositories'

export const AppLayout: React.FC = () => {
  const { tasks, isLoading, error, loadTasks, createTask, updateTask, deleteTask, completeTask, uncompleteTask } = useTaskStore()
  const { projects, loadProjects } = useProjectStore()

  const [currentView, setCurrentView] = useState<ViewType>('today')
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [inputValue, setInputValue] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  // Load initial data
  useEffect(() => {
    loadTasks()
    loadProjects()
  }, [])

  // Reload tasks when view changes
  useEffect(() => {
    loadTasks()
  }, [currentView])

  // Task operations
  const handleAddTask = useCallback(async () => {
    if (!inputValue.trim()) return
    try {
      await createTask({ title: inputValue.trim() })
      setInputValue('')
    } catch (err) {
      console.error('Failed to create task:', err)
    }
  }, [inputValue, createTask])

  const handleToggleTask = useCallback(async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId)
    if (!task) return

    try {
      if (task.status === 'done') {
        await uncompleteTask(taskId)
      } else {
        await completeTask(taskId)
      }
    } catch (err) {
      console.error('Failed to toggle task:', err)
    }
  }, [tasks, completeTask, uncompleteTask])

  const handleDeleteTask = useCallback(async (taskId: string) => {
    try {
      await deleteTask(taskId)
      if (selectedTask?.id === taskId) {
        setSelectedTask(null)
      }
    } catch (err) {
      console.error('Failed to delete task:', err)
    }
  }, [deleteTask, selectedTask])

  const handleUpdateTask = useCallback(async (taskId: string, updates: any) => {
    try {
      await updateTask(taskId, updates)
      if (selectedTask?.id === taskId) {
        setSelectedTask(prev => prev ? { ...prev, ...updates } : null)
      }
    } catch (err) {
      console.error('Failed to update task:', err)
    }
  }, [updateTask, selectedTask])

  // Filter tasks based on current view
  const getFilteredTasks = useCallback(() => {
    let filtered = tasks.filter(t => !t.deletedAt)

    // Apply search
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(t =>
        t.title.toLowerCase().includes(query) ||
        (t.note && t.note.toLowerCase().includes(query))
      )
    }

    // Apply view filter
    const today = new Date().toISOString().split('T')[0]
    switch (currentView) {
      case 'inbox':
        return filtered.filter(t => !t.projectId && t.status === 'todo')
      case 'today':
        return filtered.filter(t => t.status === 'todo' && (t.scheduledDate === today || !t.scheduledDate))
      case 'week': {
        const weekLater = new Date()
        weekLater.setDate(weekLater.getDate() + 7)
        const weekStr = weekLater.toISOString().split('T')[0]
        return filtered.filter(t => t.status === 'todo' && t.scheduledDate && t.scheduledDate <= weekStr)
      }
      case 'overdue':
        return filtered.filter(t => t.status === 'todo' && t.dueAt && new Date(t.dueAt) < new Date())
      case 'completed':
        return filtered.filter(t => t.status === 'done')
      default:
        return filtered.filter(t => t.status === 'todo')
    }
  }, [tasks, currentView, searchQuery])

  const filteredTasks = getFilteredTasks()

  // Helper functions
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

  const getProjectName = (projectId?: string | null) => {
    if (!projectId) return '📥 收件箱'
    const project = projects.find(p => p.id === projectId)
    return project ? `${project.icon || '📁'} ${project.name}` : '📥 收件箱'
  }

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
              { id: 'inbox' as ViewType, icon: '📥', label: '收件箱' },
              { id: 'today' as ViewType, icon: '📅', label: '今天' },
              { id: 'week' as ViewType, icon: '📆', label: '未来 7 天' },
              { id: 'overdue' as ViewType, icon: '⚠️', label: '已逾期' },
              { id: 'completed' as ViewType, icon: '✅', label: '已完成' },
            ].map(item => (
              <div
                key={item.id}
                onClick={() => setCurrentView(item.id)}
                style={{
                  padding: '10px 12px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  marginBottom: '4px',
                  background: currentView === item.id ? '#3498db' : 'transparent',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <span style={{ marginRight: '10px' }}>{item.icon}</span>
                {item.label}
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
                <span style={{ marginRight: '10px' }}>{project.icon || '📁'}</span>
                {project.name}
              </div>
            ))}
          </div>
        </nav>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f5f5f5' }}>
        {/* Header */}
        <div style={{ padding: '20px', background: 'white', borderBottom: '1px solid #ddd', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '24px' }}>
              {currentView === 'inbox' && '📥 收件箱'}
              {currentView === 'today' && '📅 今天'}
              {currentView === 'week' && '📆 未来 7 天'}
              {currentView === 'overdue' && '⚠️ 已逾期'}
              {currentView === 'completed' && '✅ 已完成'}
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

        {/* Quick Add */}
        <div style={{ padding: '15px 20px', background: 'white', borderBottom: '1px solid #ddd', display: 'flex', gap: '10px' }}>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAddTask()}
            placeholder="添加任务..."
            style={{ flex: 1, padding: '12px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px' }}
          />
          <button
            onClick={handleAddTask}
            disabled={isLoading}
            style={{ padding: '12px 24px', background: '#3498db', color: 'white', border: 'none', borderRadius: '6px', cursor: isLoading ? 'not-allowed' : 'pointer', fontWeight: 500 }}
          >
            {isLoading ? '添加中...' : '添加'}
          </button>
        </div>

        {/* Error Display */}
        {error && (
          <div style={{ padding: '10px 20px', background: '#fee2e2', color: '#dc2626', fontSize: '14px' }}>
            ⚠️ {error}
          </div>
        )}

        {/* Task List */}
        <div style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
          {isLoading && tasks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#999' }}>
              <div style={{ fontSize: '24px', marginBottom: '15px' }}>⏳</div>
              <p>加载中...</p>
            </div>
          ) : filteredTasks.length === 0 ? (
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
                  onClick={(e) => { e.stopPropagation(); handleToggleTask(task.id) }}
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
                    <span>{getProjectName(task.projectId)}</span>
                    {task.scheduledDate && <span>📅 {task.scheduledDate}</span>}
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDeleteTask(task.id) }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', color: '#e74c3c', padding: '5px', opacity: 0.6 }}
                >
                  🗑️
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Task Detail Panel */}
      {selectedTask && (
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
              onChange={(e) => handleUpdateTask(selectedTask.id, { title: e.target.value })}
              style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '16px', fontWeight: 500 }}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '5px' }}>优先级</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {(['p1', 'p2', 'p3', 'p4', 'none'] as const).map(p => (
                <button
                  key={p}
                  onClick={() => handleUpdateTask(selectedTask.id, { priority: p })}
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
              value={selectedTask.scheduledDate || ''}
              onChange={(e) => handleUpdateTask(selectedTask.id, { scheduledDate: e.target.value || undefined })}
              style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px' }}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '5px' }}>截止时间</label>
            <input
              type="datetime-local"
              value={selectedTask.dueAt ? selectedTask.dueAt.slice(0, 16) : ''}
              onChange={(e) => handleUpdateTask(selectedTask.id, { dueAt: e.target.value ? new Date(e.target.value).toISOString() : undefined })}
              style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px' }}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '5px' }}>备注</label>
            <textarea
              value={selectedTask.note || ''}
              onChange={(e) => handleUpdateTask(selectedTask.id, { note: e.target.value })}
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
              onClick={() => handleToggleTask(selectedTask.id)}
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
              onClick={() => handleDeleteTask(selectedTask.id)}
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
            <div>创建时间: {new Date(selectedTask.createdAt).toLocaleString('zh-CN')}</div>
            <div>更新时间: {new Date(selectedTask.updatedAt).toLocaleString('zh-CN')}</div>
            {selectedTask.completedAt && <div>完成时间: {new Date(selectedTask.completedAt).toLocaleString('zh-CN')}</div>}
          </div>
        </div>
      )}
    </div>
  )
}
