'use client'

import { useEffect, useRef, useState } from 'react'
import { MotionConfig, motion, useIsPresent } from 'framer-motion'
import AmenitiesPill from '@/components/amenity/AmenitiesPill'
import MustVisitPill from '@/components/exhibit/MustVisitPill'
import {
  AmenityTypeIcon,
  ChevronDownIcon,
  ClockIcon,
  CloseIcon,
  LocationPinIcon,
  SearchIcon,
} from '@/components/icons'
import { PLACEHOLDER } from '@/components/exhibit/Gallery'
import TrailCard from '@/components/exhibit/TrailCard'
import { haversineMetres } from '@/lib/nearby'
import { filterExhibits, matchRange, sortAmenities } from '@/lib/search'
import { useStore } from '@/lib/store'
import type { CachedAmenity, MapExhibit } from '@/lib/types'

const EASE = [0.4, 0, 0.2, 1] as const
const ROW_STAGGER = 0.03
const ROW_STAGGER_CAP = 7
const ROW_PRESS = { scale: 0.98 }

interface SearchOverlayProps {
  exhibits: MapExhibit[]
  nearbyExhibitIds: string[]
  userPosition: { lat: number; lng: number } | null
  mapFailed: boolean
  initialMode: 'exhibits' | 'amenities'
  initialMustVisit?: boolean
  onClose: () => void
  onSelect: (exhibit: MapExhibit) => void
  onSelectAmenity: (amenity: CachedAmenity) => void
}

function HighlightedName({ name, query }: { name: string; query: string }) {
  const range = matchRange(name, query)
  if (!range) return <>{name}</>
  return (
    <>
      {name.slice(0, range.start)}
      <mark className="bg-transparent text-ex-forest font-extrabold">
        {name.slice(range.start, range.end)}
      </mark>
      {name.slice(range.end)}
    </>
  )
}

