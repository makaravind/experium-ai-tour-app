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

    // bail if video doesn't start playing within 500ms
    const timer = setTimeout(done, 500)
    video
      .play()
      .then(() => clearTimeout(timer))
      .catch(done)

    return () => {
      video.removeEventListener('ended', done)
      video.removeEventListener('error', done)
      clearTimeout(timer)
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
