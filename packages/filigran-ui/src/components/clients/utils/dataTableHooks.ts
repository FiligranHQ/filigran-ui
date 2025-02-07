import { useLocalStorage } from 'usehooks-ts';
import { useEntityToggle } from './useEntityToggle';
import { type DataTableColumn } from '../legacy/dataTable/dataTableTypes';
import type { Dispatch, SetStateAction } from 'react';


export const useDataTableComputeLink = (e: string) => e;
export const useDataCellHelpers = (...p: any[]) => () => {};
export const useDataTableFormatter = () => ({ t_i18n: (t: string) => (t ?? "") });
export const useDataTableLocalStorage = (k: string, i: any, _?: boolean): [a: any, b: Dispatch<SetStateAction<any>>] => {
  const [a, b] = useLocalStorage<any>(k, i);
  return [a, b];
};
export const useDataTablePaginationLocalStorage = (...p: any[]) => ({
  viewStorage: { pageSize: "50" },
  helpers: {
    handleAddFilterWithEmptyValue: (e: any) => {},
    handleSort: () => {},
  },
});
export const useDataTableToggle = useEntityToggle;
export const getDefaultFilterObject = (e: any): Record<string, any> => ({});
export const defaultColumnsMap = new Map(Object.entries({
  name: {
    id: 'name',
    label: 'Name',
    percentWidth: 25,
    isSortable: true,
    render: ({ name }: { name: any }) => {
      return name;
    },
  },
})) as Map<string, DataTableColumn>;