import PipMascot, { type PipState } from '@/components/common/PipMascot'

export const PERCH_PIP_SIZE = 108

/** Collapsed-sheet Pip for `BottomSheet`'s `perch` slot: sits on the sheet's top-right edge. */
export default function SheetPerchPip({ state }: { state: PipState }) {
  return (
    // Lift (70 px) puts the box's visible bottom (feet, ~99 px down) at the grab-handle row, so
    // nothing of Pip lands on the name / badges (first content row is 30 px below the edge).
    <PipMascot
      state={state}
      size={PERCH_PIP_SIZE}
      className="relative -translate-y-[70px]"
      interactive
    />
  )
}
