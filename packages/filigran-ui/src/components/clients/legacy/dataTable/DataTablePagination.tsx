'use client'
import React, { type Dispatch, type SetStateAction, useCallback, useEffect, useState } from 'react';
import { type NumberOfElements } from './dataTableTypes';
import { useDataTableContext } from './DataTableContext';
import { Button } from '../../../servers';
import { TableTuneIcon, ArrowPreviousIcon, ArrowNextIcon } from 'filigran-icon';
import { DropdownMenu, DropdownMenuPortal, DropdownMenuSub, DropdownMenuTrigger } from '@radix-ui/react-dropdown-menu';
import { DropdownMenuContent, DropdownMenuSubContent, DropdownMenuSubTrigger } from '../../dropdown-menu';
import { SimpleTooltip as Tooltip } from '../../tooltip';

const DataTablePagination = ({
  page,
  setPage,
  numberOfElements: unstoreNOE,
}: {
  page: number,
  setPage: Dispatch<SetStateAction<number>>,
  numberOfElements?: NumberOfElements,
}) => {
  const {
    resetColumns,
    formatter: { t_i18n },
    useDataTablePaginationLocalStorage: {
      viewStorage: {
        pageSize,
        numberOfElements: storedNOE = { original: 0, number: 0, symbol: '' },
      },
      helpers,
    },
  } = useDataTableContext();

  const numberOfElements = unstoreNOE ?? storedNOE;

  // if the number of elements object changes, it means we have changed the filter or search
  // we reset to page 1 (we might be out-of-bound in this new context)
  useEffect(() => {
    setPage(1);
  }, [numberOfElements]);

  const items = pageSize ? Number.parseInt(pageSize, 10) : 25;
  const firstItem = items * ((page ?? 1) - 1) + 1;
  const lastItem = Math.min(firstItem + items - 1, numberOfElements.original ?? 0);

  const fetchMore = useCallback((direction = 'forward') => {
    let nextPage;
    if (direction === 'previous' && page > 1) {
      nextPage = page - 1;
      setPage(nextPage);
    } else {
      nextPage = page + 1;
      setPage(nextPage);
    }
  }, [page, pageSize]);

  const resetTable = () => {
    resetColumns();
    helpers.handleAddProperty('pageSize', '25');
  };
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div
      style={{
        display: 'flex',
        border: '1px solid',
        borderColor: 'hsl(var(--border))',
        borderRadius: 'var(--radius)',
        padding: '0.25rem',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <Button
          variant="ghost"
          onClick={() => fetchMore('previous')}
          size="icon-rounded"
          disabled={firstItem === 1}
          style={{
            padding: 0,
            borderRight: 'none',
            width: 24,
            height: 24,
          }}
        >
          <ArrowPreviousIcon className="size-2" />
        </Button>
        <Tooltip
          title={
            <div>
              <strong>{`${numberOfElements.original}`}</strong>{' '}
              {t_i18n('entitie(s)')}
            </div>
          }
        >
          <div className="leading-none text-text-secondary txt-sub-content">
            <span className="text-foreground">{`${lastItem ? firstItem : 0} - ${lastItem} `}</span>
            <span style={{ opacity: 0.6 }}>
                {`/ ${numberOfElements.number}${numberOfElements.symbol}`}
              </span>
          </div>
        </Tooltip>
        <Button
          onClick={() => fetchMore('forward')}
          variant="ghost"
          size="icon-rounded"
          disabled={lastItem === numberOfElements.original}
          style={{
            padding: 0,
            borderRight: 'none',
            width: 24,
            height: 24,
          }}
        >
          <ArrowNextIcon className="size-2" />
        </Button>
        <DropdownMenu
          open={menuOpen}
          onOpenChange={setMenuOpen}
        >
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="flex h-6 w-6 p-0 data-[state=open]:bg-muted">
              {<TableTuneIcon className="size-4 text-foreground" />}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-[160px]">
            <>
              <Button
                variant="ghost"
                className="w-full justify-start normal-case"
                onClick={resetTable}
              >
                {t_i18n('Reset table')}
              </Button>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="pl-l">
                  {t_i18n('Rows per page')}
                </DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuSubContent>
                    {['10', '25', '50', '100'].map((nb) => (
                      <Button
                        variant="ghost"
                        className="w-full justify-start normal-case"
                        onClick={() => helpers.handleAddProperty('pageSize', nb)}
                      >
                        {nb}
                      </Button>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuPortal>
              </DropdownMenuSub>
            </>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};

export default DataTablePagination;
