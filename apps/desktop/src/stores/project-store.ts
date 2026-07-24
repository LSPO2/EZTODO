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
      set({
        error: error instanceof Error ? error.message : 'Failed to load projects',
        isLoading: false,
      })
    }
  },

  createProject: async (request: CreateProjectRequest) => {
    set({ isLoading: true, error: null })
    try {
      const repos = await getRepositories()
      const project = await repos.projects.create(request)
      set((state) => ({
        projects: [...state.projects, project],
        isLoading: false,
      }))
      return project
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to create project',
        isLoading: false,
      })
      throw error
    }
  },
}))
