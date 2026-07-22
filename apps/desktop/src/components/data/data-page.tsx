/**
 * Data management page component
 * Handles import, export, and backup/restore
 */

import React, { useState, useRef } from 'react'
import { importTasks, previewImport, detectEncoding } from '../../lib/import'
import type { ImportFormat, ImportPreview, ImportResult } from '../../lib/import'
import { exportTasks, downloadExport } from '../../lib/export'
import type { ExportFormat } from '../../lib/export'
import { downloadBackup, previewBackup, restoreFromBackup } from '../../lib/backup'
import type { BackupMetadata, RestoreResult } from '../../lib/backup'

type Tab = 'import' | 'export' | 'backup'

export const DataPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('import')

  return (
    <div className="data-page">
      <div className="data-header">
        <h2>📦 数据管理</h2>
        <p>导入、导出和备份您的任务数据</p>
      </div>

      <div className="data-tabs">
        <button
          className={`tab ${activeTab === 'import' ? 'active' : ''}`}
          onClick={() => setActiveTab('import')}
        >
          📥 导入
        </button>
        <button
          className={`tab ${activeTab === 'export' ? 'active' : ''}`}
          onClick={() => setActiveTab('export')}
        >
          📤 导出
        </button>
        <button
          className={`tab ${activeTab === 'backup' ? 'active' : ''}`}
          onClick={() => setActiveTab('backup')}
        >
          💾 备份恢复
        </button>
      </div>

      <div className="data-content">
        {activeTab === 'import' && <ImportSection />}
        {activeTab === 'export' && <ExportSection />}
        {activeTab === 'backup' && <BackupSection />}
      </div>
    </div>
  )
}

