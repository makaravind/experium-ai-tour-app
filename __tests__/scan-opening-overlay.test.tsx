import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { createElement } from 'react'

const replace = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace, back: vi.fn() }) }))

let qrData = 'https://example.test/s/baobab-forest'
vi.mock('jsqr', () => ({ default: () => ({ data: qrData }) }))

import ScanPage from '@/app/scan/page'

describe('ScanPage opening overlay', () => {
  const stopTrack = vi.fn()

  beforeEach(() => {
    replace.mockReset()
    stopTrack.mockReset()
    qrData = 'https://example.test/s/baobab-forest'
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: async () => ({ getTracks: () => [{ stop: stopTrack }] }) },
      configurable: true,
    })
    // jsdom has no media pipeline or canvas: pretend a frame is always ready to decode
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
    Object.defineProperty(HTMLMediaElement.prototype, 'readyState', {
      value: 4,
      configurable: true,
    })
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: vi.fn(),
      getImageData: () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 }),
    } as unknown as CanvasRenderingContext2D)
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('valid code: shows "Opening exhibit…" as the camera stops and the replace is issued', async () => {
    render(createElement(ScanPage, null))

    expect(await screen.findByText('Opening exhibit…')).toBeInTheDocument()
    expect(stopTrack).toHaveBeenCalled()
    expect(replace).toHaveBeenCalledWith('/s/baobab-forest?scan=1&scansrc=camera')
  })

  it('non-exhibit code: no overlay, toast instead', async () => {
    qrData = 'https://example.test/not-an-exhibit'
    render(createElement(ScanPage, null))

    expect(await screen.findByText('Not an exhibit QR code')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByText('Opening exhibit…')).toBeNull())
    expect(replace).not.toHaveBeenCalled()
  })
})
