import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { requestTrayNavigation } from './lib/tray-navigation'
import * as aiClient from './lib/ai-client'
import { clearSessionApiKey, setSessionApiKey } from './lib/ai-settings'
import type { Task } from './lib/repositories'
import { calculateReminderTime, reminderScheduler } from './lib/reminder'

const mocks = vi.hoisted(() => ({
  setFilters: vi.fn(), loadTasks: vi.fn(), loadProjects: vi.fn(),
  undoLastBatch: vi.fn(), dismissUndoableBatch: vi.fn(), clearFilters: vi.fn(),
  setView: vi.fn(), setCurrentTask: vi.fn(), clearSelection: vi.fn(),
  createTask: vi.fn(), updateTask: vi.fn(), deleteTask: vi.fn(), completeTask: vi.fn(), createProject: vi.fn(),
  deleteProject: vi.fn(), reorderProjects: vi.fn(),
  indentTask: vi.fn(), outdentTask: vi.fn(), reorderSiblingTasks: vi.fn(),
  taskState: { tasks: [] as Task[], currentTask: null as Task | null },
  projectState: { projects: [{ id: 'p1', name: '分类一', icon: null, color: null, sortOrder: 0, createdAt: '', updatedAt: '', deletedAt: null }] },
}))

vi.mock('./stores/task-store', () => ({
  useTaskStore: () => ({
    tasks: mocks.taskState.tasks, currentTask: mocks.taskState.currentTask, currentView: 'today', selectedTaskIds: new Set<string>(),
    isLoading: false, error: null, warnings: [],
    undoableBatch: { operation: 'complete', count: 2 }, filters: {},
    setView: mocks.setView, setFilters: mocks.setFilters, clearFilters: mocks.clearFilters,
    loadTasks: mocks.loadTasks, createTask: mocks.createTask, updateTask: mocks.updateTask, deleteTask: mocks.deleteTask,
    completeTask: mocks.completeTask, uncompleteTask: vi.fn(), restoreTask: vi.fn(), permanentlyDelete: vi.fn(),
    searchTasks: vi.fn(), setCurrentTask: mocks.setCurrentTask, toggleSelection: vi.fn(), selectAll: vi.fn(),
    clearSelection: mocks.clearSelection, batchComplete: vi.fn(), batchDelete: vi.fn(), batchSetPriority: vi.fn(),
    batchMoveToProject: vi.fn(),
    undoLastBatch: mocks.undoLastBatch, dismissUndoableBatch: mocks.dismissUndoableBatch, indentTask: mocks.indentTask, outdentTask: mocks.outdentTask,
    copyTask: vi.fn(), reorderSiblingTasks: mocks.reorderSiblingTasks,
  }),
}))

vi.mock('./stores/project-store', () => ({
  useProjectStore: () => ({
    projects: mocks.projectState.projects, isLoading: false, error: null,
    loadProjects: mocks.loadProjects, createProject: mocks.createProject,
    deleteProject: mocks.deleteProject, reorderProjects: mocks.reorderProjects,
  }),
}))


vi.mock('./lib/export', () => ({ exportTasks: vi.fn(), downloadExport: vi.fn() }))
vi.mock('./lib/import', () => ({ importTasks: vi.fn() }))

