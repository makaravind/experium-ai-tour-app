'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import InfoModal from '@/components/exhibit/InfoModal'
import LoadingScreen from '@/components/exhibit/LoadingScreen'
import { useStore } from '@/lib/store'
import { useMapStore } from '@/lib/map-store'
import { getDeviceInfo } from '@/lib/utils'
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
  const onboardingStep = useStore((s) => s.onboardingStep)
  const setOnboardingStep = useStore((s) => s.setOnboardingStep)
  const setVisitorId = useStore((s) => s.setVisitorId)
  const visitorId = useStore((s) => s.visitorId)
  const language = useStore((s) => s.language)
  const setListenedCurrentExhibit = useStore((s) => s.setListenedCurrentExhibit)
  const setTotalDiscovered = useStore((s) => s.setTotalDiscovered)
  const markVisited = useStore((s) => s.markVisited)
  const { setExhibitPageData, clearExhibitPageData } = useMapStore()
  const deviceRef = useRef(getDeviceInfo())

  const [fpReady, setFpReady] = useState(
    () => typeof window !== 'undefined' && !!localStorage.getItem('experium_visitor_id')
  )
  const [appLoadingComplete, setAppLoadingComplete] = useState(false)

  const handleLoadingDone = useCallback(() => setAppLoadingComplete(true), [])

  // Visitor ID + onboarding setup
  useEffect(() => {
    const onboarded = localStorage.getItem('experium_onboarded')
    setOnboardingStep(onboarded ? 'exhibit' : 'loading')

    const cachedId = localStorage.getItem('experium_visitor_id')
    if (cachedId) {
      setVisitorId(cachedId)
      return
    }

    import('@fingerprintjs/fingerprintjs')
      .then((FingerprintJS) => FingerprintJS.load())
      .then((fp) => fp.get())
      .then((result) =>
        fetch('/api/user/handshake', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fingerprintHint: result.visitorId }),
        })
      )
      .then((res) => res.json())
      .then(({ visitorId: id }) => {
        if (id) {
          setVisitorId(id)
          localStorage.setItem('experium_visitor_id', id)
        }
        setFpReady(true)
      })
      .catch(() => setFpReady(true))
  }, [setOnboardingStep, setVisitorId])

  useEffect(() => {
    if (fpReady && appLoadingComplete) setOnboardingStep('info')
  }, [fpReady, appLoadingComplete, setOnboardingStep])

  const postScan = useCallback(
    (fields: object) =>
      fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visitorId, code: qrCode, ...fields }),
      }),
    [visitorId, qrCode]
  )

  // Page land analytics — fires once on mount
  useEffect(() => {
    postScan({
      listened: false,
      listen_duration_sec: 0,
      is_qr_scan: isQrScan,
      ...(scanSrc ? { scan_src: scanSrc } : {}),
      device_info: { language, ...deviceRef.current },
    })
      .then((res) => res.json())
      .then((data) => setTotalDiscovered(data.total_discovered ?? 0))
      .catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleFirstPlay = useCallback(async () => {
    setListenedCurrentExhibit(true)
    try {
      const res = await postScan({
        listened: true,
        ...(scanSrc ? { scan_src: scanSrc } : {}),
        device_info: { language, ...deviceRef.current },
      })
      const data = await res.json()
      setTotalDiscovered(data.total_discovered ?? 0)
      markVisited(exhibitId)
    } catch {}
  }, [
    language,
    postScan,
    exhibitId,
    scanSrc,
    setListenedCurrentExhibit,
    setTotalDiscovered,
    markVisited,
  ])

  const handleQuartile = useCallback(
    (sec: number, quartile: number) => {
      postScan({
        listened: true,
        listen_duration_sec: sec,
        listen_quartile: quartile,
        ...(scanSrc ? { scan_src: scanSrc } : {}),
        device_info: { language, ...deviceRef.current },
      })
    },
    [language, postScan, scanSrc]
  )

  // Refs so the store always calls the latest callback
  const handleFirstPlayRef = useRef(handleFirstPlay)
  handleFirstPlayRef.current = handleFirstPlay // eslint-disable-line react-hooks/refs
  const handleQuartileRef = useRef(handleQuartile)
  handleQuartileRef.current = handleQuartile // eslint-disable-line react-hooks/refs

  // Register exhibit data with the persistent map layout once onboarding is done
  useEffect(() => {
    if (onboardingStep !== 'exhibit') return
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
  }, [exhibitId, onboardingStep]) // eslint-disable-line react-hooks/exhaustive-deps

  if (onboardingStep === null) return null

  if (onboardingStep === 'loading') {
    return <LoadingScreen onDone={handleLoadingDone} />
  }

  if (onboardingStep === 'info') {
    return <InfoModal onDone={() => setOnboardingStep('exhibit')} />
  }

  return null
}
