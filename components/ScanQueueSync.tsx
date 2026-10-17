'use client'

import { useEffect } from 'react'
import { flushScanQueue } from '@/lib/scan-queue'
import { useStore } from '@/lib/store'

const STORE_KEY = 'experium-store'

export default function ScanQueueSync() {
  useEffect(() => {
    void flushScanQueue()
  }, [])

  useEffect(() => {
    const onOnline = () => void flushScanQueue()
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [])

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState !== 'visible') return
      void Promise.resolve(useStore.persist.rehydrate()).then(() => flushScanQueue())
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORE_KEY || e.key === null) void useStore.persist.rehydrate()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  return null
}
