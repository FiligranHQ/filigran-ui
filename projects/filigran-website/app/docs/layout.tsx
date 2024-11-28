import type {Metadata} from 'next'
import {getContentMenu} from '@/utils/mdx.util'
import {Menu} from '@/components/ui/menu'

export const metadata: Metadata = {
  title: 'Filigran docs',
  description: 'Welcome to Filigran documentation',
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const contentMenu = await getContentMenu()
  return (
    <main className="flex max-w-full">
      <Menu contentMenu={contentMenu} />
      <div className="prose prose-sm max-w-none flex-1 overflow-auto dark:prose-invert">
        {children}
      </div>
    </main>
  )
}
