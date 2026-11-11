'use client'

import { useCallback, useRef, useState, type ComponentProps, type SyntheticEvent } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { LeafOutlineIcon } from '@/components/icons'
import type { GallerySlide } from '@/lib/exhibit-photos'

export type Palette = { hero: string; blank: string; blankIcon: string }

export const PLACEHOLDER: Palette = {
  hero: 'linear-gradient(160deg, #6f9557, #456a3f)',
  blank: 'linear-gradient(160deg, #e8e5df, #d8d4cb)',
  blankIcon: '#b9b4a8',
}

const EMPTY_IMAGE = '/exhibit-placeholder.webp'

/** `blank` = gradient placeholder (count/palette path); `empty` = branded "no image" artwork. */
type Slide = GallerySlide | { kind: 'blank'; i: number } | { kind: 'empty' }

// Offline, an uncached photo fails to load: hide it so the blank background shows, not a broken icon.
const hideBroken = (e: SyntheticEvent<HTMLImageElement>) => {
  e.currentTarget.style.visibility = 'hidden'
}

/** Remounts when the slides change so `active`/`fullscreen`/scroll never point at a stale slide. */
export default function Gallery(props: ComponentProps<typeof GalleryInner>) {
  return <GalleryInner key={props.slides?.map((s) => s.url).join('|')} {...props} />
}

