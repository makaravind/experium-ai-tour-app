import { describe, it, expect, afterEach, vi } from 'vitest'
import { adminGuard, isAdminEnabled, requireAdminPage } from '@/lib/admin/guard'

afterEach(() => vi.unstubAllEnvs())

describe('admin guard', () => {
  it('returns a 404 Response in production', () => {
    vi.stubEnv('NODE_ENV', 'production')
    expect(isAdminEnabled()).toBe(false)
    expect(adminGuard()?.status).toBe(404)
  })

  it('page guard calls notFound() in production', () => {
    vi.stubEnv('NODE_ENV', 'production')
    expect(() => requireAdminPage()).toThrow()
  })

  it('passes in development', () => {
    vi.stubEnv('NODE_ENV', 'development')
    expect(isAdminEnabled()).toBe(true)
    expect(adminGuard()).toBeNull()
    expect(() => requireAdminPage()).not.toThrow()
  })
})
