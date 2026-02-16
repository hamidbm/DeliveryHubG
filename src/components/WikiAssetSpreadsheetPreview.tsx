import React, { useEffect, useMemo, useState } from 'react';
import { WikiAsset } from '../types';

interface WikiAssetSpreadsheetPreviewProps {
  asset: WikiAsset;
}

const WikiAssetSpreadsheetPreview: React.FC<WikiAssetSpreadsheetPreviewProps> = ({ asset }) => {
  const [activeSheetIndex, setActiveSheetIndex] = useState(0);
  const [viewMode, setViewMode] = useState<'tiles' | 'table'>('tiles');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterColumn, setFilterColumn] = useState('all');
  const [filterValue, setFilterValue] = useState('');
  const [visibleColumns, setVisibleColumns] = useState<string[]>([]);
  const [editingRowId, setEditingRowId] = useState<number | null>(null);
  const [editedRow, setEditedRow] = useState<Record<string, any>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const sheetData = useMemo(() => {
    if (asset.preview.kind !== 'sheet' || !asset.preview.objectKey) return null;
    try {
      return JSON.parse(asset.preview.objectKey);
    } catch {
      return null;
    }
  }, [asset.preview.kind, asset.preview.objectKey]);

  const sheets = sheetData?.sheets || [];
  if (!sheets.length) {
    return (
      <div className="bg-white border border-slate-100 p-8 rounded-[2.5rem] shadow-inner">
        <p className="text-sm text-slate-500">No spreadsheet data available.</p>
      </div>
    );
  }

  const activeSheet = sheets[activeSheetIndex] || sheets[0];
  const columns: string[] = activeSheet?.columns || [];
  const activeVisibleColumns = visibleColumns.length ? visibleColumns : columns;
  const rows: Record<string, any>[] = activeSheet?.rows || [];

  const filteredRows = rows.filter((row) => {
    const matchesSearch = searchTerm
      ? Object.values(row || {}).some((value) =>
          String(value ?? '')
            .toLowerCase()
            .includes(searchTerm.toLowerCase())
        )
      : true;
    const matchesFilter = filterValue
      ? String(row?.[filterColumn] ?? '')
          .toLowerCase()
          .includes(filterValue.toLowerCase())
      : true;
    return matchesSearch && (filterColumn === 'all' ? true : matchesFilter);
  });
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedRows = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => {
    setPage(1);
  }, [activeSheetIndex, searchTerm, filterColumn, filterValue, visibleColumns, pageSize]);

  const handleEditRow = (row: Record<string, any>) => {
    setEditingRowId(row._rowId);
    setEditedRow({ ...row });
  };

  const toggleVisibleColumn = (column: string) => {
    setVisibleColumns((prev) => {
      if (!prev.length) {
        return columns.filter((col) => col !== column);
      }
      if (prev.includes(column)) {
        const next = prev.filter((col) => col !== column);
        return next.length ? next : [];
      }
      return [...prev, column];
    });
  };

  const showAllColumns = () => {
    setVisibleColumns([]);
  };

  const handleRowChange = (column: string, value: string) => {
    setEditedRow((prev) => ({ ...prev, [column]: value }));
  };

  const handleSaveRow = async () => {
    if (!activeSheet || editingRowId === null) return;
    setIsSaving(true);
    const updatedRows = rows.map((row) =>
      row._rowId === editingRowId ? { ...editedRow } : row
    );
    const updatedSheets = sheets.map((sheet: any, index: number) =>
      index === activeSheetIndex ? { ...sheet, rows: updatedRows } : sheet
    );
    const updatedData = { ...sheetData, sheets: updatedSheets };

    try {
      await fetch('/api/wiki/assets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: asset._id || asset.id, sheetData: updatedData }),
      });
      setEditingRowId(null);
      setEditedRow({});
    } catch (err) {
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white border border-slate-100 p-8 rounded-[2.5rem] shadow-inner overflow-x-auto">
      <div className="mb-6 flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Sheet</label>
          <select
            className="border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold"
            value={activeSheetIndex}
            onChange={(e) => setActiveSheetIndex(Number(e.target.value))}
          >
            {sheets.map((sheet: any, index: number) => (
              <option value={index} key={sheet.name || index}>
                {sheet.name || `Sheet ${index + 1}`}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">View</label>
          <div className="inline-flex rounded-lg border border-slate-200 bg-white overflow-hidden">
            <button
              type="button"
              onClick={() => setViewMode('tiles')}
              className={`px-3 py-2 text-[10px] font-black uppercase tracking-widest transition ${
                viewMode === 'tiles' ? 'bg-slate-900 text-white' : 'text-slate-500'
              }`}
            >
              Tile
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`px-3 py-2 text-[10px] font-black uppercase tracking-widest transition ${
                viewMode === 'table' ? 'bg-slate-900 text-white' : 'text-slate-500'
              }`}
            >
              Table
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Search</label>
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold"
            placeholder="Search rows"
          />
        </div>
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Filter</label>
            <select
              className="border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold"
              value={filterColumn}
              onChange={(e) => setFilterColumn(e.target.value)}
            >
              <option value="all">All Columns</option>
              {columns.map((column) => (
                <option value={column} key={column}>
                  {column}
                </option>
              ))}
            </select>
            <input
              value={filterValue}
              onChange={(e) => setFilterValue(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold"
              placeholder="Filter value"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Columns</label>
            <div className="flex flex-wrap gap-2 max-w-[520px]">
              {columns.map((column) => {
                const isVisible = activeVisibleColumns.includes(column);
                return (
                  <button
                    key={column}
                    type="button"
                    onClick={() => toggleVisibleColumn(column)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border transition ${
                      isVisible
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-500 border-slate-200'
                    }`}
                  >
                    {column}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={showAllColumns}
              className="px-3 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg bg-slate-100 text-slate-500 border border-slate-200"
            >
              Show All
            </button>
          </div>
        </div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="text-xs font-semibold text-slate-500">
          {filteredRows.length.toLocaleString()} rows
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Rows</label>
          <select
            className="border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold"
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
          >
            {[10, 20, 50, 100].map((size) => (
              <option key={size} value={size}>
                {size} / page
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            className="px-3 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg bg-slate-100 text-slate-600 border border-slate-200 disabled:opacity-50"
          >
            Prev
          </button>
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Page {currentPage} / {totalPages}
          </div>
          <button
            type="button"
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
            className="px-3 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg bg-slate-100 text-slate-600 border border-slate-200 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>

      {viewMode === 'tiles' ? (
        <div className="grid gap-6">
          {pagedRows.map((row) => (
            <div
              key={row._rowId}
              className="border border-slate-200 rounded-2xl p-5 shadow-sm bg-slate-50"
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Row {row._rowId}
                </span>
                {editingRowId === row._rowId ? (
                  <div className="flex gap-2">
                    <button
                      className="px-3 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg bg-blue-600 text-white"
                      onClick={handleSaveRow}
                      disabled={isSaving}
                    >
                      {isSaving ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      className="px-3 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg bg-slate-200 text-slate-600"
                      onClick={() => {
                        setEditingRowId(null);
                        setEditedRow({});
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    className="px-3 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg bg-slate-900 text-white"
                    onClick={() => handleEditRow(row)}
                  >
                    Edit Row
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {activeVisibleColumns.map((column) => (
                  <div key={column} className="flex flex-col gap-1">
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                      {column}
                    </span>
                    {editingRowId === row._rowId ? (
                      <input
                        className="border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold bg-white"
                        value={editedRow[column] ?? ''}
                        onChange={(e) => handleRowChange(column, e.target.value)}
                      />
                    ) : (
                      <span className="text-sm font-medium text-slate-700">
                        {String(row[column] ?? '')}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
          {!filteredRows.length && (
            <div className="text-sm text-slate-500">No rows match your search.</div>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto border border-slate-200 rounded-2xl bg-white shadow-sm">
          <table className="min-w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-500 sticky top-0">
              <tr>
                <th className="px-4 py-3 border-b border-slate-200">Row</th>
                {activeVisibleColumns.map((column) => (
                  <th key={column} className="px-4 py-3 border-b border-slate-200">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pagedRows.map((row) => (
                <tr key={row._rowId} className="odd:bg-white even:bg-slate-50">
                  <td className="px-4 py-3 border-b border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    {row._rowId}
                  </td>
                  {activeVisibleColumns.map((column) => (
                    <td key={column} className="px-4 py-3 border-b border-slate-100 text-sm">
                      {String(row[column] ?? '')}
                    </td>
                  ))}
                </tr>
              ))}
              {!filteredRows.length && (
                <tr>
                  <td colSpan={activeVisibleColumns.length + 1} className="px-4 py-6 text-sm text-slate-500">
                    No rows match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default WikiAssetSpreadsheetPreview;
