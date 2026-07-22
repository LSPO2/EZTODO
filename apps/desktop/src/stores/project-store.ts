/**
 * Project store using Zustand
 */

import { create } from 'zustand'
import { projectRepository } from '../lib/repositories'
import type { Project, CreateProjectRequest } from '../lib/repositories'

interface ProjectState {
  // State
  projects: Project[]
  isLoading: boolean
  error: string | null

  // Actions
  loadProjects: () => Promise<void>
  createProject: (request: CreateProjectRequest) => Promise<Project>
}

export const useProjectStore = create<ProjectState>((set) => ({
  // Initial state
  projects: [],
  isLoading: false,
  error: null,

  // Load all projects
  loadProjects: async () => {
    set({ isLoading: true, error: null })
    try {
      const projects = await projectRepository.findAll()
      set({ projects, isLoading: false })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load projects',
        isLoading: false,
      })
    }
  },

  // Create a new project
  createProject: async (request: CreateProjectRequest) => {
    set({ isLoading: true, error: null })
    try {
      const project = await projectRepository.create(request)
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
