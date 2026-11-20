import { useCallback, useEffect, useRef, useState } from 'react'
import type { PipState } from '@/components/common/PipMascot'

/** Transient Pip reaction: `react(state, ms)` shows `state`, then auto-clears to null. Newest call wins. */
export function useMascotReaction(): [PipState | null, (state: PipState, ms: number) => void] {
  const [reaction, setReaction] = useState<PipState | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    []
  )

  const react = useCallback((state: PipState, ms: number) => {
    if (timer.current) clearTimeout(timer.current)
    setReaction(state)
    timer.current = setTimeout(() => {
      timer.current = null
      setReaction(null)
    }, ms)
  }, [])

  return [reaction, react]
}
