/**
 * View header component
 */

import React from 'react'
import type { ViewType } from '../../lib/repositories'

interface ViewHeaderProps {
  view: ViewType
  taskCount: number
}

export const ViewHeader: React.FC<ViewHeaderProps> = ({ view, taskCount }) => {
  const getViewInfo = () => {
    switch (view) {
      case 'inbox':
        return {
          icon: '📥',
          title: '收件箱',
          description: '未分类的任务',
        }
      case 'today':
        return {
          icon: '📅',
          title: '今天',
          description: new Date().toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            weekday: 'long',
          }),
        }
      case 'week':
        return {
          icon: '📆',
          title: '未来 7 天',
          description: '本周及下周的任务',
        }
      case 'overdue':
        return {
          icon: '⚠️',
          title: '已逾期',
          description: '这些任务已超过截止时间',
        }
      case 'no-date':
        return {
          icon: '📋',
          title: '无日期任务',
          description: '未设置日期的任务',
        }
      case 'completed':
        return {
          icon: '✅',
          title: '已完成',
          description: '最近完成的任务',
        }
      case 'trash':
        return {
          icon: '🗑️',
          title: '回收站',
          description: '已删除的任务将在 30 天后自动清除',
        }
      default:
        return {
          icon: '📋',
          title: 'EZTODO',
          description: '',
        }
    }
  }

  const { icon, title, description } = getViewInfo()

  return (
    <div className={`view-header ${view}`}>
      <div className="view-header-content">
        <h2>
          <span className="view-icon">{icon}</span>
          {title}
        </h2>
        <p>{description}</p>
      </div>
      <div className="view-header-stats">
        <span className="task-count">{taskCount} 个任务</span>
      </div>
    </div>
  )
}
