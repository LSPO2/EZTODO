/**
 * Backup module tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the database
vi.mock('../database', () => ({
  getDatabase: vi.fn().mockResolvedValue({
    select: vi.fn().mockResolvedValue([]),
    execute: vi.fn().mockResolvedValue({ rowsAffected: 0 }),
  }),
}))

describe('Backup Module', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('backup functions', () => {
    it('should be importable', async () => {
      const { createBackup, downloadBackup, previewBackup, restoreFromBackup } = await import('../backup')
      expect(createBackup).toBeDefined()
      expect(downloadBackup).toBeDefined()
      expect(previewBackup).toBeDefined()
      expect(restoreFromBackup).toBeDefined()
    })
  })

  describe('previewBackup', () => {
    it('should validate backup structure', async () => {
      const { previewBackup } = await import('../backup')

      const invalidBackup = JSON.stringify({ invalid: true })
      await expect(previewBackup(invalidBackup)).rejects.toThrow()
    })
  })
})
