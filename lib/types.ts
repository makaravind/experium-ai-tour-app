export type Language = 'en' | 'hi' | 'te'

/** `exhibits.facts` is a jsonb array shaped `[{ fact: "..." }]` */
export interface Fact {
  fact: string
}

export interface ExhibitData {
  name: string
  type: string | null
  tier: string
  facts: Fact[]
}
