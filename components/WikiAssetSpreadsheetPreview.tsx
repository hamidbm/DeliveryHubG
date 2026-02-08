import React, { useMemo, useState } from 'react';
import { WikiAsset } from '../types';

interface WikiAssetSpreadsheetPreviewProps {
  asset: WikiAsset;
}

const WikiAssetSpreadsheetPreview: React.FC<WikiAssetSpreadsheetPreviewProps> = ({ asset }) => {
  const [activeSheetIndex, setActiveSheetIndex] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterColumn, setFilterColumn] = useState('all');
  const [filterValue, setFilterValue] = useState('');
  const [editingRowId, setEditingRowId] = useState<number | null>(null);
  const [editedRow, setEditedRow] = useState<Record<string, any>>({});
  const [isSaving, setIsSaving] = useState(false);

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

  const handleEditRow = (row: Record<string, any>) => {
    setEditingRowId(row._rowId);
    setEditedRow({ ...row });
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
      </div>
      <div className="grid gap-6">
        {filteredRows.map((row) => (
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
              {columns.map((column) => (
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
    </div>
  );
};

export default WikiAssetSpreadsheetPreview;
