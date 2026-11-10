import { notFound } from 'next/navigation'

/** The admin tool (pages + API) is dev-only: served only outside production builds. */
export const isAdminEnabled = () => process.env.NODE_ENV !== 'production'

/** For server components / layouts: renders the 404 page in production. */
export function requireAdminPage(): void {
  if (!isAdminEnabled()) notFound()
}

/** For route handlers: a 404 Response in production, null when allowed. */
export function adminGuard(): Response | null {
  return isAdminEnabled() ? null : new Response('Not Found', { status: 404 })
}
