import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { useStore } from '@/lib/store'
import AmenitySheet from '@/components/amenity/AmenitySheet'
import type { CachedAmenity } from '@/lib/types'

vi.mock('@/components/common/BottomSheet', () => ({
  default: ({ children }: { children: (s: object) => ReactNode }) =>
    children({ expanded: false, collapse: vi.fn(), expand: vi.fn() }),
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
