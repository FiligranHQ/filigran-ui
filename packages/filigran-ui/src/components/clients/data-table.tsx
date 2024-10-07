'use client'
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
import {restrictToHorizontalAxis} from '@dnd-kit/modifiers'
import {
  arrayMove,
  horizontalListSortingStrategy,
  SortableContext,
  useSortable,
} from '@dnd-kit/sortable'
import type {Arguments} from '@dnd-kit/sortable/dist/hooks/useSortable'
import {type Transform} from '@dnd-kit/utilities'
import {
  type Cell,
  type Column,
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  type Header,
  type Row,
  type TableOptions,
  type TableState,
  type Table as TableType,
  useReactTable,
} from '@tanstack/react-table'
import {
  ArrowNextIcon,
  ArrowPreviousIcon,
  KeyboardArrowDownIcon,
  KeyboardArrowUpIcon,
  TableTuneIcon,
  UnfoldMoreIcon,
} from 'filigran-icon'
import {ArrowDownIcon, ArrowUpIcon, EyeOff, GripHorizontal} from 'lucide-react'
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useImperativeHandle,
  useState,
} from 'react'
import {cn, fixedForwardRef} from '../../lib/utils'
import {Button, Skeleton} from '../servers'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from './dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './table'

interface DataTableProps<TData extends {id: string}, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  toolbar?: ReactNode
  tableState?: Partial<TableState>
  tableOptions?: Partial<TableOptions<TData>>
  onClickRow?: (row: Row<TData>) => void
  isLoading?: boolean
  i18nKey?: Partial<DatatableI18nKey>
  onResetTable?: () => void
}

interface DatatableI18nKey {
  'Rows per page': string
  'Manage columns visibility': string
  Asc: string
  Desc: string
  Hide: string
  'Go to first page': string
  'Go to previous page': string
  'Go to next page': string
  'Go to last page': string
  Columns: string
}
const defaultI18nKey: DatatableI18nKey = {
  'Rows per page': 'Rows per page',
  'Manage columns visibility': 'Manage columns visibility',
  Asc: 'Asc',
  Desc: 'Desc',
  Hide: 'Hide',
  'Go to first page': 'Go to first page',
  'Go to previous page': 'Go to previous page',
  'Go to next page': 'Go to next page',
  'Go to last page': 'Go to last page',
  Columns: 'Columns',
}

interface TableContextProps<TData> {
  table: TableType<TData>
  t_i18n: (key: string) => string
  onResetTable?: () => void
}

const TableContext = createContext<TableContextProps<any>>({
  table: {} as TableType<any>,
  t_i18n: (key) => key,
  onResetTable: () => {},
})

function getTransformString({x, y}: Transform) {
  return `translate(${x}px, ${y}px)`
}

const DefaultToolbar = () => {
  return (
    <div className="flex items-center justify-end">
      <DataTableHeadBarOptions />
    </div>
  )
}

