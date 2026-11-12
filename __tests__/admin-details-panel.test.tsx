import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import DetailsPanel from '@/components/admin/DetailsPanel'
import type { AdminExhibit } from '@/lib/admin/types'

const make = (o: Partial<AdminExhibit> = {}): AdminExhibit => ({
  id: 'e1',
  code: 7,
  name: 'Baobab',
  type: 'flora',
  tier: 'gold',
  status: 'live',
  description: 'desc',
  facts: [{ fact: 'old' }],
  gps_lat: null,
  gps_lng: null,
  section: 'A',
  number: 1,
  ...o,
})

const other = make({ id: 'e2', code: 8, number: 2 })

afterEach(cleanup)

describe('DetailsPanel', () => {
  it('emits an updated exhibit on name edit', () => {
    const onChange = vi.fn()
    const e = make()
    render(<DetailsPanel exhibit={e} exhibits={[e, other]} onChange={onChange} />)
    fireEvent.change(screen.getByDisplayValue('Baobab'), { target: { value: 'Banyan' } })
    expect(onChange).toHaveBeenCalledWith({ ...e, name: 'Banyan' })
  })

  it('shows read-only coordinates, dash when unplaced', () => {
    const placed = make({ gps_lat: 17.385044, gps_lng: 78.486671 })
    const { unmount } = render(
      <DetailsPanel exhibit={placed} exhibits={[placed]} onChange={vi.fn()} />
    )
    expect((screen.getByLabelText('Latitude') as HTMLInputElement).value).toBe('17.385044')
    expect((screen.getByLabelText('Longitude') as HTMLInputElement).value).toBe('78.486671')
    expect((screen.getByLabelText('Latitude') as HTMLInputElement).readOnly).toBe(true)
    unmount()
    const e = make()
    render(<DetailsPanel exhibit={e} exhibits={[e]} onChange={vi.fn()} />)
    expect((screen.getByLabelText('Latitude') as HTMLInputElement).value).toBe('—')
  })

  it('blocks a duplicate number: shows error, does not emit', () => {
    const onChange = vi.fn()
    const e = make()
    render(<DetailsPanel exhibit={e} exhibits={[e, other]} onChange={onChange} />)
    fireEvent.change(screen.getByDisplayValue('1'), { target: { value: '2' } })
    expect(screen.getByText(/already used in section A/)).toBeTruthy()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('emits a free number', () => {
    const onChange = vi.fn()
    const e = make()
    render(<DetailsPanel exhibit={e} exhibits={[e, other]} onChange={onChange} />)
    fireEvent.change(screen.getByDisplayValue('1'), { target: { value: '3' } })
    expect(onChange).toHaveBeenCalledWith({ ...e, number: 3 })
  })

  it('emits facts only when the JSON is valid', () => {
    const onChange = vi.fn()
    const e = make()
    render(<DetailsPanel exhibit={e} exhibits={[e]} onChange={onChange} />)
    const ta = screen.getByLabelText(/Facts/)
    fireEvent.change(ta, { target: { value: '[{"fact":' } })
    expect(screen.getByText(/Invalid JSON/)).toBeTruthy()
    expect(onChange).not.toHaveBeenCalled()
    fireEvent.change(ta, { target: { value: '[{"fact":"new"}]' } })
    expect(onChange).toHaveBeenCalledWith({ ...e, facts: [{ fact: 'new' }] })
  })

  it('shows code placeholder for a new exhibit and disables number when unplaced', () => {
    const e = make({ code: null, section: null, number: null })
    render(<DetailsPanel exhibit={e} exhibits={[e]} onChange={vi.fn()} />)
    expect(screen.getByDisplayValue('assigned on save')).toBeTruthy()
    expect(screen.getByDisplayValue('unplaced')).toBeTruthy()
  })

  it('resets editor text when the exhibit changes', () => {
    const e = make()
    const { rerender } = render(
      <DetailsPanel exhibit={e} exhibits={[e, other]} onChange={vi.fn()} />
    )
    fireEvent.change(screen.getByLabelText(/Facts/), { target: { value: 'garbage' } })
    rerender(<DetailsPanel exhibit={other} exhibits={[e, other]} onChange={vi.fn()} />)
    expect((screen.getByLabelText(/Facts/) as HTMLTextAreaElement).value).toBe(
      JSON.stringify(other.facts, null, 2)
    )
    expect(screen.getByDisplayValue('2')).toBeTruthy()
  })

  it('reports invalid number / facts via onValidityChange and clears when fixed or unmounted', () => {
    const onValidityChange = vi.fn()
    const e = make()
    const { unmount } = render(
      <DetailsPanel
        exhibit={e}
        exhibits={[e, other]}
        onChange={vi.fn()}
        onValidityChange={onValidityChange}
      />
    )
    expect(onValidityChange).toHaveBeenLastCalledWith(null)
    fireEvent.change(screen.getByDisplayValue('1'), { target: { value: '2' } })
    expect(onValidityChange).toHaveBeenLastCalledWith(
      expect.stringMatching(/already used in section A/)
    )
    fireEvent.change(screen.getByDisplayValue('2'), { target: { value: '3' } })
    expect(onValidityChange).toHaveBeenLastCalledWith(null)
    fireEvent.change(screen.getByLabelText(/Facts/), { target: { value: '[{"fact":' } })
    expect(onValidityChange).toHaveBeenLastCalledWith(expect.stringMatching(/Invalid JSON/))
    unmount()
    expect(onValidityChange).toHaveBeenLastCalledWith(null)
  })

  it('reports valid again after the selection changes away from an invalid exhibit', () => {
    const onValidityChange = vi.fn()
    const e = make()
    const { rerender } = render(
      <DetailsPanel
        exhibit={e}
        exhibits={[e, other]}
        onChange={vi.fn()}
        onValidityChange={onValidityChange}
      />
    )
    fireEvent.change(screen.getByLabelText(/Facts/), { target: { value: 'garbage' } })
    expect(onValidityChange).toHaveBeenLastCalledWith(expect.any(String))
    rerender(
      <DetailsPanel
        exhibit={other}
        exhibits={[e, other]}
        onChange={vi.fn()}
        onValidityChange={onValidityChange}
      />
    )
    expect(onValidityChange).toHaveBeenLastCalledWith(null)
  })
})
