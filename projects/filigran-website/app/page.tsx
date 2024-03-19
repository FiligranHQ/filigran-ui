import Link from 'next/link'
import {Button} from 'filigran-tsup/button'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from 'filigran-tsup/accordion'
export default async function Home() {
  return (
    <main className="prose mx-auto flex max-w-4xl flex-1 dark:prose-invert">
      <div className="flex flex-col justify-center text-center">
        <h1 className="text-8xl font-bold tracking-tight">
          Uncover threats.
          <div className="bg-gradient-to-r from-[#0FBCFF] to-[#00F1BD] bg-clip-text text-transparent">
            Take action.
          </div>
        </h1>
        <p className="mt-6 text-lg leading-8">
          Discover our{' '}
          <strong>eXtended Threat Management (XTM) portfolio</strong>, providing
          threat intelligence, adversary simulation and crisis reponse open
          solutions to thousands of cybersecurity and crisis management teams
          across the world
        </p>
        <div className="mt-10 flex items-center justify-center gap-x-6">
          <Button asChild>
            <Link href="#">Try live demo</Link>
          </Button>
          <Button
            asChild
            variant="link">
            <Link href="#">
              Book a demo <span aria-hidden="true">→</span>
            </Link>
          </Button>
        </div>
      </div>

      <Accordion type="single" collapsible className="w-full">
      <AccordionItem value="item-1">
      <AccordionTrigger>Is it accessible?</AccordionTrigger>
      <AccordionContent>
      Yes. It adheres to the WAI-ARIA design pattern.
      </AccordionContent>
      </AccordionItem>
      <AccordionItem value="item-2">
      <AccordionTrigger>Is it styled?</AccordionTrigger>
      <AccordionContent>
      Yes. It comes with default styles that matches the other
      components&apos; aesthetic.
      </AccordionContent>
      </AccordionItem>
      <AccordionItem value="item-3">
      <AccordionTrigger>Is it animated?</AccordionTrigger>
      <AccordionContent>
      Yes. It&apos;s animated by default, but you can disable it if you
      prefer.
      </AccordionContent>
      </AccordionItem>
      </Accordion>

    </main>
  )
}
