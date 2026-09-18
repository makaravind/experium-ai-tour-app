'use client'

import { useState } from 'react'
import { CheckIcon } from '@/components/icons'
import MilestoneModal from '@/components/exhibit/MilestoneModal'
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

export default function TrailCard() {
  const totalDiscovered = useStore((s) => s.totalDiscovered)
  const segment = getCurrentSegment(totalDiscovered)
  const [openMilestone, setOpenMilestone] = useState<{
    milestone: number
    achieved: boolean
  } | null>(null)

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
    <div
      className="bg-ex-paper border border-ex-border rounded-[18px] p-5"
      style={{ boxShadow: 'var(--ex-shadow-soft)' }}
    >
      <div className="font-display font-bold text-base leading-tight">{lead}</div>
      <div className="flex items-center mt-5 mb-2" role="group" aria-label={ariaLabel}>
        {nodes.map((node, i) => (
          <div className="flex items-center flex-1 last:flex-none" key={i}>
            <Node
              variant={node.variant}
              label={node.label}
              onClick={
                node.variant === 'hollow'
                  ? undefined
                  : () =>
                      setOpenMilestone({
                        milestone: node.label as number,
                        achieved: node.variant === 'done',
                      })
              }
            />
            {i < nodes.length - 1 && (
              <Segment filled={node.variant === 'done' && nodes[i + 1]?.variant === 'done'} />
            )}
          </div>
        ))}
      </div>
      <div className="text-[13px] text-ex-muted font-semibold mt-3">{meta}</div>

      {openMilestone && (
        <MilestoneModal
          milestone={openMilestone.milestone}
          achieved={openMilestone.achieved}
          totalDiscovered={totalDiscovered}
          onClose={() => setOpenMilestone(null)}
        />
      )}
    </div>
  )
}