export default function SearchOverlay({
  exhibits,
  nearbyExhibitIds,
  userPosition,
  mapFailed,
  initialMode,
  initialMustVisit,
  onClose,
  onSelect,
  onSelectAmenity,
}: SearchOverlayProps) {
  const [query, setQuery] = useState('')
  const [amenityMode, setAmenityMode] = useState(initialMode === 'amenities')
  const [mustVisit, setMustVisit] = useState(initialMustVisit ?? false)
  // Rows stagger in on open and on mode switch only; rows that appear while typing mount in place
  const [animateIn, setAnimateIn] = useState(true)
  const isPresent = useIsPresent()
  const cachedAmenities = useStore((s) => s.cachedAmenities)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const t = setTimeout(() => setAnimateIn(false), 500)
    return () => clearTimeout(t)
  }, [amenityMode])

  const rowEnter = (index: number) => ({
    initial: animateIn ? { opacity: 0, y: 8 } : false,
    animate: { opacity: 1, y: 0 },
    transition: {
      duration: 0.2,
      ease: EASE,
      delay: Math.min(index, ROW_STAGGER_CAP) * ROW_STAGGER,
    },
  })

  const results = filterExhibits(exhibits, query, mustVisit)
  const amenityResults = sortAmenities(cachedAmenities, query, userPosition)

  const toggleAmenityMode = () => {
    setAmenityMode((m) => !m)
    setAnimateIn(true)
    setQuery('')
    inputRef.current?.focus()
  }

  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        className={`fixed inset-0 flex flex-col bg-ex-bg ${isPresent ? '' : 'pointer-events-none'}`}
        style={{ zIndex: 45, fontFamily: 'var(--font-body)' }}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0, transition: { duration: 0.2, ease: EASE } }}
        exit={{ opacity: 0, transition: { duration: 0.15, ease: EASE } }}
      >
        <div className="flex items-center gap-2 px-4 pt-4 pb-3">
          <div
            className={`flex-1 flex items-center gap-2 px-3.5 rounded-full bg-ex-paper border-[1.5px] ${
              amenityMode ? 'border-ex-amenity' : 'border-transparent'
            }`}
            style={{ height: 44, boxShadow: 'var(--ex-shadow-soft)' }}
          >
            <SearchIcon size={18} color="var(--color-ex-muted)" />
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={amenityMode ? 'Search amenities' : 'Search exhibits'}
              className="flex-1 min-w-0 bg-transparent outline-none text-[15px] text-ex-ink"
            />
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close search"
            className="w-11 h-11 grid place-items-center rounded-full text-ex-ink"
          >
            <CloseIcon size={22} />
          </button>
        </div>

        {(!mapFailed || !amenityMode) && (
          <div className="px-4 pb-2 flex gap-2">
            {!amenityMode && (
              <MustVisitPill active={mustVisit} onClick={() => setMustVisit((v) => !v)} />
            )}
            {!mapFailed && <AmenitiesPill active={amenityMode} onClick={toggleAmenityMode} />}
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-4 pb-8">
          <motion.div
            key={amenityMode ? 'amenities' : 'exhibits'}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.15, ease: EASE }}
          >
            {!amenityMode && <TrailCard />}

            <div
              className="mt-4 mb-2 text-xs font-extrabold uppercase text-ex-muted"
              style={{ letterSpacing: '0.05em' }}
            >
              {amenityMode
                ? query === ''
                  ? `All amenities · ${amenityResults.length} places`
                  : `${amenityResults.length} matches`
                : query === ''
                  ? 'All exhibits · A–Z'
                  : `${results.length} matches`}
            </div>

            {amenityMode ? (
              amenityResults.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-16 text-center text-ex-muted">
                  <SearchIcon size={36} />
                  <p className="text-[15px]">
                    {query === '' ? 'No amenities yet' : <>Nothing matches &ldquo;{query}&rdquo;</>}
                  </p>
                </div>
              ) : (
                <ul className="flex flex-col gap-2">
                  {amenityResults.map(({ amenity, distanceM }, i) => (
                    <motion.li key={amenity.id} {...rowEnter(i)}>
                      <motion.button
                        type="button"
                        whileTap={ROW_PRESS}
                        onClick={() => onSelectAmenity(amenity)}
                        className="w-full flex items-center gap-3 p-2.5 rounded-2xl bg-ex-paper text-left"
                        style={{ boxShadow: 'var(--ex-shadow-soft)' }}
                      >
                        <div
                          className="flex-none grid place-items-center rounded-xl bg-ex-amenity"
                          style={{ width: 46, height: 46 }}
                        >
                          <AmenityTypeIcon type={amenity.type} size={22} color="#fff" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[15px] font-bold text-ex-ink truncate">
                            <HighlightedName name={amenity.name} query={query} />
                          </div>
                          {distanceM !== null && (
                            <div className="mt-1 text-xs font-bold text-ex-forest">
                              {Math.round(distanceM)}m away
                            </div>
                          )}
                        </div>
                        <ChevronDownIcon
                          size={18}
                          color="var(--color-ex-muted)"
                          style={{ transform: 'rotate(-90deg)' }}
                        />
                      </motion.button>
                    </motion.li>
                  ))}
                </ul>
              )
            ) : query !== '' && results.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-center text-ex-muted">
                <SearchIcon size={36} />
                <p className="text-[15px]">Nothing matches &ldquo;{query}&rdquo;</p>
              </div>
            ) : (
              <ul className="flex flex-col gap-2">
                {results.map((exhibit, i) => {
                  const soon = exhibit.status === 'coming_soon'
                  const disabled = mapFailed && !exhibit.qr_code
                  const nearby = !!userPosition && nearbyExhibitIds.includes(exhibit.id)

                  return (
                    <motion.li key={exhibit.id} {...rowEnter(i)}>
                      <motion.button
                        type="button"
                        whileTap={disabled ? undefined : ROW_PRESS}
                        disabled={disabled}
                        onClick={disabled ? undefined : () => onSelect(exhibit)}
                        className="w-full flex items-center gap-3 p-2.5 rounded-2xl bg-ex-paper text-left"
                        style={{
                          boxShadow: 'var(--ex-shadow-soft)',
                          opacity: disabled ? 0.5 : 1,
                        }}
                      >
                        <div
                          className="flex-none rounded-xl"
                          style={{
                            width: 46,
                            height: 46,
                            background: soon ? PLACEHOLDER.blank : PLACEHOLDER.hero,
                          }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-[15px] font-bold text-ex-ink truncate">
                            <HighlightedName name={exhibit.name} query={query} />
                          </div>
                          {(soon || nearby) && (
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              {soon && (
                                <span className="inline-flex items-center gap-1 text-xs font-bold text-ex-coming-soon">
                                  <ClockIcon size={12} />
                                  Soon
                                </span>
                              )}
                              {nearby && (
                                <span className="inline-flex items-center gap-1 text-xs font-bold text-ex-forest">
                                  <LocationPinIcon size={12} />
                                  Nearby ·{' '}
                                  {Math.round(
                                    haversineMetres(userPosition, {
                                      lat: exhibit.gps_lat,
                                      lng: exhibit.gps_lng,
                                    })
                                  )}
                                  m away
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        {!disabled && (
                          <ChevronDownIcon
                            size={18}
                            color="var(--color-ex-muted)"
                            style={{ transform: 'rotate(-90deg)' }}
                          />
                        )}
                      </motion.button>
                    </motion.li>
                  )
                })}
              </ul>
            )}
          </motion.div>
        </div>
      </motion.div>
    </MotionConfig>
  )
}
