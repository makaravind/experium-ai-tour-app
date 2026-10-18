'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { HomeIcon, MapIcon, ScanIcon } from '@/components/icons'
import { useStore } from '@/lib/store'

export default function TabBar() {
  const pathname = usePathname()
  const isHome = pathname === '/'
  const isMap = pathname === '/map'
  const moreOpen = useStore((s) => s.moreMenuOpen)

  return (
    <nav
      className="absolute left-4 right-4 bottom-6 h-16 flex items-center rounded-[28px] bg-ex-paper border border-ex-border pr-[52px]"
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

      <button
        type="button"
        onClick={() => useStore.getState().setMoreMenuOpen(true)}
        aria-label="More"
        aria-haspopup="menu"
        aria-expanded={moreOpen}
        className={`absolute right-0 top-0 bottom-0 flex items-center justify-center w-[52px] rounded-r-[28px] ${moreOpen ? 'text-ex-forest-shadow' : 'text-ex-muted'}`}
      >
        <span
          className={`grid place-items-center w-8 h-8 rounded-[12px] transition-colors ${moreOpen ? 'bg-ex-forest/10' : ''}`}
        >
          <svg width={20} height={20} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <circle cx="5.5" cy="12" r="1.9" />
            <circle cx="12" cy="12" r="1.9" />
            <circle cx="18.5" cy="12" r="1.9" />
          </svg>
        </span>
      </button>
    </nav>
  )
}
