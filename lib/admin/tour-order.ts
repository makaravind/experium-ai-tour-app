const NUMERIC_REF = /^(\d+)(.*)$/

/** Natural order by `pano_ref`: non-numeric refs first, then `1, 2, 10, 37, 37A, 38`. */
export function compareNodes(a: { pano_ref: string }, b: { pano_ref: string }): number {
  const ma = NUMERIC_REF.exec(a.pano_ref)
  const mb = NUMERIC_REF.exec(b.pano_ref)
  if (!ma || !mb) {
    if (ma) return 1
    if (mb) return -1
    return a.pano_ref.localeCompare(b.pano_ref)
  }
  return Number(ma[1]) - Number(mb[1]) || ma[2].localeCompare(mb[2])
}

export function sortNodes<T extends { pano_ref: string }>(nodes: T[]): T[] {
  return [...nodes].sort(compareNodes)
}
