import { afterEach, describe, expect, it, vi } from 'vitest'
import { listAIModels, parseTaskWithAI } from '../ai-client'
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

  it('uses existing categories, preserves extracted fields, and leaves missing values empty', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      choices: [{
        message: {
          content: JSON.stringify({
            tasks: [{
              title: '准备季度汇报',
              category_name: '工作',
              scheduled_at: '2026-08-01T09:30:00+08:00',
              due_at: '2026-08-01T11:00:00+08:00',
              note: null,
              priority: 'none',
              subtasks: [],
            }],
          }),
        },
      }],
    }), { status: 200 }))

    const result = await parseTaskWithAI('8月1日上午准备季度汇报，11点前完成', settings, 'secret-key', ['生活', '工作'])

    expect(result.tasks[0]).toMatchObject({
      title: '准备季度汇报',
      categoryName: '工作',
      scheduledAt: '2026-08-01T09:30:00+08:00',
      dueAt: '2026-08-01T11:00:00+08:00',
    })
    expect(result.tasks[0].note).toBeUndefined()
    const request = JSON.parse(String(fetchMock.mock.calls[0][1]?.body))
    expect(request.messages[0].content).toContain('现有分类（只能原样引用）：["生活","工作"]')
    expect(request.messages[0].content).toContain('没有补充信息返回 null')
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

  it('fetches, normalizes, and sorts the provider model list', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      data: [
        { id: 'model-z' },
        { id: 'model-a' },
        { id: 'model-a' },
      ],
    }), { status: 200 }))

    await expect(listAIModels(settings, 'secret-key')).resolves.toEqual(['model-a', 'model-z'])
    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.com/v1/models',
      expect.objectContaining({
        method: 'GET',
        headers: { Authorization: 'Bearer secret-key' },
      }),
    )
  })
})
