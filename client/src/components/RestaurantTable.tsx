import React, { useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table';
import { format, parseISO } from 'date-fns';
import type { Restaurant } from '../types';
import { cn } from '../utils/cn';

interface RestaurantTableProps {
  restaurants: Restaurant[];
  loading?: boolean;
}

const columnHelper = createColumnHelper<Restaurant>();

export function RestaurantTable({ restaurants, loading }: RestaurantTableProps) {
  const columns = useMemo(
    () => [
      columnHelper.accessor('name', {
        header: 'Restaurant Name',
        cell: (info) => (
          <div className="flex items-center gap-2">
            <span>{info.getValue()}</span>
            {info.row.original.new_flag && (
              <span className="px-2 py-1 text-xs font-semibold bg-yellow-100 text-yellow-800 rounded">
                NEW
              </span>
            )}
          </div>
        ),
      }),
      columnHelper.accessor('district', {
        header: 'District',
        cell: (info) => info.getValue() || '-',
      }),
      columnHelper.accessor('address', {
        header: 'Address',
        cell: (info) => info.getValue() || '-',
      }),
      columnHelper.accessor('licence_no', {
        header: 'Licence No.',
      }),
      columnHelper.accessor('licence_type', {
        header: 'Licence Type',
        cell: (info) => info.getValue() || 'General Restaurant',
      }),
      columnHelper.accessor('valid_til', {
        header: 'Valid Until',
        cell: (info) => {
          const value = info.getValue();
          if (!value) return '-';
          try {
            return format(parseISO(value), 'dd/MM/yyyy');
          } catch {
            return value;
          }
        },
      }),
    ],
    []
  );

  const sortedData = useMemo(() => {
    return [...restaurants].sort((a, b) => {
      if (a.new_flag && !b.new_flag) return -1;
      if (!a.new_flag && b.new_flag) return 1;
      return 0;
    });
  }, [restaurants]);

  const table = useReactTable({
    data: sortedData,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              className={cn(
                'hover:bg-gray-50',
                row.original.new_flag && 'bg-yellow-50'
              )}
            >
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}