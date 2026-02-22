import { useEffect, useMemo, useState } from 'react'
import { useGuardedBackdropClose } from '../hooks/useGuardedBackdropClose'
import type { AppLanguage } from '../types/models'
import { tx } from '../utils/i18n'

export interface PaletteAction {
  id: string
  label: string
  description: string
  run: () => void
}

interface CommandPaletteProps {
  onClose: () => void
  actions: PaletteAction[]
  language: AppLanguage
}

export function CommandPalette({ onClose, actions, language }: CommandPaletteProps): JSX.Element {
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const backdropCloseGuard = useGuardedBackdropClose(onClose)
  const t = (de: string, en: string) => tx(language, de, en)
  const filtered = useMemo(
    () => actions.filter((item) => `${item.label} ${item.description}`.toLowerCase().includes(query.trim().toLowerCase())),
    [actions, query],
  )
  const resolvedActiveIndex = filtered.length === 0 ? -1 : Math.min(Math.max(activeIndex, 0), filtered.length - 1)

  function executeAction(action: PaletteAction): void {
    action.run()
    onClose()
  }

  function onInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'ArrowDown') {
      if (filtered.length === 0) {
        return
      }
      event.preventDefault()
      setActiveIndex((current) => (Math.max(current, 0) + 1) % filtered.length)
      return
    }
    if (event.key === 'ArrowUp') {
      if (filtered.length === 0) {
        return
      }
      event.preventDefault()
      setActiveIndex((current) => (current - 1 + filtered.length) % filtered.length)
      return
    }
    if (event.key === 'Enter') {
      if (filtered.length === 0) {
        return
      }
      event.preventDefault()
      const selected = filtered[resolvedActiveIndex] ?? filtered[0]
      executeAction(selected)
    }
  }

  useEffect(() => {
    function onEscape(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', onEscape)
    return () => window.removeEventListener('keydown', onEscape)
  }, [onClose])

  return (
    <div
      className="palette-backdrop"
      onMouseDown={backdropCloseGuard.onBackdropMouseDown}
      onClick={backdropCloseGuard.onBackdropClick}
      role="presentation"
    >
      <section className="palette" onMouseDownCapture={backdropCloseGuard.onModalMouseDownCapture} onClick={(event) => event.stopPropagation()}>
        <input
          autoFocus
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setActiveIndex(0)
          }}
          onKeyDown={onInputKeyDown}
          placeholder={t('Befehl eingeben...', 'Enter command...')}
          aria-label={t('Befehlssuche', 'Command search')}
          role="combobox"
          aria-expanded="true"
          aria-controls="command-palette-list"
          aria-activedescendant={resolvedActiveIndex >= 0 ? `palette-item-${filtered[resolvedActiveIndex]?.id}` : undefined}
        />
        <ul id="command-palette-list" role="listbox">
          {filtered.length === 0 ? <li className="empty-inline">{t('Kein Befehl gefunden.', 'No command found.')}</li> : null}
          {filtered.map((item, index) => (
            <li key={item.id}>
              <button
                type="button"
                id={`palette-item-${item.id}`}
                className={`palette-item ${index === resolvedActiveIndex ? 'active' : ''}`}
                role="option"
                aria-selected={index === resolvedActiveIndex}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => executeAction(item)}
              >
                <span>{item.label}</span>
                <small>{item.description}</small>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
