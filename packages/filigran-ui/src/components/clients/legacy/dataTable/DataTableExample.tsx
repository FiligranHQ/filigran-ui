'use client'
import {SearchIcon} from 'filigran-icon'
import {makeData} from 'filigran-website/utils/makeData'
import React, {useState} from 'react'
import {Badge, Button} from '../../../servers'
import {
  defaultColumnsMap,
  getDefaultFilterObject,
  useDataCellHelpers,
  useDataTableComputeLink,
  useDataTableFormatter,
  useDataTableLocalStorage,
  useDataTablePaginationLocalStorage,
  useDataTableToggle,
} from '../../utils'
import {DataTableComponent} from './DataTableComponent'
import DataTablePagination from './DataTablePagination'

export const DataTableExample = React.forwardRef<HTMLDivElement>(
  (props, ref) => {
    const data = makeData(100, 'report')

    const colors = [
      '#8F8F8F',
      '#DE4C8A',
      '#C2B078',
      '#CB9CF2',
      '#497E76',
      '#9B111E',
    ]

    const [page, setPage] = useState(0)
    return (
      ref && (
        <DataTableComponent
          {...props}
          rootRef={ref as unknown as HTMLDivElement}
          dataColumns={{
            type: {
              id: 'type',
              label: 'Type',
              percentWidth: 15,
              isSortable: true,
              render: ({type}) => (
                <Badge
                  color={
                    colors[
                      ['Incident', 'Report', 'Vulnerability'].indexOf(type) + 3
                    ]
                  }>
                  {type.toUpperCase()}
                </Badge>
              ),
            },
            name: {
              id: 'name',
              label: 'Name',
              percentWidth: 15,
              isSortable: true,
              render: ({name}) => <span>{name}</span>,
            },
            description: {
              id: 'description',
              label: 'Description',
              percentWidth: 30,
              isSortable: true,
              render: ({description}) => <span>{description}</span>,
            },
            author: {
              id: 'author',
              label: 'Author',
              percentWidth: 10,
              isSortable: true,
              render: ({author}) => <span>{author}</span>,
            },
            status: {
              id: 'status',
              label: 'Type',
              percentWidth: 10,
              isSortable: true,
              render: ({status}) => (
                <Badge
                  color={
                    colors[
                      ['in progress', 'not started', 'done'].indexOf(status)
                    ]
                  }>
                  {status.toUpperCase()}
                </Badge>
              ),
            },
            creator: {
              id: 'creator',
              label: 'Creator',
              percentWidth: 10,
              isSortable: true,
              render: ({creator}) => <span>{creator}</span>,
            },
            date: {
              id: 'date',
              label: 'Date',
              percentWidth: 10,
              isSortable: true,
              render: ({date}) => <span>{date.toLocaleDateString()}</span>,
            },
          }}
          useDataTable={() => ({data})}
          useLineData={(line) => line}
          dataQueryArgs={(line: never) => line}
          resolvePath={(a) => a}
          initialValues={{}}
          storageKey={''}
          dataTableHooks={{
            defaultColumnsMap,
            getDefaultFilterObject,
            useDataCellHelpers,
            useDataTableComputeLink,
            useDataTableFormatter,
            useDataTableLocalStorage,
            useDataTablePaginationLocalStorage,
            useDataTableToggle,
          }}
          filtersComponent={
            <div
              style={{
                display: 'flex',
                flex: 1,
                justifyContent: 'space-between',
              }}>
              <div
                style={{
                  width: '200px',
                }}
                className={`
                flex
                h-9
                gap-x-2
                rounded-md
                border
                border-input
                bg-background 
                px-3
                py-2
                text-sm
                mr-auto
              `}>
                <SearchIcon />
                <span>Search results...</span>
              </div>
              <div style={{display: 'flex', gap: 4}}>
                <DataTablePagination
                  page={page}
                  setPage={setPage}
                  numberOfElements={{original: 100, number: 100, symbol: ''}}
                />
                <Button
                  variant="outline"
                  className="text-darkblue-300 border-darkblue-300">
                  AI insight
                </Button>
                <Button
                  variant="outline"
                  className="text-primary border-primary">
                  Import
                </Button>
                <Button>Create object</Button>
              </div>
            </div>
          }
        />
      )
    )
  }
)
