'use client'

import { useEffect } from 'react'
import { track } from '@vercel/analytics'

export default function ErrorTracker() {
  useEffect(() => {
    function onError(event: ErrorEvent) {
      track('app_error', { message: event.message, source: event.filename ?? 'unknown' })
    }
    function onUnhandledRejection(event: PromiseRejectionEvent) {
      const message = event.reason instanceof Error ? event.reason.message : String(event.reason)
      track('app_error', { message, source: 'unhandled_rejection' })
    }
    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onUnhandledRejection)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onUnhandledRejection)
    }
  }, [])
  return null
}
