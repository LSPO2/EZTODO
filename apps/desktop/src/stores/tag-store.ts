/**
 * Tag store using Zustand
 */

import { create } from 'zustand'
import { tagRepository } from '../lib/repositories'
import type { Tag, CreateTagRequest } from '../lib/repositories'

interface TagState {
  // State
  tags: Tag[]
  isLoading: boolean
  error: string | null

  // Actions
  loadTags: () => Promise<void>
  createTag: (request: CreateTagRequest) => Promise<Tag>
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
}))
