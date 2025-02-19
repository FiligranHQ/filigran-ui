import React, { CSSProperties, FunctionComponent, useRef } from 'react';
import { DataTableHeadersProps } from './dataTableTypes';
import DataTableHeader, { SELECT_COLUMN_SIZE } from './DataTableHeader';
import { useDataTableContext } from './DataTableContext';
import { Checkbox } from '../../checkbox';

const DataTableHeaders: FunctionComponent<DataTableHeadersProps> = ({
  dataTableToolBarComponent,
}) => {
  const {
    columns,
    setColumns,
    useDataTableToggle: {
      selectAll,
      numberOfSelectedElements,
      handleToggleSelectAll,
    },
    disableToolBar,
    disableSelectAll,
    startsWithAction,
    endsWithAction,
    useDataTablePaginationLocalStorage: {
      viewStorage: { orderBy, sortBy, orderAsc },
    },
  } = useDataTableContext();
  const containerRef = useRef<HTMLDivElement | null>(null);

  // const handleToggleVisibility = (columnId: string) => {
  //   const newColumns = [...columns];
  //   const currentColumn = newColumns.find(({ id }) => id === columnId);
  //   if (!currentColumn) {
  //     return;
  //   }
  //   currentColumn.visible = currentColumn.visible ?? true;
  //   setColumns(newColumns);
  // };

  // const draggableColumns = useMemo(() => columns.filter(({ id }) => !['select', 'navigate'].includes(id)), [columns]);

  const hasSelectedElements = numberOfSelectedElements > 0 || selectAll;
  const checkboxStyle: CSSProperties = {
    background: hasSelectedElements
      ? 'hsl(var(--page-background))'
      : 'transparent',
    width: SELECT_COLUMN_SIZE,
  };

  const showToolbar = numberOfSelectedElements > 0 && !disableToolBar;

  return (
    <div
      ref={containerRef}
      style={{ display: 'flex', height: 42 }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        const data = JSON.parse(e.dataTransfer.getData('application/my-app'));
        const columnId = data.id.split('_draggable')[0];
        const varX = e.clientX - data.x;

        const column = columns.find(({ id }) => id === columnId);

        if (containerRef?.current && column && varX !== 0) {
          // Compute new width in percentage of the column.
          const containerWidth = containerRef.current!.clientWidth;
          const columnWidth = (column.percentWidth * containerWidth) / 100;
          const newColumnWidth = columnWidth + varX;
          const newPercentage = (newColumnWidth / containerWidth) * 100;
          if (newPercentage < 0) return;

          // Override the new percent width.
          let newColumns = columns.map((c) => {
            if (c.id === column.id) return { ...c, percentWidth: newPercentage };
            return c;
          });

          // Total width should be at least 100% so extend neighbor column if necessary.
          const sumPercentage = newColumns.reduce((acc, col) => acc + (col.percentWidth ?? 0), 0);
          if (sumPercentage < 100) {
            const maxOrder = Math.max(...newColumns.flatMap((c) => c.order ?? []));
            const neighborOrder = column.order < maxOrder ? column.order + 1 : column.order - 1;
            newColumns = newColumns.map((c) => {
              if (c.order === neighborOrder) {
                const percentWidth = c.percentWidth + (100 - sumPercentage);
                return { ...c, percentWidth };
              }
              return c;
            });
          }

          setColumns(newColumns);
        }
      }}
    >
      {startsWithAction && (
        <div data-testid="dataTableCheckAll" className="flex items-center justify-start pl-1" style={checkboxStyle}>
          <Checkbox
            className="flex"
            aria-label="Select all"
            checked={selectAll}
            onCheckedChange={handleToggleSelectAll}
            disabled={!handleToggleSelectAll || disableSelectAll}
          />
        </div>
      )}

      {showToolbar && dataTableToolBarComponent}
      {/*{showToolbar ? dataTableToolBarComponent : (*/}
      {/*  <>*/}
      {/*    {anchorEl && (*/}
      {/*      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleClose}>*/}
      {/*        {columns.some(({ id }) => id === 'todo-navigate') && (*/}
      {/*          <DragDropContext*/}
      {/*            key={(new Date()).toString()}*/}
      {/*            onDragEnd={({ source, destination }) => {*/}
      {/*              const result = Array.from(draggableColumns);*/}
      {/*              const [removed] = result.splice(source.index, 1);*/}
      {/*              result.splice((destination as DraggableLocation).index, 0, removed);*/}

      {/*              const newColumns: DataTableColumns = [*/}
      {/*                columns.at(0),*/}
      {/*                ...(result.map((c, index) => {*/}
      {/*                  const currentColumn = columns.find(({ id }) => id === c.id);*/}
      {/*                  return ({ ...currentColumn, order: index });*/}
      {/*                })),*/}
      {/*                columns.at(-1),*/}
      {/*              ] as DataTableColumns;*/}

      {/*              setColumns(newColumns);*/}
      {/*            }}*/}
      {/*          >*/}
      {/*            <Droppable droppableId="droppable-list">*/}
      {/*              {(provided) => (*/}
      {/*                <div ref={provided.innerRef} {...provided.droppableProps}>*/}
      {/*                  {draggableColumns.map((c, index) => (*/}
      {/*                    <Draggable*/}
      {/*                      key={index}*/}
      {/*                      draggableId={c.id}*/}
      {/*                      index={index}*/}
      {/*                    >*/}
      {/*                      {(item) => (*/}
      {/*                        <MenuItem*/}
      {/*                          ref={item.innerRef}*/}
      {/*                          {...item.draggableProps}*/}
      {/*                          {...item.dragHandleProps}*/}
      {/*                        >*/}
      {/*                          <DragIndicatorOutlined fontSize="small" />*/}
      {/*                          <Checkbox*/}
      {/*                            onClick={() => handleToggleVisibility(c.id)}*/}
      {/*                            checked={c.visible}*/}
      {/*                          />*/}
      {/*                          {c.label}*/}
      {/*                        </MenuItem>*/}
      {/*                      )}*/}
      {/*                    </Draggable>*/}
      {/*                  ))}*/}
      {/*                  {provided.placeholder}*/}
      {/*                </div>*/}
      {/*              )}*/}
      {/*            </Droppable>*/}
      {/*          </DragDropContext>*/}
      {/*        )}*/}
      {/*      </Menu>*/}
      {/*    )}*/}

      {columns
        .filter(({ id }) => !['select', 'navigate'].includes(id))
        .map((column) => (
          <DataTableHeader
            key={column.id}
            column={column}
            containerRef={containerRef}
            sortBy={(orderBy || sortBy) === column.id}
            orderAsc={!!orderAsc}
          />
        ))}

      {(endsWithAction) && <div style={{ width: SELECT_COLUMN_SIZE, flex: '0 0 auto' }} />}
    </div>
  );
};

export default DataTableHeaders;