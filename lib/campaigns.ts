export type Campaign = { id: string; milestones: number[] }

export const CAMPAIGNS: Campaign[] = [
  { id: 'default', milestones: [1, 3, 5, 10, 15, 20, 30, 40, 50] },
]
