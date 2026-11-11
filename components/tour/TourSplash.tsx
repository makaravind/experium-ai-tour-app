'use client'

import type { SplashView } from '@/lib/tour'

interface Props {
  view: Exclude<SplashView, 'hidden'>
  /** "Starting at <title>"; null until the lobby label is known */
  title: string | null
  /** blurred backdrop for the anchored (exhibit) variant */
  backdropUrl: string | null
  onCancel: () => void
  onKeepWaiting: () => void
  onRetry: () => void
  onBackToMap: () => void
}

const primary = 'rounded-full bg-white px-5 py-2 text-sm font-medium text-black'
const secondary = 'rounded-full bg-white/15 px-5 py-2 text-sm text-white'

export default function TourSplash({
  view,
  title,
  backdropUrl,
  onCancel,
  onKeepWaiting,
  onRetry,
  onBackToMap,
}: Props) {
  return (
    <div
      className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-6 bg-black px-8 text-center text-white"
      role="status"
    >
      {backdropUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={backdropUrl}
          alt=""
          className="absolute inset-0 h-full w-full scale-110 object-cover opacity-40 blur-xl"
        />
      )}
      <div className="relative flex flex-col items-center gap-6">
        {view === 'offline' ? (
          <>
            <p className="text-lg font-medium">Virtual tour needs internet</p>
            <div className="flex gap-3">
              <button onClick={onRetry} className={primary}>
                Try again
              </button>
              <button onClick={onBackToMap} className={secondary}>
                Back to map
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-lg font-medium">
              {view === 'slow'
                ? 'Taking longer than expected'
                : title
                  ? `Starting at ${title}`
                  : 'Starting virtual tour'}
            </p>
            <div className="h-1 w-40 overflow-hidden rounded-full bg-white/20">
              <div className="h-full w-1/2 animate-pulse rounded-full bg-white" />
            </div>
            {view === 'slow' && (
              <div className="flex gap-3">
                <button onClick={onKeepWaiting} className={primary}>
                  Keep waiting
                </button>
                <button onClick={onCancel} className={secondary}>
                  Cancel
                </button>
              </div>
            )}
            {view === 'loading' && (
              <button onClick={onCancel} className="text-sm text-white/70 underline">
                Cancel
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
