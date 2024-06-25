'use client';
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
  type Row, type Column,
} from '@tanstack/react-table'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './table';
import {createContext, type ReactNode, useContext, useImperativeHandle, useState} from 'react'
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  horizontalListSortingStrategy,
  SortableContext,
  useSortable,
} from '@dnd-kit/sortable';
import { restrictToHorizontalAxis } from '@dnd-kit/modifiers';
import { type Transform } from '@dnd-kit/utilities';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './dropdown-menu'
import {
  ArrowDownIcon, ArrowUpIcon,
   EyeOff,
  GripHorizontal,
} from 'lucide-react'
import {cn, fixedForwardRef} from '../../lib/utils'
import { Button } from "../servers";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from './select'
import {
  ArrowFirstIcon,
  ArrowLastIcon,
  ArrowNextIcon,
  ArrowPreviousIcon, KeyboardArrowDownIcon, KeyboardArrowUpIcon,
  TableTuneIcon,
  UnfoldMoreIcon,
} from 'filigran-icon'

interface DataTableProps<TData extends { id: string }, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  toolbar?: ReactNode;
  tableState?: Partial<TableState>;
  tableOptions?: Partial<TableOptions<TData>>;
  onClickRow?: (row: Row<TData>) => void;
}

function getTransformString({ x, y }: Transform) {
  return `translate(${x}px, ${y}px)`;
}

const DefaultToolbar = () => {

  return <div className="flex justify-between items-center gap-2">
    <DataTableRowPerPage/>
    <div className="flex items-center gap-2">
      <DataTablePagination/>
      <DataTableSelectColumnVisibility/>
    </div>
  </div>
}

const DataTableSelectColumnVisibility = <TData,>() => {
  const table = useContext(TableContext);
  return   <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button
        variant="outline"
        size="icon"
        aria-label="Manage columns visibility"
        className="rounded border border-black">
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
}

