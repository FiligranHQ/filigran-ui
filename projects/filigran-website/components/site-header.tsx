import {ModeToggle} from '@/components/mode-toggle'
import {Button} from '@/components/ui/button'
import Link from 'next/link'
import Logo from '../public/logo.svg'
export function SiteHeader() {
  return (
    <header className="supports-backdrop-blur:bg-white/95 sticky top-0 z-40 z-50 w-full flex-none border-b border-slate-900/10 bg-white backdrop-blur transition-colors duration-500 dark:border-slate-50/[0.06] dark:bg-slate-900/75">
      <div className="mx-auto flex h-16 max-w-4xl items-center justify-between py-2">
        <div className="h-full pr-2">
          <Logo className="h-full w-full" />
        </div>
        <nav>
          <Button
            asChild
            variant="link"
            className="dark:text-white">
            <Link href="/docs/button">Docs button</Link>
          </Button>
          <Button
            asChild
            variant="link"
            className="dark:text-white">
            <Link href="/mdx">Mdx</Link>
          </Button>
        </nav>
        <ModeToggle />
      </div>
    </header>
  )
}
