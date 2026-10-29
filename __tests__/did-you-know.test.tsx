import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { useStore } from '@/lib/store'
import DidYouKnow from '@/components/home/DidYouKnow'
import type { CachedExhibit, PreviewExhibit } from '@/lib/types'

function makeExhibit(overrides: Partial<CachedExhibit> = {}): CachedExhibit {
  return {
    id: 'ex-1',
    code: 'E1',
    status: 'active',
    name: 'Test Exhibit',
    type: 'plant',
    tier: 'free',
    facts: [{ fact: 'Trees can communicate via fungi.' }],
    audio: {},
    gps_lat: null,
    gps_lng: null,
    exhibitStatus: 'active',
    displayNumber: 1,
    ...overrides,
  }
}

describe('DidYouKnow', () => {
  beforeEach(() => {
    useStore.setState({ cachedExhibits: [] })
  })

  afterEach(() => {
    cleanup()
  })

  it('renders nothing when cachedExhibits is empty', () => {
    const { container } = render(createElement(DidYouKnow, { onSelect: vi.fn() }))
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when no exhibit has facts', () => {
    useStore.setState({
      cachedExhibits: [makeExhibit({ facts: [] })],
    })
    const { container } = render(createElement(DidYouKnow, { onSelect: vi.fn() }))
    expect(container.firstChild).toBeNull()
  })

  it('renders peek state (not expanded) on initial render', () => {
    useStore.setState({
      cachedExhibits: [makeExhibit()],
    })
    render(createElement(DidYouKnow, { onSelect: vi.fn() }))
    expect(screen.getByRole('button', { name: /Reveal Did You Know cards/i })).toBeTruthy()
  })

  it('onSelect is called with correct exhibit when card tapped in carousel', async () => {
    const exhibit = makeExhibit({ id: 'ex-42', name: 'Lotus Pond', type: 'water_body' })
    useStore.setState({ cachedExhibits: [exhibit] })
    const onSelect = vi.fn()
    render(createElement(DidYouKnow, { onSelect }))

    fireEvent.click(screen.getByRole('button', { name: /Reveal Did You Know cards/i }))
    const card = await screen.findByRole('button', { name: /Did you know:/i }, { timeout: 600 })
    fireEvent.click(card)

    expect(onSelect).toHaveBeenCalledOnce()
    const arg: PreviewExhibit = onSelect.mock.calls[0][0]
    expect(arg.id).toBe('ex-42')
    expect(arg.name).toBe('Lotus Pond')
  })

  it('renders fewer than 3 cards when pool has fewer than 3 facts', async () => {
    useStore.setState({
      cachedExhibits: [
        makeExhibit({ id: 'a', facts: [{ fact: 'Fact A' }] }),
        makeExhibit({ id: 'b', facts: [{ fact: 'Fact B' }] }),
      ],
    })
    render(createElement(DidYouKnow, { onSelect: vi.fn() }))

    fireEvent.click(screen.getByRole('button', { name: /Reveal Did You Know cards/i }))
    const cards = await screen.findAllByRole('button', { name: /Did you know:/i }, { timeout: 600 })
    expect(cards.length).toBe(2)
  })
})
