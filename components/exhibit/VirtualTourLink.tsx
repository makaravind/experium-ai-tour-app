'use client'

import { useSyncExternalStore } from 'react'
import Link from 'next/link'

function subscribeOnline(cb: () => void) {
  window.addEventListener('online', cb)
  window.addEventListener('offline', cb)
  return () => {
    window.removeEventListener('online', cb)
    window.removeEventListener('offline', cb)
  }
}

const getOnline = () => navigator.onLine
const getServerOnline = () => true

// The tour streams panoramas, so it's hidden offline.
export default function VirtualTourLink() {
  const online = useSyncExternalStore(subscribeOnline, getOnline, getServerOnline)
  if (!online) return null
  return (
    <Link
      href="/tour"
      className="flex items-center justify-center w-full h-[52px] mt-3.5 rounded-2xl border-[1.5px] border-ex-sage bg-ex-paper text-ex-ink font-extrabold text-sm active:translate-y-px"
    >
      360° Virtual Tour →
    </Link>
  )
}
