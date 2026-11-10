import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import PhotosPanel from '@/components/admin/PhotosPanel'
import type { AdminExhibit, AdminPhoto } from '@/lib/admin/types'

const exhibit = (code: number | null): AdminExhibit => ({
  id: 'e1', code, name: 'X', type: null, tier: 'free', status: 'live', description: null,
  facts: [], gps_lat: null, gps_lng: null, section: 'A', number: 1,
})
const photo = (id: string, sort_order: number, is_hero = false, exhibit_id = 'e1'): AdminPhoto => ({
  id, exhibit_id, url: `u/${id}`, caption: null, is_hero, sort_order,
})

describe('PhotosPanel', () => {
  afterEach(cleanup)

  it('disables upload for an unsaved exhibit', () => {
    const { container } = render(createElement(PhotosPanel, { exhibit: exhibit(null), photos: [], onChange: vi.fn() }))
    expect(screen.getByText('Save the exhibit first')).toBeTruthy()
    expect(container.querySelector<HTMLInputElement>('input[type=file]')!.disabled).toBe(true)
  })

  it('shows only this exhibit\'s photos and reports the exhibit-only list on delete', () => {
    const onChange = vi.fn()
    const photos = [photo('a', 0, true), photo('b', 1), photo('z', 0, true, 'e2')]
    render(createElement(PhotosPanel, { exhibit: exhibit(7), photos, onChange }))
    expect(screen.getAllByText('Delete')).toHaveLength(2)
    fireEvent.click(screen.getAllByText('Delete')[0])
    const next = onChange.mock.calls[0][0] as AdminPhoto[]
    expect(next.map((p) => p.id)).toEqual(['b'])
    expect(next[0].is_hero).toBe(true)
  })

  it('edits a caption', () => {
    const onChange = vi.fn()
    render(createElement(PhotosPanel, { exhibit: exhibit(7), photos: [photo('a', 0, true)], onChange }))
    fireEvent.change(screen.getByPlaceholderText('Caption'), { target: { value: 'Hello' } })
    expect(onChange.mock.calls[0][0][0].caption).toBe('Hello')
  })
})