const DataTableSelectColumnVisibility = <TData,>() => {
  const {table, t_i18n, onResetTable} = useContext(TableContext)

  const onClickResetTable = useCallback(() => {
    table.reset()
    if (onResetTable) {
      onResetTable()
    }
  }, [])

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-none"
          aria-label={t_i18n('Manage columns visibility')}>
          <TableTuneIcon className="h-[1.125rem] w-[1.125rem]" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onClickResetTable()}>
          Reset table
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>{t_i18n('Columns')}</DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent>
              {table
                .getAllColumns()
                .filter((column) => column.getCanHide())
                .map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    className="capitalize"
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) =>
                      column.toggleVisibility(!!value)
                    }>
                    {column.id}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            {t_i18n('Rows per page')}
          </DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent>
              <DropdownMenuRadioGroup
                value={String(table.getState().pagination.pageSize)}
                onValueChange={(pageSize) =>
                  table.setPageSize(Number(pageSize))
                }>
                {[50, 100, 200, 300, 500].map((pageSize) => (
                  <DropdownMenuRadioItem value={String(pageSize)}>
                    {pageSize}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>
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
  const {t_i18n} = useContext(TableContext)
  if (!column.getCanHide() && !column.getCanSort()) {
    return <span className="txt-category"> {title}</span>
  }

  return (
    <div className={className}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="data-[state=open]:bg-accent -ml-3 h-8">
            <span className="txt-category"> {title}</span>
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
                {t_i18n('Asc')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => column.toggleSorting(true)}>
                <ArrowDownIcon className="mr-2 h-4 w-4 text-text-secondary" />
                {t_i18n('Desc')}
              </DropdownMenuItem>
            </>
          )}
          {(menuItems || (column.getCanHide() && column.getCanSort())) && (
            <DropdownMenuSeparator />
          )}

          {column.getCanHide() && (
            <DropdownMenuItem onClick={() => column.toggleVisibility(false)}>
              <EyeOff className="mr-2 h-4 w-4 text-text-secondary" />
              {t_i18n('Hide')}
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
        isDragging && 'z-10 bg-text-secondary/50 opacity-80'
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
          <span className="txt-category">
            {' '}
            {flexRender(header.column.columnDef.header, header.getContext())}
          </span>
        )}

        {!header.column.getIsPinned() && (
          <button
            className={cn(
              'cursor-grab opacity-0 focus:opacity-100 group-hover:opacity-100',
              isDragging && 'cursor-grabbing'
            )}
            {...attributes}
            {...listeners}>
            <GripHorizontal className="mx-s h-5 w-5" />
          </button>
        )}
      </div>
      {header.column.getCanResize() && (
        <div
          onDoubleClick={() => header.column.resetSize()}
          onMouseDown={header.getResizeHandler()}
          onTouchStart={header.getResizeHandler()}
          className={cn(
            `absolute right-0 top-0 h-full w-1 cursor-col-resize select-none bg-text-secondary opacity-0`,
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
      <>{flexRender(cell.column.columnDef.cell, cell.getContext())}</>
    </TableCell>
  )
}

const DataTableHeadBarOptions = () => {
  const {table, t_i18n} = useContext(TableContext)
  const pageIndex = table.getState().pagination.pageIndex
  const pageSize = table.getState().pagination.pageSize
  return (
    <>
      <div className="flex-0 flex-shrink-0 box-border flex h-9 items-center rounded border border-border-light">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-none"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
          aria-label={t_i18n('Go to previous page')}>
          <ArrowPreviousIcon className="h-3 w-3" />
        </Button>
        <div className="px-s leading-none text-text-secondary txt-sub-content">
          <span className="text-foreground">
            {table.getRowCount() > 0 ? pageIndex * pageSize + 1 : 0}
            {' - '}
            {Math.min((pageIndex + 1) * pageSize, table.getRowCount())}
          </span>{' '}
          / {table.getRowCount()}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-none"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
          aria-label={t_i18n('Go to next page')}>
          <ArrowNextIcon className="h-3 w-3" />
        </Button>

        <DataTableSelectColumnVisibility />
      </div>
    </>
  )
}

const LoadingRows = <TData,>({table}: {table: TableType<TData>}) => {
  return (
    <>
      {Array(30)
        .fill({})
        .map((_, index) => (
          <LoadingRow
            key={index}
            table={table}
          />
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
          {headerGroup.headers.map((_, index) => (
            <TableCell key={index}>
              <Skeleton className="h-l w-full" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  )
}

function GenericDataTable<TData extends {id: string}, TValue>(
  {
    columns,
    data,
    tableState,
    tableOptions,
    toolbar,
    onClickRow,
    isLoading = false,
    i18nKey,
    onResetTable,
  }: DataTableProps<TData, TValue>,
  ref?: any
) {
  const [columnOrder, setColumnOrder] = useState<string[]>(() =>
    columns.map((c) => c.id!)
  )

  const t_i18n = (key: string): string => {
    const mergeI18n: {[index: string]: string} = {...defaultI18nKey, ...i18nKey}
    return mergeI18n[key] || key
  }
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
      table.setColumnOrder((columnOrder) => {
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
    <TableContext.Provider value={{table, t_i18n, onResetTable}}>
      {toolbar ? <>{toolbar}</> : <DefaultToolbar />}
      <DndContext
        collisionDetection={closestCenter}
        modifiers={[restrictToHorizontalAxis]}
        onDragEnd={handleDragEnd}
        sensors={sensors}>
        {/* do not remove twp, the class is used to isolate preflight style */}
        <div className="twp pt-l sm:pt-xl">
          <Table style={{width: table.getCenterTotalSize()}}>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow
                  className={'hover:bg-inherit'}
                  key={headerGroup.id}>
                  <SortableContext
                    items={table.getState().columnOrder}
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
                      'hover:bg-hover',
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
                        items={table.getState().columnOrder}
                        strategy={horizontalListSortingStrategy}>
                        <DragAlongCell
                          key={cell.id}
                          cell={cell}
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
  DataTableHeadBarOptions,
  DataTableOptionsHeader,
  type DatatableI18nKey,
}
