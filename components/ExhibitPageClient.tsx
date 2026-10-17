'use client'

import { useCallback, useEffect, useRef } from 'react'
import { useStore } from '@/lib/store'
import { useMapStore } from '@/lib/map-store'
import { getDeviceInfo } from '@/lib/utils'
import { enqueueScan } from '@/lib/scan-queue'
import type { ExhibitAudio, ExhibitData, PreviewExhibit } from '@/lib/types'

export default function ExhibitPageClient({
  exhibitId,
  qrCode,
  isQrScan,
  scanSrc,
  autoPlay,
  exhibit,
  audio,
}: {
  exhibitId: string
  qrCode: string
  isQrScan: boolean
  scanSrc: string | null
  autoPlay: boolean
  exhibit: ExhibitData
  audio: ExhibitAudio[]
}) {
  const visitorId = useStore((s) => s.visitorId)
  const language = useStore((s) => s.language)
  const setListenedCurrentExhibit = useStore((s) => s.setListenedCurrentExhibit)
  const setTotalDiscovered = useStore((s) => s.setTotalDiscovered)
  const markVisited = useStore((s) => s.markVisited)
  const { setExhibitPageData, clearExhibitPageData } = useMapStore()
  const deviceRef = useRef(getDeviceInfo())

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
        setTotalDiscovered(result.newTotal)
      }
    }
    enqueueScan(qrCode, {
      listened: false,
      listen_duration_sec: 0,
      is_qr_scan: isQrScan,
      ...(scanSrc ? { scan_src: scanSrc } : {}),
      device_info: { language, ...deviceRef.current },
    })
  }, [visitorId]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleFirstPlay = useCallback(() => {
    setListenedCurrentExhibit(true)
    enqueueScan(qrCode, {
      listened: true,
      ...(scanSrc ? { scan_src: scanSrc } : {}),
      device_info: { language, ...deviceRef.current },
    })
    markVisited(exhibitId)
  }, [language, qrCode, exhibitId, scanSrc, setListenedCurrentExhibit, markVisited])

  const handleQuartile = useCallback(
    (sec: number, quartile: number) => {
      enqueueScan(qrCode, {
        listened: true,
        listen_duration_sec: sec,
        listen_quartile: quartile,
        ...(scanSrc ? { scan_src: scanSrc } : {}),
        device_info: { language, ...deviceRef.current },
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
    }
    setExhibitPageData({
      exhibit: previewExhibit,
      audio,
      autoPlay,
      onFirstPlay: () => handleFirstPlayRef.current(),
      onQuartile: (sec, q) => handleQuartileRef.current(sec, q),
    })
    return () => clearExhibitPageData()
  }, [exhibitId]) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}
