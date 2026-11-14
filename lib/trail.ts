import { CAMPAIGNS } from '@/lib/campaigns'

export const TRAIL_MILESTONES: readonly number[] = CAMPAIGNS.find(
  (c) => c.id === 'default'
)!.milestones

export interface TrailSegment {
  achieved: number[]
  next: number | null
  isComplete: boolean
}

/** Where a visitor sits on the trail given how many exhibits they've discovered. */
export function getCurrentSegment(totalDiscovered: number): TrailSegment {
  const achieved = TRAIL_MILESTONES.filter((m) => m <= totalDiscovered)
  const next = TRAIL_MILESTONES.find((m) => m > totalDiscovered) ?? null

  return {
    achieved,
    next,
    isComplete: totalDiscovered >= 50,
  }
}

/** Milestone just reached by this discovery, or null. Not a range scan: discovery moves the total by at most +1. */
export function getCrossedMilestone(prevTotal: number, newTotal: number): number | null {
  if (newTotal <= prevTotal) return null
  return TRAIL_MILESTONES.find((m) => m === newTotal) ?? null
}
