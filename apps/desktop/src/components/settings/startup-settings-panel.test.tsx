import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { StartupSettingsPanel } from './startup-settings-panel'

const mocks = vi.hoisted(() => ({
  enable: vi.fn(),
  disable: vi.fn(),
  isEnabled: vi.fn(),
}))

vi.mock('@tauri-apps/plugin-autostart', () => mocks)

describe('StartupSettingsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads and enables Windows autostart', async () => {
    mocks.isEnabled.mockResolvedValueOnce(false).mockResolvedValueOnce(true)
    mocks.enable.mockResolvedValue(undefined)
    render(<StartupSettingsPanel />)

    const toggle = await screen.findByRole('switch', { name: '开机自启' })
    await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'false'))
    fireEvent.click(toggle)

    await waitFor(() => {
      expect(mocks.enable).toHaveBeenCalledTimes(1)
      expect(toggle).toHaveAttribute('aria-checked', 'true')
    })
    expect(screen.getByRole('status')).toHaveTextContent('已开启开机自启')
  })

  it('disables Windows autostart', async () => {
    mocks.isEnabled.mockResolvedValueOnce(true).mockResolvedValueOnce(false)
    mocks.disable.mockResolvedValue(undefined)
    render(<StartupSettingsPanel />)

    const toggle = await screen.findByRole('switch', { name: '开机自启' })
    await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'true'))
    fireEvent.click(toggle)

    await waitFor(() => {
      expect(mocks.disable).toHaveBeenCalledTimes(1)
      expect(toggle).toHaveAttribute('aria-checked', 'false')
    })
  })

  it('shows a clear error when the native status cannot be read', async () => {
    mocks.isEnabled.mockRejectedValue(new Error('not running in Tauri'))
    render(<StartupSettingsPanel />)

    expect(await screen.findByRole('alert')).toHaveTextContent('无法读取开机自启状态')
  })
})