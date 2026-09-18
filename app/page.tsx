'use client'

import ExploreParkLink from '@/components/exhibit/ExploreParkLink'
import ScanNowButton from '@/components/exhibit/ScanNowButton'
import TabBar from '@/components/exhibit/TabBar'
import TrailCard from '@/components/exhibit/TrailCard'
import { LeafIcon } from '@/components/icons'
import { useStore } from '@/lib/store'

export default function Home() {
  const totalDiscovered = useStore((s) => s.totalDiscovered)
  const userInfo = useStore((s) => s.userInfo)

  const isFresh = totalDiscovered === 0

  return (
    <div className="fixed inset-0 overflow-hidden" style={{ fontFamily: 'var(--font-body)' }}>
      <div className="flex flex-col h-full px-5 pt-8 pb-[110px]">
        <div className="font-display font-extrabold text-2xl flex items-center gap-1.5">
          {isFresh ? (
            <>
              Welcome to <span className="text-ex-forest">Experium</span>
            </>
          ) : (
            <>
              Welcome back, <span className="text-ex-forest">{userInfo?.name ?? 'there'}</span>
            </>
          )}
          <LeafIcon size={20} color="var(--color-ex-forest)" />
        </div>
        <div className="text-ex-muted text-sm font-semibold mt-0.5">
          {isFresh ? '150 acres. 50 stories to find.' : "You're on a roll — keep going."}
        </div>

        <div className="mt-5">
          <TrailCard />
        </div>

        <div className="flex-1" />

        <ScanNowButton />
        <ExploreParkLink />

        <div className="mt-auto pt-3.5 border-t border-ex-border flex items-center gap-3">
          <div className="w-11 h-11 rounded-lg flex-none bg-ex-sage/40" />
          <div className="flex-1 min-w-0">
            <div className="text-[9.5px] font-extrabold uppercase tracking-wide text-ex-muted">
              Sponsored
            </div>
            <div className="text-[13.5px] font-bold leading-tight mt-0.5">
              Ad slot reserved for m6-ads
            </div>
          </div>
        </div>
      </div>

      <TabBar />
    </div>
  )
}