/** `slides` (from galleryPhotos) wins; without it, `count`/`tourPreviewUrl` build placeholder slides. */
function GalleryInner({
  slides,
  name,
  count = 4,
  palette = PLACEHOLDER,
  tourPreviewUrl,
  onTourEnter,
}: {
  slides?: GallerySlide[]
  name?: string
  count?: number
  palette?: Palette
  tourPreviewUrl?: string | null
  onTourEnter?: () => void
}) {
  const items: Slide[] = slides
    ? slides.length
      ? slides
      : [{ kind: 'empty' }]
    : [
        ...(tourPreviewUrl ? [{ kind: 'tour' as const, url: tourPreviewUrl }] : []),
        ...Array.from({ length: count }, (_, i) => ({ kind: 'blank' as const, i })),
      ]
  const total = items.length
  // 1-based position among photo slides (the 360° slide doesn't count)
  const photoNo = items.map((_, i) => items.slice(0, i + 1).filter((s) => s.kind !== 'tour').length)
  const photoTotal = photoNo[total - 1]
  const trackRef = useRef<HTMLDivElement>(null)
  const slideRefs = useRef<(HTMLButtonElement | null)[]>([])
  const [active, setActive] = useState(0)
  const [fullscreen, setFullscreen] = useState<{ index: number; rect: DOMRect } | null>(null)

  const onScroll = useCallback(() => {
    const el = trackRef.current
    if (!el) return
    const i = Math.round(el.scrollLeft / el.clientWidth)
    setActive(Math.max(0, Math.min(total - 1, i)))
  }, [total])

  const goTo = (i: number) => {
    const el = trackRef.current
    if (!el) return
    el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' })
  }

  const bgFor = (s: Slide) => (s.kind === 'blank' && s.i === 0 ? palette.hero : palette.blank)

  return (
    <div className="w-full">
      <div className="relative">
        <div
          ref={trackRef}
          onScroll={onScroll}
          className="flex w-full overflow-x-auto snap-x snap-mandatory no-scrollbar"
          style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
          role="group"
          aria-label="Exhibit photos"
        >
          {items.map((slide, i) =>
            slide.kind === 'tour' ? (
              <div key={i} className="w-full flex-shrink-0 snap-center">
                <button
                  className="relative w-full overflow-hidden cursor-pointer"
                  style={{ aspectRatio: '1/1', border: 'none', padding: 0 }}
                  onClick={onTourEnter}
                  aria-label="360° virtual tour — tap to explore"
                >
                  <div
                    className="tour-pan absolute inset-0"
                    style={{ backgroundImage: `url("${slide.url}")` }}
                  />
                  <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-xs font-extrabold bg-black/55 text-white">
                    360°
                  </span>
                  <span className="absolute bottom-8 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-bold bg-black/55 text-white whitespace-nowrap">
                    Tap to explore
                  </span>
                </button>
              </div>
            ) : slide.kind === 'empty' ? (
              <div key={i} className="w-full flex-shrink-0 snap-center">
                <img
                  src={EMPTY_IMAGE}
                  alt="No image available"
                  className="w-full object-cover"
                  style={{ aspectRatio: '1/1' }}
                />
              </div>
            ) : (
              <div key={i} className="w-full flex-shrink-0 snap-center">
                <button
                  ref={(el) => {
                    slideRefs.current[i] = el
                  }}
                  className="w-full flex items-center justify-center cursor-zoom-in"
                  style={{
                    aspectRatio: '1/1',
                    background: bgFor(slide),
                    border: 'none',
                    padding: 0,
                  }}
                  onClick={() => {
                    const el = slideRefs.current[i]
                    if (el) setFullscreen({ index: i, rect: el.getBoundingClientRect() })
                  }}
                  aria-label={`Photo ${photoNo[i]} of ${photoTotal} — tap to enlarge`}
                >
                  {slide.kind === 'photo' ? (
                    <img
                      src={slide.url}
                      alt={slide.caption ?? name ?? ''}
                      loading={i === 0 ? undefined : 'lazy'}
                      onError={hideBroken}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    slide.i > 0 && (
                      <LeafOutlineIcon size={30} color={palette.blankIcon} strokeWidth={1.6} />
                    )
                  )}
                </button>
              </div>
            )
          )}
        </div>
        {total > 1 && (
          <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded-full text-xs font-bold bg-black/50 text-white">
            {active + 1} / {total}
          </span>
        )}
      </div>

      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {fullscreen !== null && (
              <FullscreenModal
                key="fullscreen"
                label={photoNo[fullscreen.index]}
                slide={items[fullscreen.index]}
                alt={name}
                rect={fullscreen.rect}
                bg={bgFor(items[fullscreen.index])}
                iconColor={palette.blankIcon}
                onClose={() => setFullscreen(null)}
              />
            )}
          </AnimatePresence>,
          document.body
        )}

      {/* Thumbnail strip */}
      {total > 1 && (
        <div className="flex gap-2 mt-3 justify-center">
          {items.map((slide, i) =>
            slide.kind === 'tour' ? (
              <button
                key={i}
                onClick={() => goTo(i)}
                className={`relative flex-shrink-0 rounded-lg overflow-hidden border-2 transition-colors ${
                  i === active ? 'border-ex-forest' : 'border-transparent'
                }`}
                style={{
                  width: 60,
                  height: 48,
                  backgroundImage: `url("${slide.url}")`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  padding: 0,
                }}
                aria-label="Go to 360° tour"
                aria-current={i === active}
              >
                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-extrabold text-white bg-black/35">
                  360°
                </span>
              </button>
            ) : (
              <button
                key={i}
                onClick={() => goTo(i)}
                className={`flex-shrink-0 rounded-lg overflow-hidden border-2 transition-colors ${
                  i === active ? 'border-ex-forest' : 'border-transparent'
                }`}
                style={{
                  width: 60,
                  height: 48,
                  ...(slide.kind === 'photo'
                    ? {
                        backgroundImage: `url("${slide.url}")`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                      }
                    : { background: bgFor(slide) }),
                  padding: 0,
                }}
                aria-label={`Go to photo ${photoNo[i]}`}
                aria-current={i === active}
              >
                {slide.kind === 'blank' && slide.i > 0 && (
                  <div className="w-full h-full flex items-center justify-center">
                    <LeafOutlineIcon size={16} color={palette.blankIcon} strokeWidth={1.6} />
                  </div>
                )}
              </button>
            )
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Separate component so AnimatePresence captures a stable snapshot of `rect`
 * at mount time — the FLIP exit animation references those same values.
 */
function FullscreenModal({
  label,
  slide,
  alt,
  rect,
  bg,
  iconColor,
  onClose,
}: {
  label: number
  slide: Slide
  alt?: string
  rect: DOMRect
  bg: string
  iconColor: string
  onClose: () => void
}) {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const size = Math.min(vw - 32, 480)
  const targetLeft = (vw - size) / 2
  const targetTop = (vh - size) / 2

  // FLIP: position image at final (fullscreen) coordinates, then apply an
  // initial transform that maps it to the thumbnail's position on screen.
  const scale = rect.width / size
  const dx = rect.left + rect.width / 2 - (targetLeft + size / 2)
  const dy = rect.top + rect.height / 2 - (targetTop + size / 2)

  const morphTransition = { type: 'spring', stiffness: 350, damping: 35 } as const

  return (
    <motion.div
      className="fixed inset-0 z-50"
      initial={{ backgroundColor: 'rgba(0,0,0,0)' }}
      animate={{ backgroundColor: 'rgba(0,0,0,0.9)' }}
      exit={{ backgroundColor: 'rgba(0,0,0,0)' }}
      transition={{ duration: 0.25 }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Photo ${label} enlarged`}
    >
      {/* Close button fades in after the morph settles */}
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15, delay: 0.22 }}
        className="absolute top-4 right-4 text-white bg-black/50 rounded-full w-9 h-9 flex items-center justify-center text-lg leading-none"
        onClick={(e) => {
          e.stopPropagation()
          onClose()
        }}
        aria-label="Close"
      >
        ✕
      </motion.button>

      {/* Morphing image — starts at thumbnail, springs to fullscreen */}
      <motion.div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'fixed',
          left: targetLeft,
          top: targetTop,
          width: size,
          height: size,
          background: bg,
          borderRadius: 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
        initial={{ scale, x: dx, y: dy, borderRadius: 10 / scale }}
        animate={{ scale: 1, x: 0, y: 0, borderRadius: 12 }}
        exit={{ scale, x: dx, y: dy, borderRadius: 10 / scale }}
        transition={morphTransition}
      >
        {slide.kind === 'photo' ? (
          <img
            src={slide.url}
            alt={slide.caption ?? alt ?? ''}
            onError={hideBroken}
            className="w-full h-full object-contain"
          />
        ) : (
          slide.kind === 'blank' &&
          slide.i > 0 && <LeafOutlineIcon size={60} color={iconColor} strokeWidth={1.2} />
        )}
      </motion.div>
    </motion.div>
  )
}
