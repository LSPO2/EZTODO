/**
 * Export module tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the database
vi.mock('../database', () => ({
  getDatabase: vi.fn().mockResolvedValue({
    select: vi.fn().mockResolvedValue([]),
    execute: vi.fn().mockResolvedValue({ rowsAffected: 0 }),
  }),
}))

describe('Export Module', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('export functions', () => {
    it('should be importable', async () => {
      const { exportTasks, downloadExport } = await import('../export')
      expect(exportTasks).toBeDefined()
      expect(downloadExport).toBeDefined()
    })
  })
})
