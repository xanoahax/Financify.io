import { useCallback, useState } from 'react'
import type { AppLanguage, ToastMessage, UpdatePrompt } from '../types/models'
import { tx } from '../utils/i18n'

interface UpdaterHandle {
  currentVersion: string
  version: string
  date?: string
  body?: string
  downloadAndInstall: () => Promise<void>
  close: () => Promise<void>
}

async function safelyCloseUpdateHandle(handle: UpdaterHandle | null): Promise<void> {
  if (!handle) {
    return
  }
  try {
    await handle.close()
  } catch {
    // Ignore close errors. They are non-fatal and should not block update checks.
  }
}

interface UseAppUpdatesParams {
  updatesSupported: boolean
  language: AppLanguage
  skippedUpdateVersion: string
  setSkippedUpdateVersion: React.Dispatch<React.SetStateAction<string>>
  pushToast: (toast: Omit<ToastMessage, 'id'>) => void
}

interface UseAppUpdatesResult {
  isCheckingForUpdates: boolean
  isInstallingUpdate: boolean
  updateCheckError: string | null
  updatePrompt: UpdatePrompt | null
  checkForUpdates: (options?: { manual?: boolean }) => Promise<boolean>
  installUpdate: () => Promise<void>
  skipUpdateVersion: () => void
  dismissUpdatePrompt: () => void
}

export function useAppUpdates(params: UseAppUpdatesParams): UseAppUpdatesResult {
  const { updatesSupported, language, skippedUpdateVersion, setSkippedUpdateVersion, pushToast } = params
  const [pendingUpdate, setPendingUpdate] = useState<UpdaterHandle | null>(null)
  const [updatePrompt, setUpdatePrompt] = useState<UpdatePrompt | null>(null)
  const [isCheckingForUpdates, setIsCheckingForUpdates] = useState(false)
  const [isInstallingUpdate, setIsInstallingUpdate] = useState(false)
  const [updateCheckError, setUpdateCheckError] = useState<string | null>(null)

  const dismissUpdatePrompt = useCallback(() => {
    setUpdatePrompt(null)
    setPendingUpdate((current) => {
      void safelyCloseUpdateHandle(current)
      return null
    })
  }, [])

  const skipUpdateVersion = useCallback(() => {
    if (!updatePrompt) {
      return
    }
    setSkippedUpdateVersion(updatePrompt.version)
    dismissUpdatePrompt()
    pushToast({
      tone: 'info',
      text: tx(
        language,
        `Version ${updatePrompt.version} wird bis zur nächsten Version übersprungen.`,
        `Version ${updatePrompt.version} will be skipped until the next version.`,
      ),
    })
  }, [dismissUpdatePrompt, language, pushToast, setSkippedUpdateVersion, updatePrompt])

  const checkForUpdates = useCallback(
    async (options?: { manual?: boolean }): Promise<boolean> => {
      const manual = Boolean(options?.manual)
      if (!updatesSupported) {
        if (manual) {
          pushToast({
            tone: 'info',
            text: tx(
              language,
              'Updates werden nur in der Desktop-App unterstützt.',
              'Updates are only supported in the desktop app.',
            ),
          })
        }
        return false
      }

      setIsCheckingForUpdates(true)
      setUpdateCheckError(null)

      try {
        const { check } = await import('@tauri-apps/plugin-updater')
        const update = await check()

        if (!update) {
          dismissUpdatePrompt()
          if (manual) {
            pushToast({
              tone: 'success',
              text: tx(language, 'Kein Update verfügbar. Du bist aktuell.', 'No update available. You are up to date.'),
            })
          }
          return false
        }

        if (!manual && skippedUpdateVersion && skippedUpdateVersion === update.version) {
          await update.close()
          return false
        }

        setPendingUpdate((current) => {
          void safelyCloseUpdateHandle(current)
          return {
            currentVersion: update.currentVersion,
            version: update.version,
            date: update.date,
            body: update.body,
            downloadAndInstall: () => update.downloadAndInstall(),
            close: () => update.close(),
          }
        })
        setUpdatePrompt({
          currentVersion: update.currentVersion,
          version: update.version,
          date: update.date,
          body: update.body,
        })
        setSkippedUpdateVersion((current) => (current === update.version ? '' : current))
        return true
      } catch (error) {
        const message = error instanceof Error ? error.message : tx(language, 'Update-Prüfung ist fehlgeschlagen.', 'Update check failed.')
        setUpdateCheckError(message)
        if (manual) {
          pushToast({ tone: 'error', text: message, expiresInMs: 0 })
        }
        return false
      } finally {
        setIsCheckingForUpdates(false)
      }
    },
    [dismissUpdatePrompt, language, pushToast, setSkippedUpdateVersion, skippedUpdateVersion, updatesSupported],
  )

  const installUpdate = useCallback(async () => {
    if (!pendingUpdate) {
      throw new Error(tx(language, 'Kein Update zum Installieren verfügbar.', 'No update available to install.'))
    }

    setIsInstallingUpdate(true)
    setUpdateCheckError(null)
    try {
      await pendingUpdate.downloadAndInstall()
      pushToast({
        tone: 'success',
        text: tx(language, 'Update wird installiert. App startet ggf. neu.', 'Update is being installed. The app may restart.'),
      })
      await safelyCloseUpdateHandle(pendingUpdate)
      setSkippedUpdateVersion('')
      setUpdatePrompt(null)
      setPendingUpdate(null)
    } catch (error) {
      const message = error instanceof Error ? error.message : tx(language, 'Update-Installation fehlgeschlagen.', 'Update installation failed.')
      setUpdateCheckError(message)
      pushToast({ tone: 'error', text: message, expiresInMs: 0 })
      throw error
    } finally {
      setIsInstallingUpdate(false)
    }
  }, [language, pendingUpdate, pushToast, setSkippedUpdateVersion])

  return {
    isCheckingForUpdates,
    isInstallingUpdate,
    updateCheckError,
    updatePrompt,
    checkForUpdates,
    installUpdate,
    skipUpdateVersion,
    dismissUpdatePrompt,
  }
}

