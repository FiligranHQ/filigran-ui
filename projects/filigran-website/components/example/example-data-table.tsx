'use client'
import {
  getPaginationRowModel,
  getSortedRowModel,
  PaginationState,
} from '@tanstack/react-table'
import {
  Checkbox, ColumnDefWithOptionsHeader,
  DataTable,
  DatatableI18nKey,
  DataTableOptionsHeader,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@filigran/ui/clients'
import {useEffect, useMemo, useState} from 'react'
import {Button, Input} from '@filigran/ui'
import {makeData, Person} from '@/utils/makeData'
import {useLocalStorage} from 'usehooks-ts'
import {MoreVertIcon} from '@filigran/icon'

const HighlightSearchTerm = ({inputSearch, text}: {inputSearch: string, text: string}) => {
  if (!inputSearch) {
    return <span>{text}</span>
  }

  // Split the text into parts based on the search term
  const parts = text.split(new RegExp(`(${inputSearch})`, 'gi'))

  return (
    <span>
        {parts.map((part, index) =>
          part.toLowerCase() === inputSearch.toLowerCase() ? (
            <span
              key={index}
              className={'bg-red text-white'}>
              {part}
            </span>
          ) : (
            part
          )
        )}
      </span>
  )
}

export function ExampleDataTable() {
  const [rowSelection, setRowSelection] = useState({})
  const [inputSearch, setInputSearch] = useState('')
  const [data, setData] = useState(() => makeData(500, 'person'))
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 50,
  })
  const [isCheckedI18n, setIsCheckedI18n] = useState(false)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false)
    }, 360)
    setLoading(true)
    // Cleanup the timer when the component unmounts
    return () => clearTimeout(timer)
  }, [pagination])

  const frenchI18nKey: Partial<DatatableI18nKey> = {
    'Rows per page': 'Lignes par page',
    'Manage columns visibility': 'Gérer la visibilité des colonnes',
    Asc: 'Ascendant',
    Desc: 'Descendant',
    Hide: 'Cacher',
    'Go to first page': 'Aller à la première page',
    'Go to previous page': 'Aller à la page précédente',
    'Go to next page': 'Aller à la page suivante',
    'Go to last page': 'Aller à la dernière page',
    Columns: 'Colonnes',
    'Reset table': 'Reinitialiser',
  }
  const columns = useMemo<ColumnDefWithOptionsHeader<Person, unknown>[]>(
    () => [
      {
        id: 'select',
        size: 40,
        header: ({table}) => (
          <Checkbox
            className="flex"
            checked={
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() && 'indeterminate')
            }
            onCheckedChange={(value) =>
              table.toggleAllPageRowsSelected(!!value)
            }
            aria-label="Select all"
          />
        ),
        cell: ({row}) => (
          <Checkbox
            className="flex"
            checked={row.getIsSelected()}
            onClick={(e) => e.stopPropagation()}
            onCheckedChange={(value) => {
              row.toggleSelected(!!value)
            }}
            aria-label="Select row"
          />
        ),
        enableSorting: false,
        enableHiding: false,
        enableResizing: false,
      },
      {
        id: 'firstName',
        accessorKey: 'firstName',
        enableHiding: true,
        enableSorting: false,
        cell: (info) => (
          <HighlightSearchTerm inputSearch={inputSearch} text={info.getValue() as string} />
        ),
        header: 'First name',
      },
      {
        id: 'lastName',
        accessorKey: 'lastName',
        enableHiding: false,
        cell: (info) => (
          <HighlightSearchTerm inputSearch={inputSearch} text={info.getValue() as string} />
        ),
        optionsHeader: (header) => (
          <DataTableOptionsHeader
            column={header.column}
            menuItems={
              <>
                <DropdownMenuItem onClick={() => console.log(header.column)}>
                  Log column
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => console.log(header.column)}>
                  Log column 2
                </DropdownMenuItem>
              </>
            }
          />
        ),
      },
      {
        id: 'age',
        accessorKey: 'age',
        header: 'Age',
        size: 200,
      },
      {
        id: 'visits',
        accessorKey: 'visits',
        size: 200,
        header: () => <span className="font-title txt-category"> Visits</span>,
      },
      {
        id: 'status',
        accessorKey: 'status',
        header: 'Status',
        size: 150,
      },
      {
        id: 'description',
        accessorKey: 'description',
        header: 'Description',
        size: 300,
        cell: ({row}) => (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger className={'w-full truncate text-left'}>
                {row.original.description}
              </TooltipTrigger>
              <TooltipContent>
                <p>{row.original.description}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ),
      },
      {
        id: 'progress',
        accessorKey: 'progress',
        header: 'Profile Progress',
      },
      {
        id: 'actions',
        enableHiding: false,
        enableResizing: false,
        size: -1,
        cell: () => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <div className="flex items-center justify-end">
                <Button
                  variant="ghost"
                  size="icon">
                  <MoreVertIcon className="h-4 w-4" />
                </Button>
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-[160px]">
              <DropdownMenuItem>Item 1</DropdownMenuItem>
              <DropdownMenuItem>Item 2</DropdownMenuItem>
              <DropdownMenuItem>Item 3</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [inputSearch]
  )

  const [columnOrder, setColumnOrder, removeColumnOrder] = useLocalStorage(
    'example-datatable-ordering-columns',
    columns.map((c) => c.id!)
  )
  const onResetTable = () => {
    console.log('Reset table')
    removeColumnOrder()
  }
  return (
    <div className="not-prose">
      <div className="flex items-center gap-xs p-xs">
        <Checkbox
          checked={isCheckedI18n}
          onCheckedChange={() => setIsCheckedI18n(!isCheckedI18n)}
          aria-label="Translate to French"
        />
        Translate in French
      </div>
      <div className="py-4">
        <Input
          placeholder="underline text"
          onChange={(e) => setInputSearch(e.target.value)}
          value={inputSearch}
          className="w-[200px] border-primary p-4"
        />
      </div>

      <DataTable
        data={data}
        columns={columns}
        isLoading={loading}
        i18nKey={isCheckedI18n ? frenchI18nKey : {}}
        tableOptions={{
          onRowSelectionChange: setRowSelection,
          getSortedRowModel: getSortedRowModel(),
          getPaginationRowModel: getPaginationRowModel(),
          onPaginationChange: setPagination,
          enableRowSelection: (row) => row.original.age > 18, //only enable row selection for adults
          onColumnOrderChange: setColumnOrder,
        }}
        onResetTable={onResetTable}
        tableState={{
          rowSelection,
          pagination,
          columnOrder,
          columnPinning: {
            left: ['select'],
            right: ['actions'],
          },
        }}
        onClickRow={(row) => console.log(row)}
      />

      <div className="container mx-auto py-10">
        <div>Selected</div>
        {JSON.stringify(rowSelection, null, 20)}
      </div>
    </div>
  )
}
