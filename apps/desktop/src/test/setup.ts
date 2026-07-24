/**
 * Test setup file
 */

import { vi } from 'vitest'
import '@testing-library/jest-dom'

// Mock Tauri APIs
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@tauri-apps/api/window', () => ({
  UserAttentionType: { Critical: 1, Informational: 2 },
  getCurrentWindow: () => ({
    requestUserAttention: vi.fn().mockResolvedValue(undefined),
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

  title: string
  options?: NotificationOptions
  close = vi.fn()

  constructor(title: string, options?: NotificationOptions) {
    this.title = title
    this.options = options
  }
}

global.Notification = MockNotification as any

// Mock crypto (including getRandomValues for UUIDv7)
Object.defineProperty(global, 'crypto', {
  value: {
    subtle: {
      digest: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
    },
    randomUUID: vi.fn().mockReturnValue('test-uuid'),
    getRandomValues: vi.fn((arr: Uint8Array) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256)
      }
      return arr
    }),
  },
})
