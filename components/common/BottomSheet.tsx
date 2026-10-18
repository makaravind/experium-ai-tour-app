'use client'

import {
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type Ref,
} from 'react'
import { animate, motion, useDragControls, useMotionValue } from 'framer-motion'

const SHEET_SPRING = { type: 'spring', stiffness: 400, damping: 40, restDelta: 0.5 } as const
const REVEAL_AT = 0.18
const TAB_BAR_CLEARANCE = 108

export type BottomSheetHandle = {
  expand: (velocity?: number) => void
  collapse: (velocity?: number) => void
}

export default function BottomSheet({
  itemId,
  onClose,
  onCollapse,
  onReady,
  ref,
  children,
}: {
  itemId: string | null
  onClose?: () => void
  onCollapse?: () => void
  onReady?: () => void
  ref?: Ref<BottomSheetHandle>
  children: (sheet: { expanded: boolean; collapse: () => void }) => ReactNode
}) {
  const [expanded, setExpanded] = useState(false)
  const [peekH, setPeekH] = useState<number | undefined>(undefined)
  const [fullH, setFullH] = useState(900)
  const yOffset = itemId && peekH !== undefined ? fullH - peekH : fullH
  const y = useMotionValue(fullH)
  const sheetRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const prevItemId = useRef<string | null>(null)
  const dragControls = useDragControls()

  useEffect(() => {
    setFullH(window.innerHeight) // eslint-disable-line react-hooks/set-state-in-effect
  }, [])

  // Measure peek height once; park sheet at correct initial position.
  useLayoutEffect(() => {
    const el = contentRef.current
    if (!el) return
    const h = el.offsetHeight
    setPeekH(h)
    y.set(itemId ? fullH - h : fullH)
  }, [fullH, y]) // eslint-disable-line react-hooks/exhaustive-deps

  // Animate in/out when the item changes.
  useEffect(() => {
    if (peekH === undefined) return
    if (!itemId) {
      onCollapse?.()
      setExpanded(false) // eslint-disable-line react-hooks/set-state-in-effect
      animate(y, fullH, SHEET_SPRING)
    } else if (itemId !== prevItemId.current || y.get() > fullH - peekH - 5) {
      onCollapse?.()
      setExpanded(false)
      animate(y, fullH - peekH, SHEET_SPRING)
    }
    prevItemId.current = itemId
  }, [itemId, peekH]) // eslint-disable-line react-hooks/exhaustive-deps

  // Declared after the item effect so it runs once the sheet has parked at peek.
  useEffect(() => {
    if (peekH !== undefined) onReady?.()
  }, [peekH]) // eslint-disable-line react-hooks/exhaustive-deps

  const expand = (velocity = 0) => {
    setExpanded(true)
    animate(y, 0, { ...SHEET_SPRING, velocity })
  }

  const collapse = (velocity = 0) => {
    if (sheetRef.current) sheetRef.current.scrollTop = 0
    onCollapse?.()
    setExpanded(false)
    animate(y, yOffset, { ...SHEET_SPRING, velocity })
  }

  useImperativeHandle(ref, () => ({ expand, collapse }))

  const handleClose = () => {
    collapse()
    setTimeout(() => onClose?.(), 300)
  }

  return (
    <>
      {onClose && itemId && <div className="fixed inset-0 z-40" onClick={handleClose} />}
      <motion.div
        ref={sheetRef}
        className="fixed left-0 right-0 bottom-0 rounded-t-3xl overflow-y-auto overflow-x-clip bg-ex-paper"
        style={{
          boxShadow: 'var(--ex-shadow-sheet)',
          zIndex: 50,
          fontFamily: 'var(--font-body)',
          height: fullH,
          y,
        }}
        drag="y"
        dragListener={false}
        dragControls={dragControls}
        dragConstraints={{ top: 0, bottom: yOffset }}
        dragElastic={{ top: 0, bottom: 0.2 }}
        dragMomentum={false}
        onDrag={() => {
          const revealed = y.get() < yOffset * (1 - REVEAL_AT)
          if (revealed !== expanded) setExpanded(revealed)
        }}
        onDragEnd={(_, info) => {
          const flick = info.velocity.y
          const pastHalfway = y.get() < yOffset / 2
          if (flick < -400 || (pastHalfway && flick <= 400)) expand(flick)
          else collapse(flick)
        }}
      >
        <div ref={contentRef}>
          <button
            onPointerDown={(e) => dragControls.start(e)}
            onClick={() => (expanded ? collapse() : expand())}
            className="w-full pt-2.5 pb-4 flex justify-center"
            style={{ background: 'none', border: 'none', touchAction: 'none', cursor: 'grab' }}
            aria-label={expanded ? 'Collapse details' : 'Expand to full view'}
            aria-expanded={expanded}
          >
            <span className="rounded-full bg-ex-border" style={{ width: 36, height: 4 }} />
          </button>

          {/* eslint-disable-next-line react-hooks/refs -- collapse only touches refs when called from handlers */}
          {children({ expanded, collapse: () => collapse() })}

          <div style={{ height: TAB_BAR_CLEARANCE }} />
        </div>
      </motion.div>
    </>
  )
}
