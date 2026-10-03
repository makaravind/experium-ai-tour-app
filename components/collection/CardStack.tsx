import { CARD_GRADIENT_CSS, getBadgeColor } from '@/lib/badge-placeholder'

interface CardStackProps {
  milestones: number[]
  onSelect: (m: number) => void
}

// Fewer cards get more room each, so a 1-card collection doesn't look lost in empty space.
function cardSizeFor(count: number) {
  if (count <= 2) return { card: 190, badge: 76, font: 26 }
  if (count <= 4) return { card: 160, badge: 64, font: 22 }
  if (count <= 6) return { card: 136, badge: 58, font: 20 }
  return { card: 112, badge: 52, font: 19 }
}

export function CardStack({ milestones, onSelect }: CardStackProps) {
  const mid = (milestones.length - 1) / 2
  const { card, badge, font } = cardSizeFor(milestones.length)
  const offsetStep = card * 0.27
  const containerHeight = card + mid * card * 0.14 + 40

  return (
    <div
      className="relative mb-2.5 flex items-center justify-center"
      style={{ height: containerHeight }}
    >
      {milestones.map((m, i) => {
        const offset = i - mid
        return (
          <button
            key={m}
            type="button"
            aria-label={`Milestone ${m} card`}
            onClick={() => onSelect(m)}
            className="absolute flex cursor-pointer items-center justify-center rounded-2xl shadow-[0_10px_20px_rgba(43,43,43,0.28)] transition-shadow hover:shadow-[0_14px_26px_rgba(43,43,43,0.36)]"
            style={{
              width: card,
              height: card,
              background: CARD_GRADIENT_CSS,
              transform: `translate(${offset * offsetStep}px,${Math.abs(offset) * 8}px) rotate(${offset * 7}deg)`,
              zIndex: i + 1,
            }}
          >
            <span
              className="grid place-items-center rounded-full border-2 border-white/60 font-extrabold text-white"
              style={{ background: getBadgeColor(m), width: badge, height: badge, fontSize: font }}
            >
              {m}
            </span>
          </button>
        )
      })}
    </div>
  )
}
