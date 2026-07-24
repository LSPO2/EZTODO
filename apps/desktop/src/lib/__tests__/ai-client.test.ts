import { afterEach, describe, expect, it, vi } from 'vitest'
import { parseTaskWithAI } from '../ai-client'
import type { AIProviderSettings } from '../ai-settings'

const settings: AIProviderSettings = {
  providerName: 'Test AI',
  apiBase: 'https://example.com/v1',
  model: 'test-model',
}

describe('AI client', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('normalizes snake_case fields and keeps a three-level task tree', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      choices: [{
        message: {
          content: JSON.stringify({
            confidence: 'high',
            warnings: ['请确认日期'],
            tasks: [{
              title: '提交报告',
              scheduled_date: '2026-07-25',
              priority: 'p1',
              uncertain_fields: ['due_at'],
              subtasks: [{
                title: '写正文',
                subtasks: [{ title: '检查引用' }],
              }],
            }],
          }),
        },
      }],
    }), { status: 200 }))

    const result = await parseTaskWithAI('明天提交报告', settings, 'secret-key')

    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.com/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer secret-key' }),
      }),
    )
    expect(result.tasks[0]).toMatchObject({
      title: '提交报告',
      scheduledDate: '2026-07-25',
      priority: 'p1',
      uncertainFields: ['due_at'],
    })
    expect(result.tasks[0].subtasks[0].subtasks[0].title).toBe('检查引用')
  })

  it('reports authentication errors without silently creating a task', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 401 }))

    await expect(parseTaskWithAI('添加任务', settings, 'bad-key'))
      .rejects.toThrow('API Key 无效')
  })

  it('rejects more than twenty generated tasks', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      choices: [{
        message: {
          content: JSON.stringify({
            tasks: Array.from({ length: 21 }, (_, index) => ({ title: `任务 ${index + 1}` })),
          }),
        },
      }],
    }), { status: 200 }))

    await expect(parseTaskWithAI('创建很多任务', settings, 'secret-key'))
      .rejects.toThrow('一次最多创建 20 个任务')
  })
})
