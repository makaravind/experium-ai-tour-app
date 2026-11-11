'use client'

import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

interface PreviewLightboxProps {
  src: string
  label: string
  panoRef: string
  onClose: () => void
}

export default function PreviewLightbox({ src, label, panoRef, onClose }: PreviewLightboxProps) {
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      opener?.focus()
    }
  }, [onClose])

  // Portal: the panel sits in a z-10 stacking context, below the Save pill (z-20).
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${label} preview`}
      data-testid="preview-lightbox"
      className="fixed inset-0 z-[10000] flex flex-col items-center justify-center gap-3 bg-black/80 p-6"
      onClick={onClose}
    >
      <button
        ref={closeRef}
        type="button"
        aria-label="Close preview"
        onClick={onClose}
        className="absolute right-4 top-4 rounded bg-background px-3 py-1 text-sm"
      >
        ✕
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element -- dev-only admin preview */}
      <img
        src={src}
        alt={label}
        onClick={(e) => e.stopPropagation()}
        className="min-h-0 max-h-[85vh] max-w-full rounded object-contain"
      />
      <p className="text-sm text-white" onClick={(e) => e.stopPropagation()}>
        {label} · <span className="text-white/70">{panoRef}</span>
      </p>
    </div>,
    document.body,
  )
}
