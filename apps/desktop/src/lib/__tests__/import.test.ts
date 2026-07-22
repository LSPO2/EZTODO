/**
 * Import module tests
 */

import { describe, it, expect } from 'vitest'
import { parseCSV, parseMarkdown, validateImportData } from '../import'

describe('Import Module', () => {
  describe('parseCSV', () => {
    it('should parse simple CSV', () => {
      const csv = 'title,status\nTask 1,todo\nTask 2,done'
      const result = parseCSV(csv)
      expect(result.headers).toEqual(['title', 'status'])
      expect(result.rows).toHaveLength(2)
      expect(result.rows[0]).toEqual(['Task 1', 'todo'])
    })

    it('should handle quoted fields', () => {
      const csv = 'title,note\n"Task with, comma","Note with ""quotes"""'
      const result = parseCSV(csv)
      expect(result.rows[0][0]).toBe('Task with, comma')
      expect(result.rows[0][1]).toBe('Note with "quotes"')
    })

    it('should handle empty lines', () => {
      const csv = 'title\nTask 1\n\nTask 2\n'
      const result = parseCSV(csv)
      expect(result.rows).toHaveLength(2)
    })
  })

  describe('parseMarkdown', () => {
    it('should parse unchecked tasks', () => {
      const md = '- [ ] Task 1\n- [ ] Task 2'
      const result = parseMarkdown(md)
      expect(result).toHaveLength(2)
      expect(result[0].title).toBe('Task 1')
      expect(result[0].status).toBe('todo')
    })

    it('should parse checked tasks', () => {
      const md = '- [x] Completed task\n- [X] Also completed'
      const result = parseMarkdown(md)
      expect(result).toHaveLength(2)
      expect(result[0].status).toBe('done')
      expect(result[1].status).toBe('done')
    })

    it('should handle indented tasks', () => {
      const md = '- [ ] Parent\n  - [ ] Child'
      const result = parseMarkdown(md)
      expect(result).toHaveLength(2)
      expect(result[0].level).toBe(0)
      expect(result[1].level).toBe(1)
    })
  })

  describe('validateImportData', () => {
    it('should validate required title', () => {
      const data = [{ title: '' }]
      const mapping = [{ source: 'title', target: 'title' }]
      const errors = validateImportData(data, mapping)
      expect(errors.length).toBeGreaterThan(0)
      expect(errors[0].field).toBe('title')
    })

    it('should validate date format', () => {
      const data = [{ title: 'Task', due_at: 'invalid-date' }]
      const mapping = [
        { source: 'title', target: 'title' },
        { source: 'due_at', target: 'due_at' },
      ]
      const errors = validateImportData(data, mapping)
      expect(errors.some(e => e.field === 'due_at')).toBe(true)
    })

    it('should validate priority values', () => {
      const data = [{ title: 'Task', priority: 'invalid' }]
      const mapping = [
        { source: 'title', target: 'title' },
        { source: 'priority', target: 'priority' },
      ]
      const errors = validateImportData(data, mapping)
      expect(errors.some(e => e.field === 'priority')).toBe(true)
    })

    it('should pass valid data', () => {
      const data = [{ title: 'Valid Task', priority: 'p1' }]
      const mapping = [
        { source: 'title', target: 'title' },
        { source: 'priority', target: 'priority' },
      ]
      const errors = validateImportData(data, mapping)
      expect(errors).toHaveLength(0)
    })
  })
})
