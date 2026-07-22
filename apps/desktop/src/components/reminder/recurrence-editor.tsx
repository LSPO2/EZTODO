/**
 * Recurrence rule editor component
 */

import React, { useState, useEffect } from 'react'
import type { RecurrenceConfig, RecurrenceFrequency } from '../../lib/recurrence'
import { createRecurrenceRule, getRecurrenceRule, updateRecurrenceRule, deleteRecurrenceRule } from '../../lib/recurrence'

interface RecurrenceEditorProps {
  taskId: string
  onRuleChange?: () => void
}

const DAYS_OF_WEEK = [
  { value: 0, label: '日', short: '周日' },
  { value: 1, label: '一', short: '周一' },
  { value: 2, label: '二', short: '周二' },
  { value: 3, label: '三', short: '周三' },
  { value: 4, label: '四', short: '周四' },
  { value: 5, label: '五', short: '周五' },
  { value: 6, label: '六', short: '周六' },
]

export const RecurrenceEditor: React.FC<RecurrenceEditorProps> = ({
  taskId,
  onRuleChange,
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [ruleId, setRuleId] = useState<string | null>(null)
  const [config, setConfig] = useState<RecurrenceConfig>({
    frequency: 'daily',
    interval: 1,
    startDate: new Date().toISOString().split('T')[0],
  })

  useEffect(() => {
    loadRule()
  }, [taskId])

  const loadRule = async () => {
    const rule = await getRecurrenceRule(taskId)
    if (rule) {
      setRuleId(rule.id)
      setConfig(rule.config)
      setIsOpen(true)
    }
  }

  const handleSave = async () => {
    try {
      if (ruleId) {
        await updateRecurrenceRule(ruleId, config)
      } else {
        const newRule = await createRecurrenceRule(taskId, config)
        setRuleId(newRule.id)
      }
      onRuleChange?.()
    } catch (error) {
      console.error('Failed to save recurrence rule:', error)
    }
  }

  const handleDelete = async () => {
    if (ruleId) {
      try {
        await deleteRecurrenceRule(ruleId)
        setRuleId(null)
        setConfig({
          frequency: 'daily',
          interval: 1,
          startDate: new Date().toISOString().split('T')[0],
        })
        setIsOpen(false)
        onRuleChange?.()
      } catch (error) {
        console.error('Failed to delete recurrence rule:', error)
      }
    }
  }

  const handleFrequencyChange = (frequency: RecurrenceFrequency) => {
    setConfig({ ...config, frequency })
  }

  const handleDayToggle = (day: number) => {
    const days = config.daysOfWeek || []
    const newDays = days.includes(day)
      ? days.filter((d) => d !== day)
      : [...days, day]

    setConfig({
      ...config,
      daysOfWeek: newDays.length > 0 ? newDays : undefined,
    })
  }

  const getFrequencyLabel = () => {
    switch (config.frequency) {
      case 'daily':
        return config.interval === 1 ? '每天' : `每 ${config.interval} 天`
      case 'weekdays':
        return '工作日'
      case 'weekly':
        if (config.daysOfWeek && config.daysOfWeek.length > 0) {
          const dayNames = config.daysOfWeek
            .sort()
            .map((d) => DAYS_OF_WEEK[d].short)
            .join('、')
          return `每周 ${dayNames}`
        }
        return '每周'
      case 'monthly':
        return config.dayOfMonth ? `每月 ${config.dayOfMonth} 日` : '每月'
      case 'yearly':
        if (config.monthOfYear !== undefined && config.dayOfMonth) {
          return `每年 ${config.monthOfYear + 1} 月 ${config.dayOfMonth} 日`
        }
        return '每年'
      case 'custom':
        return `每 ${config.interval} 天`
      default:
        return '自定义'
    }
  }

  return (
    <div className="recurrence-editor">
      <div className="recurrence-header" onClick={() => setIsOpen(!isOpen)}>
        <span className="recurrence-icon">🔁</span>
        <span className="recurrence-label">
          {ruleId ? getFrequencyLabel() : '设置重复'}
        </span>
        <span className="expand-icon">{isOpen ? '▼' : '▶'}</span>
      </div>

      {isOpen && (
        <div className="recurrence-panel">
          <div className="recurrence-section">
            <label>重复频率</label>
            <select
              value={config.frequency}
              onChange={(e) => handleFrequencyChange(e.target.value as RecurrenceFrequency)}
            >
              <option value="daily">每天</option>
              <option value="weekdays">工作日</option>
              <option value="weekly">每周</option>
              <option value="monthly">每月</option>
              <option value="yearly">每年</option>
              <option value="custom">自定义</option>
            </select>
          </div>

          {(config.frequency === 'daily' || config.frequency === 'custom') && (
            <div className="recurrence-section">
              <label>间隔</label>
              <div className="interval-input">
                <span>每</span>
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={config.interval || 1}
                  onChange={(e) => setConfig({ ...config, interval: parseInt(e.target.value) || 1 })}
                />
                <span>天</span>
              </div>
            </div>
          )}

          {config.frequency === 'weekly' && (
            <div className="recurrence-section">
              <label>星期几</label>
              <div className="days-selector">
                {DAYS_OF_WEEK.map((day) => (
                  <button
                    key={day.value}
                    className={`day-button ${config.daysOfWeek?.includes(day.value) ? 'selected' : ''}`}
                    onClick={() => handleDayToggle(day.value)}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {config.frequency === 'monthly' && (
            <div className="recurrence-section">
              <label>每月几号</label>
              <input
                type="number"
                min="1"
                max="31"
                value={config.dayOfMonth || 1}
                onChange={(e) => setConfig({ ...config, dayOfMonth: parseInt(e.target.value) || 1 })}
              />
            </div>
          )}

          {config.frequency === 'yearly' && (
            <>
              <div className="recurrence-section">
                <label>月份</label>
                <select
                  value={config.monthOfYear || 0}
                  onChange={(e) => setConfig({ ...config, monthOfYear: parseInt(e.target.value) })}
                >
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i} value={i}>{i + 1} 月</option>
                  ))}
                </select>
              </div>
              <div className="recurrence-section">
                <label>日期</label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={config.dayOfMonth || 1}
                  onChange={(e) => setConfig({ ...config, dayOfMonth: parseInt(e.target.value) || 1 })}
                />
              </div>
            </>
          )}

          <div className="recurrence-section">
            <label>开始日期</label>
            <input
              type="date"
              value={config.startDate}
              onChange={(e) => setConfig({ ...config, startDate: e.target.value })}
            />
          </div>

          <div className="recurrence-section">
            <label>结束日期（可选）</label>
            <input
              type="date"
              value={config.endDate || ''}
              onChange={(e) => setConfig({ ...config, endDate: e.target.value || undefined })}
            />
          </div>

          <div className="recurrence-actions">
            <button className="btn-save" onClick={handleSave}>
              保存
            </button>
            {ruleId && (
              <button className="btn-delete" onClick={handleDelete}>
                删除规则
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
