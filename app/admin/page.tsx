'use client'

import { useState } from 'react'

import AdminMap from '@/components/admin/AdminMap'
import type { AdminExhibit, WorkingSection } from '@/lib/admin/types'

// Placeholder state; the data step replaces this with the loaded + staged working state.
const FIXTURE_EXHIBITS: AdminExhibit[] = [
  { id: 'fx-1', code: 1, name: 'Fixture exhibit', type: null, tier: 'silver', status: 'live', description: null, facts: [], gps_lat: 17.3813, gps_lng: 78.1916, section: null, number: null },
]

export default function AdminPage() {
  const [sections, setSections] = useState<WorkingSection[]>([])
  const [exhibits, setExhibits] = useState<AdminExhibit[]>(FIXTURE_EXHIBITS)
  return (
    <div className="fixed inset-0">
      <AdminMap sections={sections} exhibits={exhibits} onSectionsChange={setSections} onExhibitsChange={setExhibits} />
    </div>
  )
}
