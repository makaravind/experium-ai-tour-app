import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import PlacePanel from '@/components/admin/tour/PlacePanel'
import type { TourNode } from '@/lib/tour'

const node: TourNode = {
  id: 'n1',
  label: 'Lobby',
  pano_ref: 'pano-01',
  tiles_url: 'https://x/tiles',
  preview_url: 'https://x/preview.jpg',
  lat: null,
  lng: null,
  is_lobby: true,
}

const setup = () => {
  const onSelect = vi.fn()
  render(
    <PlacePanel
      nodes={[node]}
      selectedId={null}
      onSelect={onSelect}
      onLabelChange={vi.fn()}
      onClearPosition={vi.fn()}
    />,
  )
  return { onSelect }
}

afterEach(cleanup)

describe('PlacePanel preview lightbox', () => {
  it('opens on thumbnail click without selecting the node', () => {
    const { onSelect } = setup()
    fireEvent.click(screen.getByLabelText('View Lobby preview large'))
    const dialog = screen.getByRole('dialog')
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(screen.getByAltText('Lobby').getAttribute('src')).toBe(node.preview_url)
    expect(within(dialog).getByText('pano-01')).toBeTruthy()
    expect(within(dialog).getByText(/Lobby/, { selector: 'p' })).toBeTruthy()
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('closes on Escape, ✕ and backdrop, but not on image click', () => {
    setup()
    const open = () => fireEvent.click(screen.getByLabelText('View Lobby preview large'))

    open()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()

    open()
    fireEvent.click(screen.getByLabelText('Close preview'))
    expect(screen.queryByRole('dialog')).toBeNull()

    open()
    fireEvent.click(screen.getByAltText('Lobby'))
    expect(screen.getByRole('dialog')).toBeTruthy()
    fireEvent.click(screen.getByRole('dialog'))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('still selects the node from the row button', () => {
    const { onSelect } = setup()
    fireEvent.click(screen.getByText('Lobby'))
    expect(onSelect).toHaveBeenCalledWith('n1')
  })
})