const ImportSection: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [format, setFormat] = useState<ImportFormat>('csv')
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fileContent, setFileContent] = useState<string | null>(null)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsLoading(true)
    setError(null)
    setPreview(null)
    setResult(null)

    try {
      // Read file
      const buffer = await file.arrayBuffer()
      const encoding = detectEncoding(buffer)

      if (encoding === 'unknown') {
        throw new Error('不支持的文件编码，请使用 UTF-8 编码')
      }

      const content = new TextDecoder(encoding === 'utf-8-bom' ? 'utf-8' : encoding).decode(buffer)
      setFileContent(content)

      // Detect format
      const ext = file.name.split('.').pop()?.toLowerCase()
      const detectedFormat: ImportFormat =
        ext === 'json' ? 'json' :
        ext === 'md' ? 'markdown' :
        'csv'
      setFormat(detectedFormat)

      // Preview
      const previewData = await previewImport(content, detectedFormat)
      setPreview(previewData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to read file')
    } finally {
      setIsLoading(false)
    }
  }

  const handleImport = async () => {
    if (!fileContent) return

    setIsLoading(true)
    setError(null)

    try {
      const importResult = await importTasks(fileContent, {
        format,
        encoding: 'utf-8',
        skipDuplicates: true,
      })
      setResult(importResult)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="import-section">
      <div className="import-upload">
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.json,.md,.markdown"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
        <button
          className="btn-upload"
          onClick={() => fileInputRef.current?.click()}
          disabled={isLoading}
        >
          📁 选择文件
        </button>
        <p className="upload-hint">
          支持 CSV、JSON、Markdown 格式
        </p>
      </div>

      {error && (
        <div className="import-error">
          ⚠️ {error}
        </div>
      )}

      {preview && (
        <div className="import-preview">
          <h3>预览</h3>
          <div className="preview-info">
            <span>格式: {format.toUpperCase()}</span>
            <span>共 {preview.totalRows} 条记录</span>
          </div>

          <div className="preview-table-wrapper">
            <table className="preview-table">
              <thead>
                <tr>
                  {preview.headers.map((header, i) => (
                    <th key={i}>{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row, i) => (
                  <tr key={i}>
                    {row.map((cell, j) => (
                      <td key={j}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {preview.suggestedMapping.length > 0 && (
            <div className="preview-mapping">
              <h4>字段映射</h4>
              <div className="mapping-list">
                {preview.suggestedMapping.map((mapping, i) => (
                  <div key={i} className="mapping-item">
                    <span className="source">{mapping.source}</span>
                    <span className="arrow">→</span>
                    <span className="target">{mapping.target}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            className="btn-import"
            onClick={handleImport}
            disabled={isLoading}
          >
            {isLoading ? '导入中...' : `导入 ${preview.totalRows} 条记录`}
          </button>
        </div>
      )}

      {result && (
        <div className={`import-result ${result.success ? 'success' : 'warning'}`}>
          <h3>导入结果</h3>
          <div className="result-stats">
            <span className="imported">✓ 成功: {result.imported}</span>
            <span className="skipped">⊘ 跳过: {result.skipped}</span>
            <span className="errors">✗ 错误: {result.errors.length}</span>
          </div>
          {result.errors.length > 0 && (
            <div className="result-errors">
              <h4>错误详情</h4>
              {result.errors.slice(0, 10).map((err, i) => (
                <div key={i} className="error-item">
                  行 {err.row}: {err.field} - {err.message}
                </div>
              ))}
              {result.errors.length > 10 && (
                <div className="error-more">
                  还有 {result.errors.length - 10} 个错误...
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const ExportSection: React.FC = () => {
  const [format, setFormat] = useState<ExportFormat>('json')
  const [includeCompleted, setIncludeCompleted] = useState(true)
  const [isLoading, setIsLoading] = useState(false)

  const handleExport = async () => {
    setIsLoading(true)

    try {
      const result = await exportTasks({
        format,
        includeCompleted,
      })
      downloadExport(result)
    } catch (error) {
      console.error('Export failed:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="export-section">
      <div className="export-options">
        <div className="option-group">
          <label>导出格式</label>
          <div className="format-options">
            <button
              className={`format-btn ${format === 'json' ? 'active' : ''}`}
              onClick={() => setFormat('json')}
            >
              📄 JSON
              <span className="format-desc">完整数据，可导入恢复</span>
            </button>
            <button
              className={`format-btn ${format === 'csv' ? 'active' : ''}`}
              onClick={() => setFormat('csv')}
            >
              📊 CSV
              <span className="format-desc">通用格式，可用 Excel 打开</span>
            </button>
            <button
              className={`format-btn ${format === 'markdown' ? 'active' : ''}`}
              onClick={() => setFormat('markdown')}
            >
              📝 Markdown
              <span className="format-desc">复选框格式，便于阅读</span>
            </button>
          </div>
        </div>

        <div className="option-group">
          <label>
            <input
              type="checkbox"
              checked={includeCompleted}
              onChange={(e) => setIncludeCompleted(e.target.checked)}
            />
            包含已完成任务
          </label>
        </div>
      </div>

      <button
        className="btn-export"
        onClick={handleExport}
        disabled={isLoading}
      >
        {isLoading ? '导出中...' : '📥 导出数据'}
      </button>
    </div>
  )
}

const BackupSection: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [backupMetadata, setBackupMetadata] = useState<BackupMetadata | null>(null)
  const [restoreResult, setRestoreResult] = useState<RestoreResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)
  const [fileContent, setFileContent] = useState<string | null>(null)

  const handleBackup = async () => {
    setIsLoading(true)

    try {
      await downloadBackup()
    } catch (error) {
      console.error('Backup failed:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsLoading(true)
    setError(null)
    setBackupMetadata(null)
    setRestoreResult(null)

    try {
      const content = await file.text()
      setFileContent(content)
      const metadata = await previewBackup(content)
      setBackupMetadata(metadata)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to read backup')
    } finally {
      setIsLoading(false)
    }
  }

  const handleRestore = async () => {
    if (!fileContent) return

    setIsLoading(true)
    setError(null)

    try {
      const result = await restoreFromBackup(fileContent)
      setRestoreResult(result)
      setShowConfirm(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Restore failed')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="backup-section">
      <div className="backup-actions">
        <div className="backup-action">
          <h3>创建备份</h3>
          <p>导出所有数据为备份文件</p>
          <button
            className="btn-backup"
            onClick={handleBackup}
            disabled={isLoading}
          >
            💾 创建备份
          </button>
        </div>

        <div className="backup-action">
          <h3>恢复备份</h3>
          <p>从备份文件恢复数据</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
          <button
            className="btn-restore"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
          >
            📂 选择备份文件
          </button>
        </div>
      </div>

      {error && (
        <div className="backup-error">
          ⚠️ {error}
        </div>
      )}

      {backupMetadata && (
        <div className="backup-preview">
          <h3>备份信息</h3>
          <div className="backup-info">
            <div className="info-item">
              <span className="label">版本:</span>
              <span className="value">{backupMetadata.version}</span>
            </div>
            <div className="info-item">
              <span className="label">创建时间:</span>
              <span className="value">
                {new Date(backupMetadata.createdAt).toLocaleString('zh-CN')}
              </span>
            </div>
            <div className="info-item">
              <span className="label">应用版本:</span>
              <span className="value">{backupMetadata.appVersion}</span>
            </div>
          </div>

          <div className="backup-counts">
            <h4>包含数据</h4>
            <div className="counts-grid">
              <div className="count-item">
                <span className="count-value">{backupMetadata.itemCounts.tasks}</span>
                <span className="count-label">任务</span>
              </div>
              <div className="count-item">
                <span className="count-value">{backupMetadata.itemCounts.projects}</span>
                <span className="count-label">项目</span>
              </div>
              <div className="count-item">
                <span className="count-value">{backupMetadata.itemCounts.tags}</span>
                <span className="count-label">标签</span>
              </div>
              <div className="count-item">
                <span className="count-value">{backupMetadata.itemCounts.reminders}</span>
                <span className="count-label">提醒</span>
              </div>
            </div>
          </div>

          <div className="backup-warning">
            ⚠️ 恢复将覆盖当前所有数据，建议先创建备份
          </div>

          <button
            className="btn-restore-confirm"
            onClick={() => setShowConfirm(true)}
            disabled={isLoading}
          >
            恢复此备份
          </button>
        </div>
      )}

      {restoreResult && (
        <div className={`restore-result ${restoreResult.success ? 'success' : 'warning'}`}>
          <h3>恢复结果</h3>
          <div className="result-stats">
            <span>任务: {restoreResult.restored.tasks}</span>
            <span>项目: {restoreResult.restored.projects}</span>
            <span>标签: {restoreResult.restored.tags}</span>
            <span>提醒: {restoreResult.restored.reminders}</span>
          </div>
          {restoreResult.errors.length > 0 && (
            <div className="result-errors">
              <h4>错误</h4>
              {restoreResult.errors.map((err, i) => (
                <div key={i} className="error-item">{err}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {showConfirm && (
        <div className="confirm-dialog">
          <div className="confirm-content">
            <h3>确定要恢复备份吗？</h3>
            <p>当前所有数据将被覆盖，此操作不可撤销</p>
            <div className="confirm-actions">
              <button
                className="btn-cancel"
                onClick={() => setShowConfirm(false)}
              >
                取消
              </button>
              <button
                className="btn-confirm"
                onClick={handleRestore}
                disabled={isLoading}
              >
                {isLoading ? '恢复中...' : '确定恢复'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
