'use client'

import { useMemo, useRef, useState } from 'react'
import { useStore } from '@/lib/store'
import type { CachedExhibit, PreviewExhibit } from '@/lib/types'

type FactPair = { fact: string; exhibit: CachedExhibit }

function pickRandom<T>(arr: T[], n: number): T[] {
  const copy = [...arr]
  const result: T[] = []
  for (let i = 0; i < Math.min(n, arr.length); i++) {
    const idx = Math.floor(Math.random() * (copy.length - i))
    result.push(copy.splice(idx, 1)[0])
  }
  return result
}

function colorClass(type: string | null): string {
  if (type === 'water_body') return 'dyk-c-water'
  if (type === 'structure') return 'dyk-c-structure'
  if (type === 'landmark') return 'dyk-c-landmark'
  return 'dyk-c-plant'
}

function typeLabel(type: string | null): string {
  if (type === 'water_body') return 'Water Body'
  if (type === 'structure') return 'Structure'
  if (type === 'landmark') return 'Landmark'
  if (type === 'plant') return 'Plant'
  return type ?? ''
}

function toPreview(ex: CachedExhibit): PreviewExhibit {
  return {
    id: ex.id,
    name: ex.name,
    type: ex.type,
    tier: ex.tier,
    qr_code: ex.code,
    facts: ex.facts,
    displayNumber: ex.displayNumber,
  }
}

const ROTATIONS = [-2.5, 1, -1.5]

function LeafSvg({ size = 10 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      style={{ stroke: '#3f6b3a', fill: 'none', strokeWidth: 3 }}
    >
      <path d="M12 2C7 7 5 11 5 15a7 7 0 0 0 14 0c0-4-2-8-7-13Z" />
    </svg>
  )
}

export default function DidYouKnow({ onSelect }: { onSelect: (exhibit: PreviewExhibit) => void }) {
  const cachedExhibits = useStore((s) => s.cachedExhibits)
  const [expanded, setExpanded] = useState(false)
  const [activeDot, setActiveDot] = useState(0)
  const stkRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

   
  const picks = useMemo(() => {
    const pool: FactPair[] = cachedExhibits.flatMap((ex) =>
      ex.facts.map((f) => ({ fact: f.fact, exhibit: ex }))
    )
    return pickRandom(pool, 3)
  }, [])

  if (picks.length === 0) return null

  const handleReveal = () => {
    if (stkRef.current) stkRef.current.style.transform = 'translateX(5px)'
    setTimeout(() => setExpanded(true), 420)
  }

  const handleScroll = () => {
    const el = scrollRef.current
    if (!el) return
    const max = el.scrollWidth - el.clientWidth
    const idx = max > 0 ? Math.round((el.scrollLeft / max) * (picks.length - 1)) : 0
    setActiveDot(Math.min(idx, picks.length - 1))
  }

  return (
    <div className="mt-5">
      {!expanded && (
        <div style={{ marginLeft: -16, position: 'relative', padding: '8px 0' }}>
          <div
            ref={stkRef}
            style={{
              width: 155,
              position: 'relative',
              transform: 'translateX(-105px)',
              transition: 'transform 0.46s cubic-bezier(0.34,1.45,0.64,1)',
            }}
          >
            {/* back */}
            <div
              className={`dyk-stk-c ${colorClass(picks[0].exhibit.type)}`}
              style={{
                position: 'absolute',
                inset: 0,
                transform: 'translateX(-9px) translateY(10px) rotate(2.5deg)',
                zIndex: 1,
                opacity: 0.76,
              }}
            />
            {/* mid */}
            <div
              className={`dyk-stk-c ${colorClass(picks[0].exhibit.type)}`}
              style={{
                position: 'absolute',
                inset: 0,
                transform: 'translateX(-4px) translateY(5px) rotate(-1.5deg)',
                zIndex: 2,
                opacity: 0.9,
              }}
            />
            {/* front — sets container height */}
            <div
              className={`dyk-stk-c ${colorClass(picks[0].exhibit.type)}`}
              style={{ position: 'relative', transform: 'rotate(-2deg)', zIndex: 3 }}
            >
              <div style={{ height: 80, width: '100%' }} />
              <div style={{ background: '#fff', padding: '8px 10px 10px' }}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: '#3f6b3a',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 3,
                  }}
                >
                  <LeafSvg size={9} />
                  Did you know?
                </div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#2b2b2b',
                    marginTop: 3,
                    lineHeight: 1.35,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {picks[0].fact}
                </div>
              </div>
            </div>
          </div>

          {/* pulse zone — absolute relative to peek container */}
          <div className="dyk-pulse-zone">
            <div className="dyk-pulse-ring" />
            <div className="dyk-pulse-ring" />
            <button
              className="dyk-pulse-btn"
              onClick={handleReveal}
              aria-label="Reveal Did You Know cards"
              aria-expanded={false}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                aria-hidden="true"
                style={{
                  stroke: '#fff',
                  fill: 'none',
                  strokeWidth: 2.8,
                  strokeLinecap: 'round',
                  strokeLinejoin: 'round',
                }}
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {expanded && (
        <div>
          <div
            ref={scrollRef}
            style={{
              display: 'flex',
              gap: 14,
              overflowX: 'auto',
              scrollSnapType: 'x mandatory',
              padding: '8px 16px 24px',
              margin: '0 -16px -14px',
              scrollPaddingInline: 16,
            }}
            className="no-scrollbar"
            onScroll={handleScroll}
          >
            {picks.map((pair, i) => (
              <div
                key={i}
                style={{
                  scrollSnapAlign: 'start',
                  flex: '0 0 170px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                }}
              >
                <button
                  onClick={() => onSelect(toPreview(pair.exhibit))}
                  className="dyk-card"
                  style={{ '--dyk-rot': `${ROTATIONS[i] ?? 0}deg` } as React.CSSProperties}
                  aria-label={`${pair.exhibit.name}. Did you know? ${pair.fact.slice(0, 60)}`}
                >
                  {/* image area with type pill */}
                  <div
                    className={colorClass(pair.exhibit.type)}
                    style={{
                      height: 90,
                      width: '100%',
                      display: 'flex',
                      alignItems: 'flex-end',
                      padding: 8,
                    }}
                  >
                    {pair.exhibit.type && (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 800,
                          letterSpacing: '0.08em',
                          textTransform: 'uppercase',
                          background: 'rgba(0,0,0,0.52)',
                          color: '#fff',
                          padding: '3px 8px',
                          borderRadius: 99,
                        }}
                      >
                        {typeLabel(pair.exhibit.type)}
                      </span>
                    )}
                  </div>
                  {/* card body */}
                  <div style={{ padding: '10px 12px 13px', textAlign: 'left' }}>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 800,
                        color: '#3f6b3a',
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 3,
                      }}
                    >
                      <LeafSvg />
                      Did you know?
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: '#2b2b2b',
                        marginTop: 5,
                        lineHeight: 1.4,
                        display: '-webkit-box',
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {pair.fact}
                    </div>
                  </div>
                </button>
                <div
                  style={{
                    textAlign: 'center',
                    marginTop: 8,
                    fontSize: 12,
                    fontWeight: 700,
                    color: '#8a8a8a',
                    maxWidth: 170,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {pair.exhibit.name}
                </div>
              </div>
            ))}
          </div>
          <div className="dyk-dots">
            {picks.map((_, i) => (
              <div key={i} className={`dyk-dot${activeDot === i ? ' active' : ''}`} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
