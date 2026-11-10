import Link from 'next/link'

interface Props {
  name: string
  code: string
}

/** Collapsed pill linking from the tour to the exhibit's audio page; plain push keeps browser back → /tour?… */
export default function ExhibitStrip({ name, code }: Props) {
  return (
    <Link
      href={`/s/${code}`}
      className="absolute inset-x-4 bottom-24 z-20 flex flex-col items-center rounded-full bg-black/70 px-5 py-3 text-white backdrop-blur-sm"
    >
      <span className="text-sm font-medium">{name}</span>
      <span className="text-xs text-white/70">Tap to listen</span>
    </Link>
  )
}
