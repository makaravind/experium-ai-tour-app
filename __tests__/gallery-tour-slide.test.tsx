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

  it('appends the tour slide last and calls onTourEnter without opening the modal', () => {
    const onTourEnter = vi.fn()
    render(<Gallery count={3} tourPreviewUrl="https://cdn.test/p.jpg" onTourEnter={onTourEnter} />)
    expect(screen.getByText('1 / 4')).toBeTruthy()
    const slide = screen.getByLabelText(/360° virtual tour/)
    expect(slide.parentElement?.parentElement?.lastElementChild).toBe(slide.parentElement)
    expect(screen.getByText('Tap to explore')).toBeTruthy()
    fireEvent.click(slide)
    expect(onTourEnter).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
