'use client'

import { useEffect } from 'react'
import { useStore } from '@/lib/store'
import { useDebugStore } from '@/lib/debug-store'

interface Props {
  exhibitId: string
  rawApiResponse?: unknown
  children: React.ReactNode
}

export default function ExhibitPageClient({ exhibitId, rawApiResponse, children }: Props) {
  const markVisited = useStore((s) => s.markVisited)
  const logApi = useDebugStore((s) => s.logApi)

  useEffect(() => {
    markVisited(exhibitId)
  }, [exhibitId, markVisited])

  useEffect(() => {
    if (rawApiResponse !== undefined) {
      logApi('exhibit-fetch', rawApiResponse)
    }
  }, [rawApiResponse, logApi])

  return <>{children}</>
}
