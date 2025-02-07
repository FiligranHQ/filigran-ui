import { useEntityToggle } from './useEntityToggle';
import { Dispatch, SetStateAction, useState } from 'react';
import { LocalStorageColumns } from '../legacy/dataTable/dataTableTypes';

export const useDataTableComputeLink = (e: string) => e;
export const useDataCellHelpers = (...p) => () => {};
export const useDataTableFormatter = () => ({ t_i18n: (t) => (t ?? "") });
export const useDataTableLocalStorage = <T>(key, initialValue, bool): [a: LocalStorageColumns, b: Dispatch<SetStateAction<LocalStorageColumns>>] => {
  const [a, b] = useState<LocalStorageColumns>();
  return [a, b];
};
export const useDataTablePaginationLocalStorage = (...p) => ({
  viewStorage: { pageSize: "50" },
  helpers: {
    handleAddFilterWithEmptyValue: (e) => {},
    handleSort: () => {},
  },
});
export const useDataTableToggle = useEntityToggle;
export const getDefaultFilterObject = (e: any) => {};
export const defaultColumnsMap = new Map(Object.entries({
  name: {
    id: 'name',
    label: 'Name',
    percentWidth: 25,
    isSortable: true,
    render: ({ name }) => {
      return name;
    },
  },
}));