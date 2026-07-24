import React, { useEffect, useState } from 'react'
import {
  forgetRememberedApiKey,
  getSessionApiKey,
  loadRememberedApiKey,
  saveAISettings,
  saveApiKey,
  validateAISettings,
  type AIProviderSettings,
} from '../../lib/ai-settings'
import { listAIModels, testAIProvider } from '../../lib/ai-client'

interface AISettingsPanelProps {
  settings: AIProviderSettings
  onSaved: (settings: AIProviderSettings) => void
}

type SettingsStatus = {
  type: 'success' | 'error' | 'info'
  message: string
}

export const AISettingsPanel: React.FC<AISettingsPanelProps> = ({ settings, onSaved }) => {
  const [draft, setDraft] = useState(settings)
  const [apiKey, setApiKey] = useState(getSessionApiKey())
  const [rememberKey, setRememberKey] = useState(true)
  const [models, setModels] = useState<string[]>([])
  const [status, setStatus] = useState<SettingsStatus | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [isLoadingModels, setIsLoadingModels] = useState(false)
  const [isForgetting, setIsForgetting] = useState(false)

  useEffect(() => {
    let active = true
    loadRememberedApiKey()
      .then(key => {
        if (active && key) setApiKey(key)
      })
      .catch(error => {
        if (active) {
          setStatus({
            type: 'error',
            message: error instanceof Error ? error.message : '读取 Windows 凭据失败',
          })
        }
      })
    return () => {
      active = false
    }
  }, [])

  const persistSettings = async (): Promise<AIProviderSettings> => {
    const validationError = validateAISettings(draft)
    if (validationError) throw new Error(validationError)
    if (!apiKey.trim()) throw new Error('请填写 API Key')

    await saveApiKey(apiKey, rememberKey)
    const saved = await saveAISettings(draft)
    onSaved(saved)
    return saved
  }

  const handleSave = async () => {
    setIsSaving(true)
    setStatus(null)
    try {
      await persistSettings()
      setStatus({
        type: 'success',
        message: rememberKey
          ? '设置已保存，API Key 已写入 Windows 凭据管理器。'
          : '设置已保存，API Key 仅保留到本次应用退出。',
      })
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

  const handleLoadModels = async () => {
    setIsLoadingModels(true)
    setStatus({ type: 'info', message: '正在从 API 获取模型列表…' })
    try {
      const validationError = validateAISettings(draft)
      if (validationError) throw new Error(validationError)
      const loadedModels = await listAIModels(draft, apiKey)
      setModels(loadedModels)
      setStatus({ type: 'success', message: `已获取 ${loadedModels.length} 个模型，请选择后保存。` })
    } catch (error) {
      setStatus({ type: 'error', message: error instanceof Error ? error.message : '获取模型列表失败' })
    } finally {
      setIsLoadingModels(false)
    }
  }

  const handleForgetKey = async () => {
    setIsForgetting(true)
    setStatus(null)
    try {
      await forgetRememberedApiKey()
      setApiKey('')
      setStatus({ type: 'success', message: '已从 Windows 凭据管理器删除 API Key。' })
    } catch (error) {
      setStatus({ type: 'error', message: error instanceof Error ? error.message : '删除凭据失败' })
    } finally {
      setIsForgetting(false)
    }
  }

  const busy = isSaving || isTesting || isLoadingModels || isForgetting
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
          支持 OpenAI 兼容的 <code>/chat/completions</code> 和 <code>/models</code> 接口。
          服务地址与模型保存在应用数据库；API Key 默认保存在当前 Windows 用户的凭据管理器中。
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
            onChange={event => {
              setDraft({ ...draft, apiBase: event.target.value })
              setModels([])
            }}
            placeholder="https://api.deepseek.com"
            style={fieldStyle}
          />
        </label>

        {models.length > 0 && (
          <label style={{ display: 'block', marginBottom: '10px' }}>
            <span style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>API 模型列表</span>
            <select
              aria-label="API 模型列表"
              value={models.includes(draft.model) ? draft.model : ''}
              onChange={event => {
                if (event.target.value) {
                  setDraft({ ...draft, model: event.target.value })
                }
              }}
              style={fieldStyle}
            >
              <option value="">请选择模型</option>
              {models.map(model => <option key={model} value={model}>{model}</option>)}
            </select>
          </label>
        )}

        <label style={{ display: 'block', marginBottom: '8px' }}>
          <span style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>模型名称</span>
          <input
            aria-label="AI 模型"
            value={draft.model}
            onChange={event => setDraft({ ...draft, model: event.target.value })}
            placeholder="deepseek-chat"
            style={fieldStyle}
          />
        </label>

        <button
          type="button"
          onClick={handleLoadModels}
          disabled={busy || !apiKey.trim()}
          style={{ padding: '8px 12px', marginBottom: '16px', background: 'white', color: '#175cd3', border: '1px solid #84adff', borderRadius: '6px', cursor: 'pointer' }}
        >
          {isLoadingModels ? '获取中…' : '从 API 获取模型列表'}
        </button>

        <label style={{ display: 'block', marginBottom: '10px' }}>
          <span style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>API Key</span>
          <input
            aria-label="AI API Key"
            type="password"
            autoComplete="new-password"
            value={apiKey}
            onChange={event => setApiKey(event.target.value)}
            placeholder="输入服务商 API Key"
            style={fieldStyle}
          />
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', fontSize: '13px', color: '#344054' }}>
          <input
            aria-label="记住 API Key"
            type="checkbox"
            checked={rememberKey}
            onChange={event => setRememberKey(event.target.checked)}
          />
          默认记住密钥（保存到 Windows 凭据管理器）
        </label>

        <div style={{ fontSize: '12px', color: '#175cd3', background: '#eff8ff', border: '1px solid #b2ddff', borderRadius: '6px', padding: '10px 12px', marginBottom: '18px' }}>
          API Key 不会写入 SQLite、localStorage 或日志。取消“记住”后保存，会删除此前保存的 Windows 凭据。
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

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={handleSave}
            disabled={busy}
            style={{ padding: '10px 18px', background: '#3498db', color: 'white', border: 0, borderRadius: '6px', cursor: 'pointer' }}
          >
            {isSaving ? '保存中…' : '保存设置'}
          </button>
          <button
            onClick={handleTest}
            disabled={busy}
            style={{ padding: '10px 18px', background: 'white', color: '#344054', border: '1px solid #d0d5dd', borderRadius: '6px', cursor: 'pointer' }}
          >
            {isTesting ? '测试中…' : '测试连接'}
          </button>
          <button
            type="button"
            onClick={handleForgetKey}
            disabled={busy}
            style={{ padding: '10px 18px', background: 'white', color: '#b42318', border: '1px solid #fda29b', borderRadius: '6px', cursor: 'pointer' }}
          >
            {isForgetting ? '删除中…' : '删除已保存密钥'}
          </button>
        </div>
      </div>
    </div>
  )
}
