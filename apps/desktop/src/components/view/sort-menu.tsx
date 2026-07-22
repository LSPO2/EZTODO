/**
 * Sort menu component
 */

import React, { useState } from 'react'
import type { SortField, SortDirection } from '../../lib/repositories'

interface SortMenuProps {
  sortField: SortField
  sortDirection: SortDirection
  onSortChange: (field: SortField, direction: SortDirection) => void
}

export const SortMenu: React.FC<SortMenuProps> = ({
  sortField,
  sortDirection,
  onSortChange,
}) => {
  const [isOpen, setIsOpen] = useState(false)

  const sortOptions: Array<{ field: SortField; label: string }> = [
    { field: 'sortOrder', label: '手动排序' },
    { field: 'createdAt', label: '创建时间' },
    { field: 'scheduledDate', label: '计划时间' },
    { field: 'dueAt', label: '截止时间' },
    { field: 'priority', label: '优先级' },
  ]

  const handleSortChange = (field: SortField) => {
    if (field === sortField) {
      // Toggle direction
      onSortChange(field, sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      // New field, default direction
      onSortChange(field, field === 'priority' ? 'desc' : 'asc')
    }
    setIsOpen(false)
  }

  const getSortLabel = () => {
    const option = sortOptions.find((o) => o.field === sortField)
    return option?.label || '排序'
  }

  const getDirectionIcon = () => {
    return sortDirection === 'asc' ? '↑' : '↓'
  }

  return (
    <div className="sort-menu">
      <button
        className={`sort-toggle ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        ↕️ {getSortLabel()} {getDirectionIcon()}
      </button>

      {isOpen && (
        <div className="sort-panel">
          {sortOptions.map((option) => (
            <button
              key={option.field}
              className={`sort-option ${sortField === option.field ? 'selected' : ''}`}
              onClick={() => handleSortChange(option.field)}
            >
              <span className="sort-label">{option.label}</span>
              {sortField === option.field && (
                <span className="sort-direction">{getDirectionIcon()}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
