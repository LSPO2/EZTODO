/**
 * Project store using Zustand
 */

import { create } from 'zustand'
import { getRepositories } from '../lib/repositories'
import type { Project, CreateProjectRequest } from '../lib/repositories'

interface ProjectState {
  projects: Project[]
  isLoading: boolean
  error: string | null

  loadProjects: () => Promise<void>
  createProject: (request: CreateProjectRequest) => Promise<Project>
  deleteProject: (id: string) => Promise<void>
  reorderProjects: (ids: string[]) => Promise<void>
}

export const useProjectStore = create<ProjectState>((set) => ({
  projects: [],
  isLoading: false,
  error: null,

  loadProjects: async () => {
    set({ isLoading: true, error: null })
    try {
      const repos = await getRepositories()
      const projects = await repos.projects.findAll()
      set({ projects, isLoading: false })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '加载分类失败', isLoading: false })
    }
  },

  createProject: async (request: CreateProjectRequest) => {
    const name = request.name.trim()
    if (!name) throw new Error('分类名称不能为空')
    const duplicate = useProjectStore.getState().projects.some(
      project => project.name.toLocaleLowerCase() === name.toLocaleLowerCase(),
    )
    if (duplicate) throw new Error('已存在同名分类')

    set({ isLoading: true, error: null })
    try {
      const repos = await getRepositories()
      const project = await repos.projects.create({ ...request, name })
      set((state) => ({ projects: [...state.projects, project], isLoading: false }))
      return project
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '创建分类失败', isLoading: false })
      throw error
    }
  },

  deleteProject: async (id: string) => {
    set({ isLoading: true, error: null })
    try {
      const repos = await getRepositories()
      await repos.projects.delete(id)
      set((state) => ({ projects: state.projects.filter(project => project.id !== id), isLoading: false }))
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '删除分类失败', isLoading: false })
      throw error
    }
  },

  reorderProjects: async (ids: string[]) => {
    const currentProjects = useProjectStore.getState().projects
    if (ids.length !== currentProjects.length || new Set(ids).size !== ids.length || currentProjects.some(project => !ids.includes(project.id))) {
      throw new Error('分类排序数据无效')
    }

    set({ isLoading: true, error: null })
    try {
      const repos = await getRepositories()
      const projects = await repos.projects.reorder(ids)
      set({ projects, isLoading: false })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '分类排序失败', isLoading: false })
      throw error
    }
  },
}))
