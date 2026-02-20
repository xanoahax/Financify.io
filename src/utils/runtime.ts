export function isTauriRuntime(): boolean {
  const tauriWindow = window as Window & { __TAURI_INTERNALS__?: unknown }
  return typeof tauriWindow.__TAURI_INTERNALS__ !== 'undefined'
}

export function isGitHubPagesRuntime(): boolean {
  return window.location.hostname.endsWith('github.io')
}
