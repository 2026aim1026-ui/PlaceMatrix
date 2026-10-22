import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { useTableState } from '../../hooks/useTableState';
import Pagination from '../common/Pagination';
import EmptyState from '../common/EmptyState';

/**
 * Generic table with sorting and pagination.
 * columns: [{ key, header, render?(row), sortable?, sortValue?(row), className?, headerClassName? }]
 */
export default function DataTable({
  columns, rows, pageSize = 10, initialSort = null, rowKey = (r) => r.id, onRowClick,
  empty = { title: 'No records found', description: 'Try adjusting your search or filters.' }, selectedKey, dense = false,
}) {
  const { sort, toggleSort, page, setPage, pageCount, pageRows, total } = useTableState(rows, columns, { pageSize, initialSort });

  return (
    <div>
      <div className="overflow-x-auto">
        <table className={`table-base ${dense ? '[&_td]:py-2' : ''}`}>
          <thead>
            <tr>
              {columns.map((c) => {
                const active = sort?.key === c.key;
                return (
                  <th key={c.key} scope="col" className={c.headerClassName || ''} aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}>
                    {c.sortable ? (
                      <button type="button" onClick={() => toggleSort(c.key)} className="inline-flex items-center gap-1 uppercase hover:text-ink">
                        {c.header}
                        {active ? (sort.dir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-40" />}
                      </button>
                    ) : c.header}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((r) => {
              const key = rowKey(r);
              return (
                <tr
                  key={key}
                  onClick={onRowClick ? () => onRowClick(r) : undefined}
                  className={`${onRowClick ? 'cursor-pointer' : ''} ${selectedKey === key ? '!bg-brand-50/60' : ''}`}
                >
                  {columns.map((c) => (
                    <td key={c.key} className={c.className || ''}>{c.render ? c.render(r) : r[c.key]}</td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
        {total === 0 && <EmptyState compact title={empty.title} description={empty.description} icon={empty.icon} />}
      </div>
      <Pagination page={page} pageCount={pageCount} total={total} pageSize={pageSize} onPage={setPage} />
    </div>
  );
}
