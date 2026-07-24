import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
}))

vi.mock('../environment', () => ({
  isTauriEnvironment: () => true,
}))

vi.mock('@tauri-apps/api/core', () => ({
  invoke: mocks.invoke,
}))

import {
  clearSessionApiKey,
  forgetRememberedApiKey,
  getSessionApiKey,
  loadRememberedApiKey,
  saveApiKey,
} from '../ai-settings'

describe('AI key storage', () => {
  beforeEach(() => {
    mocks.invoke.mockReset()
    clearSessionApiKey()
  })

  it('remembers keys in Windows Credential Manager by default', async () => {
    mocks.invoke.mockResolvedValue(undefined)

    await saveApiKey(' sk-secret ')

    expect(getSessionApiKey()).toBe('sk-secret')
    expect(mocks.invoke).toHaveBeenCalledWith('store_ai_api_key', { apiKey: 'sk-secret' })
  })

  it('loads and deletes remembered keys without persisting them in app settings', async () => {
    mocks.invoke.mockResolvedValueOnce('stored-secret')
    await expect(loadRememberedApiKey()).resolves.toBe('stored-secret')
    expect(getSessionApiKey()).toBe('stored-secret')

    mocks.invoke.mockResolvedValueOnce(undefined)
    await forgetRememberedApiKey()
    expect(getSessionApiKey()).toBe('')
    expect(mocks.invoke).toHaveBeenLastCalledWith('delete_ai_api_key')
  })

  it('deletes any remembered credential when remember is disabled', async () => {
    mocks.invoke.mockResolvedValue(undefined)

    await saveApiKey('session-only', false)

    expect(getSessionApiKey()).toBe('session-only')
    expect(mocks.invoke).toHaveBeenCalledWith('delete_ai_api_key')
  })
})
