import { beforeEach, describe, expect, it, vi } from 'vitest'

const repositoryMocks = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
}))

vi.mock('../repositories', () => ({
  getRepositories: async () => ({
    settings: {
      get: repositoryMocks.get,
      set: repositoryMocks.set,
      delete: vi.fn(),
      getAll: vi.fn(),
    },
  }),
}))

import {
  clearSessionApiKey,
  getSessionApiKey,
  saveAISettings,
  setSessionApiKey,
  validateAISettings,
} from '../ai-settings'

describe('AI settings', () => {
  beforeEach(() => {
    repositoryMocks.get.mockReset()
    repositoryMocks.set.mockReset()
    clearSessionApiKey()
  })

  it('persists only non-secret provider settings', async () => {
    setSessionApiKey('sk-should-not-be-persisted')

    await saveAISettings({
      providerName: ' Example ',
      apiBase: 'https://example.com/v1/',
      model: ' model-a ',
    })

    expect(getSessionApiKey()).toBe('sk-should-not-be-persisted')
    expect(repositoryMocks.set).toHaveBeenCalledTimes(1)
    const persisted = repositoryMocks.set.mock.calls[0][1] as string
    expect(persisted).toContain('"apiBase":"https://example.com/v1"')
    expect(persisted).not.toContain('sk-should-not-be-persisted')
  })

  it('requires HTTPS except for local development addresses', () => {
    expect(validateAISettings({
      providerName: 'Remote',
      apiBase: 'http://example.com/v1',
      model: 'model',
    })).toContain('HTTPS')

    expect(validateAISettings({
      providerName: 'Local',
      apiBase: 'http://localhost:11434/v1',
      model: 'model',
    })).toBeNull()
  })
})
