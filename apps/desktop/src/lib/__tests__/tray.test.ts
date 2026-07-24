import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getById: vi.fn(),
  createTray: vi.fn(),
  createMenu: vi.fn(),
  showFromTray: vi.fn(),
  confirmWindowClose: vi.fn(),
  destroyWindow: vi.fn(),
}))

vi.mock('@tauri-apps/api/tray', () => ({
  TrayIcon: {
    getById: mocks.getById,
    new: mocks.createTray,
  },
}))

vi.mock('@tauri-apps/api/menu', () => ({
  Menu: { new: mocks.createMenu },
}))

vi.mock('@tauri-apps/api/app', () => ({
  defaultWindowIcon: vi.fn().mockResolvedValue({}),
}))

vi.mock('@tauri-apps/api/image', () => ({
  Image: { fromPath: vi.fn() },
}))

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    destroy: mocks.destroyWindow,
  }),
}))

vi.mock('../window', () => ({
  showFromTray: mocks.showFromTray,
  confirmWindowClose: mocks.confirmWindowClose,
}))

describe('system tray', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    mocks.getById.mockResolvedValue(null)
    mocks.createMenu.mockResolvedValue({})
    mocks.confirmWindowClose.mockResolvedValue(true)
    mocks.createTray.mockResolvedValue({
      setIcon: vi.fn(),
      setTooltip: vi.fn(),
    })
  })

  it('initializes once and makes repeated left clicks show-only', async () => {
    const { initializeTray } = await import('../tray')

    await Promise.all([initializeTray(), initializeTray()])

    expect(mocks.createTray).toHaveBeenCalledTimes(1)
    const action = mocks.createTray.mock.calls[0][0].action

    await action({ type: 'Click', button: 'Left', buttonState: 'Down' })
    await action({ type: 'Click', button: 'Left', buttonState: 'Up' })
    await action({ type: 'Click', button: 'Left', buttonState: 'Up' })

    expect(mocks.showFromTray).toHaveBeenCalledTimes(2)
  })

  it('creates the requested menu and wires every action', async () => {
    const navigationEvents: string[] = []
    window.addEventListener('eztodo:tray-navigation', event => {
      navigationEvents.push((event as CustomEvent<string>).detail)
    })
    const { initializeTray } = await import('../tray')

    await initializeTray()

    const items = mocks.createMenu.mock.calls[0][0].items
    expect(items.map((item: { text: string }) => item.text)).toEqual([
      '快速添加',
      '今天',
      '设置',
      '退出',
    ])

    await items[0].action()
    await items[1].action()
    await items[2].action()
    await items[3].action()

    expect(navigationEvents).toEqual(['quick-add', 'today', 'settings'])
    expect(mocks.showFromTray).toHaveBeenCalledTimes(3)
    expect(mocks.destroyWindow).toHaveBeenCalledTimes(1)
  })

  it('reuses an existing native tray icon', async () => {
    const existingTray = {
      setIcon: vi.fn(),
      setTooltip: vi.fn(),
    }
    mocks.getById.mockResolvedValue(existingTray)
    const { initializeTray } = await import('../tray')

    await initializeTray()

    expect(mocks.createTray).not.toHaveBeenCalled()
  })
})
