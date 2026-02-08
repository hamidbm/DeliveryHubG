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
      const nonEmptyCount = row.filter((cell) => String(cell ?? '').trim() !== '').length;
      if (nonEmptyCount > best.count) {
        return { index, count: nonEmptyCount };
      }
      return best;
    },
    { index: 0, count: 0 }
  ).index;

  const headerRow = grid[headerRowIndex] || [];
  const columns = headerRow.map((cell, colIndex) => {
    const label = String(cell ?? '').trim();
    if (label) return label;
    const colLetter = XLSX.utils.encode_col(colIndex);
    return `Column ${colLetter}`;
  });

  const rows = grid
    .slice(headerRowIndex + 1)
    .map((row, rowIndex) => {
      const rowData: Record<string, any> = { _rowId: rowIndex + 1 };
      columns.forEach((col, colIndex) => {
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
