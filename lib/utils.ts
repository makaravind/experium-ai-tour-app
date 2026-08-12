import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { ExhibitAudio, Fact, Language } from '@/lib/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatTime(sec: number) {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export interface LanguageOption {
  code: Language
  /** Compact label for chips, e.g. "EN" */
  label: string
  /** Full native name, e.g. "English" */
  nativeLabel: string
}

export const LANGUAGES: LanguageOption[] = [
  { code: 'en', label: 'EN', nativeLabel: 'English' },
  { code: 'hi', label: 'हि', nativeLabel: 'हिंदी' },
  { code: 'te', label: 'తె', nativeLabel: 'తెలుగు' },
]

/** Languages that actually have audio among the given rows. */
export function getAvailableLangs(audio: ExhibitAudio[]): LanguageOption[] {
  return LANGUAGES.filter(({ code }) => audio.some((a) => a.language === code && a.audio_url))
}

/** Flattens `exhibits.facts` jsonb into display strings, tolerating null/malformed rows. */
export function parseFacts(raw: Fact[] | null | undefined): string[] {
  if (!Array.isArray(raw)) return []
  return raw.map((f) => f?.fact?.trim() ?? '').filter(Boolean)
}
