/**
 * Filter bar component
 */

import React, { useState } from 'react'
import type { TaskFilters, TaskPriority, TaskStatus } from '../../lib/repositories'

interface FilterBarProps {
  filters: TaskFilters
  onFiltersChange: (filters: TaskFilters) => void
}

export const FilterBar: React.FC<FilterBarProps> = ({
  filters,
  onFiltersChange,
}) => {
  const [isOpen, setIsOpen] = useState(false)

  const priorities: Array<{ value: TaskPriority; label: string; icon: string }> = [
    { value: 'none', label: '无优先级', icon: '⚪' },
    { value: 'p1', label: 'P1 - 紧急重要', icon: '🔴' },
    { value: 'p2', label: 'P2 - 重要不紧急', icon: '🟠' },
    { value: 'p3', label: 'P3 - 紧急不重要', icon: '🟡' },
    { value: 'p4', label: 'P4 - 不紧急不重要', icon: '🔵' },
  ]

  const statuses: Array<{ value: TaskStatus; label: string }> = [
    { value: 'todo', label: '待办' },
    { value: 'done', label: '已完成' },
    { value: 'cancelled', label: '已取消' },
  ]

  const handlePriorityChange = (priority: TaskPriority) => {
    onFiltersChange({
      ...filters,
      priority: filters.priority === priority ? undefined : priority,
    })
  }

  const handleStatusChange = (status: TaskStatus) => {
    onFiltersChange({
      ...filters,
      status: filters.status === status ? undefined : status,
    })
  }

  const handleClearFilters = () => {
    onFiltersChange({})
  }

  const hasActiveFilters = filters.priority || filters.status || filters.search

  return (
    <div className="filter-bar">
      <button
        className={`filter-toggle ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        🔽 筛选
        {hasActiveFilters && <span className="filter-badge">●</span>}
      </button>

      {isOpen && (
        <div className="filter-panel">
          <div className="filter-section">
            <h4>优先级</h4>
            <div className="filter-options">
              {priorities.map((priority) => (
                <button
                  key={priority.value}
                  className={`filter-option ${filters.priority === priority.value ? 'selected' : ''}`}
                  onClick={() => handlePriorityChange(priority.value)}
                >
                  <span className="filter-icon">{priority.icon}</span>
                  <span className="filter-label">{priority.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="filter-section">
            <h4>状态</h4>
            <div className="filter-options">
              {statuses.map((status) => (
                <button
                  key={status.value}
                  className={`filter-option ${filters.status === status.value ? 'selected' : ''}`}
                  onClick={() => handleStatusChange(status.value)}
                >
                  <span className="filter-label">{status.label}</span>
                </button>
              ))}
            </div>
          </div>

          {hasActiveFilters && (
            <div className="filter-actions">
              <button className="btn-clear-filters" onClick={handleClearFilters}>
                清除所有筛选
              </button>
            </div>
          )}
        </div>
      )}

      {hasActiveFilters && (
        <div className="active-filters">
          {filters.priority && (
            <span className="filter-tag">
              {priorities.find((p) => p.value === filters.priority)?.icon}{' '}
              {priorities.find((p) => p.value === filters.priority)?.label}
              <button onClick={() => handlePriorityChange(filters.priority!)}>✕</button>
            </span>
          )}
          {filters.status && (
            <span className="filter-tag">
              {statuses.find((s) => s.value === filters.status)?.label}
              <button onClick={() => handleStatusChange(filters.status!)}>✕</button>
            </span>
          )}
        </div>
      )}
    </div>
  )
}
