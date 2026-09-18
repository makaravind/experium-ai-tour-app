'use client'

import { CloseIcon, StarIcon } from '@/components/icons'

export default function MilestoneModal({
  milestone,
  achieved,
  totalDiscovered,
  onClose,
}: {
  milestone: number
  achieved: boolean
  totalDiscovered: number
  onClose: () => void
}) {
  const remaining = milestone - totalDiscovered

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-ex-paper rounded-3xl p-6 mx-8 max-w-xs text-center relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 text-ex-muted"
          style={{ border: 'none', background: 'none' }}
        >
          <CloseIcon size={18} />
        </button>

        <StarIcon size={40} color={achieved ? 'var(--color-ex-forest)' : 'var(--color-ex-sage)'} />

        <div className="font-display font-extrabold text-lg mt-3">Milestone {milestone}</div>

        {achieved ? (
          <div className="text-ex-muted text-sm font-semibold mt-1">
            You&apos;ve discovered {totalDiscovered} exhibits! 🎉
          </div>
        ) : (
          <div className="text-ex-muted text-sm font-semibold mt-1">
            {remaining} more to unlock this badge!
          </div>
        )}
      </div>
    </div>
  )
}
