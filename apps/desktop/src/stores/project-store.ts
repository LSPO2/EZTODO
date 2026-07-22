/**
 * Project store using Zustand
 */

import { create } from 'zustand'
import { projectRepository } from '../lib/repositories'
import type { Project, CreateProjectRequest, UpdateProjectRequest } from '../lib/repositories'

interface ProjectState {
  // State
  projects: Project[]
  isLoading: boolean
  error: string | null

  // Actions
  loadProjects: () => Promise<void>
  createProject: (request: CreateProjectRequest) => Promise<Project>
  updateProject: (id: string, updates: UpdateProjectRequest) => Promise<Project>
  deleteProject: (id: string) => Promise<void>
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

  // Update a project
  updateProject: async (id: string, updates: UpdateProjectRequest) => {
    set({ isLoading: true, error: null })
    try {
      const project = await projectRepository.update(id, updates)
      set((state) => ({
        projects: state.projects.map((p) => (p.id === id ? project : p)),
        isLoading: false,
      }))
      return project
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to update project',
        isLoading: false,
      })
      throw error
    }
  },

  // Delete a project
  deleteProject: async (id: string) => {
    set({ isLoading: true, error: null })
    try {
      await projectRepository.delete(id)
      set((state) => ({
        projects: state.projects.filter((p) => p.id !== id),
        isLoading: false,
      }))
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to delete project',
        isLoading: false,
      })
      throw error
    }
  },
}))
