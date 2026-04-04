import { useLayoutEffect } from 'react'
import type { RefObject } from 'react'

const CARD_SELECTOR = '.card:not(.form-modal):not(.stat-card)'
const ROW_TOLERANCE_PX = 20
const BASE_DELAY_MS = 100
const ROW_STEP_MS = 120

export function useCardRowStagger<T extends HTMLElement>(rootRef: RefObject<T | null>): void {
  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) {
      return
    }

    let frame = 0

    const applyStagger = () => {
      const cards = Array.from(root.querySelectorAll<HTMLElement>(CARD_SELECTOR))
      let currentRowTop: number | null = null
      let currentRowIndex = -1

      cards.forEach((card) => {
        const top = Math.round(card.getBoundingClientRect().top)
        if (currentRowTop === null || Math.abs(top - currentRowTop) > ROW_TOLERANCE_PX) {
          currentRowIndex += 1
          currentRowTop = top
        }

        card.style.setProperty('--card-row-delay', `${BASE_DELAY_MS + currentRowIndex * ROW_STEP_MS}ms`)
      })
    }

    const schedule = () => {
      cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(applyStagger)
    }

    schedule()

    const resizeObserver = new ResizeObserver(schedule)
    resizeObserver.observe(root)
    Array.from(root.querySelectorAll<HTMLElement>(CARD_SELECTOR)).forEach((card) => resizeObserver.observe(card))
    window.addEventListener('resize', schedule)

    return () => {
      cancelAnimationFrame(frame)
      resizeObserver.disconnect()
      window.removeEventListener('resize', schedule)
    }
  })
}
