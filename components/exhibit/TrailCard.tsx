'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckIcon, CloseIcon, InfoIcon } from '@/components/icons'
import { useStore } from '@/lib/store'
import { TRAIL_MILESTONES, getCurrentSegment } from '@/lib/trail'

const NODE_BASE = 'w-[26px] h-[26px] rounded-full flex-none grid place-items-center'

function Node({
  variant,
  label,
  onClick,
}: {
  variant: 'hollow' | 'done' | 'target'
  label: string | number
  onClick?: () => void
}) {
  if (variant === 'done') {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={`Milestone ${label} — achieved, tap to revisit`}
        className={`${NODE_BASE} bg-ex-forest`}
        style={{ border: 'none', padding: 0 }}
      >
        <CheckIcon size={13} color="#fff" strokeWidth={3} />
      </button>
    )
  }
  if (variant === 'target') {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={`Milestone ${label} — in progress, tap for details`}
        className={`${NODE_BASE} bg-ex-orange text-[11px] font-extrabold text-white`}
        style={{
          boxShadow: '0 0 0 5px rgba(221,161,94,.3), 0 2px 0 #b8834a',
          border: 'none',
          padding: 0,
        }}
      >
        {label}
      </button>
    )
  }
  return (
    <div className={`${NODE_BASE} border-2 border-ex-sage text-[11px] font-extrabold text-ex-sage`}>
      {label}
    </div>
  )
}

function Segment({ filled }: { filled: boolean }) {
  return <div className={`h-1 flex-1 -mx-0.5 ${filled ? 'bg-ex-forest' : 'bg-ex-border'}`} />
}

const STEPS = [
  {
    emoji: '📷',
    title: 'Scan a QR code',
    desc: 'Find a marker at any exhibit and scan it.',
  },
  {
    emoji: '🎧',
    title: 'Listen to the story',
    desc: 'Each exhibit has an audio narration. Let it finish.',
  },
  {
    emoji: '🏅',
    title: 'Earn milestone badges',
    desc: 'Hit 1 · 3 · 5 · 10 · 15 · 20 · 30 · 40 · 50 discovers to unlock a collectible card.',
  },
]

function TrailInfoModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 flex items-center justify-center px-6"
      style={{ zIndex: 70, background: 'rgba(0,0,0,0.45)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-5 bg-ex-paper"
        style={{ boxShadow: 'var(--ex-shadow-modal)', fontFamily: 'var(--font-body)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <h2
            className="text-base font-bold text-ex-ink leading-snug"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            How the Trail works
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full text-ex-muted"
            style={{ background: 'none', border: 'none', marginTop: -2 }}
            aria-label="Close"
          >
            <CloseIcon size={16} strokeWidth={2.5} />
          </button>
        </div>

        <div className="flex flex-col gap-4">
          {STEPS.map((step, i) => (
            <div key={i} className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl flex-none flex items-center justify-center bg-ex-sage/30 text-2xl">
                {step.emoji}
              </div>
              <div className="flex-1 pt-0.5">
                <div className="text-[13.5px] font-extrabold text-ex-ink leading-tight">
                  {step.title}
                </div>
                <div className="text-[12.5px] font-semibold text-ex-muted mt-0.5 leading-snug">
                  {step.desc}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function TrailCard() {
  const totalDiscovered = useStore((s) => s.totalDiscovered)
  const segment = getCurrentSegment(totalDiscovered)
  const router = useRouter()
  const [infoOpen, setInfoOpen] = useState(false)

  const isFresh = totalDiscovered === 0
  const isComplete = segment.isComplete

  let lead: React.ReactNode
  let meta: string
  let ariaLabel: string
  let nodes: { variant: 'hollow' | 'done' | 'target'; label: string | number }[]

  if (isFresh) {
    lead = (
      <>
        Start your trail! <span className="text-ex-forest">Discover 50 exhibits</span> to earn all
        badges.
      </>
    )
    meta = '1 exhibit to your first milestone!'
    ariaLabel = 'Trail progress: 0 of 50 exhibits discovered. First milestone at 1.'
    nodes = [
      { variant: 'hollow', label: 1 },
      { variant: 'hollow', label: '' },
      { variant: 'hollow', label: '' },
      { variant: 'hollow', label: '' },
    ]
  } else if (isComplete) {
    lead = <>You&apos;ve discovered all 50 exhibits! 🎉</>
    meta = 'Trail complete — every exhibit found.'
    ariaLabel = 'Trail progress: all 50 exhibits discovered.'
    nodes = segment.achieved.map((m) => ({ variant: 'done' as const, label: m }))
  } else {
    const next = segment.next as number
    const toNextBadge = next - totalDiscovered
    lead = (
      <>
        <span className="text-ex-forest">{totalDiscovered} of 50</span> discovered ·{' '}
        <span className="text-ex-orange-shadow">{toNextBadge} more to your next badge!</span>
      </>
    )
    meta = `Milestones ${segment.achieved.join(' · ')} earned — ${next} is glowing just ahead.`
    ariaLabel = `Trail progress: ${totalDiscovered} of 50 discovered. Next badge at ${next}.`

    const doneNodes = segment.achieved
      .slice(-3)
      .map((m) => ({ variant: 'done' as const, label: m }))
    const nextNextIdx = TRAIL_MILESTONES.indexOf(next as (typeof TRAIL_MILESTONES)[number]) + 1
    const nextNext = TRAIL_MILESTONES[nextNextIdx]
    nodes = [
      ...doneNodes,
      { variant: 'target', label: next },
      ...(nextNext ? [{ variant: 'hollow' as const, label: nextNext }] : []),
    ]
  }

  return (
    <>
      <div
        className="relative bg-ex-paper border border-ex-border rounded-[18px] p-5"
        style={{ boxShadow: 'var(--ex-shadow-soft)' }}
      >
        <button
          type="button"
          onClick={() => setInfoOpen(true)}
          className="absolute top-3.5 right-3.5 w-7 h-7 flex items-center justify-center rounded-full text-ex-muted"
          style={{ background: 'none', border: 'none' }}
          aria-label="How the trail works"
        >
          <InfoIcon size={17} strokeWidth={2} />
        </button>
        <div className="font-display font-bold text-base leading-tight pr-8">{lead}</div>
        <div className="flex items-center mt-5 mb-2" role="group" aria-label={ariaLabel}>
          {nodes.map((node, i) => (
            <div className="flex items-center flex-1 last:flex-none" key={i}>
              <Node
                variant={node.variant}
                label={node.label}
                onClick={
                  node.variant === 'done'
                    ? () => router.push(`/collection?reveal=${node.label}`)
                    : undefined
                }
              />
              {i < nodes.length - 1 && (
                <Segment filled={node.variant === 'done' && nodes[i + 1]?.variant === 'done'} />
              )}
            </div>
          ))}
        </div>
        <div className="text-[13px] text-ex-muted font-semibold mt-3">{meta}</div>
      </div>
      {infoOpen && <TrailInfoModal onClose={() => setInfoOpen(false)} />}
    </>
  )
}
