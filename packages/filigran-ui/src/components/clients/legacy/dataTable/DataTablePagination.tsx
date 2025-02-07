"use client"
import Tooltip from '@mui/material/Tooltip';
import React, { type Dispatch, type SetStateAction, useCallback, useEffect } from 'react';
import { ArrowLeft, ArrowRight } from '@mui/icons-material';
import { type NumberOfElements } from './dataTableTypes';
import { useDataTableContext } from './DataTableContext';
import { Button } from '../../../servers';

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
  const nestedMenuOptions = [
    {
      value: 'menu-reset',
      label: t_i18n('Reset table'),
      onClick: () => resetTable(),
      menuLevel: 0,
    },
    {
      value: 'menu-rows-per-page',
      label: t_i18n('Rows per page'),
      menuLevel: 0,
      nestedOptions: [
        {
          value: '10',
          onClick: () => helpers.handleAddProperty('pageSize', '10'),
          selected: pageSize === '10',
          menuLevel: 1,
        },
        {
          value: '25',
          onClick: () => helpers.handleAddProperty('pageSize', '25'),
          selected: !pageSize || pageSize === '25',
          menuLevel: 1,
        },
        {
          value: '50',
          onClick: () => helpers.handleAddProperty('pageSize', '50'),
          selected: pageSize === '50',
          menuLevel: 1,
        },
        {
          value: '100',
          onClick: () => helpers.handleAddProperty('pageSize', '100'),
          selected: pageSize === '100',
          menuLevel: 1,
        },
      ],
    },
  ];

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
          size="icon"
          disabled={firstItem === 1}
          style={{
            padding: 0,
            borderRight: 'none',
            width: 24,
            height: 24,
          }}
        >
          <ArrowLeft />
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
          size="icon"
          disabled={lastItem === numberOfElements.original}
          style={{
            padding: 0,
            borderRight: 'none',
            width: 24,
            height: 24,
          }}
        >
          <ArrowRight />
        </Button>
      </div>
      {/*<NestedMenuButton*/}
      {/*  menuButtonProps={{*/}
      {/*    variant: 'outlined',*/}
      {/*    size: 'small',*/}
      {/*    color: 'pagination',*/}
      {/*    style: {*/}
      {/*      padding: 6,*/}
      {/*      minWidth: 36,*/}
      {/*      border: 'none',*/}
      {/*    },*/}
      {/*  }}*/}
      {/*  menuButtonChildren={<TableTuneIcon />}*/}
      {/*  options={nestedMenuOptions}*/}
      {/*  menuLevels={2}*/}
      {/*/>*/}
    </div>
  );
};

export default DataTablePagination;
