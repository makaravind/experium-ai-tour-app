'use client'

interface Props {
  /** label of the node the visitor is leaving from */
  label: string
  /** false when the node has no position, so no spot was written */
  spotSaved: boolean
}

export default function ExitSplash({ label, spotSaved }: Props) {
  return (
    <div
      className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-6 bg-black px-8 text-center text-white"
      role="status"
    >
      <div className="flex flex-col items-center gap-2">
        <p className="text-lg font-medium">Back to the map</p>
        <p className="text-sm text-white/70">Landing at {label}</p>
        {spotSaved && <p className="text-sm text-white/70">Spot saved</p>}
        <p className="text-sm text-white/70">Centring the map</p>
      </div>
      <div className="h-1 w-40 overflow-hidden rounded-full bg-white/20">
        <div className="h-full w-1/2 animate-pulse rounded-full bg-white" />
      </div>
    </div>
  )
}
