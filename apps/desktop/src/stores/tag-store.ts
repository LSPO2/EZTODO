/**
 * Tag store using Zustand
 */

import { create } from 'zustand'
import { getRepositories } from '../lib/repositories'
import type { Tag, CreateTagRequest } from '../lib/repositories'

interface TagState {
  tags: Tag[]
  isLoading: boolean
  error: string | null

  loadTags: () => Promise<void>
  createTag: (request: CreateTagRequest) => Promise<Tag>
}

export const useTagStore = create<TagState>((set) => ({
  tags: [],
  isLoading: false,
  error: null,

  loadTags: async () => {
    set({ isLoading: true, error: null })
    try {
      const repos = await getRepositories()
      const tags = await repos.tags.findAll()
      set({ tags, isLoading: false })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load tags',
        isLoading: false,
      })
    }
  },

  createTag: async (request: CreateTagRequest) => {
    set({ isLoading: true, error: null })
    try {
      const repos = await getRepositories()
      const tag = await repos.tags.create(request)
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
