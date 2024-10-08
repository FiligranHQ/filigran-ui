import {ModeToggle} from '@/components/mode-toggle'
import {Button} from 'filigran-ui/servers'
import Link from 'next/link'
import Logo from '../public/logo.svg'
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-10 flex h-16 w-full flex-shrink-0 items-center justify-between border-b bg-page-background px-xl shadow-md">
      <div className="h-full p-l">
        <Logo className="h-full w-full" />
      </div>
      <nav>
        <Button
          asChild
          variant="link"
          className="dark:text-white">
          <Link href="/docs">Docs</Link>
        </Button>
      </nav>
      <ModeToggle />
    </header>
  )
}
