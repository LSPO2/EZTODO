/**
 * Time utility tests
 */

import { describe, it, expect } from 'vitest'
import {
  getSystemTimezone,
  isToday,
  isTomorrow,
  isYesterday,
  isOverdue,
  getRelativeTime,
  addDays,
  addHours,
  addMinutes,
  daysBetween,
  isQuietHours,
} from '../time'

describe('Time Utilities', () => {
  describe('getSystemTimezone', () => {
    it('should return a string', () => {
      const timezone = getSystemTimezone()
      expect(typeof timezone).toBe('string')
      expect(timezone.length).toBeGreaterThan(0)
    })
  })

  describe('isToday', () => {
    it('should return true for today', () => {
      const today = new Date().toISOString()
      expect(isToday(today)).toBe(true)
    })

    it('should return false for yesterday', () => {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      expect(isToday(yesterday.toISOString())).toBe(false)
    })
  })

  describe('isTomorrow', () => {
    it('should return true for tomorrow', () => {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      expect(isTomorrow(tomorrow.toISOString())).toBe(true)
    })

    it('should return false for today', () => {
      const today = new Date().toISOString()
      expect(isTomorrow(today)).toBe(false)
    })
  })

  describe('isYesterday', () => {
    it('should return true for yesterday', () => {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      expect(isYesterday(yesterday.toISOString())).toBe(true)
    })

    it('should return false for today', () => {
      const today = new Date().toISOString()
      expect(isYesterday(today)).toBe(false)
    })
  })

  describe('isOverdue', () => {
    it('should return true for past dates', () => {
      const past = new Date()
      past.setHours(past.getHours() - 1)
      expect(isOverdue(past.toISOString())).toBe(true)
    })

    it('should return false for future dates', () => {
      const future = new Date()
      future.setHours(future.getHours() + 1)
      expect(isOverdue(future.toISOString())).toBe(false)
    })
  })

  describe('getRelativeTime', () => {
    it('should return "今天" for today', () => {
      const today = new Date().toISOString()
      expect(getRelativeTime(today)).toBe('今天')
    })

    it('should return "明天" for tomorrow', () => {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      expect(getRelativeTime(tomorrow.toISOString())).toBe('明天')
    })

    it('should return "昨天" for yesterday', () => {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      expect(getRelativeTime(yesterday.toISOString())).toBe('昨天')
    })
  })

  describe('addDays', () => {
    it('should add days correctly', () => {
      const base = '2026-01-01T00:00:00Z'
      const result = addDays(base, 5)
      const date = new Date(result)
      expect(date.getDate()).toBe(6)
    })
  })

  describe('addHours', () => {
    it('should add hours correctly', () => {
      const base = '2026-01-01T10:00:00Z'
      const result = addHours(base, 3)
      const date = new Date(result)
      // UTC hours should be 13, but local hours may differ due to timezone
      expect(date.getUTCHours()).toBe(13)
    })
  })

  describe('addMinutes', () => {
    it('should add minutes correctly', () => {
      const base = '2026-01-01T10:00:00Z'
      const result = addMinutes(base, 30)
      const date = new Date(result)
      expect(date.getMinutes()).toBe(30)
    })
  })

  describe('daysBetween', () => {
    it('should calculate days between dates', () => {
      const date1 = '2026-01-01T00:00:00Z'
      const date2 = '2026-01-11T00:00:00Z'
      expect(daysBetween(date1, date2)).toBe(10)
    })
  })

  describe('isQuietHours', () => {
    it('should handle quiet hours check', () => {
      // This test depends on current time, so just verify it returns a boolean
      const result = isQuietHours('22:00', '08:00')
      expect(typeof result).toBe('boolean')
    })
  })
})
