/**
 * EZTODO Desktop Application
 */

import React, { useState, useEffect } from 'react'

// Simple task type
interface Task {
  id: string
  title: string
  status: string
  priority: string
  project_id?: string
  scheduled_date?: string
  due_at?: string
}

const App: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([])
  const [currentView, setCurrentView] = useState<string>('today')
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [inputValue, setInputValue] = useState('')

  useEffect(() => {
    // Load or initialize sample data
    const db = localStorage.getItem('eztodo_db')
    if (db) {
      const data = JSON.parse(db)
      setTasks(data.tasks || [])
    } else {
      const sampleTasks: Task[] = [
        { id: '1', title: '提交项目报告', status: 'todo', priority: 'p1', project_id: 'proj-1', scheduled_date: new Date().toISOString().split('T')[0] },
        { id: '2', title: '准备明天的会议材料', status: 'todo', priority: 'p2', project_id: 'proj-1' },
        { id: '3', title: '买菜做饭', status: 'todo', priority: 'p3', project_id: 'proj-3' },
        { id: '4', title: '回复邮件', status: 'done', priority: 'none', project_id: 'proj-1' },
        { id: '5', title: '每周一晚上八点复习高数', status: 'todo', priority: 'none', project_id: 'proj-2' },
      ]
      localStorage.setItem('eztodo_db', JSON.stringify({ tasks: sampleTasks, projects: [], tags: [] }))
      setTasks(sampleTasks)
    }
  }, [])

  const addTask = () => {
    if (!inputValue.trim()) return
    const newTask: Task = {
      id: Date.now().toString(),
      title: inputValue.trim(),
      status: 'todo',
      priority: 'none',
    }
    const updatedTasks = [...tasks, newTask]
    setTasks(updatedTasks)
    localStorage.setItem('eztodo_db', JSON.stringify({ tasks: updatedTasks, projects: [], tags: [] }))
    setInputValue('')
  }

  const toggleTask = (taskId: string) => {
    const updatedTasks = tasks.map(t =>
      t.id === taskId ? { ...t, status: t.status === 'done' ? 'todo' : 'done' } : t
    )
    setTasks(updatedTasks)
    localStorage.setItem('eztodo_db', JSON.stringify({ tasks: updatedTasks, projects: [], tags: [] }))
  }

  const deleteTask = (taskId: string) => {
    const updatedTasks = tasks.filter(t => t.id !== taskId)
    setTasks(updatedTasks)
    localStorage.setItem('eztodo_db', JSON.stringify({ tasks: updatedTasks, projects: [], tags: [] }))
    if (selectedTask?.id === taskId) setSelectedTask(null)
  }

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
    switch (projectId) {
      case 'proj-1': return '💼 工作'
      case 'proj-2': return '📚 学习'
      case 'proj-3': return '🏠 生活'
      default: return '📥 收件箱'
    }
  }

  const filteredTasks = tasks.filter(t => {
    switch (currentView) {
      case 'inbox': return !t.project_id && t.status === 'todo'
      case 'today': return t.status === 'todo' && (t.scheduled_date === new Date().toISOString().split('T')[0] || !t.scheduled_date)
      case 'completed': return t.status === 'done'
      default: return t.status === 'todo'
    }
  })

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      {/* Sidebar */}
      <div style={{ width: '240px', background: '#2c3e50', color: 'white', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px', borderBottom: '1px solid #34495e' }}>
          <h2 style={{ margin: 0, fontSize: '20px' }}>📋 EZTODO</h2>
          <div style={{ marginTop: '10px', fontSize: '12px', opacity: 0.7 }}>v1.0.0</div>
        </div>
        <nav style={{ flex: 1, padding: '10px' }}>
          {[
            { id: 'inbox', icon: '📥', label: '收件箱' },
            { id: 'today', icon: '📅', label: '今天' },
            { id: 'week', icon: '📆', label: '未来 7 天' },
            { id: 'overdue', icon: '⚠️', label: '已逾期' },
            { id: 'completed', icon: '✅', label: '已完成' },
          ].map(item => (
            <div
              key={item.id}
              onClick={() => setCurrentView(item.id)}
              style={{
                padding: '12px 15px',
                borderRadius: '6px',
                cursor: 'pointer',
                marginBottom: '5px',
                background: currentView === item.id ? '#3498db' : 'transparent',
                transition: 'background 0.2s'
              }}
            >
              <span style={{ marginRight: '10px' }}>{item.icon}</span>
              {item.label}
            </div>
          ))}
        </nav>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f5f5f5' }}>
        {/* Header */}
        <div style={{ padding: '20px', background: 'white', borderBottom: '1px solid #ddd' }}>
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

        {/* Quick Add */}
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

        {/* Task List */}
        <div style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
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
                  <div style={{ fontSize: '12px', color: '#999', marginTop: '5px' }}>
                    {getPriorityIcon(task.priority)} {getProjectName(task.project_id)}
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteTask(task.id) }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: '#e74c3c', padding: '5px' }}
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
            <h3 style={{ margin: '0 0 10px', fontSize: '16px' }}>{selectedTask.title}</h3>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <span style={{
                padding: '4px 12px',
                borderRadius: '20px',
                fontSize: '12px',
                background: selectedTask.priority === 'p1' ? '#fee2e2' : selectedTask.priority === 'p2' ? '#fef3c7' : '#f3f4f6',
                color: getPriorityColor(selectedTask.priority)
              }}>
                {getPriorityIcon(selectedTask.priority)} {selectedTask.priority.toUpperCase()}
              </span>
              <span style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '12px', background: '#e3f2fd', color: '#1976d2' }}>
                {getProjectName(selectedTask.project_id)}
              </span>
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '5px' }}>状态</label>
            <div style={{
              padding: '8px 12px',
              background: selectedTask.status === 'done' ? '#d4edda' : '#e3f2fd',
              color: selectedTask.status === 'done' ? '#155724' : '#004085',
              borderRadius: '4px',
              fontSize: '14px'
            }}>
              {selectedTask.status === 'done' ? '✅ 已完成' : '📝 待办'}
            </div>
          </div>

          {selectedTask.scheduled_date && (
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '5px' }}>计划日期</label>
              <div style={{ padding: '8px 12px', background: '#f8f9fa', borderRadius: '4px', fontSize: '14px' }}>
                📅 {selectedTask.scheduled_date}
              </div>
            </div>
          )}

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '5px' }}>操作</label>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => toggleTask(selectedTask.id)}
                style={{
                  flex: 1,
                  padding: '10px',
                  background: selectedTask.status === 'done' ? '#6c757d' : '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                {selectedTask.status === 'done' ? '恢复' : '完成'}
              </button>
              <button
                onClick={() => deleteTask(selectedTask.id)}
                style={{
                  flex: 1,
                  padding: '10px',
                  background: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
