'use client'

import { DataTableExample, LeftBar } from 'filigran-ui/clients';
import { TopBar } from 'filigran-ui/clients';
import { Breadcrumb, BreadcrumbEllipsis, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from 'filigran-ui/servers';
import { Info } from 'filigran-ui/clients';
import { DropdownMenu, DropdownMenuTrigger } from '@radix-ui/react-dropdown-menu';
import { DropdownMenuContent, DropdownMenuItem } from 'filigran-ui/clients';
import { FakeBrowser } from 'filigran-ui/clients/utils';
import { useSearchParams } from 'next/navigation'
import { ExampleSimpleDataTable } from 'filigran-website/components/example/example-simple-data-table';
import { ExampleDataTable } from '@/components/example/example-data-table';
import { useState } from 'react';

export const ExamplePage = ({ view }) => {
  const [ref, setRef] = useState<HTMLDivElement>(null);
  return (
    <FakeBrowser>
      <div className="flex flex-row flex-grow overflow-hidden border-2 h-[60rem] w-full">
        <LeftBar />
        <div className="flex flex-col w-full h-full overflow-auto pr-2">
          <TopBar />
          <div
            className={'w-full p-4 gap-y-[1rem] flex flex-col pr-0'}
            ref={setRef}
          >
            <Breadcrumb className={'p-0'}>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink style={{ textDecoration: 'none' }} href="#">Home</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbEllipsis className="h-4 w-4" />
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink style={{ textDecoration: 'none' }} href="#">Components</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>List</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <Info />
            {view ==="table" ? <DataTableExample ref={ref} /> : <div>Not prepared</div>}
          </div>
        </div>
      </div>
    </FakeBrowser>
  );
}