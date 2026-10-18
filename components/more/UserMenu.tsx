'use client'

import { useRef, useSyncExternalStore } from 'react'
import { AnimatePresence, animate, motion } from 'framer-motion'
import { useStore } from '@/lib/store'

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

function RefreshIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={21}
      height={21}
      stroke="currentColor"
      strokeWidth={2.1}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
      aria-hidden="true"
    >
      <path d="M1 4v6h6" />
      <path d="M23 20v-6h-6" />
      <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15" />
    </svg>
  )
}

function LogoutIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={21}
      height={21}
      stroke="currentColor"
      strokeWidth={2.1}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
      aria-hidden="true"
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  )
}

function UserIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={21}
      height={21}
      stroke="currentColor"
      strokeWidth={2.1}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
      aria-hidden="true"
    >
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}

const ROW =
  'flex items-center gap-3.5 w-[calc(100%-16px)] mx-2 px-3 py-2.5 min-h-[64px] rounded-2xl text-left border-none bg-transparent'

const ICON_BASE = 'shrink-0 w-[42px] h-[42px] rounded-[13px] grid place-items-center'

export default function UserMenu() {
  const open = useStore((s) => s.moreMenuOpen)
  const setOpen = useStore((s) => s.setMoreMenuOpen)
  const online = useSyncExternalStore(subscribeOnline, getOnline, getServerOnline)
  const refreshRowRef = useRef<HTMLButtonElement>(null)

  const onRefresh = () => {
    if (!online) {
      if (refreshRowRef.current) {
        animate(refreshRowRef.current, { x: [0, -6, 6, -4, 4, 0] }, { duration: 0.26 })
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
          <motion.div
            className="absolute inset-0"
            style={{ background: 'rgba(43,43,43,.38)', zIndex: 38 }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <motion.div
            role="dialog"
            aria-label="More options"
            className="absolute left-3 right-3 rounded-[28px] bg-ex-paper border border-ex-border"
            style={{
              bottom: 106,
              zIndex: 39,
              boxShadow: 'var(--ex-shadow-modal)',
              fontFamily: 'var(--font-body)',
              padding: '6px 0 10px',
            }}
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
          >
            <div className="px-5 pt-4 pb-1.5">
              <div
                className="font-extrabold text-[19px] leading-tight tracking-tight text-ex-ink"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Account &amp; App
              </div>
              <div className="text-[13px] text-ex-muted mt-0.5">Manage your experience</div>
            </div>

            <div className="px-5 pt-3.5 pb-1 text-[11px] font-extrabold tracking-[0.08em] uppercase text-ex-muted">
              Content
            </div>
            <ul>
              <li>
                <button
                  ref={refreshRowRef}
                  type="button"
                  role="menuitem"
                  aria-disabled={!online}
                  onClick={onRefresh}
                  className={`${ROW} cursor-pointer hover:bg-ex-bg active:bg-ex-bg`}
                >
                  <span
                    className={`${ICON_BASE} ${online ? 'bg-ex-forest/10 text-ex-forest' : 'bg-ex-bg text-ex-muted'}`}
                  >
                    <RefreshIcon />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block font-extrabold text-[15px] text-ex-ink leading-snug">
                      Refresh content
                    </span>
                    <span className="block text-[12.5px] text-ex-muted mt-0.5 leading-snug">
                      {online
                        ? 'Download the latest exhibit audio & data'
                        : 'Connect to Wi-Fi or mobile data to refresh'}
                    </span>
                  </span>
                  {!online && (
                    <span className="shrink-0 inline-block text-[11px] font-extrabold tracking-[0.02em] rounded-full px-[9px] py-[3px] border bg-ex-orange/10 text-ex-orange border-ex-orange/40">
                      Offline
                    </span>
                  )}
                </button>
              </li>
            </ul>

            <div className="px-5 pt-3.5 pb-1 text-[11px] font-extrabold tracking-[0.08em] uppercase text-ex-muted">
              Account
            </div>
            <ul>
              <li>
                <button
                  type="button"
                  role="menuitem"
                  aria-disabled="true"
                  className={`${ROW} cursor-not-allowed`}
                >
                  <span className={`${ICON_BASE} bg-ex-bg text-ex-muted`}>
                    <LogoutIcon />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block font-extrabold text-[15px] text-ex-muted leading-snug">
                      Log out
                    </span>
                    <span className="block text-[12.5px] text-ex-muted mt-0.5 leading-snug">
                      Sign out of your account
                    </span>
                  </span>
                  <span className="shrink-0 inline-block text-[11px] font-extrabold tracking-[0.02em] rounded-full px-[9px] py-[3px] border bg-ex-sage/10 text-ex-sage border-ex-sage/40">
                    Soon
                  </span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  role="menuitem"
                  aria-disabled="true"
                  className={`${ROW} cursor-not-allowed`}
                >
                  <span className={`${ICON_BASE} bg-ex-bg text-ex-muted`}>
                    <UserIcon />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block font-extrabold text-[15px] text-ex-muted leading-snug">
                      Profile &amp; preferences
                    </span>
                    <span className="block text-[12.5px] text-ex-muted mt-0.5 leading-snug">
                      Name, language, accessibility
                    </span>
                  </span>
                  <span className="shrink-0 inline-block text-[11px] font-extrabold tracking-[0.02em] rounded-full px-[9px] py-[3px] border bg-ex-sage/10 text-ex-sage border-ex-sage/40">
                    Soon
                  </span>
                </button>
              </li>
            </ul>

            <span
              aria-hidden="true"
              className="absolute -bottom-[7px] right-[28px] h-3.5 w-3.5 rotate-45 border-b border-r border-ex-border bg-ex-paper"
            />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
