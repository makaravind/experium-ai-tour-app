'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { HomeIcon, MapIcon, ScanIcon } from '@/components/icons'

export default function TabBar() {
  const pathname = usePathname()
  const isHome = pathname === '/'
  const isMap = pathname === '/map'

  return (
    <nav
      className="absolute left-4 right-4 bottom-6 h-16 flex items-center justify-around rounded-[28px] bg-ex-paper border border-ex-border"
      style={{
        boxShadow: 'var(--ex-shadow-nav)',
        zIndex: 40,
        fontFamily: 'var(--font-body)',
      }}
      aria-label="Primary"
    >
      <Link
        href="/"
        aria-current={isHome ? 'page' : undefined}
        className={`flex flex-col items-center gap-0.5 text-[10.5px] font-extrabold flex-1 ${
          isHome ? 'text-ex-forest' : 'text-ex-muted'
        }`}
      >
        <HomeIcon strokeWidth={2.1} />
        Home
      </Link>

      <Link
        href="/scan"
        className="flex flex-col items-center"
        style={{ flex: '0 0 auto', marginTop: -24 }}
        aria-label="Scan a marker"
      >
        <span
          className="btn-3d-orange flex items-center justify-center rounded-full bg-ex-orange border-[3px] border-ex-paper text-white"
          style={{ width: 62, height: 62 }}
        >
          <ScanIcon size={28} strokeWidth={2.3} />
        </span>
        <span
          className="mt-1.5 text-[10.5px] font-extrabold text-ex-orange"
          style={{ fontFamily: 'var(--font-body)' }}
        >
          Scan
        </span>
      </Link>

      <Link
        href="/map"
        aria-current={isMap ? 'page' : undefined}
        className={`flex flex-col items-center gap-0.5 text-[10.5px] font-extrabold flex-1 ${
          isMap ? 'text-ex-forest' : 'text-ex-muted'
        }`}
      >
        <MapIcon strokeWidth={2.1} />
        Map
      </Link>
    </nav>
  )
}
