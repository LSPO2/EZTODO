/**
 * Trash module tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getRemainingDays } from '../trash'

describe('Trash Module', () => {
  describe('getRemainingDays', () => {
    it('should return positive days for future expiration', () => {
      const future = new Date()
      future.setDate(future.getDate() + 10)
      const result = getRemainingDays(future.toISOString())
      expect(result).toBeGreaterThanOrEqual(9)
      expect(result).toBeLessThanOrEqual(10)
    })

    it('should return 0 for past expiration', () => {
      const past = new Date()
      past.setDate(past.getDate() - 1)
      const result = getRemainingDays(past.toISOString())
      expect(result).toBe(0)
    })

    it('should return 30 days for 30 days from now', () => {
      const future = new Date()
      future.setDate(future.getDate() + 30)
      const result = getRemainingDays(future.toISOString())
      expect(result).toBeGreaterThanOrEqual(29)
      expect(result).toBeLessThanOrEqual(30)
    })
  })
})
