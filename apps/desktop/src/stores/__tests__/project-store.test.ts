import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getRepositories } from '../../lib/repositories'
import type { Project } from '../../lib/repositories'
import { useProjectStore } from '../project-store'

vi.mock('../../lib/repositories', () => ({ getRepositories: vi.fn() }))

const mockedGetRepositories = vi.mocked(getRepositories)

function project(id: string, name: string, sortOrder: number): Project {
  return {
    id, name, sortOrder, color: null, icon: null,
    createdAt: '2026-07-29T00:00:00.000Z', updatedAt: '2026-07-29T00:00:00.000Z', deletedAt: null,
  }
}

describe('project store category management', () => {
  const first = project('p1', '工作', 0)
  const second = project('p2', '学习', 1)
  const create = vi.fn()
  const remove = vi.fn()
  const reorder = vi.fn()
  const findAll = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    useProjectStore.setState({ projects: [first, second], isLoading: false, error: null })
    mockedGetRepositories.mockResolvedValue({
      projects: { create, delete: remove, reorder, findAll },
    } as never)
  })

  it('creates a trimmed category and appends it to the list', async () => {
    const created = project('p3', '生活', 2)
    create.mockResolvedValue(created)

    await useProjectStore.getState().createProject({ name: '  生活  ' })

    expect(create).toHaveBeenCalledWith({ name: '生活' })
    expect(useProjectStore.getState().projects.map(item => item.id)).toEqual(['p1', 'p2', 'p3'])
  })

  it('rejects empty and duplicate category names before repository writes', async () => {
    await expect(useProjectStore.getState().createProject({ name: '   ' })).rejects.toThrow('分类名称不能为空')
    await expect(useProjectStore.getState().createProject({ name: '工作' })).rejects.toThrow('已存在同名分类')
    expect(create).not.toHaveBeenCalled()
  })

  it('deletes a category from persistent storage and local state', async () => {
    remove.mockResolvedValue(undefined)

    await useProjectStore.getState().deleteProject('p1')

    expect(remove).toHaveBeenCalledWith('p1')
    expect(useProjectStore.getState().projects).toEqual([second])
  })

  it('persists and adopts a requested category order', async () => {
    reorder.mockResolvedValue([
      { ...second, sortOrder: 0 },
      { ...first, sortOrder: 1 },
    ])

    await useProjectStore.getState().reorderProjects(['p2', 'p1'])

    expect(reorder).toHaveBeenCalledWith(['p2', 'p1'])
    expect(useProjectStore.getState().projects.map(item => item.id)).toEqual(['p2', 'p1'])
  })

  it('rejects incomplete reorder payloads', async () => {
    await expect(useProjectStore.getState().reorderProjects(['p1'])).rejects.toThrow('分类排序数据无效')
    expect(reorder).not.toHaveBeenCalled()
  })
})
