'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useStore } from '@/lib/store'
import { CARD_GRADIENT_STOPS, getBadgeColor } from '@/lib/badge-placeholder'

const CARD_SIZE = 1080

interface Props {
  milestone: number
  onBack: () => void
}

function drawCard(canvas: HTMLCanvasElement, milestone: number, name: string) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const W = CARD_SIZE
  const H = CARD_SIZE

  const grad = ctx.createLinearGradient(0, 0, W, H)
  for (const [pos, c] of CARD_GRADIENT_STOPS) grad.addColorStop(pos, c)
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, W, H)

  const rg = ctx.createRadialGradient(W * 0.26, H * 0.22, 10, W * 0.26, H * 0.22, W * 0.55)
  rg.addColorStop(0, 'rgba(255,255,255,.28)')
  rg.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = rg
  ctx.fillRect(0, 0, W, H)

  const cx = W / 2
  const cy = H * 0.36
  const rOuter = W * 0.165
  const rInner = W * 0.12
  ctx.save()
  ctx.setLineDash([14, 10])
  ctx.lineWidth = W * 0.008
  ctx.strokeStyle = 'rgba(255,255,255,.55)'
  ctx.beginPath()
  ctx.arc(cx, cy, rOuter, 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()

  ctx.fillStyle = getBadgeColor(milestone)
  ctx.beginPath()
  ctx.arc(cx, cy, rInner, 0, Math.PI * 2)
  ctx.fill()
  ctx.lineWidth = W * 0.005
  ctx.strokeStyle = 'rgba(255,255,255,.5)'
  ctx.stroke()

  ctx.fillStyle = '#fff'
  ctx.font = `800 ${W * 0.11}px Baloo 2, system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(String(milestone), cx, cy + W * 0.006)

  const trimmed = name.trim()
  const label = trimmed || 'Your Name Here'
  const nameY = H * 0.565
  ctx.font = `700 ${W * 0.044}px Baloo 2, system-ui, sans-serif`
  ctx.fillStyle = trimmed ? '#fff' : 'rgba(255,255,255,.65)'
  ctx.fillText(label, cx, nameY)
  if (!trimmed) {
    const w = ctx.measureText(label).width
    ctx.save()
    ctx.setLineDash([6, 6])
    ctx.strokeStyle = 'rgba(255,255,255,.5)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(cx - w / 2, nameY + W * 0.032)
    ctx.lineTo(cx + w / 2, nameY + W * 0.032)
    ctx.stroke()
    ctx.restore()
  }

  ctx.font = `800 ${W * 0.024}px Nunito, system-ui, sans-serif`
  ctx.fillStyle = 'rgba(255,255,255,.78)'
  ctx.fillText('EXPERIUM PARK EXPLORER', cx, H * 0.67)

  ctx.font = `800 ${W * 0.03}px Baloo 2, system-ui, sans-serif`
  ctx.fillStyle = '#fff'
  ctx.fillText(`${milestone} Discovered`, cx, H * 0.735)
}

export default function DiscoveryCard({ milestone, onBack }: Props) {
  const name = useStore((s) => s.userInfo?.name ?? '')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [inputStyle, setInputStyle] = useState<React.CSSProperties | null>(null)
  const [showRetry, setShowRetry] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const redraw = useCallback(() => {
    if (canvasRef.current) drawCard(canvasRef.current, milestone, name)
  }, [milestone, name])

  useEffect(() => {
    redraw()
    // webfonts may load after first paint
    document.fonts?.ready.then(redraw)
  }, [redraw])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2200)
    return () => clearTimeout(t)
  }, [toast])

  useEffect(() => {
    if (inputStyle) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [inputStyle])

  function handleCanvasClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const scale = rect.width / CARD_SIZE
    const yCanvas = (e.clientY - rect.top) / scale
    if (yCanvas < CARD_SIZE * 0.5 || yCanvas > CARD_SIZE * 0.63) return
    setInputStyle({
      left: rect.width * 0.15,
      top: CARD_SIZE * 0.525 * scale,
      width: rect.width * 0.7,
      height: CARD_SIZE * 0.09 * scale,
      fontSize: Math.max(12, CARD_SIZE * 0.044 * scale),
    })
  }

  function commitName() {
    const value = inputRef.current?.value ?? ''
    const { userInfo, setUserInfo } = useStore.getState()
    setUserInfo({ phone: '', email: '', ...userInfo, name: value })
    setInputStyle(null)
  }

  function handleDownload() {
    setShowRetry(false)
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.toBlob(async (blob) => {
      if (!blob) {
        setShowRetry(true)
        return
      }
      try {
        const filename = `experium-card-${milestone}.png`
        const file = new File([blob], filename, { type: 'image/png' })
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], title: 'My Experium Park Discovery Card' })
          setToast('Shared! 🎉')
          return
        }
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        document.body.appendChild(a)
        a.click()
        a.remove()
        setTimeout(() => URL.revokeObjectURL(url), 2000)
        setToast('Saved! 🎉')
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return
        setShowRetry(true)
      }
    }, 'image/png')
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-ex-paper">
      <div className="flex items-center gap-3 px-4 h-14">
        <button onClick={onBack} aria-label="Back" className="text-ex-ink text-2xl font-extrabold">
          ‹
        </button>
        <h1 className="text-ex-ink font-extrabold">Milestone {milestone}</h1>
      </div>
      <div className="px-4">
        <div className="relative w-full rounded-2xl overflow-hidden shadow-lg">
          <canvas
            ref={canvasRef}
            width={CARD_SIZE}
            height={CARD_SIZE}
            onClick={handleCanvasClick}
            className="block w-full h-auto"
          />
          {inputStyle && (
            <input
              ref={inputRef}
              defaultValue={name}
              onBlur={commitName}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur()
              }}
              aria-label="Your name"
              className="absolute bg-transparent text-white text-center font-bold outline-none"
              style={inputStyle}
            />
          )}
        </div>
        <button
          onClick={handleDownload}
          className="flex items-center justify-center w-full h-[52px] mt-4 rounded-2xl bg-ex-ink text-white font-extrabold text-sm active:translate-y-px"
        >
          Download
        </button>
        {showRetry && (
          <div className="flex items-center justify-between mt-3 px-4 py-3 rounded-xl bg-red-50 text-red-800 text-sm font-bold">
            <span>Couldn&apos;t save image.</span>
            <button onClick={handleDownload} className="underline">
              Try again?
            </button>
          </div>
        )}
      </div>
      {toast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-ex-ink text-white text-sm font-bold">
          {toast}
        </div>
      )}
    </div>
  )
}
