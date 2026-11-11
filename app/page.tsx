'use client'

import { useState } from 'react'
import Link from 'next/link'

import ScanNowButton from '@/components/exhibit/ScanNowButton'
import VirtualTourLink from '@/components/exhibit/VirtualTourLink'
import TabBar from '@/components/exhibit/TabBar'
import UserMenu from '@/components/more/UserMenu'
import TrailCard from '@/components/exhibit/TrailCard'
import InfoModal from '@/components/onboarding/InfoModal'
import PreviewSheet from '@/components/exhibit/PreviewSheet'
import DidYouKnow from '@/components/home/DidYouKnow'
import { LeafIcon } from '@/components/icons'
import { useStore } from '@/lib/store'
import type { PreviewExhibit } from '@/lib/types'

export default function Home() {
  const totalDiscovered = useStore((s) => s.totalDiscovered)
  const userInfo = useStore((s) => s.userInfo)
  const profileModalOpen = useStore((s) => s.profileModalOpen)
  const setProfileModalOpen = useStore((s) => s.setProfileModalOpen)
  const [selectedDykExhibit, setSelectedDykExhibit] = useState<PreviewExhibit | null>(null)

  const isFresh = totalDiscovered === 0

  return (
    <div className="fixed inset-0 overflow-hidden" style={{ fontFamily: 'var(--font-body)' }}>
      <div className="flex flex-col h-full px-5 pt-8 pb-[calc(8.5rem+env(safe-area-inset-bottom,0px))]">
        <div className="font-display font-extrabold text-2xl flex items-center gap-1.5">
          {isFresh ? (
            <>
              Welcome to <span className="text-ex-forest">Experium</span>
            </>
          ) : userInfo?.name ? (
            <>
              Welcome back, <span className="text-ex-forest">{userInfo.name}</span>
            </>
          ) : (
            'Welcome back!'
          )}
          <LeafIcon size={20} color="var(--color-ex-forest)" />
        </div>
        <div className="text-ex-muted text-sm font-semibold mt-0.5">
          {isFresh ? '150 acres. 50 stories to find.' : "You're on a roll — keep going."}
        </div>

        <div className="mt-5">
          <TrailCard />
          <Link
            href="/collection"
            className="flex items-center justify-center w-full h-[52px] mt-3.5 rounded-2xl border-[1.5px] border-ex-sage bg-ex-paper text-ex-ink font-extrabold text-sm active:translate-y-px"
          >
            🗂️ My Collection →
          </Link>
        </div>

        <DidYouKnow onSelect={setSelectedDykExhibit} />

        <div className="flex-1" />

        <ScanNowButton />
        <VirtualTourLink />
      </div>

      {selectedDykExhibit && (
        <PreviewSheet
          exhibit={selectedDykExhibit}
          audio={[]}
          onClose={() => setSelectedDykExhibit(null)}
        />
      )}

      <TabBar />
      <UserMenu />
      {profileModalOpen && (
        <InfoModal
          initialValues={{
            name: userInfo?.name ?? '',
            phone: userInfo?.phone ?? '',
            email: userInfo?.email ?? '',
          }}
          onDone={() => setProfileModalOpen(false)}
          onCancel={() => setProfileModalOpen(false)}
        />
      )}
    </div>
  )
}
