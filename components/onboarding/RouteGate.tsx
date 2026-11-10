'use client'

import type { ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import AppGate from '@/components/onboarding/AppGate'

/** Visitor gate for every route except the dev-only /admin tool. */
export default function RouteGate({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  if (pathname === '/admin' || pathname.startsWith('/admin/')) return <>{children}</>
  return <AppGate>{children}</AppGate>
}
