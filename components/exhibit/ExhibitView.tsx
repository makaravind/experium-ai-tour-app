'use client'

import { useCallback, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import AudioPlayer from '@/components/exhibit/AudioPlayer'
import BottomSheet from '@/components/exhibit/BottomSheet'
import MapStub from '@/components/exhibit/MapStub'
import MilestoneCelebration from '@/components/exhibit/MilestoneCelebration'
import TabBar from '@/components/exhibit/TabBar'
import Toast from '@/components/exhibit/Toast'
import { CompassIcon, SearchIcon } from '@/components/icons'
import { MILESTONE_NUMBERS } from '@/lib/constants'
import { useStore } from '@/lib/store'
import type { ExhibitData } from '@/lib/types'

export default function ExhibitView({
  exhibit,
  audioByLang,
  qrCodeId,
  exhibitId,
}: {
  exhibit: ExhibitData
  audioByLang: Record<string, string | null>
  qrCodeId: string
  exhibitId: string
}) {
  const language = useStore((s) => s.language)
  const visitorId = useStore((s) => s.visitorId)
  const totalDiscovered = useStore((s) => s.totalDiscovered)
  const setTotalDiscovered = useStore((s) => s.setTotalDiscovered)
  const markVisited = useStore((s) => s.markVisited)
  const [showPlayer, setShowPlayer] = useState(false)
  const [discovered, setDiscovered] = useState(false)
  const [showToast, setShowToast] = useState(false)
  const [showMilestone, setShowMilestone] = useState(false)
  const [audioDuration, setAudioDuration] = useState(0)

  const currentAudioUrl = audioByLang[language] ?? null

  const handleAudioEnd = useCallback(
    async (listenDurationSec: number) => {
      setShowPlayer(false)

      try {
        const res = await fetch('/api/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            visitorId: visitorId ?? `anon-${Date.now()}`,
            qrCodeId,
            exhibitId,
            listenDurationSec,
          }),
        })
        const data = await res.json()
        const total: number = data.total_discovered ?? 0
        setTotalDiscovered(total)
        markVisited(exhibitId)
        setDiscovered(true)
        setShowToast(true)
        setTimeout(() => setShowToast(false), 3000)
        if (MILESTONE_NUMBERS.includes(total)) {
          setTimeout(() => setShowMilestone(true), 400)
        }
      } catch {
        // non-fatal — show toast anyway
        setDiscovered(true)
        setShowToast(true)
        setTimeout(() => setShowToast(false), 3000)
      }
    },
    [qrCodeId, exhibitId, visitorId, setTotalDiscovered, markVisited]
  )

  return (
    <div className="fixed inset-0 overflow-hidden" style={{ fontFamily: 'var(--font-body)' }}>
      <MapStub discovered={discovered} />

      {/* Search bar */}
      <div
        className="absolute left-4 right-4 flex gap-2.5 items-center"
        style={{ top: 60, zIndex: 20 }}
      >
        <div
          className="flex-1 h-11 flex items-center gap-2 px-4 rounded-full font-semibold text-sm"
          style={{
            background: '#fff',
            border: '1px solid #e8e5df',
            boxShadow: '0 2px 10px rgba(43,43,43,.08)',
            color: '#8a8a8a',
          }}
        >
          <SearchIcon size={17} color="#8a8a8a" strokeWidth={2.2} />
          Search
        </div>
        <div
          className="w-11 h-11 rounded-full flex items-center justify-center"
          style={{
            background: '#fff',
            border: '1px solid #e8e5df',
            boxShadow: '0 2px 10px rgba(43,43,43,.08)',
            color: '#588157',
          }}
        >
          <CompassIcon size={20} color="currentColor" strokeWidth={2.2} />
        </div>
      </div>

      {/* Toast */}
      <AnimatePresence>{showToast && <Toast totalDiscovered={totalDiscovered} />}</AnimatePresence>

      {/* Bottom sheet */}
      <BottomSheet
        exhibit={exhibit}
        audioByLang={audioByLang}
        audioDuration={audioDuration}
        onListen={() => setShowPlayer(true)}
      />

      <TabBar />

      {/* Hidden audio for duration metadata */}
      {currentAudioUrl && (
        <audio
          src={currentAudioUrl}
          preload="metadata"
          onLoadedMetadata={(e) => setAudioDuration((e.target as HTMLAudioElement).duration)}
          style={{ display: 'none' }}
        />
      )}

      {/* Audio player (full-screen) */}
      {showPlayer && (
        <AudioPlayer
          exhibit={exhibit}
          audioByLang={audioByLang}
          onClose={() => setShowPlayer(false)}
          onEnded={handleAudioEnd}
        />
      )}

      {/* Milestone celebration */}
      <AnimatePresence>
        {showMilestone && (
          <MilestoneCelebration
            totalDiscovered={totalDiscovered}
            onDismiss={() => setShowMilestone(false)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
