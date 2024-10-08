'use client'
import {FunctionComponent} from 'react'
import {ContentMenu} from '@/utils/mdx.util'
import {cn} from '@/utils/utils'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Button,
} from 'filigran-ui'
import Link from 'next/link'
import {usePathname} from 'next/navigation'

interface MenuProps {
  contentMenu: ContentMenu
}

export const Menu: FunctionComponent<MenuProps> = ({contentMenu}) => {
  const currentPath = usePathname().replace('/docs/', '')
  console.log(currentPath)
  return (
    <aside
      className={cn(
        'mobile:hidden z-9 sticky top-[4rem] flex h-[calc(100vh-4rem)] w-48 flex-col overflow-y-auto overflow-x-hidden border-r bg-page-background py-s duration-300 ease-in-out'
      )}>
      <h2 className="px-s text-xl font-medium leading-9">
        {contentMenu.title}
      </h2>
      {contentMenu.content.map((menu) => {
        if (menu?.content?.length > 0) {
          return (
            <Accordion
              type="single"
              key={menu.title}
              collapsible>
              <AccordionItem value={`item-${menu.title}`}>
                <AccordionTrigger
                  className={cn(
                    'h-9 justify-between px-4 py-2 hover:bg-hover hover:no-underline',
                    currentPath.startsWith(menu.title.toLowerCase()) &&
                      'bg-primary/10 shadow-[inset_2px_0px] shadow-primary'
                  )}>
                  {menu.title}
                </AccordionTrigger>
                <AccordionContent>
                  {menu?.content.map((m) => {
                    return (
                      <Button
                        key={m.slug}
                        variant="ghost"
                        className={cn(
                          'h-9 w-full justify-start rounded-none',
                          currentPath === m.slug &&
                            'bg-primary/10 shadow-[inset_2px_0px] shadow-primary'
                        )}
                        asChild>
                        <Link href={`/docs/${m.slug}`}>{m.title}</Link>
                      </Button>
                    )
                  })}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )
        }
        return (
          <Button
            key={menu.slug}
            variant="ghost"
            className={cn(
              'h-9 w-full justify-start rounded-none',
              currentPath === menu.slug &&
                'bg-primary/10 shadow-[inset_2px_0px] shadow-primary'
            )}
            asChild>
            <Link href={`/docs/${menu.slug}`}>{menu.title}</Link>
          </Button>
        )
      })}
    </aside>
  )
}
