import Link from 'next/link'
import { ScanIcon } from '@/components/icons'

export default function ScanNowButton() {
  return (
    <Link
      href="/scan"
      className="btn-3d-orange flex items-center justify-center gap-2.5 w-full h-[66px] rounded-2xl bg-ex-orange text-white font-extrabold text-lg uppercase tracking-wide"
    >
      <ScanIcon size={26} strokeWidth={2.3} color="#fff" />
      Scan Now
    </Link>
  )
}
