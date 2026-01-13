import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Date Palm Farm Management System',
  description: 'Comprehensive management system for date palm farms with inventory tracking, distributor management, order processing, and commission calculations.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="he" dir="rtl">
      <body className="antialiased">
        {children}
      </body>
    </html>
  )
}
