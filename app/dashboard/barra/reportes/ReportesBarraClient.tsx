'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import {
  ChevronLeft,
  BarChart2,
  AlertTriangle,
  Download,
  Search,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface Props {
  today: string;
}

interface RawRow {
  inventory_date: string;
  shift: string;
  snapshot_type: string;
  inventory_id: string;
  product_name: string;
  category: string;
  bottle_ml: number;
  closed_bottles: number;
  open_fraction: number;
}

interface ProductTotal {
  inventory_id: string;
  product_name: string;
  category: string;
  bottle_ml: number;
  total_bottles: number;
  total_liters: number;
}

interface DayRow {
  date: string;
  matutino: number;
  vespertino: number;
  total: number;
}

interface ReportData {
  productTotals: ProductTotal[];
  dayRows: DayRow[];
  shiftCount: number;
  completePairs: number;
}

const CARD = 'bg-[#151D1A] rounded-2xl border border-[#223530] shadow-[0_2px_8px_rgba(0,0,0,0.2)]';

function isoWeekStart(today: string) {
  const d = new Date(today + 'T12:00:00');
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  return d.toISOString().split('T')[0];
}

function monthStart(today: string) {
  return today.slice(0, 8) + '01';
}

export default function ReportesBarraClient({ today }: Props) {
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [report, setReport] = useState<ReportData | null>(null);
  const [fetched, setFetched] = useState(false);

  function applyPreset(preset: 'hoy' | 'semana' | 'mes') {
    if (preset === 'hoy') { setFrom(today); setTo(today); }
    else if (preset === 'semana') { setFrom(isoWeekStart(today)); setTo(today); }
    else { setFrom(monthStart(today)); setTo(today); }
    setFetched(false);
  }

  const fetchReport = useCallback(async (f: string, t: string) => {
    setLoading(true);
    setError('');
    try {
      const supabase = createClient();
      const { data, error: err } = await supabase
        .from('bar_daily_inventory')
        .select(
          'inventory_date, shift, snapshot_type, inventory_id, product_name, category, bottle_ml, closed_bottles, open_fraction',
        )
        .gte('inventory_date', f)
        .lte('inventory_date', t)
        .order('inventory_date')
        .order('shift')
        .order('snapshot_type');

      if (err) throw new Error(err.message);

      const rows = (data ?? []) as RawRow[];

      // Group rows by (date, shift) → { inicial: Map<id, entry>, arrastre: Map<id, entry> }
      type EntryMap = Map<string, { closed_bottles: number; open_fraction: number; product_name: string; category: string; bottle_ml: number }>;
      type ShiftData = { inicial: EntryMap; arrastre: EntryMap };
      const byDateShift = new Map<string, ShiftData>();

      for (const row of rows) {
        const key = `${row.inventory_date}|${row.shift}`;
        if (!byDateShift.has(key)) {
          byDateShift.set(key, { inicial: new Map(), arrastre: new Map() });
        }
        const sd = byDateShift.get(key)!;
        const target = row.snapshot_type === 'inicial' ? sd.inicial : sd.arrastre;
        target.set(row.inventory_id, {
          closed_bottles: Number(row.closed_bottles),
          open_fraction: Number(row.open_fraction),
          product_name: row.product_name,
          category: row.category,
          bottle_ml: Number(row.bottle_ml),
        });
      }

      // Per product totals
      const productMap = new Map<string, ProductTotal>();
      // Per day totals
      const dayMap = new Map<string, DayRow>();
      let completePairs = 0;

      for (const [key, sd] of byDateShift) {
        const [date, shift] = key.split('|');
        if (sd.inicial.size === 0 || sd.arrastre.size === 0) continue;
        completePairs++;

        // Day row
        if (!dayMap.has(date)) {
          dayMap.set(date, { date, matutino: 0, vespertino: 0, total: 0 });
        }
        const day = dayMap.get(date)!;

        // Consume per product
        const allIds = new Set([...sd.inicial.keys(), ...sd.arrastre.keys()]);
        for (const id of allIds) {
          const ini = sd.inicial.get(id);
          const arr = sd.arrastre.get(id);
          const iniTotal = ini ? ini.closed_bottles + ini.open_fraction : 0;
          const arrTotal = arr ? arr.closed_bottles + arr.open_fraction : 0;
          const consumed = Math.max(0, iniTotal - arrTotal);
          if (consumed === 0) continue;

          const meta = ini ?? arr!;
          const liters = consumed * (meta.bottle_ml / 1000);

          if (!productMap.has(id)) {
            productMap.set(id, {
              inventory_id: id,
              product_name: meta.product_name,
              category: meta.category,
              bottle_ml: meta.bottle_ml,
              total_bottles: 0,
              total_liters: 0,
            });
          }
          const pt = productMap.get(id)!;
          pt.total_bottles = Math.round((pt.total_bottles + consumed) * 100) / 100;
          pt.total_liters = Math.round((pt.total_liters + liters) * 1000) / 1000;

          if (shift === 'Matutino') day.matutino = Math.round((day.matutino + consumed) * 100) / 100;
          else day.vespertino = Math.round((day.vespertino + consumed) * 100) / 100;
          day.total = Math.round((day.matutino + day.vespertino) * 100) / 100;
        }
      }

      const productTotals = [...productMap.values()].sort((a, b) => b.total_bottles - a.total_bottles);
      const dayRows = [...dayMap.values()].sort((a, b) => a.date.localeCompare(b.date));

      setReport({ productTotals, dayRows, shiftCount: byDateShift.size, completePairs });
      setFetched(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar reporte.');
    } finally {
      setLoading(false);
    }
  }, []);

  function handleFetch() {
    if (from > to) { setError('La fecha inicial debe ser anterior o igual a la final.'); return; }
    fetchReport(from, to);
  }

  function exportCSV() {
    if (!report) return;
    const rows: string[] = [
      '\uFEFFProducto,Categoría,ml,Botellas consumidas,Litros consumidos',
      ...report.productTotals.map(
        (p) => `"${p.product_name}","${p.category}",${p.bottle_ml},${p.total_bottles},${p.total_liters}`,
      ),
      '',
      '\uFEFFFecha,Matutino (bot.),Vespertino (bot.),Total (bot.)',
      ...report.dayRows.map(
        (d) => `${d.date},${d.matutino},${d.vespertino},${d.total}`,
      ),
    ];
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `consumo_barra_${from}_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Group products by category
  const categories = report
    ? Array.from(new Set(report.productTotals.map((p) => p.category)))
    : [];

  return (
    <div className="min-h-screen bg-[#0D1211] text-[#e6edea]">
      {/* Header */}
      <header className="bg-[#151D1A] border-b border-[#223530] px-4 py-3 flex items-center gap-3 shadow-[0_2px_8px_rgba(0,0,0,0.2)] sticky top-0 z-10">
        <Link
          href="/dashboard/barra"
          className="flex items-center justify-center w-9 h-9 rounded-xl text-[#7d9990] hover:text-[#e6edea] hover:bg-[#1c2b27] transition active:scale-[0.95]"
          aria-label="Volver"
        >
          <ChevronLeft size={22} strokeWidth={2.5} />
        </Link>
        <BarChart2 size={22} strokeWidth={1.5} className="text-[#E8899A] shrink-0" />
        <div className="flex-1 min-w-0">
          <h1 className="font-extrabold text-[#E8899A] text-lg leading-tight">
            Reporte de Consumo
          </h1>
          <p className="text-xs text-[#7d9990]">Barra</p>
        </div>
      </header>

      <main className="p-3 max-w-xl mx-auto space-y-3 pb-10">
        {/* Date range controls */}
        <div className={`${CARD} p-4 space-y-3`}>
          {/* Presets */}
          <div className="flex gap-2">
            {(['hoy', 'semana', 'mes'] as const).map((p) => (
              <button
                key={p}
                onClick={() => applyPreset(p)}
                className="flex-1 h-8 rounded-lg bg-[#1c2b27] border border-[#223530] text-[#7d9990] hover:text-[#e6edea] hover:border-[#7A1D2E]/50 text-xs font-semibold capitalize transition active:scale-[0.97] select-none"
              >
                {p === 'hoy' ? 'Hoy' : p === 'semana' ? 'Semana' : 'Mes'}
              </button>
            ))}
          </div>
          {/* Manual date range */}
          <div className="flex gap-2 items-center">
            <div className="flex-1">
              <label className="block text-[10px] text-[#7d9990] uppercase tracking-wider mb-1">
                Desde
              </label>
              <input
                type="date"
                value={from}
                max={today}
                onChange={(e) => { setFrom(e.target.value); setFetched(false); }}
                className="w-full bg-[#0a0f0e] border border-[#223530] rounded-xl px-3 py-2 text-sm text-[#e6edea] focus:outline-none focus:ring-2 focus:ring-[#B8324B]"
              />
            </div>
            <span className="text-[#7d9990] mt-4 shrink-0">—</span>
            <div className="flex-1">
              <label className="block text-[10px] text-[#7d9990] uppercase tracking-wider mb-1">
                Hasta
              </label>
              <input
                type="date"
                value={to}
                max={today}
                onChange={(e) => { setTo(e.target.value); setFetched(false); }}
                className="w-full bg-[#0a0f0e] border border-[#223530] rounded-xl px-3 py-2 text-sm text-[#e6edea] focus:outline-none focus:ring-2 focus:ring-[#B8324B]"
              />
            </div>
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <button
            onClick={handleFetch}
            disabled={loading}
            className="w-full min-h-[44px] rounded-xl bg-[#7A1D2E] hover:bg-[#9E2A3E] active:scale-[0.98] text-white font-bold text-sm transition duration-150 ease-out disabled:opacity-50 select-none flex items-center justify-center gap-2"
          >
            <Search size={15} strokeWidth={2} />
            {loading ? 'Cargando...' : 'Ver reporte'}
          </button>
        </div>

        {/* Results */}
        {fetched && report && (
          <>
            {/* Summary card */}
            <div className={`${CARD} p-4`}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold text-[#7d9990] uppercase tracking-wider">
                  Resumen
                </p>
                {report.productTotals.length > 0 && (
                  <button
                    onClick={exportCSV}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#1c2b27] border border-[#223530] text-[#7d9990] hover:text-[#e6edea] text-xs font-semibold transition active:scale-[0.97]"
                  >
                    <Download size={12} strokeWidth={2} />
                    CSV
                  </button>
                )}
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-[#0a0f0e] rounded-xl p-3 text-center">
                  <p className="font-mono font-black text-xl text-[#E8899A]">
                    {report.completePairs}
                  </p>
                  <p className="text-[10px] text-[#7d9990] mt-0.5">turnos</p>
                </div>
                <div className="bg-[#0a0f0e] rounded-xl p-3 text-center">
                  <p className="font-mono font-black text-xl text-[#E8899A]">
                    {report.dayRows.length}
                  </p>
                  <p className="text-[10px] text-[#7d9990] mt-0.5">días</p>
                </div>
                <div className="bg-[#0a0f0e] rounded-xl p-3 text-center">
                  <p className="font-mono font-black text-xl text-[#E8899A]">
                    {report.productTotals.length}
                  </p>
                  <p className="text-[10px] text-[#7d9990] mt-0.5">productos</p>
                </div>
              </div>
              {report.completePairs === 0 && (
                <p className="text-center text-xs text-[#7d9990] mt-3">
                  Sin pares Inicial/Arrastre completos en este período.
                </p>
              )}
            </div>

            {/* Products by category */}
            {categories.map((cat) => {
              const items = report.productTotals.filter((p) => p.category === cat);
              const maxBottles = Math.max(...items.map((p) => p.total_bottles), 0.01);
              return (
                <div key={cat}>
                  <p className="text-[10px] font-bold text-[#7d9990] uppercase tracking-wider px-1 mb-1.5 capitalize">
                    {cat}
                  </p>
                  <div className={`${CARD} divide-y divide-[#223530]`}>
                    {items.map((product) => {
                      const pct = (product.total_bottles / maxBottles) * 100;
                      return (
                        <div key={product.inventory_id} className="px-4 py-3">
                          <div className="flex items-center gap-2 mb-1.5">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-semibold text-sm text-[#e6edea] leading-tight">
                                  {product.product_name}
                                </span>
                                <span className="text-[10px] text-[#7d9990] bg-[#1c2b27] px-1.5 py-0.5 rounded-md">
                                  {product.bottle_ml}ml
                                </span>
                              </div>
                            </div>
                            <div className="shrink-0 text-right">
                              <p className="font-mono font-bold text-sm text-[#F5C2CB]">
                                {product.total_bottles % 1 === 0
                                  ? product.total_bottles.toFixed(0)
                                  : product.total_bottles.toFixed(2)}{' '}
                                bot.
                              </p>
                              <p className="text-[10px] text-[#7d9990]">
                                {product.total_liters % 1 === 0
                                  ? product.total_liters.toFixed(0)
                                  : product.total_liters.toFixed(2)}{' '}
                                L
                              </p>
                            </div>
                          </div>
                          {/* Bar */}
                          <div className="h-1.5 bg-[#1c2b27] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[#7A1D2E] rounded-full transition-all duration-300"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* Daily breakdown table */}
            {report.dayRows.length > 0 && (
              <div>
                <p className="text-[10px] font-bold text-[#7d9990] uppercase tracking-wider px-1 mb-1.5">
                  Consumo por día (botellas totales)
                </p>
                <div className={`${CARD} overflow-hidden`}>
                  {/* Table header */}
                  <div className="grid grid-cols-4 px-4 py-2 border-b border-[#223530] bg-[#0a0f0e]">
                    <span className="text-[10px] font-bold text-[#7d9990] uppercase tracking-wider">
                      Fecha
                    </span>
                    <span className="text-[10px] font-bold text-[#7d9990] uppercase tracking-wider text-right">
                      Mat.
                    </span>
                    <span className="text-[10px] font-bold text-[#7d9990] uppercase tracking-wider text-right">
                      Ves.
                    </span>
                    <span className="text-[10px] font-bold text-[#7d9990] uppercase tracking-wider text-right">
                      Total
                    </span>
                  </div>
                  {report.dayRows.map((row, i) => (
                    <div
                      key={row.date}
                      className={`grid grid-cols-4 px-4 py-2.5 ${
                        i < report.dayRows.length - 1 ? 'border-b border-[#223530]' : ''
                      }`}
                    >
                      <span className="text-xs text-[#e6edea] font-mono">{row.date.slice(5)}</span>
                      <span className="text-xs font-mono text-[#7d9990] text-right">
                        {row.matutino > 0
                          ? row.matutino % 1 === 0
                            ? row.matutino.toFixed(0)
                            : row.matutino.toFixed(2)
                          : '—'}
                      </span>
                      <span className="text-xs font-mono text-[#7d9990] text-right">
                        {row.vespertino > 0
                          ? row.vespertino % 1 === 0
                            ? row.vespertino.toFixed(0)
                            : row.vespertino.toFixed(2)
                          : '—'}
                      </span>
                      <span className="text-xs font-mono font-bold text-[#F5C2CB] text-right">
                        {row.total % 1 === 0 ? row.total.toFixed(0) : row.total.toFixed(2)}
                      </span>
                    </div>
                  ))}
                  {/* Totals footer */}
                  <div className="grid grid-cols-4 px-4 py-2.5 border-t border-[#7A1D2E]/40 bg-[#1c2b27]">
                    <span className="text-[10px] font-bold text-[#7d9990] uppercase tracking-wider">
                      Total
                    </span>
                    <span className="text-xs font-mono font-bold text-[#e6edea] text-right">
                      {(() => {
                        const t = report.dayRows.reduce((s, r) => s + r.matutino, 0);
                        return t > 0 ? (t % 1 === 0 ? t.toFixed(0) : t.toFixed(2)) : '—';
                      })()}
                    </span>
                    <span className="text-xs font-mono font-bold text-[#e6edea] text-right">
                      {(() => {
                        const t = report.dayRows.reduce((s, r) => s + r.vespertino, 0);
                        return t > 0 ? (t % 1 === 0 ? t.toFixed(0) : t.toFixed(2)) : '—';
                      })()}
                    </span>
                    <span className="text-xs font-mono font-bold text-[#E8899A] text-right">
                      {(() => {
                        const t = report.dayRows.reduce((s, r) => s + r.total, 0);
                        return t % 1 === 0 ? t.toFixed(0) : t.toFixed(2);
                      })()}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Low stock warning across period */}
            {report.productTotals.some((p) => p.total_bottles === 0) && (
              <div className="flex items-start gap-2 bg-amber-950/40 border border-amber-700/50 rounded-xl px-3 py-2.5">
                <AlertTriangle size={15} strokeWidth={2} className="text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-300">
                  Algunos productos no registraron consumo en el período seleccionado.
                </p>
              </div>
            )}
          </>
        )}

        {fetched && report && report.productTotals.length === 0 && (
          <div className="text-center py-12 text-[#7d9990] text-sm">
            Sin datos de consumo en el período seleccionado.
          </div>
        )}
      </main>
    </div>
  );
}
