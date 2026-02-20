import { useContext } from 'react'
import { AppContext, type AppContextValue } from './AppContext'

export function useAppContext(): AppContextValue {
  const context = useContext(AppContext)
  if (!context) {
    throw new Error('useAppContext must be used inside AppProvider.')
  }
  return context
}

