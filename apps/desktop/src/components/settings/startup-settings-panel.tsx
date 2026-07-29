import React, { useEffect, useState } from 'react'
import { disable, enable, isEnabled } from '@tauri-apps/plugin-autostart'

export const StartupSettingsPanel: React.FC = () => {
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void isEnabled()
      .then(value => {
        if (active) setEnabled(value)
      })
      .catch(() => {
        if (active) setError('无法读取开机自启状态，请在 Windows 桌面版中重试。')
      })
    return () => {
      active = false
    }
  }, [])

  const handleToggle = async () => {
    if (enabled === null || isSaving) return
    const nextEnabled = !enabled
    setIsSaving(true)
    setMessage(null)
    setError(null)
    try {
      if (nextEnabled) await enable()
      else await disable()
      const verified = await isEnabled()
      setEnabled(verified)
      setMessage(verified ? '已开启开机自启。' : '已关闭开机自启。')
    } catch {
      setError(nextEnabled ? '开启开机自启失败，请重试。' : '关闭开机自启失败，请重试。')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section style={{ background: 'white', borderRadius: '8px', padding: '20px' }}>
      <h2 style={{ margin: '0 0 6px' }}>常规设置</h2>
      <p style={{ margin: '0 0 20px', color: '#667085', fontSize: '13px' }}>
        管理 EZTODO 在 Windows 登录后的启动行为。
      </p>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '20px',
        padding: '16px',
        border: '1px solid #e4e7ec',
        borderRadius: '8px',
      }}>
        <div>
          <div style={{ color: '#1d2939', fontWeight: 600 }}>开机自启</div>
          <div style={{ marginTop: '4px', color: '#667085', fontSize: '12px' }}>
            登录 Windows 后自动启动 EZTODO。
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-label="开机自启"
          aria-checked={enabled ?? false}
          disabled={enabled === null || isSaving}
          onClick={() => void handleToggle()}
          style={{
            minWidth: '104px',
            padding: '9px 14px',
            border: 'none',
            borderRadius: '999px',
            cursor: enabled === null || isSaving ? 'wait' : 'pointer',
            background: enabled ? '#12b76a' : '#e4e7ec',
            color: enabled ? 'white' : '#344054',
            fontWeight: 600,
            opacity: enabled === null ? 0.65 : 1,
          }}
        >
          {isSaving ? '处理中…' : enabled === null ? '读取中…' : enabled ? '已开启' : '已关闭'}
        </button>
      </div>

      {message && <p role="status" style={{ margin: '12px 0 0', color: '#067647', fontSize: '13px' }}>{message}</p>}
      {error && <p role="alert" style={{ margin: '12px 0 0', color: '#b42318', fontSize: '13px' }}>{error}</p>}
    </section>
  )
}