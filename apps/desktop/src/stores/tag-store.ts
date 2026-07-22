/**
 * Tag store using Zustand
 */

import { create } from 'zustand'
import { tagRepository } from '../lib/repositories'
import type { Tag, CreateTagRequest, UpdateTagRequest } from '../lib/repositories'

interface TagState {
  // State
  tags: Tag[]
  isLoading: boolean
  error: string | null

  // Actions
  loadTags: () => Promise<void>
  createTag: (request: CreateTagRequest) => Promise<Tag>
  updateTag: (id: string, updates: UpdateTagRequest) => Promise<Tag>
  deleteTag: (id: string) => Promise<void>
  addTagToTask: (taskId: string, tagId: string) => Promise<void>
  removeTagFromTask: (taskId: string, tagId: string) => Promise<void>
  getTaskTags: (taskId: string) => Promise<Tag[]>
}

export const useTagStore = create<TagState>((set) => ({
  // Initial state
  tags: [],
  isLoading: false,
  error: null,

  // Load all tags
  loadTags: async () => {
    set({ isLoading: true, error: null })
    try {
      const tags = await tagRepository.findAll()
      set({ tags, isLoading: false })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load tags',
        isLoading: false,
      })
    }
  },

  // Create a new tag
  createTag: async (request: CreateTagRequest) => {
    set({ isLoading: true, error: null })
    try {
      const tag = await tagRepository.create(request)
      set((state) => ({
        tags: [...state.tags, tag],
        isLoading: false,
      }))
      return tag
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to create tag',
        isLoading: false,
      })
      throw error
    }
  },

  // Update a tag
  updateTag: async (id: string, updates: UpdateTagRequest) => {
    set({ isLoading: true, error: null })
    try {
      const tag = await tagRepository.update(id, updates)
      set((state) => ({
        tags: state.tags.map((t) => (t.id === id ? tag : t)),
        isLoading: false,
      }))
      return tag
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to update tag',
        isLoading: false,
      })
      throw error
    }
  },

  // Delete a tag
  deleteTag: async (id: string) => {
    set({ isLoading: true, error: null })
    try {
      await tagRepository.delete(id)
      set((state) => ({
        tags: state.tags.filter((t) => t.id !== id),
        isLoading: false,
      }))
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to delete tag',
        isLoading: false,
      })
      throw error
    }
  },

  // Add tag to task
  addTagToTask: async (taskId: string, tagId: string) => {
    try {
      await tagRepository.addToTask(taskId, tagId)
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to add tag to task',
      })
      throw error
    }
  },

  // Remove tag from task
  removeTagFromTask: async (taskId: string, tagId: string) => {
    try {
      await tagRepository.removeFromTask(taskId, tagId)
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to remove tag from task',
      })
      throw error
    }
  },

  // Get tags for a task
  getTaskTags: async (taskId: string) => {
    try {
      return await tagRepository.findByTaskId(taskId)
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to get task tags',
      })
      return []
    }
  },
}))
