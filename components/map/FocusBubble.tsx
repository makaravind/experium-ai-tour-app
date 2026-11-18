'use client'

export type FocusBubbleState = 'unvisited' | 'visited' | 'coming_soon'

// Ring / tag colour + copy per pin state (matches TINTS in marker-layer.ts).
const STATE: Record<FocusBubbleState, { color: string; tag: string }> = {
  unvisited: { color: 'var(--color-ex-orange)', tag: 'Not visited' },
  visited: { color: 'var(--color-ex-forest)', tag: '✓ Visited' },
  // Pin grey from TINTS in marker-layer.ts, not the --color-ex-coming-soon token (brown).
  coming_soon: { color: '#8f8f8f', tag: 'Coming soon' },
}

const TAIL = 12

/**
 * Peek card for the exhibit nearest the view centre. Presentational only: the
 * caller positions it (map Marker / PSV marker) with its bottom-centre tail on the pin,
 * and bumps `popKey` on each show so the pop-in replays.
 */
export default function FocusBubble({
  displayId,
  name,
  thumb,
  state,
  onTap,
  popKey,
  visible = true,
}: {
  displayId: string
  name: string
  thumb: string | null
  state: FocusBubbleState
  onTap: () => void
  popKey: number
  /** false → fades out in 100 ms and ignores taps. Defaults to true. */
  visible?: boolean
}) {
  const { color, tag } = STATE[state]

  return (
    <div
      data-testid="focus-bubble"
      aria-hidden={!visible}
      style={{
        width: 164,
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? 'auto' : 'none',
        transition: 'opacity 100ms ease-out',
      }}
    >
      <div key={popKey} className="focus-bubble-anim">
        <button
          type="button"
          aria-label={`${name}, ${tag}`}
          tabIndex={visible ? 0 : -1}
          onClick={(e) => {
            e.stopPropagation()
            onTap()
          }}
          className="relative block w-full overflow-hidden rounded-2xl bg-white p-0 text-left"
          style={{ boxShadow: 'var(--ex-shadow-float)' }}
        >
          <span
            className="relative block w-full"
            style={{
              height: 100,
              background:
                'linear-gradient(135deg, var(--color-ex-forest-light), var(--color-ex-forest-deep))',
            }}
          >
            {thumb && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={thumb}
                src={thumb}
                alt=""
                className="h-full w-full object-cover"
                // Offline and uncached: hide it so the gradient shows, not a broken icon.
                onError={(e) => {
                  e.currentTarget.style.visibility = 'hidden'
                }}
              />
            )}
            <span
              className="absolute flex items-center justify-center rounded-full bg-white text-[11px] font-extrabold text-ex-ink"
              style={{
                top: 6,
                left: 6,
                width: 26,
                height: 26,
                border: `3px solid ${color}`,
                boxSizing: 'border-box',
              }}
            >
              {displayId}
            </span>
          </span>
          <span className="block py-2 pl-2.5 pr-7">
            <span className="block truncate text-[13px] font-bold leading-4 text-ex-ink">{name}</span>
            <span className="mt-0.5 block text-[11px] font-bold leading-4" style={{ color }}>
              {tag}
            </span>
          </span>
          <svg
            className="absolute"
            style={{ right: 8, bottom: 10 }}
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--color-ex-muted)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M9 6l6 6-6 6" />
          </svg>
        </button>
        <span
          aria-hidden="true"
          className="mx-auto block bg-white"
          style={{
            width: TAIL,
            height: TAIL,
            marginTop: -TAIL / 2,
            transform: 'rotate(45deg)',
            boxShadow: '2px 2px 4px rgba(43, 43, 43, 0.1)',
          }}
        />
      </div>
    </div>
  )
}
