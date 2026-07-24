import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AISettingsPanel } from './ai-settings-panel'

const mocks = vi.hoisted(() => ({
  loadRememberedApiKey: vi.fn(),
  saveApiKey: vi.fn(),
  forgetRememberedApiKey: vi.fn(),
  saveAISettings: vi.fn(),
  testAIProvider: vi.fn(),
  listAIModels: vi.fn(),
}))

vi.mock('../../lib/ai-settings', () => ({
  getSessionApiKey: () => '',
  loadRememberedApiKey: mocks.loadRememberedApiKey,
  saveApiKey: mocks.saveApiKey,
  forgetRememberedApiKey: mocks.forgetRememberedApiKey,
  validateAISettings: () => null,
  saveAISettings: mocks.saveAISettings,
}))

vi.mock('../../lib/ai-client', () => ({
  testAIProvider: mocks.testAIProvider,
  listAIModels: mocks.listAIModels,
}))

const settings = {
  providerName: 'DeepSeek',
  apiBase: 'https://api.deepseek.com',
  model: 'deepseek-chat',
}

describe('AISettingsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.loadRememberedApiKey.mockResolvedValue('stored-key')
    mocks.saveAISettings.mockImplementation(async value => value)
    mocks.saveApiKey.mockResolvedValue(undefined)
    mocks.forgetRememberedApiKey.mockResolvedValue(undefined)
    mocks.testAIProvider.mockResolvedValue(undefined)
    mocks.listAIModels.mockResolvedValue(['deepseek-chat', 'deepseek-reasoner'])
  })

  it('loads the remembered key and remembers it by default when saving', async () => {
    const onSaved = vi.fn()
    render(<AISettingsPanel settings={settings} onSaved={onSaved} />)

    expect(screen.getByLabelText('记住 API Key')).toBeChecked()
    await waitFor(() => expect(screen.getByLabelText('AI API Key')).toHaveValue('stored-key'))
    fireEvent.click(screen.getByRole('button', { name: '保存设置' }))

    await waitFor(() => {
      expect(mocks.saveApiKey).toHaveBeenCalledWith('stored-key', true)
      expect(mocks.saveAISettings).toHaveBeenCalledWith(settings)
      expect(onSaved).toHaveBeenCalledWith(settings)
      expect(screen.getByRole('status')).toHaveTextContent('Windows 凭据管理器')
    })
  })

  it('fetches models from the API and lets the user select one', async () => {
    render(<AISettingsPanel settings={settings} onSaved={vi.fn()} />)
    await waitFor(() => expect(screen.getByLabelText('AI API Key')).toHaveValue('stored-key'))

    fireEvent.click(screen.getByRole('button', { name: '从 API 获取模型列表' }))

    await waitFor(() => {
      expect(mocks.listAIModels).toHaveBeenCalledWith(settings, 'stored-key')
      expect(screen.getByRole('status')).toHaveTextContent('已获取 2 个模型')
    })
    const modelSelect = screen.getByLabelText('API 模型列表')
    expect(modelSelect).toContainHTML('<option value="deepseek-chat">deepseek-chat</option>')
    expect(modelSelect).toContainHTML('<option value="deepseek-reasoner">deepseek-reasoner</option>')

    fireEvent.change(modelSelect, { target: { value: 'deepseek-reasoner' } })
    expect(screen.getByLabelText('AI 模型')).toHaveValue('deepseek-reasoner')
    fireEvent.click(screen.getByRole('button', { name: '保存设置' }))
    await waitFor(() => {
      expect(mocks.saveAISettings).toHaveBeenCalledWith(expect.objectContaining({
        model: 'deepseek-reasoner',
      }))
    })
  })

  it('supports session-only keys and explicit credential deletion', async () => {
    render(<AISettingsPanel settings={settings} onSaved={vi.fn()} />)
    await waitFor(() => expect(screen.getByLabelText('AI API Key')).toHaveValue('stored-key'))

    fireEvent.click(screen.getByLabelText('记住 API Key'))
    fireEvent.click(screen.getByRole('button', { name: '保存设置' }))
    await waitFor(() => expect(mocks.saveApiKey).toHaveBeenCalledWith('stored-key', false))

    fireEvent.click(screen.getByRole('button', { name: '删除已保存密钥' }))
    await waitFor(() => {
      expect(mocks.forgetRememberedApiKey).toHaveBeenCalled()
      expect(screen.getByLabelText('AI API Key')).toHaveValue('')
    })
  })

  it('tests the saved provider connection explicitly', async () => {
    render(<AISettingsPanel settings={settings} onSaved={vi.fn()} />)
    await waitFor(() => expect(screen.getByLabelText('AI API Key')).toHaveValue('stored-key'))
    fireEvent.click(screen.getByRole('button', { name: '测试连接' }))

    await waitFor(() => {
      expect(mocks.testAIProvider).toHaveBeenCalledWith(settings, 'stored-key')
      expect(screen.getByRole('status')).toHaveTextContent('连接成功')
    })
  })
})
