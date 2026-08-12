import type { Metadata, Viewport } from 'next'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'
import DebugPanel from '@/components/DebugPanel'

export const metadata: Metadata = {
  title: 'Nature Audio Tour',
  description: "Scan a marker to hear the story of what's around you.",
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Audio Tour',
  },
}

export const viewport: Viewport = {
  themeColor: '#10b981',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className="font-body antialiased">
        {children}
        <Analytics />
        {process.env.NEXT_PUBLIC_DEBUG_ENABLED === 'true' && <DebugPanel />}
      </body>
    </html>
  )
}
