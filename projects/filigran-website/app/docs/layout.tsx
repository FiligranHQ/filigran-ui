import type {Metadata} from 'next'
import Link from 'next/link'
import {getContentMenu} from '@/utils/mdx.util'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from 'filigran-ui/clients'

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
    <main className=" flex max-w-full p-4">
      <aside className="fixed z-10 flex  w-[250px] flex-col px-2">
        <h2 className="text-xl font-medium">{contentMenu.title}</h2>
        {contentMenu.content.map((menu) => {
          if (menu?.content?.length > 0) {
            return (
              <Accordion
                type="single"
                key={menu.title}
                collapsible>
                <AccordionItem value={`item-${menu.title}`}>
                  <AccordionTrigger className="mx-0">
                    {menu.title}
                  </AccordionTrigger>
                  <AccordionContent>
                    {menu?.content.map((m) => {
                      return (
                        <Link
                          key={m.slug}
                          className="my-2 flex flex-col space-y-1"
                          href={`/docs/${m.slug}`}>
                          {m.title}
                        </Link>
                      )
                    })}
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            )
          }
          return (
            <Link
              key={menu.slug}
              className="my-2 flex flex-col space-y-1"
              href={`/docs/${menu.slug}`}>
              {menu.title}
            </Link>
          )
        })}
      </aside>
      <div className="prose dark:prose-invert ml-[250px] max-w-none flex-1 overflow-auto">
        {children}
      </div>
    </main>
  )
}
