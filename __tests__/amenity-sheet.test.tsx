import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { useStore } from '@/lib/store'
import AmenitySheet from '@/components/amenity/AmenitySheet'
import type { CachedAmenity } from '@/lib/types'

vi.mock('@/components/common/BottomSheet', () => ({
  default: ({ children, perch }: { children: (s: object) => ReactNode; perch?: ReactNode }) =>
    createElement(
      'div',
      null,
      createElement('div', { 'data-testid': 'perch' }, perch),
      children({ expanded: false, collapse: vi.fn(), expand: vi.fn() })
    ),
}))
vi.mock('@/components/common/PipMascot', () => ({
  default: ({ state, interactive }: { state: string; interactive?: boolean }) =>
    createElement('div', {
      'data-testid': 'pip',
      'data-state': state,
      'data-interactive': String(!!interactive),
    }),
}))
vi.mock('@/components/common/SheetSummary', () => ({
  default: ({ badge }: { badge?: ReactNode }) => createElement('div', null, badge),
}))

const make = (o: Record<string, unknown> = {}) =>
  ({
    id: 'a1',
    name: 'Main Washroom',
    type: 'washroom',
    description: 'desc',
    gps_lat: 17.38,
    gps_lng: 78.19,
    photos: [],
    section: 'G',
    ...o,
  }) as unknown as CachedAmenity

function renderSheet(amenity: CachedAmenity) {
  useStore.setState({ cachedAmenities: [amenity] })
  render(createElement(AmenitySheet, { amenityId: 'a1', onClose: vi.fn() }))
}

afterEach(cleanup)

describe('AmenitySheet badge', () => {
  it('shows section when present', () => {
    renderSheet(make())
    expect(screen.getByText('Washroom · Section G')).toBeTruthy()
  })

  it.each([undefined, null, ''])('omits section segment when section is %j', (section) => {
    renderSheet(make({ section }))
    expect(screen.getByText('Washroom')).toBeTruthy()
  })
})

describe('AmenitySheet perch', () => {
  it('passes an idle interactive Pip as the BottomSheet perch', () => {
    renderSheet(make())
    const pip = screen.getByTestId('perch').querySelector('[data-testid="pip"]')!
    expect(pip.getAttribute('data-state')).toBe('idle')
    expect(pip.getAttribute('data-interactive')).toBe('true')
  })
})
