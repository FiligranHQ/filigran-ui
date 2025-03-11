'use client'
import {DropdownMenu, DropdownMenuTrigger} from '@radix-ui/react-dropdown-menu'
import {
  KeyboardArrowDownIcon,
  KeyboardArrowUpIcon,
  MoreVertIcon,
} from 'filigran-icon'
import {FunctionComponent, MouseEvent, useEffect, useState} from 'react'
import {cn} from '../../../../lib/utils'
import {Button} from '../../../servers'
import {DropdownMenuContent} from '../../dropdown-menu'
import {TableHead} from '../../table'
import {SimpleTooltip} from '../../tooltip'
import {useDataTableContext} from './DataTableContext'
import {DataTableHeaderProps, DataTableVariant} from './dataTableTypes'

export const SELECT_COLUMN_SIZE = 42

const DataTableHeader: FunctionComponent<DataTableHeaderProps> = ({
  column,
  sortBy,
  orderAsc,
}) => {
  const {
    availableFilterKeys,
    onSort,
    variant,
    formatter: {t_i18n},
    tableWidthState: [tableWidth],
    onAddFilter,
  } = useDataTableContext()

  // To avoid spamming sorting (and calling API)
  const throttleSortColumn = (e: MouseEvent) => {
    const el = e.target as HTMLDivElement
    el.style.setProperty('pointer-events', 'none')
    setTimeout(() => el.style.setProperty('pointer-events', 'auto'), 800)
    if (column.isSortable) onSort(column.id, !orderAsc)
  }

  const hasColumnMenu =
    column.isSortable || (availableFilterKeys ?? []).includes(column.id)
  const cellWidth = Math.round(tableWidth * (column.percentWidth / 100))

  const dragstartHandler = (ev) => {
    // Add the target element's id to the data transfer object
    console.log(ev.clientX, ev.clientY)
    ev.dataTransfer.setData(
      'application/my-app',
      JSON.stringify({id: ev.target.id, x: ev.clientX, y: ev.clientY})
    )
    ev.dataTransfer.effectAllowed = 'move'
  }
  useEffect(() => {
    document
      .getElementById(`${column.id}_draggable`)
      ?.addEventListener('dragstart', dragstartHandler)
    return () => {
      document
        .getElementById(`${column.id}_draggable`)
        ?.removeEventListener('dragstart', dragstartHandler)
    }
  }, [])

  const [active, setActive] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div
      key={column.id}
      className="flex items-center"
      style={{width: cellWidth}}
      onMouseEnter={() => setActive(true)}
      onMouseLeave={() => setActive(false)}>
      <SimpleTooltip
        className="uppercase"
        title={t_i18n(column.label)}>
        <TableHead
          className="truncate uppercase flex items-center p-0 pl-s gap-s flex-1"
          onClick={throttleSortColumn}>
          {t_i18n(column.label)}
          {sortBy &&
            (orderAsc ? (
              <KeyboardArrowUpIcon className="size-3" />
            ) : (
              <KeyboardArrowDownIcon className="size-3" />
            ))}
        </TableHead>
      </SimpleTooltip>

      <DropdownMenu
        open={menuOpen}
        onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger>
          {hasColumnMenu && (
            <Button
              variant="ghost"
              size="icon-rounded"
              className={cn(
                'w-4 mr-1 hover:bg-transparent',
                active || menuOpen ? 'visible' : 'hidden'
              )}>
              <MoreVertIcon className="size-4" />
            </Button>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {column?.isSortable && (
            <Button
              variant="ghost"
              className="w-full justify-start normal-case"
              onClick={() => onSort(column.id, true)}>
              {t_i18n('Sort Asc')}
            </Button>
          )}
          {column?.isSortable && (
            <Button
              variant="ghost"
              className="w-full justify-start normal-case"
              onClick={() => onSort(column.id, false)}>
              {t_i18n('Sort Desc')}
            </Button>
          )}
          {column && availableFilterKeys?.includes(column.id) && (
            <Button
              variant="ghost"
              className="w-full justify-start normal-case"
              onClick={() => {
                onAddFilter(column.id)
                setMenuOpen(false)
              }}>
              {t_i18n('Add filtering')}
            </Button>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <div
        id={`${column.id}_draggable`}
        draggable={
          variant !== DataTableVariant.inline &&
          variant !== DataTableVariant.widget
        }
        className={cn(
          active ? 'bg-primary' : '',
          'w-[0.25rem]',
          'h-[fill-available]',
          'mr-xs',
          'rounded',
          'my-xs'
        )}
        style={{
          cursor: 'col-resize',
        }}
      />
    </div>
  )
}

export default DataTableHeader
