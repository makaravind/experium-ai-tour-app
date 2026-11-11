import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import Gallery from '@/components/exhibit/Gallery'

afterEach(cleanup)

describe('Gallery 360° slide', () => {
  it('has no tour slide without a preview url', () => {
    render(<Gallery count={3} />)
    expect(screen.queryByLabelText(/360° virtual tour/)).toBeNull()
    expect(screen.getByText('1 / 3')).toBeTruthy()
  })

  it('puts the tour slide first and calls onTourEnter without opening the modal', () => {
    const onTourEnter = vi.fn()
    render(<Gallery count={3} tourPreviewUrl="https://cdn.test/p.jpg" onTourEnter={onTourEnter} />)
    expect(screen.getByText('1 / 4')).toBeTruthy()
    const slide = screen.getByLabelText(/360° virtual tour/)
    expect(slide.parentElement?.parentElement?.firstElementChild).toBe(slide.parentElement)
    expect(screen.getByText('Tap to explore')).toBeTruthy()
    fireEvent.click(slide)
    expect(onTourEnter).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('thumbnail strip starts with the 360° thumb, marked current', () => {
    render(<Gallery count={3} tourPreviewUrl="https://cdn.test/p.jpg" />)
    const strip = screen.getByLabelText('Go to 360° tour').parentElement!
    expect(strip.firstElementChild).toBe(screen.getByLabelText('Go to 360° tour'))
    expect(screen.getByLabelText('Go to 360° tour').getAttribute('aria-current')).toBe('true')
    expect(screen.getByLabelText('Go to photo 1').getAttribute('aria-current')).toBe('false')
  })

  it('photo slides still open their own photo in the viewer after the shift', () => {
    render(<Gallery count={3} tourPreviewUrl="https://cdn.test/p.jpg" />)
    fireEvent.click(screen.getByLabelText(/Photo 2 of 3/))
    expect(screen.getByRole('dialog').getAttribute('aria-label')).toBe('Photo 2 enlarged')
  })
})
