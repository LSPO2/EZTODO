import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AISettingsPanel } from './ai-settings-panel'

const mocks = vi.hoisted(() => ({
  saveAISettings: vi.fn(),
  setSessionApiKey: vi.fn(),
  testAIProvider: vi.fn(),
}))

vi.mock('../../lib/ai-settings', () => ({
  getSessionApiKey: () => '',
  setSessionApiKey: mocks.setSessionApiKey,
  validateAISettings: () => null,
  saveAISettings: mocks.saveAISettings,
}))

vi.mock('../../lib/ai-client', () => ({
  testAIProvider: mocks.testAIProvider,
}))

describe('AISettingsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.saveAISettings.mockImplementation(async settings => settings)
  })

  it('renders provider settings and keeps the API key in the session setter', async () => {
    const onSaved = vi.fn()
    render(
      <AISettingsPanel
        settings={{
          providerName: 'DeepSeek',
          apiBase: 'https://api.deepseek.com',
          model: 'deepseek-chat',
        }}
        onSaved={onSaved}
      />,
    )

    expect(screen.getByLabelText('AI API Key')).toHaveAttribute('type', 'password')
    fireEvent.change(screen.getByLabelText('AI API Key'), { target: { value: 'sk-test' } })
    fireEvent.click(screen.getByRole('button', { name: '保存设置' }))

    await waitFor(() => {
      expect(mocks.setSessionApiKey).toHaveBeenCalledWith('sk-test')
      expect(mocks.saveAISettings).toHaveBeenCalledWith(expect.objectContaining({
        apiBase: 'https://api.deepseek.com',
        model: 'deepseek-chat',
      }))
      expect(onSaved).toHaveBeenCalled()
    })
  })

  it('tests the saved provider connection explicitly', async () => {
    render(
      <AISettingsPanel
        settings={{
          providerName: 'Local AI',
          apiBase: 'http://localhost:11434/v1',
          model: 'model-a',
        }}
        onSaved={vi.fn()}
      />,
    )

    fireEvent.change(screen.getByLabelText('AI API Key'), { target: { value: 'session-key' } })
    fireEvent.click(screen.getByRole('button', { name: '测试连接' }))

    await waitFor(() => {
      expect(mocks.testAIProvider).toHaveBeenCalledWith(
        expect.objectContaining({ providerName: 'Local AI' }),
        'session-key',
      )
      expect(screen.getByRole('status')).toHaveTextContent('连接成功')
    })
  })
})
