import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import Gallery from '@/components/exhibit/Gallery'
import type { GallerySlide } from '@/lib/exhibit-photos'

afterEach(cleanup)

const photo = (n: number, caption: string | null = null): GallerySlide => ({
  kind: 'photo',
  url: `https://cdn.test/${n}.webp`,
  caption,
})
const tour: GallerySlide = { kind: 'tour', url: 'https://cdn.test/p.jpg' }

describe('Gallery slides', () => {
  it('empty slides render one placeholder image, no counter, no strip', () => {
    render(<Gallery slides={[]} name="Banyan" />)
    const img = screen.getByAltText('No image available')
    expect(img.getAttribute('src')).toBe('/exhibit-placeholder.webp')
    expect(screen.getAllByRole('img')).toHaveLength(1)
    expect(screen.queryByText(/ \/ /)).toBeNull()
    expect(screen.queryByLabelText(/^Go to/)).toBeNull()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('single slide hides counter and strip', () => {
    render(<Gallery slides={[photo(1)]} name="Banyan" />)
    expect(screen.queryByText(/ \/ /)).toBeNull()
    expect(screen.queryByLabelText(/^Go to/)).toBeNull()
  })

  it('renders photos in order; alt is caption or exhibit name; only slide 0 is eager', () => {
    render(<Gallery slides={[photo(1, 'Hero shot'), photo(2)]} name="Banyan" />)
    expect(screen.getByText('1 / 2')).toBeTruthy()
    const first = screen.getByAltText('Hero shot')
    const second = screen.getByAltText('Banyan')
    expect(first.getAttribute('src')).toBe('https://cdn.test/1.webp')
    expect(first.getAttribute('loading')).toBeNull()
    expect(second.getAttribute('loading')).toBe('lazy')
  })

  it('photo slide opens the modal with the real image; 360° slide enters the tour', () => {
    const onTourEnter = vi.fn()
    render(
      <Gallery
        slides={[photo(1, 'Hero'), tour, photo(2)]}
        name="Banyan"
        onTourEnter={onTourEnter}
      />
    )
    expect(screen.getByText('1 / 3')).toBeTruthy()
    fireEvent.click(screen.getByLabelText('360° virtual tour — tap to explore'))
    expect(onTourEnter).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog')).toBeNull()

    fireEvent.click(screen.getByLabelText('Photo 2 of 2 — tap to enlarge'))
    const dialog = screen.getByRole('dialog')
    expect(dialog.getAttribute('aria-label')).toBe('Photo 2 enlarged')
    expect(dialog.querySelector('img')?.getAttribute('src')).toBe('https://cdn.test/2.webp')
  })

  it('a photo that fails to load is hidden, leaving the blank background', () => {
    render(<Gallery slides={[photo(1, 'Hero')]} />)
    const img = screen.getByAltText('Hero')
    fireEvent.error(img)
    expect(img.style.visibility).toBe('hidden')
  })
})
