import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

let pathname = '/'
vi.mock('next/navigation', () => ({ usePathname: () => pathname }))
vi.mock('@/components/onboarding/AppGate', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="gate">{children}</div>,
}))

import RouteGate from '@/components/onboarding/RouteGate'

describe('RouteGate', () => {
  it.each(['/', '/s/12', '/exhibit/3', '/administrator'])('wraps %s in the visitor gate', (p) => {
    pathname = p
    render(<RouteGate>app</RouteGate>)
    expect(screen.getByTestId('gate')).toHaveTextContent('app')
  })

  it.each(['/admin', '/admin/foo'])('renders %s without the gate', (p) => {
    pathname = p
    render(<RouteGate>app</RouteGate>)
    expect(screen.queryByTestId('gate')).toBeNull()
    expect(screen.getByText('app')).toBeInTheDocument()
  })
})
