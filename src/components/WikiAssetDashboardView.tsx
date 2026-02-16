import React, { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { WikiAsset } from '../types';

interface WikiAssetDashboardViewProps {
  asset: WikiAsset;
  onBack?: () => void;
}

const parseNumber = (value: any) => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const normalized = value.replace(/[^0-9.-]+/g, '');
    const parsed = Number(normalized);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
};

const getSheetData = (asset: WikiAsset) => {
  if (asset.preview.kind !== 'sheet' || !asset.preview.objectKey) return null;
  try {
    return JSON.parse(asset.preview.objectKey);
  } catch {
    return null;
  }
};

const WikiAssetDashboardView: React.FC<WikiAssetDashboardViewProps> = ({ asset, onBack }) => {
  const sheetData = useMemo(() => getSheetData(asset), [asset]);
  const sheets = sheetData?.sheets || [];
  const [activeSheetIndex, setActiveSheetIndex] = useState(0);

  const activeSheet = sheets[activeSheetIndex] || sheets[0];
  const columns: string[] = activeSheet?.columns || [];
  const rows: Record<string, any>[] = activeSheet?.rows || [];

  const candidateValueColumns = columns.filter((column) =>
    rows.some((row) => parseNumber(row[column]) !== 0)
  );
  const candidateCategoryColumns = columns.filter((column) =>
    rows.some((row) => String(row[column] ?? '').trim() !== '')
  );

  const [categoryColumn, setCategoryColumn] = useState(candidateCategoryColumns[0] || '');
  const [valueColumn, setValueColumn] = useState(candidateValueColumns[0] || '');

  const chartData = useMemo(() => {
    if (!categoryColumn || !valueColumn) return [];
    const aggregate = new Map<string, number>();
    rows.forEach((row) => {
      const key = String(row[categoryColumn] ?? '').trim() || 'Unspecified';
      const value = parseNumber(row[valueColumn]);
      aggregate.set(key, (aggregate.get(key) || 0) + value);
    });
    return Array.from(aggregate.entries()).map(([label, total]) => ({
      label,
      total,
    }));
  }, [rows, categoryColumn, valueColumn]);

  const totalValue = useMemo(() => {
    if (!valueColumn) return 0;
    return rows.reduce((sum, row) => sum + parseNumber(row[valueColumn]), 0);
  }, [rows, valueColumn]);

  if (!sheets.length) {
    return (
      <div className="bg-white border border-slate-100 p-8 rounded-[2.5rem] shadow-inner">
        <p className="text-sm text-slate-500">No spreadsheet data available.</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-100 p-8 rounded-[2.5rem] shadow-inner">
      <div className="mb-6 flex flex-wrap gap-4 items-center">
        {onBack && (
          <button
            onClick={onBack}
            className="px-3 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg bg-slate-100 text-slate-600 border border-slate-200 hover:bg-white transition-all flex items-center gap-2"
          >
            <i className="fas fa-arrow-left"></i> Back to Tiles
          </button>
        )}
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
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Category</label>
          <select
            className="border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold"
            value={categoryColumn}
            onChange={(e) => setCategoryColumn(e.target.value)}
          >
            {candidateCategoryColumns.map((column) => (
              <option value={column} key={column}>
                {column}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Value</label>
          <select
            className="border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold"
            value={valueColumn}
            onChange={(e) => setValueColumn(e.target.value)}
          >
            {candidateValueColumns.map((column) => (
              <option value={column} key={column}>
                {column}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[240px,1fr]">
        <div className="border border-slate-200 rounded-2xl p-5 bg-slate-50">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Total</p>
          <p className="text-3xl font-black text-slate-800">{totalValue.toLocaleString()}</p>
          <p className="text-xs text-slate-500 mt-2">{valueColumn || 'Select a value column'}</p>
        </div>
        <div className="border border-slate-200 rounded-2xl p-5 bg-white shadow-sm">
          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="total" fill="#2563eb" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="border border-slate-200 rounded-2xl p-5 bg-white shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Distribution</p>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip />
                <Pie data={chartData} dataKey="total" nameKey="label" fill="#6366f1" label />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="border border-slate-200 rounded-2xl p-5 bg-white shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Trend</p>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Line type="monotone" dataKey="total" stroke="#0ea5e9" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WikiAssetDashboardView;
