import { HomeIcon, MapIcon, ScanIcon } from '@/components/icons'

export default function TabBar() {
  return (
    <nav
      className="absolute left-4 right-4 bottom-6 h-16 flex items-center justify-around rounded-[28px]"
      style={{
        background: '#fff',
        border: '1px solid #e8e5df',
        boxShadow: '0 8px 26px rgba(43,43,43,.14)',
        zIndex: 40,
        fontFamily: 'var(--font-body)',
      }}
      aria-label="Primary"
    >
      <button
        className="flex flex-col items-center gap-0.5 text-[10.5px] font-extrabold flex-1"
        style={{ color: '#8a8a8a', border: 'none', background: 'none' }}
      >
        <HomeIcon color="#8a8a8a" strokeWidth={2.1} />
        Home
      </button>

      <button
        className="flex flex-col items-center"
        style={{ flex: '0 0 auto', marginTop: -24, border: 'none', background: 'none' }}
        aria-label="Scan a marker"
      >
        <span
          className="btn-3d-orange flex items-center justify-center rounded-full"
          style={{ width: 62, height: 62, background: '#dda15e', border: '3px solid #fff' }}
        >
          <ScanIcon size={28} color="#fff" strokeWidth={2.3} />
        </span>
        <span
          className="mt-1.5 text-[10.5px] font-extrabold"
          style={{ color: '#dda15e', fontFamily: 'var(--font-body)' }}
        >
          Scan
        </span>
      </button>

      <button
        className="flex flex-col items-center gap-0.5 text-[10.5px] font-extrabold flex-1"
        style={{ color: '#588157', border: 'none', background: 'none' }}
      >
        <MapIcon color="#588157" strokeWidth={2.1} />
        Map
      </button>
    </nav>
  )
}
