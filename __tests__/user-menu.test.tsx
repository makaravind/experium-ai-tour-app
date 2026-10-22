import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { useStore } from '@/lib/store'
import UserMenu from '@/components/more/UserMenu'

function setStorage(value: unknown) {
  Object.defineProperty(navigator, 'storage', { value, writable: true, configurable: true })
}

async function openConfirm() {
  render(createElement(UserMenu, null))
  fireEvent.click(screen.getByText(/delete and re-download/i).closest('button')!)
  await screen.findByText('Re-download all content?')
}

describe('UserMenu refresh confirm', () => {
  beforeEach(() => {
    useStore.setState({ moreMenuOpen: true, refreshRequested: false })
    Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true })
  })

  afterEach(() => {
    cleanup()
    setStorage(undefined)
  })

  it('Cancel: refreshRequested stays false', async () => {
    setStorage({ estimate: async () => ({ usage: 20_971_520 }) })
    await openConfirm()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(useStore.getState().refreshRequested).toBe(false)
    expect(screen.queryByText('Re-download all content?')).toBeNull()
  })

  it('Re-download: sets refreshRequested true', async () => {
    setStorage({ estimate: async () => ({ usage: 20_971_520 }) })
    await openConfirm()
    expect(screen.getByText(/~20 MB/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Re-download' }))
    expect(useStore.getState().refreshRequested).toBe(true)
  })

  it('omits size clause when navigator.storage is undefined', async () => {
    setStorage(undefined)
    await openConfirm()
    expect(screen.queryByText(/MB/)).toBeNull()
  })
})
