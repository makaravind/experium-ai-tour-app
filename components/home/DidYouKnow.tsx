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
    const itemWidth = 170 + 12
    const idx = Math.round(el.scrollLeft / itemWidth)
    setActiveDot(Math.min(idx, picks.length - 1))
  }

  return (
    <div className="mt-5">
      {!expanded && (
        <div style={{ marginLeft: -20 }}>
          <div
            ref={stkRef}
            style={{
              transform: 'translateX(-105px)',
              transition: 'transform 0.42s cubic-bezier(0.34,1.56,0.64,1)',
              position: 'relative',
              display: 'inline-block',
            }}
          >
            {/* back card */}
            <div
              className={colorClass(picks[0].exhibit.type)}
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: 20,
                transform: 'rotate(-4deg) translateX(-10px)',
              }}
            />
            {/* mid card */}
            <div
              className={colorClass(picks[0].exhibit.type)}
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: 20,
                transform: 'rotate(-2deg) translateX(-5px)',
              }}
            />
            {/* front card */}
            <div
              className={colorClass(picks[0].exhibit.type)}
              style={{
                position: 'relative',
                width: 170,
                height: 200,
                borderRadius: 20,
                overflow: 'hidden',
              }}
            >
              {/* top color area */}
              <div style={{ height: 80 }} />
              {/* content area */}
              <div style={{ background: '#fff', padding: '10px 12px 14px' }}>
                <div
                  style={{
                    fontSize: 9,
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: '#588157',
                    marginBottom: 4,
                  }}
                >
                  Did you know?
                </div>
                <div
                  style={{
                    fontSize: 12.5,
                    fontWeight: 600,
                    lineHeight: 1.4,
                    color: '#2b2b2b',
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {picks[0].fact}
                </div>
              </div>
            </div>
            {/* pulse button */}
            <div
              style={{
                position: 'absolute',
                right: -16,
                top: '50%',
                transform: 'translateY(-50%)',
                zIndex: 10,
              }}
            >
              <div style={{ position: 'relative', width: 36, height: 36 }}>
                <div className="dyk-ping-ring" />
                <button
                  onClick={handleReveal}
                  style={{
                    position: 'relative',
                    zIndex: 1,
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: '#588157',
                    border: 'none',
                    color: 'white',
                    fontSize: 16,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                  aria-label="Reveal Did You Know cards"
                >
                  ✨
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {expanded && (
        <>
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: '#8a8a8a',
              marginBottom: 10,
            }}
          >
            Did you know?
          </div>
          <div style={{ marginLeft: -20, marginRight: -20 }}>
            <div
              ref={scrollRef}
              style={{
                display: 'flex',
                overflowX: 'auto',
                scrollSnapType: 'x mandatory',
                gap: 12,
                paddingLeft: 20,
                paddingRight: 20,
              }}
              className="no-scrollbar"
              onScroll={handleScroll}
            >
              {picks.map((pair, i) => (
                <div key={i} style={{ scrollSnapAlign: 'center', flexShrink: 0 }}>
                  <button
                    onClick={() => onSelect(toPreview(pair.exhibit))}
                    style={{
                      width: 170,
                      borderRadius: 20,
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                      transform: `rotate(${i === 0 ? -2 : i === 2 ? 2 : 0}deg)`,
                      overflow: 'hidden',
                    }}
                    className={colorClass(pair.exhibit.type)}
                    aria-label={`Did you know: ${pair.fact.slice(0, 40)}`}
                  >
                    {/* top color area */}
                    <div style={{ height: 80 }} />
                    {/* content area */}
                    <div
                      style={{ background: '#fff', padding: '10px 12px 14px', textAlign: 'left' }}
                    >
                      <div
                        style={{
                          fontSize: 9,
                          fontWeight: 800,
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                          color: '#588157',
                          marginBottom: 4,
                        }}
                      >
                        Did you know?
                      </div>
                      <div
                        style={{
                          fontSize: 12.5,
                          fontWeight: 600,
                          lineHeight: 1.4,
                          color: '#2b2b2b',
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
                      fontSize: 11.5,
                      fontWeight: 700,
                      color: '#8a8a8a',
                    }}
                  >
                    {pair.exhibit.name}
                  </div>
                </div>
              ))}
            </div>
            {/* dot indicators */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 10 }}>
              {picks.map((_, i) => (
                <div
                  key={i}
                  style={{
                    width: activeDot === i ? 16 : 6,
                    height: 6,
                    borderRadius: 3,
                    background: activeDot === i ? '#588157' : '#e8e5df',
                    transition: 'width 0.2s, background 0.2s',
                  }}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
