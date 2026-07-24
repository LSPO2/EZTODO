import { afterEach, describe, expect, it } from 'vitest'
import { isTauriEnvironment } from '../environment'

type TauriWindow = Window & {
  __TAURI_INTERNALS__?: unknown
}

afterEach(() => {
  delete (window as TauriWindow).__TAURI_INTERNALS__
})

describe('isTauriEnvironment', () => {
  it('returns false in a regular browser runtime', () => {
    expect(isTauriEnvironment()).toBe(false)
  })

  it('detects the Tauri v2 internal bridge', () => {
    ;(window as TauriWindow).__TAURI_INTERNALS__ = {}

    expect(isTauriEnvironment()).toBe(true)
  })
})