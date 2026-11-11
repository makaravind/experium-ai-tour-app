'use client'

import { useCallback, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useStore } from '@/lib/store'
import { useMapStore } from '@/lib/map-store'
import { enqueueScan } from '@/lib/scan-queue'
import { tourHref } from '@/lib/tour'
import type { ExhibitAudio, ExhibitData, PreviewExhibit } from '@/lib/types'
import { track } from '@vercel/analytics'

export default function ExhibitPageClient({
  exhibitId,
  qrCode,
  scanSrc,
  exhibit,
  audio,
}: {
  exhibitId: string
  qrCode: string
  scanSrc: string | null
  exhibit: ExhibitData
  audio: ExhibitAudio[]
}) {
  const visitorId = useStore((s) => s.visitorId)
  const language = useStore((s) => s.language)
  const cachedExhibit = useStore((s) => s.cachedExhibits.find((e) => e.id === exhibitId))
  const displayId = cachedExhibit?.displayId ?? null
  const router = useRouter()
  const virtualTourMode = useSearchParams().get('mode') === 'virtual-tour'
  const setListenedCurrentExhibit = useStore((s) => s.setListenedCurrentExhibit)
  const markVisited = useStore((s) => s.markVisited)
  const { setExhibitPageData, clearExhibitPageData } = useMapStore()

  // Page land — fires once visitorId has resolved (cached or via handshake); the queue
  // flush needs it to send.
  //
  // Discovery is local-first: scanning the onsite marker (not finishing the audio) is the
  // anti-fraud discovery trigger, so for scan_src === 'onsite' we mark the code discovered
  // locally and publish the prevTotal → newTotal delta as pendingDiscovery for MapShell's
  // handleAudioEnded to read synchronously. The scan is then enqueued; the flush reconciles
  // the server total when it drains.
  const pageLandSentRef = useRef(false)
  useEffect(() => {
    if (!visitorId || pageLandSentRef.current) return
    pageLandSentRef.current = true
    if (scanSrc === 'onsite') {
      const result = useStore.getState().discoverCode(qrCode)
      if (result) {
        useMapStore.getState().setPendingDiscovery({ exhibitId, ...result })
      }
    }
    enqueueScan(qrCode, {
      listened: false,
      listen_duration_sec: 0,
      is_qr_scan: scanSrc === 'onsite' || scanSrc === 'camera',
      ...(scanSrc ? { scan_src: scanSrc } : {}),
      language,
    })
  }, [visitorId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Virtual-tour QR: jump to the linked node. replace keeps back from /tour out of a redirect loop.
  // Exhibits without a node (or not in cache) fall through to the normal page.
  const tourRedirectedRef = useRef(false)
  useEffect(() => {
    if (!virtualTourMode || tourRedirectedRef.current) return
    const href = cachedExhibit && tourHref(cachedExhibit)
    if (!href) return
    tourRedirectedRef.current = true
    router.replace(href)
  }, [virtualTourMode, cachedExhibit, router])

  const handleFirstPlay = useCallback(() => {
    setListenedCurrentExhibit(true)
    track('playback_start', { exhibit: qrCode })
    enqueueScan(qrCode, {
      listened: true,
      ...(scanSrc ? { scan_src: scanSrc } : {}),
      language,
    })
    markVisited(exhibitId)
  }, [language, qrCode, exhibitId, scanSrc, setListenedCurrentExhibit, markVisited])

  const handleQuartile = useCallback(
    (sec: number, quartile: number) => {
      track('playback_progress', { exhibit: qrCode, quartile })
      enqueueScan(qrCode, {
        listened: true,
        listen_duration_sec: sec,
        listen_quartile: quartile,
        ...(scanSrc ? { scan_src: scanSrc } : {}),
        language,
      })
    },
    [language, qrCode, scanSrc]
  )

  // Refs so the store always calls the latest callback
  const handleFirstPlayRef = useRef(handleFirstPlay)
  handleFirstPlayRef.current = handleFirstPlay // eslint-disable-line react-hooks/refs
  const handleQuartileRef = useRef(handleQuartile)
  handleQuartileRef.current = handleQuartile // eslint-disable-line react-hooks/refs

  // Register exhibit data with the persistent map layout
  useEffect(() => {
    const previewExhibit: PreviewExhibit = {
      id: exhibitId,
      name: exhibit.name,
      type: exhibit.type,
      tier: exhibit.tier,
      qr_code: qrCode,
      facts: exhibit.facts,
      languages: audio.map((a) => a.language),
      displayId,
      tour_node_id: cachedExhibit?.tour_node_id,
      tour_heading: cachedExhibit?.tour_heading,
      tour_pitch: cachedExhibit?.tour_pitch,
      tour_preview_url: cachedExhibit?.tour_preview_url,
    }
    setExhibitPageData({
      exhibit: previewExhibit,
      audio,
      scanSrc,
      onFirstPlay: () => handleFirstPlayRef.current(),
      onQuartile: (sec, q) => handleQuartileRef.current(sec, q),
    })
    return () => clearExhibitPageData()
  }, [exhibitId]) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}
