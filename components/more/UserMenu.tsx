'use client'

import { useRef, useSyncExternalStore } from 'react'
import { AnimatePresence, animate, motion } from 'framer-motion'
import { useStore } from '@/lib/store'

const NUDGE_X = [0, -6, 6, -4, 4, 0]

function subscribeOnline(cb: () => void) {
  window.addEventListener('online', cb)
  window.addEventListener('offline', cb)
  return () => {
    window.removeEventListener('online', cb)
    window.removeEventListener('offline', cb)
  }
}

const getOnline = () => navigator.onLine
const getServerOnline = () => true

function Badge({ children, tone }: { children: string; tone: 'offline' | 'soon' }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${
        tone === 'offline' ? 'bg-ex-orange/20 text-ex-coming-soon' : 'bg-ex-bg text-ex-muted'
      }`}
    >
      {children}
    </span>
  )
}

const ROW =
  'flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-[15px] font-extrabold'

export default function UserMenu() {
  const open = useStore((s) => s.moreMenuOpen)
  const setOpen = useStore((s) => s.setMoreMenuOpen)
  const online = useSyncExternalStore(subscribeOnline, getOnline, getServerOnline)
  const refreshRowRef = useRef<HTMLButtonElement>(null)

  const onRefresh = () => {
    if (!online) {
      if (refreshRowRef.current) {
        animate(refreshRowRef.current, { x: NUDGE_X }, { duration: 0.35 })
      }
      return
    }
    setOpen(false)
    useStore.getState().setRefreshRequested(true)
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <div
            className="absolute inset-0"
            style={{ zIndex: 38 }}
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <motion.div
            role="menu"
            aria-label="More"
            className="absolute right-4 w-60 rounded-2xl bg-ex-paper border border-ex-border"
            style={{
              bottom: 106,
              zIndex: 39,
              boxShadow: 'var(--ex-shadow-modal)',
              fontFamily: 'var(--font-body)',
            }}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.15 }}
          >
            <button
              ref={refreshRowRef}
              type="button"
              role="menuitem"
              className={`${ROW} text-ex-ink`}
              aria-disabled={!online}
              onClick={onRefresh}
            >
              Refresh content
              {!online && <Badge tone="offline">Offline</Badge>}
            </button>
            <div className="mx-4 h-px bg-ex-border" />
            <button
              type="button"
              role="menuitem"
              className={`${ROW} text-ex-muted`}
              aria-disabled="true"
            >
              Log out
              <Badge tone="soon">Soon</Badge>
            </button>
            <div className="mx-4 h-px bg-ex-border" />
            <button
              type="button"
              role="menuitem"
              className={`${ROW} text-ex-muted`}
              aria-disabled="true"
            >
              Profile
              <Badge tone="soon">Soon</Badge>
            </button>
            <span
              aria-hidden="true"
              className="absolute -bottom-[7px] right-[42px] h-3.5 w-3.5 rotate-45 border-b border-r border-ex-border bg-ex-paper"
            />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
