import type { AppLanguage } from '../types/models'

export function tx(language: AppLanguage, de: string, en: string): string {
  return language === 'en' ? en : de
}
