import { requireAdminPage } from '@/lib/admin/guard'
import TourShell from './TourShell'

export default function AdminTourPage() {
  requireAdminPage()
  return <TourShell />
}
