import React, { CSSProperties, useMemo } from 'react';
import { redirect } from 'react-router-dom';
import type { DataTableCellProps, DataTableLineProps } from './dataTableTypes';
import { DataTableVariant } from './dataTableTypes';
import { SELECT_COLUMN_SIZE } from './DataTableHeader';
import { useDataTableContext } from './DataTableContext';
import { useTheme } from '@mui/styles';
import { Checkbox } from '../../checkbox';
import { ChevronIcon } from 'filigran-icon';
import { Button, Skeleton } from '../../../servers';

const cellContainerStyle = {
  display: 'flex',
  height: '48px',
  alignItems: 'center',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  flex: '0 0 auto',
};

const DataTableLineDummy = () => {
  const { columns, tableWidthState: [tableWidth] } = useDataTableContext();
  return (
    <div style={{ display: 'flex' }}>
      {columns.map((column) => {
        const width = column.percentWidth
          ? Math.round((tableWidth || window.innerWidth * 0.7) * (column.percentWidth / 100))
          : SELECT_COLUMN_SIZE;
        return (
          <div
            key={column.id}
            className="p-s"
            style={{
              paddingLeft: '0.5rem',
              paddingRight: '1rem',
              flex: '0 0 auto',
              width,
            }}
          >
            <Skeleton className="h-6" />
          </div>
        )
      })}
    </div>
  );
};

export const DataTableLinesDummy = ({ number = 10 }: { number?: number }) => <>
  {Array(Math.min(number, 25)).fill(0).map((_, idx) => (
    <DataTableLineDummy key={idx} />
  ))}
</>;

const DataTableCell = ({
  cell,
  data,
}: DataTableCellProps) => {
  const { useDataCellHelpers, tableWidthState: [tableWidth] } = useDataTableContext();
  const helpers = useDataCellHelpers(cell);

  const cellStyle: CSSProperties = {
    display: 'flex',
    paddingLeft: '0.5rem',
    paddingRight: '0.5rem',
    width: '100%',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '13px',
  };

  return (
    <div
      key={`${cell.id}_${data.id}`}
      style={{
        ...cellContainerStyle,
        width: Math.round(tableWidth * (cell.percentWidth / 100)),
      }}
    >
      <div style={cellStyle}>
        {cell.render?.(data, helpers) ?? (<div>-</div>)}
      </div>
    </div>
  );
};

const DataTableLine = ({
  row,
  index,
  onToggleShiftEntity,
}: DataTableLineProps) => {
  const theme = useTheme();
  const {
    columns,
    useLineData,
    useComputeLink,
    actions,
    disableNavigation,
    onLineClick,
    selectOnLineClick,
    variant,
    startsWithAction,
    endsWithAction,
    endsWithNavigate,
    useDataTableToggle: {
      selectAll,
      deSelectedElements,
      selectedElements,
      onToggleEntity,
    },
    useDataTablePaginationLocalStorage: {
      viewStorage: { redirectionMode },
    },
  } = useDataTableContext();

  const data = useLineData(row);

  // Memoize link to avoid recomputations
  let link = useMemo(() => useComputeLink(data), [data]);
  if (redirectionMode && redirectionMode !== 'overview') {
    link = `${link}/${redirectionMode}`;
  }

  const navigable = !disableNavigation && !onLineClick && !selectOnLineClick;
  const clickable = !!(navigable || selectOnLineClick || onLineClick);

  const handleSelectLine = (event: React.MouseEvent) => {
    if (event.shiftKey) {
      onToggleShiftEntity(index, data, event);
    } else {
      onToggleEntity(data, event);
    }
  };

  const handleNavigate = (event: React.MouseEvent) => {
    if (!navigable) return;
    if (event.ctrlKey) {
      window.open(link, '_blank');
    } else {
      redirect(link);
    }
  };

  const handleRowClick = (event: React.MouseEvent) => {
    if (!clickable) return;
    event.preventDefault();
    event.stopPropagation();

    if (selectOnLineClick) {
      handleSelectLine(event);
    } else if (onLineClick) {
      onLineClick(data);
    } else {
      handleNavigate(event);
    }
  };

  const linkStyle: CSSProperties = {
    display: 'flex',
    color: 'inherit',
    borderBottom: '1px solid',
    borderColor: 'hsl(var(--border-medium-light))',
    cursor: clickable ? 'pointer' : 'unset',
    textDecoration: 'none',
  };

  return (
    <div className="hover:bg-hover">
      <a
        className={theme?.palette?.mode}
        style={linkStyle}
        href={navigable ? link : undefined}
        // We need both to handle accessibility and widget.
        onMouseDown={variant === DataTableVariant.widget ? handleNavigate : undefined}
        onClick={variant !== DataTableVariant.widget ? handleRowClick : undefined}
      >
        {startsWithAction && (
          <div
            key={`select_${data.id}`}
            className="pl-1"
            style={{
              ...cellContainerStyle,
              width: SELECT_COLUMN_SIZE,
            }}
          >
            <Checkbox
              onClick={handleSelectLine}
              checked={
                (selectAll
                  && !((data.id || 'id') in (deSelectedElements || {})))
                || (data.id || 'id') in (selectedElements || {})
              }
            />
          </div>
        )}

        {columns.slice(startsWithAction ? 1 : 0, (actions || disableNavigation) ? undefined : -1).map((column) => (
          <DataTableCell
            key={column.id}
            cell={column}
            data={data}
          />
        ))}

        {endsWithAction && (
          <div
            key={`navigate_${data.id}`}
            style={{
              ...cellContainerStyle,
              width: SELECT_COLUMN_SIZE,
              overflow: 'initial',
            }}
          >
            {actions && actions(data)}
            {endsWithNavigate && (
              <Button
                variant="ghost"
                size="icon"
              >
                <ChevronIcon className="size-4" />
              </Button>
            )}
          </div>
        )}
      </a>
    </div>
  );
};

export default DataTableLine;