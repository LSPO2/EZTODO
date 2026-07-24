type TauriWindow = Window & {
  __TAURI_INTERNALS__?: unknown
}

/**
 * Detect the Tauri v2 runtime without requiring `app.withGlobalTauri`.
 *
 * Tauri v2 always injects `__TAURI_INTERNALS__`; the public `__TAURI__`
 * namespace only exists when the optional global API is enabled.
 */
export function isTauriEnvironment(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof (window as TauriWindow).__TAURI_INTERNALS__ === 'object'
  )
}