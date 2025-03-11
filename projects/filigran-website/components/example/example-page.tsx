'use client'

import {DataTableExample, LeftBar} from 'filigran-ui/clients'
import {TopBar} from 'filigran-ui/clients'
import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from 'filigran-ui/servers'
import {Info} from 'filigran-ui/clients'
import {DropdownMenu, DropdownMenuTrigger} from '@radix-ui/react-dropdown-menu'
import {DropdownMenuContent, DropdownMenuItem} from 'filigran-ui/clients'
import {FakeBrowser} from 'filigran-ui/clients/utils'
import {useSearchParams} from 'next/navigation'
import {ExampleSimpleDataTable} from 'filigran-website/components/example/example-simple-data-table'
import {ExampleDataTable} from '@/components/example/example-data-table'
import {useState} from 'react'

export const ExamplePage = ({view}) => {
  const [ref, setRef] = useState<HTMLDivElement>(null)
  return (
    <FakeBrowser>
      <div className="flex h-[60rem] w-full flex-grow flex-row overflow-hidden border-2">
        <LeftBar />
        <div className="flex h-full w-full flex-col overflow-auto pr-2">
          <TopBar />
          <div
            className={'flex w-full flex-col gap-y-[1rem] p-4 pr-0'}
            ref={setRef}>
            <Breadcrumb className={'p-0'}>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink
                    style={{textDecoration: 'none'}}
                    href="#">
                    Home
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbEllipsis className="h-4 w-4" />
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink
                    style={{textDecoration: 'none'}}
                    href="#">
                    Components
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>List</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <Info />
            {view === 'table' ? (
              <DataTableExample ref={ref} />
            ) : (
              <div>Not prepared</div>
            )}
          </div>
        </div>
      </div>
    </FakeBrowser>
  )
}
