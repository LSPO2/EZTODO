import React, { useState } from 'react'
import {
  getSessionApiKey,
  saveAISettings,
  setSessionApiKey,
  validateAISettings,
  type AIProviderSettings,
} from '../../lib/ai-settings'
import { testAIProvider } from '../../lib/ai-client'

interface AISettingsPanelProps {
  settings: AIProviderSettings
  onSaved: (settings: AIProviderSettings) => void
}

export const AISettingsPanel: React.FC<AISettingsPanelProps> = ({ settings, onSaved }) => {
  const [draft, setDraft] = useState(settings)
  const [apiKey, setApiKey] = useState(getSessionApiKey())
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isTesting, setIsTesting] = useState(false)

  const persistSettings = async (): Promise<AIProviderSettings> => {
    const validationError = validateAISettings(draft)
    if (validationError) throw new Error(validationError)
    if (!apiKey.trim()) throw new Error('请填写 API Key')

    setSessionApiKey(apiKey)
    const saved = await saveAISettings(draft)
    onSaved(saved)
    return saved
  }

  const handleSave = async () => {
    setIsSaving(true)
    setStatus(null)
    try {
      await persistSettings()
      setStatus({ type: 'success', message: '设置已保存。API Key 仅保留到本次应用退出。' })
    } catch (error) {
      setStatus({ type: 'error', message: error instanceof Error ? error.message : '保存失败' })
    } finally {
      setIsSaving(false)
    }
  }

  const handleTest = async () => {
    setIsTesting(true)
    setStatus({ type: 'info', message: '正在测试连接…' })
    try {
      const saved = await persistSettings()
      await testAIProvider(saved, apiKey)
      setStatus({ type: 'success', message: '连接成功，当前模型可以响应请求。' })
    } catch (error) {
      setStatus({ type: 'error', message: error instanceof Error ? error.message : '连接失败' })
    } finally {
      setIsTesting(false)
    }
  }

  const fieldStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #d8dee8',
    borderRadius: '6px',
    fontSize: '14px',
    boxSizing: 'border-box',
  }

  return (
    <div style={{ maxWidth: '680px', margin: '0 auto' }}>
      <div style={{ background: 'white', borderRadius: '10px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <h2 style={{ margin: '0 0 6px' }}>AI 服务设置</h2>
        <p style={{ margin: '0 0 22px', color: '#667085', lineHeight: 1.6 }}>
          支持 OpenAI 兼容的 <code>/chat/completions</code> 接口。服务地址和模型会持久化，
          API Key 只保存在本次运行的内存中，不写入 SQLite、localStorage 或日志。
        </p>

        <label style={{ display: 'block', marginBottom: '16px' }}>
          <span style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>服务商名称</span>
          <input
            aria-label="AI 服务商名称"
            value={draft.providerName}
            onChange={event => setDraft({ ...draft, providerName: event.target.value })}
            placeholder="例如 DeepSeek"
            style={fieldStyle}
          />
        </label>

        <label style={{ display: 'block', marginBottom: '16px' }}>
          <span style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>API Base</span>
          <input
            aria-label="AI API Base"
            value={draft.apiBase}
            onChange={event => setDraft({ ...draft, apiBase: event.target.value })}
            placeholder="https://api.deepseek.com"
            style={fieldStyle}
          />
        </label>

        <label style={{ display: 'block', marginBottom: '16px' }}>
          <span style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>模型</span>
          <input
            aria-label="AI 模型"
            value={draft.model}
            onChange={event => setDraft({ ...draft, model: event.target.value })}
            placeholder="deepseek-chat"
            style={fieldStyle}
          />
        </label>

        <label style={{ display: 'block', marginBottom: '10px' }}>
          <span style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>API Key</span>
          <input
            aria-label="AI API Key"
            type="password"
            autoComplete="off"
            value={apiKey}
            onChange={event => setApiKey(event.target.value)}
            placeholder="仅本次运行使用"
            style={fieldStyle}
          />
        </label>

        <div style={{ fontSize: '12px', color: '#8a5a00', background: '#fff8e6', border: '1px solid #ffe2a8', borderRadius: '6px', padding: '10px 12px', marginBottom: '18px' }}>
          安全提示：重启后需要重新填写 API Key。后续应接入 Windows 凭据管理器后再提供“记住密钥”功能。
        </div>

        {status && (
          <div
            role="status"
            style={{
              marginBottom: '16px',
              padding: '10px 12px',
              borderRadius: '6px',
              color: status.type === 'error' ? '#b42318' : status.type === 'success' ? '#067647' : '#175cd3',
              background: status.type === 'error' ? '#fef3f2' : status.type === 'success' ? '#ecfdf3' : '#eff8ff',
            }}
          >
            {status.message}
          </div>
        )}

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={handleSave}
            disabled={isSaving || isTesting}
            style={{ padding: '10px 18px', background: '#3498db', color: 'white', border: 0, borderRadius: '6px', cursor: 'pointer' }}
          >
            {isSaving ? '保存中…' : '保存设置'}
          </button>
          <button
            onClick={handleTest}
            disabled={isSaving || isTesting}
            style={{ padding: '10px 18px', background: 'white', color: '#344054', border: '1px solid #d0d5dd', borderRadius: '6px', cursor: 'pointer' }}
          >
            {isTesting ? '测试中…' : '测试连接'}
          </button>
        </div>
      </div>
    </div>
  )
}
