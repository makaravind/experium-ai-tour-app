'use client'

import { useCallback, useEffect, useState } from 'react'
import ExhibitView from '@/components/exhibit/ExhibitView'
import InfoModal from '@/components/exhibit/InfoModal'
import LoadingScreen from '@/components/exhibit/LoadingScreen'
import { useStore } from '@/lib/store'
import type { ExhibitAudio, ExhibitData } from '@/lib/types'

interface Props {
  exhibitId: string
  qrCodeId: string
  exhibit: ExhibitData
  audio: ExhibitAudio[]
}

export default function ExhibitPageClient({ exhibitId, qrCodeId, exhibit, audio }: Props) {
  const onboardingStep = useStore((s) => s.onboardingStep)
  const setOnboardingStep = useStore((s) => s.setOnboardingStep)
  const setVisitorId = useStore((s) => s.setVisitorId)

  const [fpReady, setFpReady] = useState(
    () => typeof window !== 'undefined' && !!localStorage.getItem('experium_visitor_id')
  )
  const [appLoadingComplete, setAppLoadingComplete] = useState(false)

  const handleLoadingDone = useCallback(() => setAppLoadingComplete(true), [])

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
      .then(({ visitorId }) => {
        if (visitorId) {
          setVisitorId(visitorId)
          localStorage.setItem('experium_visitor_id', visitorId)
        }
        setFpReady(true)
      })
      .catch(() => setFpReady(true))
  }, [setOnboardingStep, setVisitorId])

  useEffect(() => {
    if (fpReady && appLoadingComplete) setOnboardingStep('info')
  }, [fpReady, appLoadingComplete, setOnboardingStep])

  if (onboardingStep === null) return null

  if (onboardingStep === 'loading') {
    return <LoadingScreen onDone={handleLoadingDone} />
  }

  if (onboardingStep === 'info') {
    return <InfoModal onDone={() => setOnboardingStep('exhibit')} />
  }

  return <ExhibitView exhibit={exhibit} audio={audio} qrCodeId={qrCodeId} exhibitId={exhibitId} />
}
