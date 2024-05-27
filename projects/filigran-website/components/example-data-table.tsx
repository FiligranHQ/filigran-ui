'use client'
import {ColumnDef} from '@tanstack/react-table'
import {Checkbox, DataTable} from 'filigran-ui/clients'
import {useState} from 'react'
import {cn} from '@/utils/utils'
import {Input} from 'filigran-ui'

interface Invoices {
  id: string
  invoice: string
  paymentStatus: string
  totalAmount: string
  paymentMethod: string
}
const invoices: Invoices[] = [
  {
    id: 'INV001',
    invoice: 'INV001',
    paymentStatus: 'Paid',
    totalAmount: '$250.00',
    paymentMethod: 'Credit Card',
  },
  {
    id: 'INV002',
    invoice: 'INV002',
    paymentStatus: 'Pending',
    totalAmount: '$150.00',
    paymentMethod: 'PayPal',
  },
  {
    id: 'INV003',
    invoice: 'INV003',
    paymentStatus: 'Unpaid',
    totalAmount: '$350.00',
    paymentMethod: 'Bank Transfer',
  },
  {
    id: 'INV004',
    invoice: 'INV004',
    paymentStatus: 'Paid',
    totalAmount: '$450.00',
    paymentMethod: 'Credit Card',
  },
  {
    id: 'INV005',
    invoice: 'INV005',
    paymentStatus: 'Paid',
    totalAmount: '$550.00',
    paymentMethod: 'PayPal',
  },
  {
    id: 'INV006',
    invoice: 'INV006',
    paymentStatus: 'Pending',
    totalAmount: '$200.00',
    paymentMethod: 'Bank Transfer',
  },
  {
    id: 'INV007',
    invoice: 'INV007',
    paymentStatus: 'Unpaid',
    totalAmount: '$300.00',
    paymentMethod: 'Credit Card',
  },
]

export function ExampleDataTable() {
  const rowSelectionState = useState({})
  const [rowSelection, setRowSelection] = rowSelectionState
  const [inputSearch, setInputSearch] = useState('')
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
  const columns: ColumnDef<Invoices>[] = [
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
      accessorKey: 'invoice',
      id: 'invoice',
      header: 'Invoice',
    },
    {
      accessorKey: 'paymentStatus',
      id: 'paymentStatus',
      header: 'Payment status',
      cell: ({row}) => (
        <HighlightSearchTerm text={row.original.paymentStatus} />
      ),
    },
    {
      accessorKey: 'totalAmount',
      id: 'totalAmount',
      header: 'Total amount',
    },
    {
      accessorKey: 'paymentMethod',
      id: 'paymentMethod',
      header: 'Payment method',
    },
  ]
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
      {/*// @ts-ignore*/}
      <DataTable
        data={invoices}
        columns={columns}
        rowSelectionState={rowSelectionState}
      />
      <div className="container mx-auto py-10">
        <div>Selected</div>
        {JSON.stringify(rowSelection, null, 20)}
      </div>
    </>
  )
}
