'use client'
import {
  type Cell,
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  type Header,
  type TableOptions,
  type TableState,
  type Table as TableType,
  useReactTable,
  type Column,
  type RowData,
} from '@tanstack/react-table'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './table'
import {
  createContext,
  type ReactNode,
  useContext,
  useImperativeHandle,
  useState,
} from 'react'
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  horizontalListSortingStrategy,
  SortableContext,
  useSortable,
} from '@dnd-kit/sortable'
import {restrictToHorizontalAxis} from '@dnd-kit/modifiers'
import {type Transform} from '@dnd-kit/utilities'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './dropdown-menu'
import {ArrowDownIcon, ArrowUpIcon, EyeOff, GripHorizontal} from 'lucide-react'
import {cn, fixedForwardRef} from '../../lib/utils'
import {Button, Skeleton} from '../servers'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './select'
import {
  ArrowFirstIcon,
  ArrowLastIcon,
  ArrowNextIcon,
  ArrowPreviousIcon,
  KeyboardArrowDownIcon,
  KeyboardArrowUpIcon,
  TableTuneIcon,
  UnfoldMoreIcon,
} from 'filigran-icon'
import type {Arguments} from '@dnd-kit/sortable/dist/hooks/useSortable'

interface DataTableProps<TData extends {id: string}, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  toolbar?: ReactNode
  tableState?: Partial<TableState>
  tableOptions?: Partial<TableOptions<TData>>
  onClickRow?: (row: RowData) => void
  isLoading?: boolean
}

function getTransformString({x, y}: Transform) {
  return `translate(${x}px, ${y}px)`
}

const DefaultToolbar = () => {
  return (
    <div className="flex items-center justify-between gap-2">
      <DataTableRowPerPage />
      <div className="flex items-center gap-2">
        <DataTablePagination />
        <DataTableSelectColumnVisibility />
      </div>
    </div>
  )
}