describe('P0-2 App interactions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearSessionApiKey()
    mocks.taskState.tasks = []
    mocks.taskState.currentTask = null
    mocks.projectState.projects = [{ id: 'p1', name: '分类一', icon: null, color: null, sortOrder: 0, createdAt: '', updatedAt: '', deletedAt: null }]
    mocks.createProject.mockResolvedValue({ id: 'new-category', name: '新分类' })
    mocks.createTask.mockResolvedValue({
      id: 'created-1', parentId: null, projectId: null, title: '新任务', note: null,
      status: 'todo', priority: 'none', sortOrder: 0, scheduledDate: null, scheduledAt: null,
      dueAt: null, isAllDay: false, timezone: 'Asia/Shanghai', estimatedMinutes: null,
      createdAt: '', updatedAt: '', completedAt: null, deletedAt: null, revision: 1,
      source: 'manual', sourceCaptureId: null,
    })
  })

  it('keeps the undo action visible after a successful batch clears selection', () => {
    render(<App />)

    expect(screen.getByTestId('undo-banner')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('undo-button'))
    expect(mocks.undoLastBatch).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: '删除撤销提示' }))
    expect(mocks.dismissUndoableBatch).toHaveBeenCalledTimes(1)
  })

  it('automatically clears the undo notice after seven seconds', () => {
    vi.useFakeTimers()
    render(<App />)
    act(() => vi.advanceTimersByTime(7_000))
    expect(mocks.dismissUndoableBatch).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })
  it('wires project, priority, status, sorting and parent controls to the Store', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '🔽 筛选' }))

    expect(screen.getByLabelText('分类筛选')).toBeInTheDocument()
    expect(screen.queryByLabelText('标签筛选')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('批量添加标签')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('批量移除标签')).not.toBeInTheDocument()
    expect(screen.getByLabelText('优先级筛选')).toBeInTheDocument()
    expect(screen.getByLabelText('状态筛选')).toBeInTheDocument()
    expect(screen.getByLabelText('排序字段')).toBeInTheDocument()
    expect(screen.getByLabelText('切换排序方向')).toBeInTheDocument()
    expect(screen.getByText('仅父任务')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '展开全部子任务' })).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('状态筛选'), { target: { value: 'done' } })
    expect(mocks.setFilters).toHaveBeenCalledWith({ status: 'done' })
  })

  it('navigates from tray actions and focuses quick add', async () => {
    render(<App />)

    act(() => requestTrayNavigation('settings'))
    expect(screen.getByRole('heading', { name: '⚙️ 设置' })).toBeInTheDocument()

    act(() => requestTrayNavigation('today'))
    expect(mocks.setView).toHaveBeenCalledWith('today')
    expect(screen.getByRole('heading', { name: '🔴 今天' })).toBeInTheDocument()

    act(() => requestTrayNavigation('quick-add'))
    await waitFor(() => expect(screen.getByLabelText('添加任务内容')).toHaveFocus())
  })
  it('uses Today by default, filters by category, and keeps trash inside Settings', () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: '🔴 今天' })).toBeInTheDocument()
    expect(screen.queryByText('视图')).not.toBeInTheDocument()
    expect(screen.queryByText('收件箱')).not.toBeInTheDocument()
    expect(screen.queryByText('无日期')).not.toBeInTheDocument()
    expect(screen.queryByText('AI 创建')).not.toBeInTheDocument()

    fireEvent.click(screen.getByText('分类一'))
    expect(mocks.setView).toHaveBeenCalledWith('all')
    expect(mocks.setFilters).toHaveBeenCalledWith({ projectId: 'p1' })

    fireEvent.click(screen.getByRole('button', { name: '⚙️ 设置' }))
    fireEvent.click(screen.getByRole('button', { name: '回收站' }))
    expect(mocks.setView).toHaveBeenCalledWith('trash')
  })

  it('creates, deletes, and reorders categories from the sidebar manager', async () => {
    mocks.projectState.projects = [
      { id: 'p1', name: '分类一', icon: null, color: null, sortOrder: 0, createdAt: '', updatedAt: '', deletedAt: null },
      { id: 'p2', name: '分类二', icon: null, color: null, sortOrder: 1, createdAt: '', updatedAt: '', deletedAt: null },
    ]
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: '管理分类' }))
    expect(screen.getByRole('dialog', { name: '分类管理' })).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('新分类名称'), { target: { value: '工作' } })
    fireEvent.click(screen.getByRole('button', { name: '创建分类' }))
    await waitFor(() => expect(mocks.createProject).toHaveBeenCalledWith({ name: '工作' }))

    fireEvent.click(screen.getByRole('button', { name: '下移分类 分类一' }))
    await waitFor(() => expect(mocks.reorderProjects).toHaveBeenCalledWith(['p2', 'p1']))

    fireEvent.click(screen.getByRole('button', { name: '删除分类 分类一' }))
    await waitFor(() => expect(mocks.deleteProject).toHaveBeenCalledWith('p1'))
    expect(mocks.loadTasks).toHaveBeenCalled()
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('任务会保留并转为未分类'))
  })

  it('closes the category manager without changing categories', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '管理分类' }))
    fireEvent.click(screen.getByRole('button', { name: '关闭分类管理' }))
    expect(screen.queryByRole('dialog', { name: '分类管理' })).not.toBeInTheDocument()
  })
  it('supports quick add and advanced draft save from the top input', async () => {
    render(<App />)
    const input = screen.getByLabelText('添加任务内容')

    fireEvent.change(input, { target: { value: '快速任务' } })
    fireEvent.click(screen.getByRole('button', { name: '快速添加' }))
    await waitFor(() => expect(mocks.createTask).toHaveBeenCalledWith({ title: '快速任务' }))

    fireEvent.change(input, { target: { value: '高级任务' } })
    fireEvent.click(screen.getByRole('button', { name: '高级' }))
    expect(screen.getByRole('heading', { name: '新建任务详情' })).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('任务标题'), { target: { value: '高级任务（已编辑）' } })
    fireEvent.change(screen.getByLabelText('任务备注'), { target: { value: '详情备注' } })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))

    await waitFor(() => expect(mocks.createTask).toHaveBeenLastCalledWith(expect.objectContaining({
      title: '高级任务（已编辑）',
      note: '详情备注',
    })))
  })
  it('creates an AI-recognized task and opens its editable details', async () => {
    setSessionApiKey('test-key')
    vi.spyOn(aiClient, 'parseTaskWithAI').mockResolvedValue({
      confidence: 'high',
      warnings: [],
      tasks: [{
        title: 'AI 识别任务', categoryName: '学习', note: 'AI 备注', priority: 'p2', subtasks: [],
        scheduledAt: '2099-08-01T09:30:00+08:00', dueAt: '2099-08-01T11:00:00+08:00',
        confidence: 'high', uncertainFields: [],
      }],
    })
    mocks.createTask.mockResolvedValueOnce({
      id: 'ai-1', parentId: null, projectId: null, title: 'AI 识别任务', note: 'AI 备注',
      status: 'todo', priority: 'p2', sortOrder: 0, scheduledDate: null, scheduledAt: null,
      dueAt: null, isAllDay: false, timezone: 'Asia/Shanghai', estimatedMinutes: null,
      createdAt: '', updatedAt: '', completedAt: null, deletedAt: null, revision: 1,
      source: 'ai', sourceCaptureId: null,
    })
    render(<App />)

    fireEvent.change(screen.getByLabelText('添加任务内容'), { target: { value: '明天交报告' } })
    fireEvent.click(screen.getByRole('button', { name: 'AI 添加' }))

    await waitFor(() => expect(aiClient.parseTaskWithAI).toHaveBeenCalled())
    expect(aiClient.parseTaskWithAI).toHaveBeenCalledWith(
      '明天交报告', expect.anything(), 'test-key', ['分类一'],
    )
    expect(mocks.createProject).toHaveBeenCalledWith({ name: '学习' })
    expect(mocks.createTask).toHaveBeenCalledWith(expect.objectContaining({
      title: 'AI 识别任务', projectId: 'new-category', note: 'AI 备注',
      scheduledAt: '2099-08-01T09:30:00+08:00', dueAt: '2099-08-01T11:00:00+08:00', source: 'ai',
    }))
    expect(await screen.findByRole('heading', { name: '任务详情' })).toBeInTheDocument()
    expect(screen.getByLabelText('任务标题')).toHaveValue('AI 识别任务')
  })
  it('uses clear hierarchy labels and disables actions that cannot succeed', () => {
    const firstTask: Task = {
      id: 'first', parentId: null, projectId: null, title: '第一项任务', note: null,
      status: 'todo', priority: 'none', sortOrder: 0, scheduledDate: null, scheduledAt: null,
      dueAt: null, isAllDay: false, timezone: 'Asia/Shanghai', estimatedMinutes: null,
      createdAt: '', updatedAt: '', completedAt: null, deletedAt: null, revision: 1,
      source: 'manual', sourceCaptureId: null,
    }
    mocks.taskState.tasks = [firstTask]
    mocks.taskState.currentTask = firstTask
    render(<App />)

    fireEvent.click(screen.getByText('第一项任务'))

    const makeChildButton = screen.getByRole('button', { name: '设为上一项的子任务' })
    const moveUpButton = screen.getByRole('button', { name: '移到上一级' })
    expect(makeChildButton).toBeDisabled()
    expect(makeChildButton).toHaveAttribute('title', '前面没有同级任务，不能设为子任务')
    expect(moveUpButton).toBeDisabled()
    expect(moveUpButton).toHaveAttribute('title', '当前已经是顶级任务')
  })
  it('saves minute-level times and creates a manually entered category', async () => {
    render(<App />)
    fireEvent.change(screen.getByLabelText('添加任务内容'), { target: { value: '带时间任务' } })
    fireEvent.click(screen.getByRole('button', { name: '高级' }))

    fireEvent.change(screen.getByLabelText('新分类名称'), { target: { value: '新分类' } })
    fireEvent.change(screen.getByLabelText('计划开始时间'), { target: { value: '2026-08-01T09:30' } })
    fireEvent.change(screen.getByLabelText('计划截止时间'), { target: { value: '2026-08-01T11:45' } })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))

    await waitFor(() => expect(mocks.createProject).toHaveBeenCalledWith({ name: '新分类' }))
    expect(mocks.createTask).toHaveBeenLastCalledWith(expect.objectContaining({
      projectId: 'new-category',
      scheduledDate: '2026-08-01',
      scheduledAt: new Date('2026-08-01T09:30').toISOString(),
      dueAt: new Date('2026-08-01T11:45').toISOString(),
    }))
  })

  it('opens a child task detail from the parent subtask Advanced button', () => {
    const parent: Task = {
      id: 'advanced-parent', parentId: null, projectId: null, title: '主任务详情', note: null,
      status: 'todo', priority: 'none', sortOrder: 0, scheduledDate: null, scheduledAt: null,
      dueAt: null, isAllDay: false, timezone: 'Asia/Shanghai', estimatedMinutes: null,
      createdAt: '', updatedAt: '', completedAt: null, deletedAt: null, revision: 1,
      source: 'manual', sourceCaptureId: null,
    }
    const child = { ...parent, id: 'advanced-child', parentId: parent.id, title: '需要高级设置的子任务' }
    mocks.taskState.tasks = [parent, child]
    mocks.taskState.currentTask = parent
    render(<App />)

    fireEvent.click(screen.getByText('主任务详情'))
    fireEvent.click(screen.getByRole('button', { name: '打开子任务详情 需要高级设置的子任务' }))

    expect(screen.getByRole('heading', { name: '任务详情' })).toBeInTheDocument()
    expect(screen.getByLabelText('任务标题')).toHaveValue('需要高级设置的子任务')
  })
  it('copies the main task start and deadline into a child task draft', () => {
    const parent: Task = {
      id: 'parent', parentId: null, projectId: null, title: '主任务', note: null,
      status: 'todo', priority: 'none', sortOrder: 0, scheduledDate: '2026-08-01',
      scheduledAt: '2026-08-01T09:30:00', dueAt: '2026-08-01T11:45:00',
      isAllDay: false, timezone: 'Asia/Shanghai', estimatedMinutes: null,
      createdAt: '', updatedAt: '', completedAt: null, deletedAt: null, revision: 1,
      source: 'manual', sourceCaptureId: null,
    }
    const child: Task = { ...parent, id: 'child', parentId: 'parent', title: '子任务', scheduledDate: null, scheduledAt: null, dueAt: null }
    mocks.taskState.tasks = [parent, child]
    mocks.taskState.currentTask = child
    render(<App />)

    fireEvent.click(screen.getByText('▶'))
    fireEvent.click(screen.getByText('子任务'))
    fireEvent.click(screen.getByRole('button', { name: '与主任务同步' }))

    expect(screen.getByLabelText('计划开始时间')).toHaveValue('2026-08-01T09:30')
    expect(screen.getByLabelText('计划截止时间')).toHaveValue('2026-08-01T11:45')
  })

  it('supports independent start/deadline reminders with exact and custom-offset input', async () => {
    const scheduledAt = new Date('2099-08-01T09:30').toISOString()
    const dueAt = new Date('2099-08-01T11:45').toISOString()
    const created: Task = {
      id: 'reminded-task', parentId: null, projectId: null, title: '提醒任务', note: null,
      status: 'todo', priority: 'none', sortOrder: 0, scheduledDate: '2099-08-01', scheduledAt,
      dueAt, isAllDay: false, timezone: 'Asia/Shanghai', estimatedMinutes: null,
      createdAt: '', updatedAt: '', completedAt: null, deletedAt: null, revision: 1,
      source: 'manual', sourceCaptureId: null,
    }
    mocks.createTask.mockResolvedValueOnce(created)
    const reminderSpy = vi.spyOn(reminderScheduler, 'setTaskReminders').mockResolvedValueOnce(undefined)
    render(<App />)

    fireEvent.change(screen.getByLabelText('添加任务内容'), { target: { value: '提醒任务' } })
    fireEvent.click(screen.getByRole('button', { name: '高级' }))
    fireEvent.change(screen.getByLabelText('计划开始时间'), { target: { value: '2099-08-01T09:30' } })
    fireEvent.change(screen.getByLabelText('计划截止时间'), { target: { value: '2099-08-01T11:45' } })

    const startEditor = within(screen.getByTestId('start-reminder-editor'))
    expect(startEditor.getByRole('button', { name: '前一天' })).toBeInTheDocument()
    fireEvent.click(startEditor.getByRole('button', { name: '指定日期时间' }))
    fireEvent.change(startEditor.getByLabelText('开始提醒指定时间'), { target: { value: '2099-08-01T08:15' } })

    const dueEditor = within(screen.getByTestId('due-reminder-editor'))
    fireEvent.click(dueEditor.getByRole('button', { name: '自定义提前量' }))
    fireEvent.change(dueEditor.getByLabelText('截止提醒提前小时'), { target: { value: '2' } })
    fireEvent.change(dueEditor.getByLabelText('截止提醒提前分钟'), { target: { value: '15' } })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))

    await waitFor(() => expect(reminderSpy).toHaveBeenCalledWith(created, [
      { kind: 'start', remindAt: new Date('2099-08-01T08:15').toISOString() },
      { kind: 'due', remindAt: calculateReminderTime(dueAt, 135) },
    ]))
  })

  it('opens a square quick-priority menu and updates the task', async () => {
    const task: Task = {
      id: 'priority-task', parentId: null, projectId: null, title: 'Priority task', note: null,
      status: 'todo', priority: 'p2', sortOrder: 0, scheduledDate: null, scheduledAt: null,
      dueAt: null, isAllDay: false, timezone: 'Asia/Shanghai', estimatedMinutes: null,
      createdAt: '', updatedAt: '', completedAt: null, deletedAt: null, revision: 1,
      source: 'manual', sourceCaptureId: null,
    }
    mocks.taskState.tasks = [task]
    render(<App />)

    expect(screen.queryByTestId('task-drag-handle-priority-task')).not.toBeInTheDocument()
    const priorityButton = screen.getByRole('button', { name: '调整优先级 Priority task' })
    expect(priorityButton).toHaveClass('task-priority-square')
    fireEvent.click(priorityButton)
    fireEvent.click(screen.getByRole('menuitem', { name: 'P1' }))

    await waitFor(() => expect(mocks.updateTask).toHaveBeenCalledWith('priority-task', { priority: 'p1' }))
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('sorts child tasks by sortOrder and reorders them from child controls', async () => {
    const parent: Task = {
      id: 'parent', parentId: null, projectId: null, title: 'Parent', note: null,
      status: 'todo', priority: 'none', sortOrder: 0, scheduledDate: null, scheduledAt: null,
      dueAt: null, isAllDay: false, timezone: 'Asia/Shanghai', estimatedMinutes: null,
      createdAt: '2026-07-24T08:00:00.000Z', updatedAt: '', completedAt: null, deletedAt: null,
      revision: 1, source: 'manual', sourceCaptureId: null,
    }
    const childLater = { ...parent, id: 'child-later', parentId: 'parent', title: 'Child later', sortOrder: 1 }
    const childFirst = { ...parent, id: 'child-first', parentId: 'parent', title: 'Child first', sortOrder: 0 }
    mocks.taskState.tasks = [parent, childLater, childFirst]
    render(<App />)

    const expand = screen.getByRole('button', { name: '展开子任务' })
    expect(expand).toHaveClass('task-expand-button')
    fireEvent.click(expand)

    expect(screen.getAllByTestId(/^task-card-child-/).map(card => card.getAttribute('data-testid'))).toEqual([
      'task-card-child-first', 'task-card-child-later',
    ])
    fireEvent.click(within(screen.getByTestId('task-card-child-later')).getByRole('button', { name: '上移任务' }))
    await waitFor(() => expect(mocks.reorderSiblingTasks).toHaveBeenCalledWith('parent', [
      'child-later', 'child-first',
    ]))
  })
  it('shows note, created time and delayed-help metadata on task controls', () => {
    mocks.taskState.tasks = [{
      id: 'visible-meta', parentId: null, projectId: null, title: '可见信息任务', note: '无需打开详情即可看到的备注',
      status: 'todo', priority: 'none', sortOrder: 0, scheduledDate: null, scheduledAt: null,
      dueAt: null, isAllDay: false, timezone: 'Asia/Shanghai', estimatedMinutes: null,
      createdAt: '2026-07-24T08:30:00.000Z', updatedAt: '2026-07-24T08:30:00.000Z', completedAt: null,
      deletedAt: null, revision: 1, source: 'manual', sourceCaptureId: null,
    }]
    render(<App />)

    expect(screen.getByText('无需打开详情即可看到的备注')).toBeInTheDocument()
    expect(screen.getByText(/创建于/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '快速添加' })).toHaveAttribute('data-tooltip', '立即创建一个基础 TODO 任务')
    expect(screen.getByRole('button', { name: '上移任务' })).toHaveAttribute('data-tooltip', '将任务上移一位')
  })

  it('protects unsaved detail edits with Save, Discard and Cancel choices', () => {
    render(<App />)
    fireEvent.change(screen.getByLabelText('添加任务内容'), { target: { value: '待保护任务' } })
    fireEvent.click(screen.getByRole('button', { name: '高级' }))
    fireEvent.change(screen.getByLabelText('任务备注'), { target: { value: '尚未保存' } })
    fireEvent.click(screen.getByRole('button', { name: '取消' }))

    const dialog = screen.getByRole('dialog', { name: '保存任务详情的改动？' })
    expect(within(dialog).getAllByRole('button')).toHaveLength(3)
    expect(within(dialog).getByRole('button', { name: '保存' })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: '不保存' })).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: '取消' }))
    expect(screen.getByLabelText('任务备注')).toHaveValue('尚未保存')
  })

  it('uses a polished three-button choice when a parent has unfinished children', async () => {
    const parent: Task = {
      id: 'choice-parent', parentId: null, projectId: null, title: '待选择父任务', note: null,
      status: 'todo', priority: 'none', sortOrder: 0, scheduledDate: null, scheduledAt: null,
      dueAt: null, isAllDay: false, timezone: 'Asia/Shanghai', estimatedMinutes: null,
      createdAt: '', updatedAt: '', completedAt: null, deletedAt: null, revision: 1,
      source: 'manual', sourceCaptureId: null,
    }
    mocks.taskState.tasks = [parent, { ...parent, id: 'choice-child', parentId: parent.id, title: '未完成子任务' }]
    mocks.completeTask.mockRejectedValueOnce(new Error('HAS_UNCOMPLETED_CHILDREN')).mockResolvedValueOnce(parent)
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: '完成任务 待选择父任务' }))
    const dialog = await screen.findByRole('dialog', { name: '还有未完成的子任务' })
    expect(within(dialog).getAllByRole('button')).toHaveLength(3)
    fireEvent.click(within(dialog).getByRole('button', { name: '完成全部子任务' }))
    await waitFor(() => expect(mocks.completeTask).toHaveBeenLastCalledWith('choice-parent', 'withChildren'))
  })
})
