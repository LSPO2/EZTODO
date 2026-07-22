/**
 * Sidebar component
 */

import React from 'react'
import { useTaskStore, useProjectStore } from '../../stores'
import type { ViewType } from '../../lib/repositories'

interface SidebarProps {
  onNavigate?: (page: string) => void
}

export const Sidebar: React.FC<SidebarProps> = ({ onNavigate }) => {
  const { currentView, setView } = useTaskStore()
  const { projects } = useProjectStore()

  const viewItems: Array<{ id: ViewType; icon: string; label: string }> = [
    { id: 'inbox', icon: '📥', label: '收件箱' },
    { id: 'today', icon: '📅', label: '今天' },
    { id: 'week', icon: '📆', label: '未来 7 天' },
    { id: 'overdue', icon: '⚠️', label: '已逾期' },
    { id: 'completed', icon: '✅', label: '已完成' },
    { id: 'trash', icon: '🗑️', label: '回收站' },
  ]

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h3>📋 EZTODO</h3>
        <div className="sync-status synced">
          <div className="dot" />
          <span>已同步</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section">
          <div className="nav-section-title">视图</div>
          {viewItems.map((item) => (
            <div
              key={item.id}
              className={`nav-item ${currentView === item.id ? 'active' : ''}`}
              onClick={() => setView(item.id)}
            >
              <span className="icon">{item.icon}</span>
              <span className="label">{item.label}</span>
            </div>
          ))}
        </div>

        <div className="nav-section">
          <div className="nav-section-title">项目</div>
          {projects.map((project) => (
            <div
              key={project.id}
              className="nav-item project"
              onClick={() => {
                // TODO: Filter by project
              }}
            >
              <span className="icon" style={{ color: project.color || '#95a5a6' }}>
                {project.icon || '📁'}
              </span>
              <span className="label">{project.name}</span>
            </div>
          ))}
          <div className="nav-item add-project">
            <span className="icon">+</span>
            <span className="label">添加项目</span>
          </div>
        </div>

        <div className="nav-section">
          <div className="nav-section-title">工具</div>
          <div className="nav-item" onClick={() => onNavigate?.('data')}>
            <span className="icon">📦</span>
            <span className="label">数据管理</span>
          </div>
        </div>
      </nav>
    </div>
  )
}
