'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import jsQR from 'jsqr'

function extractExhibitCode(text: string): string | null {
  try {
    const url = new URL(text)
    const match = url.pathname.match(/^\/s\/([^/?#]+)/)
    if (match) return match[1]
  } catch {
    if (/^[a-zA-Z0-9_-]{2,32}$/.test(text)) return text
  }
  return null
}

export default function ScanPage() {
  const router = useRouter()
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number>(0)
  const redirectedRef = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  function stopCamera() {
    cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }

  useEffect(() => {
    let cancelled = false

    function scanFrame() {
      const video = videoRef.current
      const canvas = canvasRef.current
      if (!video || !canvas || video.readyState < 2) {
        rafRef.current = requestAnimationFrame(scanFrame)
        return
      }
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      ctx.drawImage(video, 0, 0)
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const code = jsQR(imageData.data, imageData.width, imageData.height)
      if (code) {
        const exhibitCode = extractExhibitCode(code.data)
        if (exhibitCode && !redirectedRef.current) {
          redirectedRef.current = true
          stopCamera()
          router.replace(`/s/${exhibitCode}?scan=1&scansrc=camera`)
          return
        } else if (!exhibitCode) {
          setToast('Not an exhibit QR code')
          setTimeout(() => setToast(null), 2500)
        }
      }
      rafRef.current = requestAnimationFrame(scanFrame)
    }

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' } })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play().then(() => {
            rafRef.current = requestAnimationFrame(scanFrame)
          })
        }
      })
      .catch(() => setError('Camera access denied. Please allow camera permission and try again.'))

    return () => {
      cancelled = true
      stopCamera()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="fixed inset-0 bg-black flex flex-col" style={{ zIndex: 50 }}>
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        playsInline
        muted
      />
      <canvas ref={canvasRef} className="hidden" />

      {/* Viewfinder */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div
          className="border-2 border-white/70 rounded-2xl"
          style={{ width: 220, height: 220, boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)' }}
        />
      </div>

      {/* Top bar */}
      <div className="relative z-10 flex items-center justify-between px-4 pt-12 pb-4">
        <button
          onClick={() => {
            stopCamera()
            router.back()
          }}
          className="flex items-center justify-center rounded-full bg-black/50 text-white"
          style={{ width: 40, height: 40, border: '1.5px solid rgba(255,255,255,0.25)' }}
          aria-label="Close scanner"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
        <span
          className="text-white/90 text-sm font-semibold tracking-wide"
          style={{ fontFamily: 'var(--font-body)' }}
        >
          Scan Exhibit Marker
        </span>
        <div style={{ width: 40 }} />
      </div>

      {/* Hint */}
      <div className="absolute bottom-24 left-0 right-0 flex justify-center pointer-events-none">
        <span className="text-white/70 text-xs font-medium px-4 py-1.5 rounded-full bg-black/40">
          Point at a QR code marker
        </span>
      </div>

      {error && (
        <div className="absolute inset-x-4 top-32 bg-red-900/90 text-white text-sm rounded-xl px-4 py-3 text-center">
          {error}
        </div>
      )}

      {toast && (
        <div className="absolute inset-x-8 top-32 bg-black/80 text-white text-sm rounded-xl px-4 py-3 text-center border border-white/20">
          {toast}
        </div>
      )}
    </div>
  )
}
