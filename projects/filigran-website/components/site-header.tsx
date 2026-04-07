import {ModeToggle} from '@/components/mode-toggle'
import {Button} from '@filigran/ui/servers'
import Image from 'next/image'
import Link from 'next/link'

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-10 flex h-16 w-full shrink-0 items-center justify-between border-b border-border bg-page-background px-xl dark:bg-background">
      <div className="flex h-full items-center py-l">
        <Image
          src="/logo.svg"
          alt="Filigran"
          width={161}
          height={41}
          className="h-full w-auto dark:invert"
          priority
        />
      </div>
      <nav>
        <Button
          asChild
          variant="link">
          <Link href="/docs">Docs</Link>
        </Button>
      </nav>
      <ModeToggle />
    </header>
  )
}
