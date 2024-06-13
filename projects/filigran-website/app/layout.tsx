import type {Metadata} from 'next'
import 'filigran-ui/theme.css'
import './globals.css'
import {ThemeProvider} from '@/components/providers'
import {SiteHeader} from '@/components/site-header'
import {geologica, ibmPlexSans} from '@/app/font'
import {Toaster} from 'filigran-ui'

export const metadata: Metadata = {
  title: 'Filigran docs',
  description: 'Welcome to Filigran documentation',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`${geologica.variable} ${ibmPlexSans.variable}`}>
      <body className=" flex min-h-screen flex-col dark:bg-gradient-to-br dark:from-[#00020C] dark:from-80% dark:to-[#071578]">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange>
          <SiteHeader />
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
