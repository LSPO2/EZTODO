/**
 * Recurrence module tests
 */

import { describe, it, expect } from 'vitest'
import { getNextOccurrence, isRecurrenceDate } from '../recurrence'
import type { RecurrenceConfig } from '../recurrence'

describe('Recurrence Module', () => {
  describe('getNextOccurrence', () => {
    it('should get next daily occurrence', () => {
      const config: RecurrenceConfig = {
        frequency: 'daily',
        interval: 1,
        startDate: '2026-01-01',
      }
      const next = getNextOccurrence(config, '2026-01-01')
      expect(next).toBe('2026-01-02')
    })

    it('should get next weekly occurrence', () => {
      const config: RecurrenceConfig = {
        frequency: 'weekly',
        interval: 1,
        daysOfWeek: [1], // Monday
        startDate: '2026-01-01',
      }
      const next = getNextOccurrence(config, '2026-01-01')
      expect(next).toBeDefined()
    })

    it('should get next monthly occurrence', () => {
      const config: RecurrenceConfig = {
        frequency: 'monthly',
        interval: 1,
        dayOfMonth: 15,
        startDate: '2026-01-01',
      }
      const next = getNextOccurrence(config, '2026-01-01')
      // Should be January 15 or February 15 depending on implementation
      expect(next).toBeDefined()
      expect(next).toContain('15')
    })

    it('should return null after end date', () => {
      const config: RecurrenceConfig = {
        frequency: 'daily',
        interval: 1,
        startDate: '2026-01-01',
        endDate: '2026-01-05',
      }
      const next = getNextOccurrence(config, '2026-01-05')
      expect(next).toBeNull()
    })
  })

  describe('isRecurrenceDate', () => {
    it('should match daily recurrence', () => {
      const config: RecurrenceConfig = {
        frequency: 'daily',
        interval: 1,
        startDate: '2026-01-01',
      }
      expect(isRecurrenceDate(config, '2026-01-02')).toBe(true)
      expect(isRecurrenceDate(config, '2026-01-03')).toBe(true)
    })

    it('should match weekly recurrence with specific days', () => {
      const config: RecurrenceConfig = {
        frequency: 'weekly',
        interval: 1,
        daysOfWeek: [1], // Monday
        startDate: '2026-01-01',
      }
      // 2026-01-05 is Monday
      expect(isRecurrenceDate(config, '2026-01-05')).toBe(true)
    })

    it('should not match before start date', () => {
      const config: RecurrenceConfig = {
        frequency: 'daily',
        interval: 1,
        startDate: '2026-01-10',
      }
      expect(isRecurrenceDate(config, '2026-01-05')).toBe(false)
    })
  })
})
