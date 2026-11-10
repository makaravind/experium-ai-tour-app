import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createElement } from 'react'
import VirtualTourLink from '@/components/exhibit/VirtualTourLink'

function setOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { value, writable: true, configurable: true })
}

describe('VirtualTourLink', () => {
  beforeEach(() => setOnline(true))
  afterEach(cleanup)

  it('links to /tour when online', () => {
    render(createElement(VirtualTourLink))
    expect(screen.getByRole('link', { name: '360° Virtual Tour →' }).getAttribute('href')).toBe(
      '/tour'
    )
  })

  it('is hidden when offline', () => {
    setOnline(false)
    render(createElement(VirtualTourLink))
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('reacts to connectivity changes', () => {
    render(createElement(VirtualTourLink))
    act(() => {
      setOnline(false)
      window.dispatchEvent(new Event('offline'))
    })
    expect(screen.queryByRole('link')).toBeNull()
    act(() => {
      setOnline(true)
      window.dispatchEvent(new Event('online'))
    })
    expect(screen.getByRole('link')).toBeTruthy()
  })
})
