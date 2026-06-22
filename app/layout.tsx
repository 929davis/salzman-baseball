import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Salzman Baseball',
  description: 'Pitcher Training Dashboard',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className} style={{margin:0,padding:0,background:'#0d1117'}}>
        {children}
      </body>
    </html>
  )
}
