'use client'

import { useCallback, useEffect } from 'react'
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

  const handleLoadingDone = useCallback(() => setOnboardingStep('info'), [setOnboardingStep])

  useEffect(() => {
    const onboarded = localStorage.getItem('experium_onboarded')
    setOnboardingStep(onboarded ? 'exhibit' : 'loading')

    import('@fingerprintjs/fingerprintjs')
      .then((FingerprintJS) => FingerprintJS.load())
      .then((fp) => fp.get())
      .then((result) => setVisitorId(result.visitorId))
      .catch(() => {})
  }, [setOnboardingStep, setVisitorId])

  if (onboardingStep === null) return null

  if (onboardingStep === 'loading') {
    return <LoadingScreen onDone={handleLoadingDone} />
  }

  if (onboardingStep === 'info') {
    return <InfoModal onDone={() => setOnboardingStep('exhibit')} />
  }

  return <ExhibitView exhibit={exhibit} audio={audio} qrCodeId={qrCodeId} exhibitId={exhibitId} />
}
