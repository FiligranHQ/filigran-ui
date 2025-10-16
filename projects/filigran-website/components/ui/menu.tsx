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
  basePath?: string
  contentMenu: ContentMenu
}

interface MenuItemProps {
  menu: ContentMenu
  basePath: string
  currentPath: string
  level?: number
}

const MenuItem: FunctionComponent<MenuItemProps> = ({
                                                      menu,
                                                      basePath,
                                                      currentPath,
                                                      level = 0,
                                                    }) => {
  const hasChildren = menu.content && menu.content.length > 0
  const isActive = menu.slug && currentPath === menu.slug
  const isParentActive = menu.slug && currentPath.startsWith(menu.slug)

  // Calculate indentation based on level
  const indentClass = level > 0 ? `pl-${Math.min(level * 4, 12)}` : ''

  if (hasChildren) {
    // Check if any child is active to auto-open the accordion
    const hasActiveChild = menu.content.some(child =>
      child.slug && (currentPath === child.slug || currentPath.startsWith(child.slug + '/'))
    )

    return (
      <Accordion
        type="single"
        defaultValue={hasActiveChild || isParentActive ? `item-${menu.title}` : undefined}
        collapsible>
        <AccordionItem value={`item-${menu.title}`} className="border-none">
          <AccordionTrigger
            className={cn(
              'h-9 justify-between px-4 py-2 hover:bg-hover hover:no-underline',
              indentClass,
              (isParentActive || hasActiveChild) &&
              'bg-primary/10 shadow-[inset_2px_0px] shadow-primary'
            )}>
            {menu.title}
          </AccordionTrigger>
          <AccordionContent className="pb-0">
            {menu.slug && (
              <Button
                variant="ghost"
                className={cn(
                  'h-9 w-full justify-start rounded-none normal-case',
                  `pl-${Math.min((level + 1) * 4, 12)}`,
                  isActive && 'bg-primary/10 shadow-[inset_2px_0px] shadow-primary'
                )}
                asChild>
              </Button>
            )}
            {menu.content.map((childMenu) => (
              <MenuItem
                key={childMenu.slug || childMenu.title}
                menu={childMenu}
                basePath={basePath}
                currentPath={currentPath}
                level={level + 1}
              />
            ))}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    )
  }

  return (
    <Button
      variant="ghost"
      className={cn(
        'h-9 w-full justify-start rounded-none normal-case',
        indentClass,
        isActive && 'bg-primary/10 shadow-[inset_2px_0px] shadow-primary'
      )}
      asChild>
      <Link href={`/${basePath}/${menu.slug}`}>{menu.title}</Link>
    </Button>
  )
}

export const Menu: FunctionComponent<MenuProps> = ({
                                                     contentMenu,
                                                     basePath = 'docs',
                                                   }) => {
  const currentPath = usePathname().replace(`/${basePath}/`, '')

  return (
    <aside
      className={cn(
        'mobile:hidden z-9 sticky top-[4rem] flex h-[calc(100vh-4rem)] w-48 flex-shrink-0 flex-col overflow-y-auto overflow-x-hidden border-r bg-page-background py-s duration-300 ease-in-out'
      )}>
      <h2 className="px-s text-xl font-medium leading-9">
        {contentMenu.title}
      </h2>
      <div className="flex flex-col">
        {contentMenu.content.map((menu) => (
          <MenuItem
            key={menu.slug || menu.title}
            menu={menu}
            basePath={basePath}
            currentPath={currentPath}
            level={0}
          />
        ))}
      </div>
    </aside>
  )
}
