import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import AmenityPanel from '@/components/admin/AmenityPanel'
import type { AdminAmenity } from '@/lib/admin/types'

const make = (o: Partial<AdminAmenity> = {}): AdminAmenity => ({
  id: 'a1',
  name: 'Main Washroom',
  type: 'washroom',
  description: 'desc',
  gps_lat: 17.38,
  gps_lng: 78.19,
  section: 'G',
  ...o,
})

afterEach(cleanup)

describe('AmenityPanel', () => {
  it('emits an updated amenity on name edit', () => {
    const onChange = vi.fn()
    const a = make()
    render(<AmenityPanel amenity={a} onChange={onChange} onDelete={vi.fn()} />)
    fireEvent.change(screen.getByDisplayValue('Main Washroom'), { target: { value: 'North Washroom' } })
    expect(onChange).toHaveBeenCalledWith({ ...a, name: 'North Washroom' })
  })

  it('blank name: no emit, reports validity error, clears it when fixed', () => {
    const onChange = vi.fn()
    const onValidityChange = vi.fn()
    const a = make()
    render(<AmenityPanel amenity={a} onChange={onChange} onDelete={vi.fn()} onValidityChange={onValidityChange} />)
    expect(onValidityChange).toHaveBeenLastCalledWith(null)
    const input = screen.getByDisplayValue('Main Washroom')
    fireEvent.change(input, { target: { value: '  ' } })
    expect(onChange).not.toHaveBeenCalled()
    expect(onValidityChange).toHaveBeenLastCalledWith('Amenity name is required')
    expect(screen.getByText('Amenity name is required')).toBeTruthy()
    fireEvent.change(input, { target: { value: 'Back' } })
    expect(onChange).toHaveBeenCalledWith({ ...a, name: 'Back' })
    expect(onValidityChange).toHaveBeenLastCalledWith(null)
  })

  it('clears the validity error on unmount', () => {
    const onValidityChange = vi.fn()
    const { unmount } = render(<AmenityPanel amenity={make()} onChange={vi.fn()} onDelete={vi.fn()} onValidityChange={onValidityChange} />)
    fireEvent.change(screen.getByDisplayValue('Main Washroom'), { target: { value: '' } })
    unmount()
    expect(onValidityChange).toHaveBeenLastCalledWith(null)
  })

  it('emits a type change from the five allowed types', () => {
    const onChange = vi.fn()
    const a = make()
    render(<AmenityPanel amenity={a} onChange={onChange} onDelete={vi.fn()} />)
    const select = screen.getByDisplayValue('washroom') as HTMLSelectElement
    expect([...select.options].map((o) => o.value)).toEqual(['washroom', 'ticketing', 'food', 'gate', 'leisure'])
    fireEvent.change(select, { target: { value: 'food' } })
    expect(onChange).toHaveBeenCalledWith({ ...a, type: 'food' })
  })

  it('maps an empty description to null', () => {
    const onChange = vi.fn()
    const a = make()
    render(<AmenityPanel amenity={a} onChange={onChange} onDelete={vi.fn()} />)
    fireEvent.change(screen.getByDisplayValue('desc'), { target: { value: '' } })
    expect(onChange).toHaveBeenCalledWith({ ...a, description: null })
  })

  it('shows the section read-only, "unplaced" when null', () => {
    const { rerender } = render(<AmenityPanel amenity={make()} onChange={vi.fn()} onDelete={vi.fn()} />)
    expect((screen.getByDisplayValue('G') as HTMLInputElement).disabled).toBe(true)
    rerender(<AmenityPanel amenity={make({ section: null })} onChange={vi.fn()} onDelete={vi.fn()} />)
    expect((screen.getByDisplayValue('unplaced') as HTMLInputElement).disabled).toBe(true)
  })

  it('calls onDelete', () => {
    const onDelete = vi.fn()
    render(<AmenityPanel amenity={make()} onChange={vi.fn()} onDelete={onDelete} />)
    fireEvent.click(screen.getByRole('button', { name: /delete/i }))
    expect(onDelete).toHaveBeenCalledOnce()
  })

  it('resets the name input when the amenity changes underneath', () => {
    const { rerender } = render(<AmenityPanel amenity={make()} onChange={vi.fn()} onDelete={vi.fn()} />)
    fireEvent.change(screen.getByDisplayValue('Main Washroom'), { target: { value: '' } })
    rerender(<AmenityPanel amenity={make({ id: 'a2', name: 'Canopy' })} onChange={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByDisplayValue('Canopy')).toBeTruthy()
    expect(screen.queryByText('Amenity name is required')).toBeNull()
  })
})
