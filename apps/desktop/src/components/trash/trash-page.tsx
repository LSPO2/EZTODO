/**
 * Trash page component
 * Shows deleted items and allows restore/permanent delete
 */

import React, { useState, useEffect } from 'react'
import {
  getTrashItems,
  restoreFromTrash,
  restoreMultipleFromTrash,
  permanentlyDelete,
  permanentlyDeleteMultiple,
  emptyTrash,
  getTrashStats,
  getRemainingDays,
} from '../../lib/trash'
import type { TrashItem, TrashStats, EntityType } from '../../lib/trash'

export const TrashPage: React.FC = () => {
  const [items, setItems] = useState<TrashItem[]>([])
  const [stats, setStats] = useState<TrashStats | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [filter, setFilter] = useState<EntityType | 'all'>('all')
  const [isLoading, setIsLoading] = useState(false)
  const [showConfirm, setShowConfirm] = useState<'empty' | 'delete' | null>(null)

  useEffect(() => {
    loadTrash()
  }, [filter])

  const loadTrash = async () => {
    setIsLoading(true)
    try {
      const trashItems = await getTrashItems(filter === 'all' ? undefined : filter)
      setItems(trashItems)
      const trashStats = await getTrashStats()
      setStats(trashStats)
    } finally {
      setIsLoading(false)
    }
  }

  const handleRestore = async (id: string) => {
    try {
      await restoreFromTrash(id)
      await loadTrash()
      setSelectedIds([])
    } catch (error) {
      console.error('Failed to restore:', error)
    }
  }

  const handleRestoreSelected = async () => {
    if (selectedIds.length === 0) return

    try {
      await restoreMultipleFromTrash(selectedIds)
      await loadTrash()
      setSelectedIds([])
    } catch (error) {
      console.error('Failed to restore selected:', error)
    }
  }

  const handlePermanentDelete = async (id: string) => {
    try {
      await permanentlyDelete(id)
      await loadTrash()
      setSelectedIds([])
    } catch (error) {
      console.error('Failed to permanently delete:', error)
    }
  }

  const handlePermanentDeleteSelected = async () => {
    if (selectedIds.length === 0) return

    try {
      await permanentlyDeleteMultiple(selectedIds)
      await loadTrash()
      setSelectedIds([])
      setShowConfirm(null)
    } catch (error) {
      console.error('Failed to permanently delete selected:', error)
    }
  }

  const handleEmptyTrash = async () => {
    try {
      await emptyTrash()
      await loadTrash()
      setSelectedIds([])
      setShowConfirm(null)
    } catch (error) {
      console.error('Failed to empty trash:', error)
    }
  }

  const handleSelectAll = () => {
    if (selectedIds.length === items.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(items.map(item => item.id))
    }
  }

  const handleSelectItem = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id)
        ? prev.filter(i => i !== id)
        : [...prev, id]
    )
  }

  const getEntityIcon = (type: EntityType) => {
    switch (type) {
      case 'task': return '✅'
      case 'project': return '📁'
      case 'tag': return '🏷️'
      default: return '📄'
    }
  }

  const getEntityTypeName = (type: EntityType) => {
    switch (type) {
      case 'task': return '任务'
      case 'project': return '项目'
      case 'tag': return '标签'
      default: return '未知'
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="trash-page">
      <div className="trash-header">
        <h2>🗑️ 回收站</h2>
        <p>已删除的任务将在 30 天后自动清除</p>
      </div>

      {stats && (
        <div className="trash-stats">
          <div className="stat">
            <span className="stat-value">{stats.totalItems}</span>
            <span className="stat-label">总计</span>
          </div>
          <div className="stat">
            <span className="stat-value">{stats.tasks}</span>
            <span className="stat-label">任务</span>
          </div>
          <div className="stat">
            <span className="stat-value">{stats.projects}</span>
            <span className="stat-label">项目</span>
          </div>
          <div className="stat">
            <span className="stat-value">{stats.tags}</span>
            <span className="stat-label">标签</span>
          </div>
        </div>
      )}

      <div className="trash-filters">
        <button
          className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          全部
        </button>
        <button
          className={`filter-btn ${filter === 'task' ? 'active' : ''}`}
          onClick={() => setFilter('task')}
        >
          任务
        </button>
        <button
          className={`filter-btn ${filter === 'project' ? 'active' : ''}`}
          onClick={() => setFilter('project')}
        >
          项目
        </button>
        <button
          className={`filter-btn ${filter === 'tag' ? 'active' : ''}`}
          onClick={() => setFilter('tag')}
        >
          标签
        </button>
      </div>

      <div className="trash-actions">
        <div className="trash-actions-left">
          <label className="select-all">
            <input
              type="checkbox"
              checked={selectedIds.length === items.length && items.length > 0}
              onChange={handleSelectAll}
            />
            全选
          </label>
          {selectedIds.length > 0 && (
            <span className="selected-count">
              已选择 {selectedIds.length} 项
            </span>
          )}
        </div>

        <div className="trash-actions-right">
          {selectedIds.length > 0 && (
            <>
              <button className="btn-restore" onClick={handleRestoreSelected}>
                恢复选中
              </button>
              <button
                className="btn-delete"
                onClick={() => setShowConfirm('delete')}
              >
                永久删除选中
              </button>
            </>
          )}
          {items.length > 0 && (
            <button
              className="btn-empty"
              onClick={() => setShowConfirm('empty')}
            >
              清空回收站
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="trash-loading">加载中...</div>
      ) : items.length === 0 ? (
        <div className="trash-empty">
          <div className="empty-icon">🗑️</div>
          <h3>回收站为空</h3>
          <p>删除的任务会出现在这里</p>
        </div>
      ) : (
        <div className="trash-list">
          {items.map(item => {
            const entityData = JSON.parse(item.entityData)
            const remainingDays = getRemainingDays(item.expiresAt)

            return (
              <div key={item.id} className="trash-item">
                <div className="trash-item-checkbox">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(item.id)}
                    onChange={() => handleSelectItem(item.id)}
                  />
                </div>

                <div className="trash-item-icon">
                  {getEntityIcon(item.entityType)}
                </div>

                <div className="trash-item-info">
                  <div className="trash-item-title">
                    {entityData.title || entityData.name || 'Untitled'}
                  </div>
                  <div className="trash-item-meta">
                    <span className="entity-type">
                      {getEntityTypeName(item.entityType)}
                    </span>
                    <span className="deleted-at">
                      删除于 {formatDate(item.deletedAt)}
                    </span>
                    <span className="remaining-days">
                      剩余 {remainingDays} 天
                    </span>
                  </div>
                </div>

                <div className="trash-item-actions">
                  <button
                    className="btn-restore"
                    onClick={() => handleRestore(item.id)}
                    title="恢复"
                  >
                    恢复
                  </button>
                  <button
                    className="btn-delete"
                    onClick={() => handlePermanentDelete(item.id)}
                    title="永久删除"
                  >
                    永久删除
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showConfirm && (
        <div className="confirm-dialog">
          <div className="confirm-content">
            <h3>
              {showConfirm === 'empty'
                ? '确定要清空回收站吗？'
                : `确定要永久删除选中的 ${selectedIds.length} 项吗？`}
            </h3>
            <p>此操作不可恢复</p>
            <div className="confirm-actions">
              <button
                className="btn-cancel"
                onClick={() => setShowConfirm(null)}
              >
                取消
              </button>
              <button
                className="btn-confirm"
                onClick={
                  showConfirm === 'empty'
                    ? handleEmptyTrash
                    : handlePermanentDeleteSelected
                }
              >
                确定
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
