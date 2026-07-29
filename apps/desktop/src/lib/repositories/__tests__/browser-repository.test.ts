/**
 * Browser Repository tests
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { BrowserTaskRepository, BrowserProjectRepository } from '../browser-repository'

// Clear localStorage before each test
beforeEach(() => {
  localStorage.clear()
})

describe('BrowserTaskRepository', () => {
  const repo = new BrowserTaskRepository()

  it('should create a task', async () => {
    const task = await repo.create({ title: 'Test Task' })

    expect(task).toBeDefined()
    expect(task.id).toBeDefined()
    expect(task.title).toBe('Test Task')
    expect(task.status).toBe('todo')
    expect(task.priority).toBe('none')
  })

  it('should find task by id', async () => {
    const created = await repo.create({ title: 'Find Me' })
    const found = await repo.findById(created.id)

    expect(found).toBeDefined()
    expect(found?.title).toBe('Find Me')
  })

  it('should return null for non-existent task', async () => {
    const found = await repo.findById('non-existent')
    expect(found).toBeNull()
  })

  it('should update a task', async () => {
    const task = await repo.create({ title: 'Original' })
    const updated = await repo.update(task.id, { title: 'Updated' })

    expect(updated.title).toBe('Updated')
    expect(updated.revision).toBeGreaterThan(task.revision)
  })

  it('should soft delete a task', async () => {
    const task = await repo.create({ title: 'Delete Me' })
    await repo.delete(task.id)

    const found = await repo.findById(task.id)
    expect(found?.deletedAt).toBeDefined()
  })

  it('should restore a deleted task', async () => {
    const task = await repo.create({ title: 'Restore Me' })
    await repo.delete(task.id)
    const restored = await repo.restore(task.id)

    expect(restored.deletedAt).toBeNull()
  })

  it('should find tasks by view', async () => {
    await repo.create({ title: 'Todo 1' })
    await repo.create({ title: 'Todo 2' })

    const tasks = await repo.findByView('inbox')
    expect(tasks.length).toBeGreaterThanOrEqual(2)
  })

  it('includes undated tasks in Today and exposes soft-deleted tasks in Trash', async () => {
    const undated = await repo.create({ title: 'Undated Today' })
    await repo.create({ title: 'Future', scheduledDate: '2099-12-31' })
    const deleted = await repo.create({ title: 'Move to trash' })
    await repo.delete(deleted.id)

    const todayTasks = await repo.findByView('today')
    const trashTasks = await repo.findByView('trash')

    expect(todayTasks.some(task => task.id === undated.id)).toBe(true)
    expect(todayTasks.some(task => task.title === 'Future')).toBe(false)
    expect(trashTasks.some(task => task.id === deleted.id && task.deletedAt)).toBe(true)
  })
  it('filters all active TODOs by category regardless of schedule', async () => {
    const categorized = await repo.create({ title: 'Categorized future', projectId: 'category-1', scheduledDate: '2099-12-31' })
    await repo.create({ title: 'Other category', projectId: 'category-2' })

    const tasks = await repo.findByView('all', { projectId: 'category-1' })

    expect(tasks.map(task => task.id)).toEqual([categorized.id])
  })
  it('should search tasks', async () => {
    await repo.create({ title: 'Searchable Task' })
    await repo.create({ title: 'Other Task' })

    const results = await repo.search('Searchable')
    expect(results.length).toBe(1)
    expect(results[0].title).toBe('Searchable Task')
  })

  it('should batch complete tasks', async () => {
    const t1 = await repo.create({ title: 'Batch 1' })
    const t2 = await repo.create({ title: 'Batch 2' })

    const result = await repo.batchComplete([t1.id, t2.id])
    expect(result.success).toBe(true)
    expect(result.affectedCount).toBe(2)
  })
})

describe('BrowserProjectRepository', () => {
  const repo = new BrowserProjectRepository()

  it('should create a project', async () => {
    const project = await repo.create({ name: 'Test Project' })

    expect(project).toBeDefined()
    expect(project.name).toBe('Test Project')
  })

  it('should find all projects', async () => {
    await repo.create({ name: 'Project 1' })
    await repo.create({ name: 'Project 2' })

    const projects = await repo.findAll()
    expect(projects.length).toBeGreaterThanOrEqual(2)
  })
  it('persists category ordering', async () => {
    const first = await repo.create({ name: 'First' })
    const second = await repo.create({ name: 'Second' })

    const reordered = await repo.reorder([second.id, first.id])

    expect(reordered.map(project => project.id)).toEqual([second.id, first.id])
    expect(reordered.map(project => project.sortOrder)).toEqual([0, 1])
  })

  it('keeps tasks and clears their category when deleting a category', async () => {
    const taskRepo = new BrowserTaskRepository()
    const category = await repo.create({ name: 'Temporary' })
    const task = await taskRepo.create({ title: 'Keep me', projectId: category.id })

    await repo.delete(category.id)

    expect((await repo.findAll()).some(project => project.id === category.id)).toBe(false)
    expect((await taskRepo.findById(task.id))?.projectId).toBeNull()
  })

  it('rejects empty and duplicate category names', async () => {
    await repo.create({ name: 'Unique' })

    await expect(repo.create({ name: '  ' })).rejects.toThrow('分类名称不能为空')
    await expect(repo.create({ name: 'unique' })).rejects.toThrow('已存在同名分类')
  })
})
