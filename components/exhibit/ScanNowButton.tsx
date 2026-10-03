import ActionButton from '@/components/ui/action-button'
import { ScanIcon } from '@/components/icons'

export default function ScanNowButton() {
  return (
    <ActionButton href="/scan" variant="orange" uppercase>
      <ScanIcon size={26} strokeWidth={2.3} color="#fff" />
      Scan Now
    </ActionButton>
  )
}
