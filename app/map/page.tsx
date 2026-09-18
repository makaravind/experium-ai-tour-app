'use client'

import MapStub from '@/components/exhibit/MapStub'
import TabBar from '@/components/exhibit/TabBar'

export default function MapPage() {
  return (
    <div className="fixed inset-0 overflow-hidden" style={{ fontFamily: 'var(--font-body)' }}>
      <MapStub discovered={false} />
      <TabBar />
    </div>
  )
}
