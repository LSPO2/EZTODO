export type TrayDestination = 'quick-add' | 'today' | 'settings'

const TRAY_NAVIGATION_EVENT = 'eztodo:tray-navigation'

export function requestTrayNavigation(destination: TrayDestination): void {
  window.dispatchEvent(new CustomEvent<TrayDestination>(TRAY_NAVIGATION_EVENT, {
    detail: destination,
  }))
}

export function subscribeToTrayNavigation(
  handler: (destination: TrayDestination) => void,
): () => void {
  const listener = (event: Event) => {
    handler((event as CustomEvent<TrayDestination>).detail)
  }

  window.addEventListener(TRAY_NAVIGATION_EVENT, listener)
  return () => window.removeEventListener(TRAY_NAVIGATION_EVENT, listener)
}
