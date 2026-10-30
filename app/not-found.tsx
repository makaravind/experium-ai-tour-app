import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-ex-bg px-6 text-center">
      <div
        className="text-[64px] font-extrabold text-ex-forest leading-none"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        404
      </div>
      <p
        className="mt-3 text-[17px] font-extrabold text-ex-ink"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        Marker not found
      </p>
      <p className="mt-2 text-[14px] text-ex-muted leading-relaxed max-w-xs">
        This QR code may be outdated or the exhibit may have moved. Try scanning a different marker.
      </p>
      <Link
        href="/"
        className="mt-8 px-6 py-3 rounded-full bg-ex-forest text-white text-[14px] font-semibold no-underline"
      >
        Go to home
      </Link>
    </div>
  )
}
