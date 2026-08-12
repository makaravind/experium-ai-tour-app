'use client'

import { motion } from 'framer-motion'
import { useStore } from '@/lib/store'
import type { LanguageOption } from '@/lib/utils'

type Variant = 'block' | 'chip' | 'chip-sm'

const VARIANTS: Record<Variant, { wrapper: string; button: string; useNativeLabel: boolean }> = {
  // Full-width buttons — onboarding / loading screen
  block: {
    wrapper: 'flex gap-2.5',
    button: 'flex-1 h-14 rounded-2xl border-2 text-base font-extrabold',
    useNativeLabel: true,
  },
  // Chips — bottom sheet
  chip: {
    wrapper: 'flex gap-2',
    button: 'rounded-full px-4 py-2 text-sm font-extrabold border-2',
    useNativeLabel: false,
  },
  // Compact chips — audio player
  'chip-sm': {
    wrapper: 'flex gap-2',
    button: 'rounded-full px-3.5 py-1.5 text-xs font-extrabold border-2',
    useNativeLabel: false,
  },
}

/**
 * Single source of truth for language selection. Writes straight to the Zustand
 * store, which persists `language` — so the choice carries to the next scan.
 */
export default function LanguageSelector({
  options,
  variant = 'chip',
  className = '',
}: {
  options: LanguageOption[]
  variant?: Variant
  className?: string
}) {
  const language = useStore((s) => s.language)
  const setLanguage = useStore((s) => s.setLanguage)

  const { wrapper, button, useNativeLabel } = VARIANTS[variant]

  return (
    <div className={`${wrapper} ${className}`} role="group" aria-label="Audio language">
      {options.map(({ code, label, nativeLabel }) => {
        const selected = language === code
        return (
          <motion.button
            key={code}
            onClick={() => setLanguage(code)}
            whileTap={{ scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            className={`${button} transition-colors ${
              selected
                ? 'bg-ex-forest border-ex-forest text-white'
                : 'bg-transparent border-ex-sage text-ex-ink'
            }`}
            aria-pressed={selected}
          >
            {useNativeLabel ? nativeLabel : label}
          </motion.button>
        )
      })}
    </div>
  )
}
