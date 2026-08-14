import Link from 'next/link'
import { HomeIcon, MapIcon, ScanIcon } from '@/components/icons'

export default function TabBar() {
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
      <button
        className="flex flex-col items-center gap-0.5 text-[10.5px] font-extrabold flex-1 text-ex-muted"
        style={{ border: 'none', background: 'none' }}
      >
        <HomeIcon strokeWidth={2.1} />
        Home
      </button>

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

      <button
        className="flex flex-col items-center gap-0.5 text-[10.5px] font-extrabold flex-1 text-ex-forest"
        style={{ border: 'none', background: 'none' }}
      >
        <MapIcon strokeWidth={2.1} />
        Map
      </button>
    </nav>
  )
}
