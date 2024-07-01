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
  DropdownMenuItem,
} from 'filigran-ui/clients'
import {useMemo, useState} from 'react'
import {Input} from 'filigran-ui'
import {makeData, Person} from '@/utils/makeData'

export function ExampleDataTable() {
  const [rowSelection, setRowSelection] = useState({})
  const [inputSearch, setInputSearch] = useState('')
  const [data, setData] = useState(() => makeData(500))
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 50,
  })

  const columns = useMemo<ColumnDef<Person>[]>(
    () => [
      {
        id: 'select',
        size: 20,
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
        enableHiding: false,
        cell: (info) => (
          <HighlightSearchTerm text={info.getValue() as string} />
        ),
        header: 'First name',
      },
      {
        accessorFn: (row) => row.lastName,
        id: 'lastName',
        enableHiding: false,
        cell: (info) => (
          <HighlightSearchTerm text={info.getValue() as string} />
        ),
        header: (header) => (
          <DataTableOptionsHeader
            column={header.column}
            title={'Last name'}
            menuItems={
              <>
                <DropdownMenuItem onClick={() => console.log(header.column)}>
                  Log column
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
      },
      {
        id: 'visits',
        accessorKey: 'visits',
        header: () => <span className="font-title"> Visits</span>,
      },
      {
        id: 'status',
        accessorKey: 'status',
        header: 'Status',
      },
      {
        id: 'progress',
        accessorKey: 'progress',
        header: 'Profile Progress',
      },
    ],
    [inputSearch]
  )

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
    <>
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
        tableOptions={{
          onRowSelectionChange: setRowSelection,
          getSortedRowModel: getSortedRowModel(),
          getPaginationRowModel: getPaginationRowModel(),
          onPaginationChange: setPagination,
          enableRowSelection: (row) => row.original.age > 18, //only enable row selection for adults
        }}
        tableState={{
          rowSelection,
          pagination,
        }}
        onClickRow={(row) => console.log(row)}
      />
      <div className="container mx-auto py-10">
        <div>Selected</div>
        {JSON.stringify(rowSelection, null, 20)}
      </div>
    </>
  )
}
