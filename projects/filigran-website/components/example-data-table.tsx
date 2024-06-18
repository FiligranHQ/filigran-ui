'use client'
import {ColumnDef, getPaginationRowModel, PaginationState} from '@tanstack/react-table'
import {Checkbox, DataTable} from 'filigran-ui/clients'
import {useMemo, useState} from 'react'
import {Input} from 'filigran-ui'
import {makeData, Person} from '@/utils/makeData'


export function ExampleDataTable() {
  const [rowSelection, setRowSelection] = useState({});
  const [inputSearch, setInputSearch] = useState('');
  const [data, setData] = useState(() => makeData(500));
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  })

  const columns = useMemo<ColumnDef<Person>[]>(
    () => [
      {
        id: 'select',
        size: 20,
        header: ({table}) => (
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() && 'indeterminate')
            }
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
            aria-label="Select all"
          />
        ),
        cell: ({row}) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
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
        cell: (info) => (
          <HighlightSearchTerm text={info.getValue() as string} />
        ),
        header:  'First name',
      },
      {
        accessorFn: row => row.lastName,
        id: 'lastName',
        cell: (info) => (
          <HighlightSearchTerm text={info.getValue() as string} />
        ),
        header: () => <span>Last Name</span>,

      },
      {
        id: 'age',
        accessorKey: 'age',
        header: () => 'Age',
      },
      {
        id: 'visits',
        accessorKey: 'visits',
        header: () => <span>Visits</span>,
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
      <div>
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
          getPaginationRowModel: getPaginationRowModel(),
          onPaginationChange: setPagination,
        }}
        tableState={{
          rowSelection,
          pagination
      }}
      />
      <div className="container mx-auto py-10">
        <div>Selected</div>
        {JSON.stringify(rowSelection, null, 20)}
      </div>
    </>
  )
}
