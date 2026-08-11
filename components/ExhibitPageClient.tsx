'use client'

import { useEffect } from 'react'
import { useStore } from '@/lib/store'

interface Props {
  exhibitId: string
  children: React.ReactNode
}

export default function ExhibitPageClient({ exhibitId, children }: Props) {
  const markVisited = useStore((s) => s.markVisited)

  useEffect(() => {
    markVisited(exhibitId)
  }, [exhibitId, markVisited])

  return <>{children}</>
}
