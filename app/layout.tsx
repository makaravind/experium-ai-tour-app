import type { Metadata, Viewport } from 'next'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'
import DebugPanel from '@/components/DebugPanel'
import ErrorTracker from '@/components/ErrorTracker'
import AppGate from '@/components/onboarding/AppGate'
import ScanQueueSync from '@/components/ScanQueueSync'
import { SerwistProvider } from '@serwist/next/react'

export const metadata: Metadata = {
  title: 'Experium Virtual Tour',
  description: "Scan a marker to hear the story of what's around you.",
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Experium',
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f8f7f4' },
    { media: '(prefers-color-scheme: dark)', color: '#1a1a1a' },
  ],
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className="font-body antialiased">
        <SerwistProvider swUrl="/sw.js" register cacheOnNavigation={false} reloadOnOnline={false}>
          <ScanQueueSync />
          <AppGate>{children}</AppGate>
        </SerwistProvider>
        <Analytics />
        <ErrorTracker />
        {process.env.NEXT_PUBLIC_DEBUG_ENABLED === 'true' && <DebugPanel />}
      </body>
    </html>
  )
}
