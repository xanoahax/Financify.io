import { useCallback, useRef } from 'react'

interface GuardedBackdropCloseHandlers {
  onBackdropMouseDown: React.MouseEventHandler<HTMLDivElement>
  onBackdropClick: React.MouseEventHandler<HTMLDivElement>
  onModalMouseDownCapture: React.MouseEventHandler<HTMLElement>
}

export function useGuardedBackdropClose(onClose: () => void): GuardedBackdropCloseHandlers {
  const startedOnBackdropRef = useRef(false)
  const suppressCloseRef = useRef(false)

  const onBackdropMouseDown = useCallback<React.MouseEventHandler<HTMLDivElement>>((event) => {
    const isBackdropTarget = event.target === event.currentTarget
    startedOnBackdropRef.current = isBackdropTarget
    if (isBackdropTarget) {
      suppressCloseRef.current = false
    }
  }, [])

  const onModalMouseDownCapture = useCallback<React.MouseEventHandler<HTMLElement>>(() => {
    startedOnBackdropRef.current = false
    suppressCloseRef.current = true
  }, [])

  const onBackdropClick = useCallback<React.MouseEventHandler<HTMLDivElement>>(
    (event) => {
      if (event.target !== event.currentTarget) {
        return
      }

      const selectedText = window.getSelection?.()?.toString() ?? ''
      const shouldIgnoreClose = suppressCloseRef.current || !startedOnBackdropRef.current || selectedText.length > 0
      startedOnBackdropRef.current = false
      suppressCloseRef.current = false
      if (shouldIgnoreClose) {
        return
      }
      onClose()
    },
    [onClose],
  )

  return { onBackdropMouseDown, onBackdropClick, onModalMouseDownCapture }
}
