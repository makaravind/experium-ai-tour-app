import { AmenityTypeIcon, CloseIcon } from '@/components/icons'

interface AmenitiesPillProps {
  active?: boolean
  onClick: () => void
}

export default function AmenitiesPill({ active = false, onClick }: AmenitiesPillProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`h-8 px-3.5 rounded-full inline-flex items-center gap-1.5 text-[12.5px] font-extrabold border-[1.5px] ${
        active
          ? 'bg-ex-amenity border-ex-amenity text-white'
          : 'bg-ex-paper border-ex-border text-ex-muted'
      }`}
      style={active ? undefined : { boxShadow: 'var(--ex-shadow-soft)' }}
    >
      <AmenityTypeIcon type="washroom" size={13} strokeWidth={2.2} />
      Amenities
      {active && <CloseIcon size={12} strokeWidth={2.6} style={{ opacity: 0.85 }} />}
    </button>
  )
}
