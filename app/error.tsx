'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-ex-bg px-6 text-center">
      <p
        className="text-[17px] font-extrabold text-ex-ink"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        Something went wrong
      </p>
      <p className="mt-2 text-[14px] text-ex-muted leading-relaxed max-w-xs">
        {error.message || 'An unexpected error occurred.'}
      </p>
      <button
        onClick={reset}
        className="mt-8 px-6 py-3 rounded-full bg-ex-forest text-white text-[14px] font-semibold"
      >
        Try again
      </button>
    </div>
  )
}
