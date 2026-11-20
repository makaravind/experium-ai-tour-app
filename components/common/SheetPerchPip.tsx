import PipMascot, { type PipState } from '@/components/common/PipMascot'

export const PERCH_PIP_SIZE = 108

/** Collapsed-sheet Pip for `BottomSheet`'s `perch` slot: sits on the sheet's top-right edge. */
export default function SheetPerchPip({ state }: { state: PipState }) {
  return (
    // Lift (px) = how far above the sheet edge the 108 px box sits; keep it high enough that the
    // part inside the sheet clears the first content row (~30 px below the edge).
    <PipMascot
      state={state}
      size={PERCH_PIP_SIZE}
      className="relative -translate-y-[41px]"
      interactive
    />
  )
}
