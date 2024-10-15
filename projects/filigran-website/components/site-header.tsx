import {ModeToggle} from '@/components/mode-toggle'
import {Button} from 'filigran-ui/servers'
import Link from 'next/link'
import Logo from '../public/logo.svg'
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-10 flex h-16 w-full flex-shrink-0 items-center justify-between border-b bg-page-background px-xl dark:bg-background">
      <div className="h-full p-l">
        <Logo className="h-full w-full" />
      </div>
      <nav>
        <Button
          asChild
          variant="link">
          <Link href="/docs">Docs</Link>
        </Button>
        <Button
          asChild
          variant="link">
          <Link href="/learning">Learning</Link>
        </Button>
      </nav>
      <ModeToggle />
    </header>
  )
}
