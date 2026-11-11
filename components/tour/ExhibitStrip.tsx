import Link from 'next/link'

interface Props {
  name: string
  code: string
  onInfo: () => void
  onDismiss: () => void
}

const iconButton = 'flex h-10 w-10 shrink-0 items-center justify-center text-lg text-white/80'

/**
 * Compact pill linking from the tour to the exhibit's audio page; plain push keeps browser back → /tour?…
 * Anchored under the top pills: navigation arrows sit on the ground at the bottom of the panorama.
 * ⓘ / ✕ are siblings of the link, so they never trigger it.
 */
export default function ExhibitStrip({ name, code, onInfo, onDismiss }: Props) {
  return (
    <div className="pointer-events-none absolute inset-x-4 top-16 z-20 flex justify-center">
      <div className="pointer-events-auto flex max-w-full items-center rounded-full bg-black/70 text-white backdrop-blur-sm">
        <button type="button" aria-label="Exhibit details" onClick={onInfo} className={iconButton}>
          ⓘ
        </button>
        <Link href={`/s/${code}`} className="flex min-w-0 flex-col items-center px-1 py-1.5">
          <span className="max-w-full truncate text-sm font-medium">{name}</span>
          <span className="text-xs text-white/70">Tap to listen</span>
        </Link>
        <button type="button" aria-label="Dismiss" onClick={onDismiss} className={iconButton}>
          ✕
        </button>
      </div>
    </div>
  )
}
