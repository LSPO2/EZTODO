/**
 * Test setup file
 */

import '@testing-library/jest-dom'

// Mock Tauri APIs
vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    show: vi.fn(),
    hide: vi.fn(),
    close: vi.fn(),
    minimize: vi.fn(),
    maximize: vi.fn(),
    unmaximize: vi.fn(),
    isMaximized: vi.fn().mockResolvedValue(false),
    isVisible: vi.fn().mockResolvedValue(true),
    setTitle: vi.fn(),
    center: vi.fn(),
    outerSize: vi.fn().mockResolvedValue({ width: 1200, height: 800 }),
    outerPosition: vi.fn().mockResolvedValue({ x: 0, y: 0 }),
    scaleFactor: vi.fn().mockResolvedValue(1),
    onCloseRequested: vi.fn(),
  }),
}))

vi.mock('@tauri-apps/api/tray', () => ({
  TrayIcon: {
    new: vi.fn().mockResolvedValue({
      setIcon: vi.fn(),
      setTooltip: vi.fn(),
    }),
  },
}))

vi.mock('@tauri-apps/api/menu', () => ({
  Menu: {
    new: vi.fn().mockResolvedValue({}),
  },
}))

vi.mock('@tauri-apps/plugin-sql', () => ({
  default: {
    load: vi.fn().mockResolvedValue({
      execute: vi.fn().mockResolvedValue({ rowsAffected: 0 }),
      select: vi.fn().mockResolvedValue([]),
      close: vi.fn(),
    }),
  },
}))

vi.mock('@tauri-apps/plugin-notification', () => ({
  sendNotification: vi.fn(),
  requestPermission: vi.fn().mockResolvedValue('granted'),
  isPermissionGranted: vi.fn().mockResolvedValue(true),
}))

vi.mock('@tauri-apps/plugin-global-shortcut', () => ({
  register: vi.fn(),
  unregister: vi.fn(),
  isRegistered: vi.fn().mockResolvedValue(false),
}))

// Mock fetch
global.fetch = vi.fn()

// Mock Notification
class MockNotification {
  static permission = 'granted'
  static requestPermission = vi.fn().mockResolvedValue('granted')

  constructor(public title: string, public options?: NotificationOptions) {}

  close = vi.fn()
}

global.Notification = MockNotification as any

// Mock crypto.subtle
Object.defineProperty(global, 'crypto', {
  value: {
    subtle: {
      digest: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
    },
    randomUUID: vi.fn().mockReturnValue('test-uuid'),
  },
})
