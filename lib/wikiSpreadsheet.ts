import type { Worksheet } from 'exceljs';

function columnToLetter(colIndex: number): string {
  let letter = '';
  let num = colIndex + 1;
  while (num > 0) {
    const remainder = (num - 1) % 26;
    letter = String.fromCharCode(65 + remainder) + letter;
    num = Math.floor((num - 1) / 26);
  }
  return letter;
}

export const buildSheetData = (worksheet: Worksheet) => {
  const grid: any[][] = [];
  
  // Convert worksheet to 2D array
  worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    const rowData: any[] = [];
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      rowData[colNumber - 1] = cell.text || cell.value || '';
    });
    grid.push(rowData);
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
    const colLetter = columnToLetter(colIndex);
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
