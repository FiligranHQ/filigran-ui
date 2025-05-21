import Link from 'next/link'
import {Button, Card, Badge, Callout} from 'filigran-ui/servers'
import {FiligranLoader} from 'filigran-icon'
export default async function Home() {
  return (
    <main className="mx-auto flex max-w-5xl flex-1 py-12">
      <div className="flex w-full flex-col justify-center">
        <section className="mb-20 text-center">
          <h1 className="text-6xl font-bold tracking-tight">
            Filigran Design System
            <div className="bg-gradient-to-r from-[#0FBCFF] to-[#00F1BD] bg-clip-text text-transparent">
              Elegant and Consistent Components
            </div>
          </h1>
          <p className="mt-6 text-lg leading-8">
            A comprehensive library of React components for creating modern, 
            accessible, and consistent user interfaces for Filigran applications.
          </p>
          <div className="mt-10 flex items-center justify-center gap-x-6">
            <Button asChild>
              <Link href="/docs">Explore Components</Link>
            </Button>
            <Button
              asChild
              variant="link">
              <Link href="/docs">
                Documentation <span aria-hidden="true">→</span>
              </Link>
            </Button>
          </div>
        </section>

        <section className="mb-16">
          <h2 className="mb-8 text-center text-3xl font-bold">Core Components</h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Card className="p-6">
              <h3 className="mb-2 text-xl font-semibold">Buttons</h3>
              <p className="mb-4 text-sm text-muted-foreground">
                Different button variants for all user actions.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button variant="default">Default</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="outline">Outline</Button>
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="mb-2 text-xl font-semibold">Badges</h3>
              <p className="mb-4 text-sm text-muted-foreground">
                Visual labels to highlight information.
              </p>
              <div className="flex flex-wrap gap-2">
                <Badge>Default</Badge>
                <Badge variant="secondary">Secondary</Badge>
                <Badge variant="outline">Outline</Badge>
                <Badge variant="destructive">Destructive</Badge>
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="mb-2 text-xl font-semibold">Callouts</h3>
              <p className="mb-4 text-sm text-muted-foreground">
                Information, warning, or error messages.
              </p>
              <Callout className="mb-2">
                Important information for the user
              </Callout>
            </Card>

            <Card className="p-6">
              <h3 className="mb-2 text-xl font-semibold">Loader</h3>
              <p className="mb-4 text-sm text-muted-foreground">
                Animated loading indicator.
              </p>
              <div className="flex justify-center">
                <FiligranLoader className="h-12 w-12" />
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="mb-2 text-xl font-semibold">Inputs</h3>
              <p className="mb-4 text-sm text-muted-foreground">
                Input fields with different options.
              </p>
              <div className="space-y-2">
                <input
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                  placeholder="Enter text..."
                />
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="mb-2 text-xl font-semibold">Cards</h3>
              <p className="mb-4 text-sm text-muted-foreground">
                Containers to organize content.
              </p>
              <div className="rounded-md border border-border p-3 text-sm">
                Example content in a card
              </div>
            </Card>
          </div>
        </section>

        <section className="mb-16">
          <h2 className="mb-6 text-center text-3xl font-bold">Why Use Our Design System?</h2>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 rounded-full bg-primary/10 p-3">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"></path><path d="m9 12 2 2 4-4"></path></svg>
              </div>
              <h3 className="mb-2 text-xl font-semibold">Consistency</h3>
              <p className="text-muted-foreground">
                Ensures a consistent user experience across all Filigran applications.
              </p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 rounded-full bg-primary/10 p-3">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle></svg>
              </div>
              <h3 className="mb-2 text-xl font-semibold">Efficiency</h3>
              <p className="text-muted-foreground">
                Speeds up development by providing ready-to-use, tested components.
              </p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 rounded-full bg-primary/10 p-3">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary"><path d="M2 9V5c0-1.1.9-2 2-2h3.93a2 2 0 0 1 1.66.9l.82 1.2a2 2 0 0 0 1.66.9H20a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-1"></path><path d="M2 13h10"></path><path d="m9 16 3-3-3-3"></path></svg>
              </div>
              <h3 className="mb-2 text-xl font-semibold">Adaptability</h3>
              <p className="text-muted-foreground">
                Customizable components that adapt to different contexts and needs.
              </p>
            </div>
          </div>
        </section>

        <section className="text-center">
          <h2 className="mb-6 text-3xl font-bold">Get Started Now</h2>
          <p className="mb-8 text-lg text-muted-foreground">
            Easily integrate our Design System into your projects
          </p>
          <div className="mx-auto max-w-lg rounded-md bg-muted p-4 text-left">
            <code className="text-sm">npm install filigran-ui</code>
          </div>
        </section>
      </div>
    </main>
  )
}
