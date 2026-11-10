import { requireAdminPage } from '@/lib/admin/guard'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  requireAdminPage()
  return <>{children}</>
}
