'use client'
import {
  ColumnDef,
  getPaginationRowModel,
  getSortedRowModel,
  PaginationState,
} from '@tanstack/react-table'
import {
  Checkbox,
  DataTable,
  DataTableOptionsHeader,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  SearchInput,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from 'filigran-ui/clients'
import {useEffect, useMemo, useState} from 'react'
import {Button, Input} from 'filigran-ui'
import {makeData, Person} from '@/utils/makeData'
import {useLocalStorage} from 'usehooks-ts'
import {MoreVertIcon, SearchIcon} from 'filigran-icon'
import {Badge} from 'filigran-ui/servers'

export function ExampleSimpleDataTable() {
  const [rowSelection, setRowSelection] = useState({})
  const [inputSearch, setInputSearch] = useState('')
  const [data, setData] = useState(() => makeData(100, 'report'))
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 50,
  })
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false)
    }, 360)
    setLoading(true)
    // Cleanup the timer when the component unmounts
    return () => clearTimeout(timer)
  }, [pagination])

  const colors = [
    '#8F8F8F',
    '#DE4C8A',
    '#C2B078',
    '#CB9CF2',
    '#497E76',
    '#9B111E',
  ]

  const columns = useMemo<ColumnDef<Report>[]>(
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
        id: 'type',
        accessorKey: 'type',
        enableHiding: true,
        enableSorting: false,
        cell: ({row, getValue}) => (
          <Badge
            style={{
              color:
                colors[
                  ['Incident', 'Report', 'Vulnerability'].indexOf(
                    row.original.type
                  ) + 3
                ],
            }}>
            {getValue().toUpperCase()}
          </Badge>
        ),
        header: 'Type',
      },
      {
        accessorFn: (row) => row.name,
        id: 'name',
        enableHiding: false,
        cell: (info) => (
          <HighlightSearchTerm text={info.getValue() as string} />
        ),
        header: (header) => (
          <DataTableOptionsHeader
            column={header.column}
            title={'Name'}
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
        id: 'author',
        accessorKey: 'author',
        header: 'Author',
        size: 200,
      },
      {
        id: 'creator',
        accessorKey: 'creator',
        size: 200,
        header: 'Creator',
      },
      {
        id: 'status',
        accessorKey: 'status',
        header: 'Status',
        size: 200,
        cell: ({row}) => (
          <Badge
            style={{
              color:
                colors[
                  ['in progress', 'not started', 'done'].indexOf(
                    row.original.status
                  )
                ],
            }}>
            {row.original.status.toUpperCase()}
          </Badge>
        ),
      },
      {
        id: 'description',
        accessorKey: 'description',
        header: 'Description',
        size: 400,
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
        id: 'date',
        accessorKey: 'date',
        header: 'Date',
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
  const HighlightSearchTerm = ({text}: {text: string}) => {
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
  return (
    <DataTable
      data={data}
      columns={columns}
      isLoading={loading}
      tableOptions={{
        onRowSelectionChange: setRowSelection,
        getSortedRowModel: getSortedRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        onPaginationChange: setPagination,
        enableRowSelection: (row) => row.original.status !== 'in progress', //only enable row selection for adults
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
  )
}