const DataTableOptionsHeader = <TData, TValue>({column, menuItems, title, className}: { column: Column<TData, TValue> , menuItems?: ReactNode, title: string, className?: string}) => {
  if(!column.getCanHide() && !column.getCanSort() ) {
    return <> {title}</>;
  }

  return (
    <div className={ className }>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3 h-8 data-[state=open]:bg-accent"
          >
            {title}
            {column.getIsSorted() === "desc" ? (
              <KeyboardArrowDownIcon className="ml-2 h-4 w-4" />
            ) : column.getIsSorted() === "asc" ? (
              <KeyboardArrowUpIcon className="ml-2 h-4 w-4" />
            ) : (
              <UnfoldMoreIcon className="ml-2 h-4 w-4" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
        {
          column.getCanSort() && <>
            <DropdownMenuItem onClick={() => column.toggleSorting(false)}>
              <ArrowUpIcon className="mr-2 h-3.5 w-3.5 text-muted-foreground/70" />
              Asc
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => column.toggleSorting(true)}>
              <ArrowDownIcon className="mr-2 h-3.5 w-3.5 text-muted-foreground/70" />
              Desc
            </DropdownMenuItem>
          </>
        }
        { ((menuItems) || column.getCanHide()) && <DropdownMenuSeparator />}

          {column.getCanHide() && <DropdownMenuItem onClick={() => column.toggleVisibility(false)}>
            <EyeOff className="mr-2 h-3.5 w-3.5 text-muted-foreground/70" />
            Hide
          </DropdownMenuItem>}
          {menuItems}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
const DraggableTableHeader = <TData, TValue>({ header }: { header: Header<TData, TValue> }) => {
  const { attributes, isDragging, listeners, setNodeRef, transform } =
    useSortable({
      id: header.column.id,
    });


  return (
    <TableHead
      key={header.id}
      colSpan={header.colSpan}
      className={cn(
        'transition-width group relative z-0 whitespace-nowrap opacity-100 transition-transform duration-200 ease-in-out',
        isDragging && 'z-10 opacity-80 bg-gray-150'
      )}
      ref={setNodeRef}
      style={{
        width: header.getSize(),
        transform: transform ? getTransformString(transform) : undefined,
      }}>
      <div className=" flex items-center justify-between h-full">
        {header.isPlaceholder ? null : (
          typeof header.column.columnDef.header === 'string' ?
          <DataTableOptionsHeader column={header.column} title={header.column.columnDef.header}/>:
          <> {flexRender(header.column.columnDef.header, header.getContext())}</>

        )}

          <button
            className={cn('opacity-0 group-hover:opacity-100 cursor-grab', isDragging && 'cursor-grabbing')}
            {...attributes}
            {...listeners}>
            <GripHorizontal className="mx-2 h-6 w-6" />
          </button>

      </div>
      {
        header.column.getCanResize() &&
      <div
        onDoubleClick={() => header.column.resetSize()}
        onMouseDown={header.getResizeHandler()}
        onTouchStart={header.getResizeHandler()}
        className={cn(
          `absolute right-0 top-0 h-full w-1 cursor-col-resize select-none 
                     bg-gray-700 opacity-0
                     `,
          header.column.getIsResizing() && `bg-primary opacity-100`,
          !isDragging && 'group-hover:opacity-100'
        )}
      />
      }
    </TableHead>
  );
};

const DragAlongCell = <TData,>({ cell }: { cell: Cell<TData, unknown> }) => {
  const { isDragging, setNodeRef, transform } = useSortable({
    id: cell.column.id,
  });
  return (
    <TableCell
      key={cell.id}
      ref={setNodeRef}
      style={{
        width: cell.column.getSize(),
        transform: transform ? getTransformString(transform) : undefined,
      }}
      className={cn(
        'transition-width group relative z-0 opacity-100 transition-transform duration-200 ease-in-out',
        isDragging && 'z-10 opacity-80'
      )}>
      {flexRender(cell.column.columnDef.cell, cell.getContext())}
    </TableCell>
  );
};

const DataTableRowPerPage = ({rowPerPage = [50, 100, 200, 300, 500]}: {rowPerPage?: number[]}) => {
  const table = useContext(TableContext);
  return <div className="flex items-center space-x-2">
    <p className="text-sm font-medium">Rows per page</p>
    <Select
      value={`${table.getState().pagination.pageSize}`}
      onValueChange={(value) => {
        table.setPageSize(Number(value))
      }}
    >
      <SelectTrigger className="h-10 w-[70px] border-black">
        <SelectValue placeholder={table.getState().pagination.pageSize} />
      </SelectTrigger>
      <SelectContent side="top">
        {rowPerPage.map((pageSize) => (
          <SelectItem key={pageSize} value={`${pageSize}`}>
            {pageSize}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
}
const DataTablePagination = () => {
  const table = useContext(TableContext);
  const pageIndex = table.getState().pagination.pageIndex;
  const pageSize = table.getState().pagination.pageSize;
  return  <>

    <div className="flex items-center space-x-2">
      <Button
        variant="outline"
        className=" h-8 w-8 p-0"
        onClick={() => table.setPageIndex(0)}
        disabled={!table.getCanPreviousPage()}
      >
        <span className="sr-only">Go to first page</span>
        <ArrowFirstIcon className="h-4 w-4" />
      </Button>
      <Button
        variant="outline"
        className="h-8 w-8 p-0"
        onClick={() => table.previousPage()}
        disabled={!table.getCanPreviousPage()}
      >
        <span className="sr-only">Go to previous page</span>
        <ArrowPreviousIcon className="h-4 w-4" />
      </Button>
      <div className=" text-sm font-medium">
        Rows {(pageIndex* pageSize) + 1 } to {Math.min((pageIndex + 1)* pageSize, table.getRowCount())} / {table.getRowCount()}
      </div>
      <Button
        variant="outline"
        className="h-8 w-8 p-0"
        onClick={() => table.nextPage()}
        disabled={!table.getCanNextPage()}
      >
        <span className="sr-only">Go to next page</span>
        <ArrowNextIcon className="h-4 w-4" />
      </Button>
      <Button
        variant="outline"
        className=" h-8 w-8 p-0"
        onClick={() => table.setPageIndex(table.getPageCount() - 1)}
        disabled={!table.getCanNextPage()}
      >
        <span className="sr-only">Go to last page</span>
        <ArrowLastIcon className="h-4 w-4" />
      </Button>
    </div>
  </>
}

const TableContext = createContext<TableType<any>>({} as TableType<any>);
function GenericDataTable<TData extends { id: string }, TValue>(
  { columns, data, tableState, tableOptions, toolbar, onClickRow }: DataTableProps<TData, TValue>,
  ref?: any
) {
  const [columnOrder, setColumnOrder] = useState<string[]>(() =>
    columns.map((c) => c.id!)
  );

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
  });

  useImperativeHandle(ref, () => table);
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (active && over && active.id !== over.id) {
      setColumnOrder((columnOrder) => {
        const oldIndex = columnOrder.indexOf(active.id as string);
        const newIndex = columnOrder.indexOf(over.id as string);
        return arrayMove(columnOrder, oldIndex, newIndex); //this is just a splice util
      });
    }
  };

  const sensors = useSensors(
    useSensor(MouseSensor, {}),
    useSensor(TouchSensor, {}),
    useSensor(KeyboardSensor, {})
  );

  return (
    <TableContext.Provider value={{...table}}>
        {toolbar ? <>{toolbar}</>
          : <DefaultToolbar/>}
      <DndContext
        collisionDetection={closestCenter}
        modifiers={[restrictToHorizontalAxis]}
        onDragEnd={handleDragEnd}
        sensors={sensors}>
        <div className="rounded-md">
          <Table style={{ width: table.getCenterTotalSize() }}>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow className={"hover:bg-inherit"} key={headerGroup.id}>
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
              {table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} className={cn(onClickRow && 'cursor-pointer', !row.getCanSelect() && 'cursor-auto opacity-50 bg-muted/30 ')} onClick={() => onClickRow && row.getCanSelect() ? onClickRow(row) : null}>
                  {row.getVisibleCells().map((cell) => (
                    <SortableContext
                      key={cell.id}
                      items={columnOrder}
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
  );
}

const DataTable = fixedForwardRef(GenericDataTable);

export { DataTable, DataTablePagination, DataTableSelectColumnVisibility , DataTableRowPerPage, DataTableOptionsHeader };
