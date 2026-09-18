import Link from 'next/link'

export default function ExploreParkLink() {
  return (
    <Link
      href="/map"
      className="flex items-center justify-center w-full h-[52px] mt-3.5 rounded-2xl border-[1.5px] border-ex-sage bg-ex-paper text-ex-ink font-extrabold text-sm active:translate-y-px"
    >
      Explore the Park →
    </Link>
  )
}