const DataTableSelectColumnVisibility = <TData,>() => {
  const table = useContext(TableContext)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          aria-label="Manage columns visibility"
          className="box-content h-8 w-8 rounded border">
          <TableTuneIcon className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {table
          .getAllColumns()
          .filter((column) => column.getCanHide())
          .map((column) => (
            <DropdownMenuCheckboxItem
              key={column.id}
              className="capitalize"
              checked={column.getIsVisible()}
              onCheckedChange={(value) => column.toggleVisibility(!!value)}>
              {column.id}
            </DropdownMenuCheckboxItem>
          ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

const DataTableOptionsHeader = <TData, TValue>({
  column,
  menuItems,
  title,
  className,
}: {
  column: Column<TData, TValue>
  menuItems?: ReactNode
  title: string
  className?: string
}) => {
  if (!column.getCanHide() && !column.getCanSort()) {
    return <span className="font-title font-bold"> {title}</span>
  }

  return (
    <div className={className}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3 h-8 data-[state=open]:bg-accent">
            <span className="font-title font-bold"> {title}</span>
            {column.getIsSorted() === 'desc' ? (
              <KeyboardArrowDownIcon className="ml-s h-3 w-3 text-text-secondary" />
            ) : column.getIsSorted() === 'asc' ? (
              <KeyboardArrowUpIcon className="ml-s h-3 w-3 text-text-secondary" />
            ) : (
              <UnfoldMoreIcon className="ml-s h-4 w-4 text-text-secondary" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {column.getCanSort() && (
            <>
              <DropdownMenuItem onClick={() => column.toggleSorting(false)}>
                <ArrowUpIcon className="mr-2 h-4 w-4 text-text-secondary" />
                Asc
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => column.toggleSorting(true)}>
                <ArrowDownIcon className="mr-2 h-4 w-4 text-text-secondary" />
                Desc
              </DropdownMenuItem>
            </>
          )}
          {(menuItems || (column.getCanHide() && column.getCanSort())) && (
            <DropdownMenuSeparator />
          )}

          {column.getCanHide() && (
            <DropdownMenuItem onClick={() => column.toggleVisibility(false)}>
              <EyeOff className="mr-2 h-4 w-4 text-text-secondary" />
              Hide
            </DropdownMenuItem>
          )}
          {menuItems}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
const DraggableTableHeader = <TData, TValue>({
  header,
}: {
  header: Header<TData, TValue>
}) => {
  const {attributes, isDragging, listeners, setNodeRef, transform} =
    useSortable({
      id: header.column.id,
    } as Arguments)

  return (
    <TableHead
      key={header.id}
      colSpan={header.colSpan}
      className={cn(
        'transition-width group relative z-0 whitespace-nowrap opacity-100 transition-transform duration-200 ease-in-out',
        isDragging && 'z-10 bg-gray-150 opacity-80'
      )}
      ref={setNodeRef}
      style={{
        width: header.getSize(),
        transform: transform ? getTransformString(transform) : '',
      }}>
      <div className="flex h-full items-center justify-between">
        {header.isPlaceholder ? null : typeof header.column.columnDef.header ===
          'string' ? (
          <DataTableOptionsHeader
            column={header.column}
            title={header.column.columnDef.header}
          />
        ) : (
          <span className="font-title font-bold">
            {' '}
            {flexRender(header.column.columnDef.header, header.getContext())}
          </span>
        )}

        <button
          className={cn(
            'cursor-grab opacity-0 group-hover:opacity-100',
            isDragging && 'cursor-grabbing'
          )}
          {...attributes}
          {...listeners}>
          <GripHorizontal className="mx-s h-5 w-5" />
        </button>
      </div>
      {header.column.getCanResize() && (
        <div
          onDoubleClick={() => header.column.resetSize()}
          onMouseDown={header.getResizeHandler()}
          onTouchStart={header.getResizeHandler()}
          className={cn(
            `absolute right-0 top-0 h-full w-1 cursor-col-resize select-none bg-gray-700 opacity-0`,
            header.column.getIsResizing() && `bg-primary opacity-100`,
            !isDragging && 'group-hover:opacity-100'
          )}
        />
      )}
    </TableHead>
  )
}

const DragAlongCell = <TData,>({
  cell,
  isLoading,
}: {
  cell: Cell<TData, unknown>
  isLoading?: boolean
}) => {
  const {isDragging, setNodeRef, transform} = useSortable({
    id: cell.column.id,
  } as Arguments)
  return (
    <TableCell
      key={cell.id}
      ref={setNodeRef}
      style={{
        width: cell.column.getSize(),
        transform: transform ? getTransformString(transform) : '',
      }}
      className={cn(
        'transition-width group relative z-0 opacity-100 transition-transform duration-200 ease-in-out',
        isDragging && 'z-10 opacity-80'
      )}>
      {isLoading ? (
        <Skeleton className="h-l w-full" />
      ) : (
        <>{flexRender(cell.column.columnDef.cell, cell.getContext())}</>
      )}
    </TableCell>
  )
}

const DataTableRowPerPage = ({
  rowPerPage = [50, 100, 200, 300, 500],
}: {
  rowPerPage?: number[]
}) => {
  const table = useContext(TableContext)
  return (
    <div className="flex items-center gap-s">
      <p className="text-sub-content">Rows per page</p>
      <Select
        value={`${table.getState().pagination.pageSize}`}
        onValueChange={(value) => {
          table.setPageSize(Number(value))
        }}>
        <div className="box-content flex h-8 rounded border border-border-medium-strong text-sub-content">
          <SelectTrigger className="border-none">
            <SelectValue placeholder={table.getState().pagination.pageSize} />
          </SelectTrigger>
        </div>
        <SelectContent side="top">
          {rowPerPage.map((pageSize) => (
            <SelectItem
              key={pageSize}
              value={`${pageSize}`}>
              {pageSize}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
const DataTablePagination = () => {
  const table = useContext(TableContext)
  const pageIndex = table.getState().pagination.pageIndex
  const pageSize = table.getState().pagination.pageSize
  return (
    <>
      <div className="flex items-center divide-x divide-border-medium-strong rounded border border-border-medium-strong">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-none p-s"
          aria-label="Go to first page"
          onClick={() => table.setPageIndex(0)}
          disabled={!table.getCanPreviousPage()}>
          <ArrowFirstIcon className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-none p-s"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
          aria-label="Go to previous page">
          <ArrowPreviousIcon className="h-3 w-3" />
        </Button>
        <div className="h-8 p-s text-text-secondary text-sub-content">
          Rows{' '}
          <span className="text-foreground">
            {table.getRowCount() > 0 ? pageIndex * pageSize + 1 : 0} to{' '}
            {Math.min((pageIndex + 1) * pageSize, table.getRowCount())}
          </span>{' '}
          / {table.getRowCount()}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-none p-s"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
          aria-label="Go to next page">
          <ArrowNextIcon className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-none p-s"
          onClick={() => table.setPageIndex(table.getPageCount() - 1)}
          disabled={!table.getCanNextPage()}
          aria-label="Go to last page">
          <ArrowLastIcon className="h-3 w-3" />
        </Button>
      </div>
    </>
  )
}

const LoadingRows = <TData,>({table}: {table: TableType<TData>}) => {
  return (
    <>
      {Array(30)
        .fill({})
        .map(() => (
          <LoadingRow table={table} />
        ))}
    </>
  )
}

const LoadingRow = <TData,>({table}: {table: TableType<TData>}) => {
  return (
    <>
      {table.getHeaderGroups().map((headerGroup) => (
        <TableRow
          className={'hover:bg-inherit'}
          key={headerGroup.id}>
          {headerGroup.headers.map(() => (
            <TableCell>
              <Skeleton className="h-l w-full" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  )
}
const TableContext = createContext<TableType<any>>({} as TableType<any>)
function GenericDataTable<TData extends {id: string}, TValue>(
  {
    columns,
    data,
    tableState,
    tableOptions,
    toolbar,
    onClickRow,
    isLoading = false,
  }: DataTableProps<TData, TValue>,
  ref?: any
) {
  const [columnOrder, setColumnOrder] = useState<string[]>(() =>
    columns.map((c) => c.id!)
  )

  const table = useReactTable({
    data,
    columns,
    columnResizeMode: 'onChange',
    getCoreRowModel: getCoreRowModel(),
    onColumnOrderChange: setColumnOrder,
    getRowId: (c) => c.id,
    state: {
      columnOrder,
      ...tableState,
    },
    ...tableOptions,
  })

  useImperativeHandle(ref, () => table)
  const handleDragEnd = (event: DragEndEvent) => {
    const {active, over} = event
    if (active && over && active.id !== over.id) {
      setColumnOrder((columnOrder) => {
        const oldIndex = columnOrder.indexOf(active.id as string)
        const newIndex = columnOrder.indexOf(over.id as string)
        return arrayMove(columnOrder, oldIndex, newIndex) //this is just a splice util
      })
    }
  }

  const sensors = useSensors(
    useSensor(MouseSensor, {}),
    useSensor(TouchSensor, {}),
    useSensor(KeyboardSensor, {})
  )

  return (
    <TableContext.Provider value={{...table}}>
      {toolbar ? <>{toolbar}</> : <DefaultToolbar />}
      <DndContext
        collisionDetection={closestCenter}
        modifiers={[restrictToHorizontalAxis]}
        onDragEnd={handleDragEnd}
        sensors={sensors}>
        <div className="pt-xl">
          <Table style={{width: table.getCenterTotalSize()}}>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow
                  className={'hover:bg-inherit'}
                  key={headerGroup.id}>
                  <SortableContext
                    items={columnOrder}
                    strategy={horizontalListSortingStrategy}>
                    {headerGroup.headers.map((header) => (
                      <DraggableTableHeader
                        key={header.id}
                        header={header}
                      />
                    ))}
                  </SortableContext>
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              <>{isLoading && <LoadingRows table={table} />}</>
              {!isLoading &&
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className={cn(
                      onClickRow ? 'cursor-pointer' : '',
                      !row.getCanSelect() &&
                        'bg-text-foreground/30 cursor-auto opacity-50'
                    )}
                    onClick={() =>
                      onClickRow && row.getCanSelect() ? onClickRow(row) : null
                    }>
                    {row.getVisibleCells().map((cell) => (
                      <SortableContext
                        key={cell.id}
                        items={columnOrder}
                        strategy={horizontalListSortingStrategy}>
                        <DragAlongCell
                          key={cell.id}
                          cell={cell}
                          isLoading={isLoading}
                        />
                      </SortableContext>
                    ))}
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>
      </DndContext>
    </TableContext.Provider>
  )
}

const DataTable = fixedForwardRef(GenericDataTable)

export {
  DataTable,
  DataTablePagination,
  DataTableSelectColumnVisibility,
  DataTableRowPerPage,
  DataTableOptionsHeader,
}
