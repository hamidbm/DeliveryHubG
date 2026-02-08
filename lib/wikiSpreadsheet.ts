import * as XLSX from 'xlsx';

export const buildSheetData = (sheet: XLSX.WorkSheet) => {
  const grid = XLSX.utils.sheet_to_json<any[]>(sheet, {
    header: 1,
    defval: '',
    raw: false,
  });

  if (!grid.length) {
    return { columns: [], rows: [] };
  }

  const headerRowIndex = grid.reduce(
    (best, row, index) => {
      const nonEmptyCells = row.filter((cell) => String(cell ?? '').trim() !== '');
      const nonEmptyCount = nonEmptyCells.length;
      const labelCount = nonEmptyCells.filter((cell) => /[a-zA-Z]/.test(String(cell))).length;
      const numericCount = nonEmptyCells.filter((cell) => !isNaN(Number(cell))).length;
      const score = labelCount * 2 + nonEmptyCount - numericCount;
      if (score > best.score) {
        return { index, score };
      }
      return best;
    },
    { index: 0, score: -1 }
  ).index;

  const headerRow = grid[headerRowIndex] || [];
  const rawColumns = headerRow.map((cell, colIndex) => {
    const label = String(cell ?? '').trim();
    if (label && !/^__EMPTY/i.test(label)) return label;
    const colLetter = XLSX.utils.encode_col(colIndex);
    return `Column ${colLetter}`;
  });

  const columns = rawColumns.filter((col, colIndex) => {
    if (!col) return false;
    if (headerRow[colIndex] && String(headerRow[colIndex]).trim() !== '') return true;
    return grid.slice(headerRowIndex + 1).some((row) => String(row[colIndex] ?? '').trim() !== '');
  });

  const rows = grid
    .slice(headerRowIndex + 1)
    .map((row, rowIndex) => {
      const rowData: Record<string, any> = { _rowId: rowIndex + 1 };
      rawColumns.forEach((col, colIndex) => {
        if (!columns.includes(col)) return;
        rowData[col] = row[colIndex] ?? '';
      });
      return rowData;
    })
    .filter((row) => {
      return Object.entries(row).some(
        ([key, value]) => key !== '_rowId' && String(value ?? '').trim() !== ''
      );
    });

  return { columns, rows };
};
