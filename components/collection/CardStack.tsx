import { CARD_GRADIENT_CSS, getBadgeColor } from '@/lib/badge-placeholder'

interface CardStackProps {
  milestones: number[]
  onSelect: (m: number) => void
}

export function CardStack({ milestones, onSelect }: CardStackProps) {
  const mid = (milestones.length - 1) / 2

  return (
    <div className="relative mt-8 mb-2.5 flex h-[170px] items-center justify-center">
      {milestones.map((m, i) => {
        const offset = i - mid
        return (
          <button
            key={m}
            type="button"
            aria-label={`Milestone ${m} card`}
            onClick={() => onSelect(m)}
            className="absolute flex size-28 cursor-pointer items-center justify-center rounded-2xl shadow-[0_10px_20px_rgba(43,43,43,0.28)] transition-shadow hover:shadow-[0_14px_26px_rgba(43,43,43,0.36)]"
            style={{
              background: CARD_GRADIENT_CSS,
              transform: `translate(${offset * 30}px,${Math.abs(offset) * 8}px) rotate(${offset * 7}deg)`,
              zIndex: i + 1,
            }}
          >
            <span
              className="grid size-[52px] place-items-center rounded-full border-2 border-white/60 text-[19px] font-extrabold text-white"
              style={{ background: getBadgeColor(m) }}
            >
              {m}
            </span>
          </button>
        )
      })}
    </div>
  )
}
