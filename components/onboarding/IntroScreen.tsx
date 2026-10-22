'use client'

import { useEffect, useRef } from 'react'

export default function IntroScreen({ onEnd }: { onEnd: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) {
      onEnd()
      return
    }

    let fired = false
    const done = () => {
      if (fired) return
      fired = true
      onEnd()
    }

    video.addEventListener('ended', done)
    video.addEventListener('error', done)
    // SW precache serves video without range-request support; video can start then stall
    video.addEventListener('stalled', done)

    // bail if video doesn't start playing within 500ms
    const timer = setTimeout(done, 500)
    // hard max: never wait more than 8s regardless of playback state
    const maxTimer = setTimeout(done, 8_000)
    const p = video.play()
    if (p instanceof Promise) p.then(() => clearTimeout(timer)).catch(done)

    return () => {
      video.removeEventListener('ended', done)
      video.removeEventListener('error', done)
      video.removeEventListener('stalled', done)
      clearTimeout(timer)
      clearTimeout(maxTimer)
    }
  }, [onEnd])

  return (
    <video
      ref={videoRef}
      src="/intro.mp4"
      className="fixed inset-0 w-full h-full object-cover"
      muted
      playsInline
      preload="auto"
    />
  )
}
