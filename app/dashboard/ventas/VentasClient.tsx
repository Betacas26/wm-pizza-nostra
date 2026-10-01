'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

// ── Tipos ──────────────────────────────────────────────────────────────────
type SaleShift = 'Matutino' | 'Vespertino';
type ActiveTab = 'registrar' | 'hoy' | 'mes';

export interface StaffMember {
  id: string;
  name: string;
}

export interface SaleRecord {
  id: string;
  sale_date: string;
  shift: SaleShift;
  staff_id: string;
  staff_name: string;
  total: number;
  contribution: number;
  glassware: number;
  captain_tip: number;
  to_deliver: number;
}

export interface VentasClientProps {
  staff: StaffMember[];
  initialSales: SaleRecord[];
  isManager: boolean;
  today: string;
}

// ── Constantes (logic.md) ─────────────────────────────────────────────────
const APORTE_PCT = 4.5;
const CRISTALERIA = 10.0;
const CAPITAN_PCT = 0.8;

/**
 * Calcula los valores derivados de una venta total.
 * Determinista: redondea a 2 decimales, nunca produce NaN ni valores negativos.
 * @param rawTotal - Importe bruto de la venta
 */
function calcular(rawTotal: number): {
  total: number;
  contribution: number;
  glassware: number;
  captain_tip: number;
  to_deliver: number;
} {
  const total = isFinite(rawTotal) && rawTotal > 0 ? rawTotal : 0;
  // Aporte = total × 4.5%  →  Math.round(total × 4.5) / 100
  const contribution = Math.round(total * APORTE_PCT) / 100;
  // Propina Capitán = total × 0.8%  (solo informativo)
  const captain_tip = Math.round(total * CAPITAN_PCT) / 100;
  // Total a entregar = Aporte + Cristalería (cristalería NO incluye propina)
  const to_deliver = Math.round((contribution + CRISTALERIA) * 100) / 100;
  return { total, contribution, glassware: CRISTALERIA, captain_tip, to_deliver };
}

function fmtMXN(n: number): string {
  return `$${n.toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Genera y descarga un archivo CSV con el detalle de ventas del mes.
 * Incluye BOM UTF-8 para compatibilidad con Excel.
 */
function exportarCSV(records: SaleRecord[], monthLabel: string) {
  const headers = [
    'Fecha',
    'Turno',
    'Mesero',
    'Venta Total',
    'Aporte (4.5%)',
    'Cristaleria',
    'Total a Entregar',
    'Propina Capitan (info)',
  ];
  const rows = records.map((r) => [
    r.sale_date,
    r.shift,
    `"${r.staff_name.replace(/"/g, '""')}"`,
    r.total.toFixed(2),
    r.contribution.toFixed(2),
    r.glassware.toFixed(2),
    r.to_deliver.toFixed(2),
    r.captain_tip.toFixed(2),
  ]);
  const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ventas_${monthLabel}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Componente ─────────────────────────────────────────────────────────────
export default function VentasClient({
  staff,
  initialSales,
  isManager,
  today,
}: VentasClientProps) {
  const supabase = useMemo(() => createClient(), []);

  const [activeTab, setActiveTab] = useState<ActiveTab>('registrar');

  // ── Form state ─────────────────────────────────────────────────────────
  const [formStaffId, setFormStaffId] = useState(staff[0]?.id ?? '');
  const [formShift, setFormShift] = useState<SaleShift>('Matutino');
  const [formTotal, setFormTotal] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);

  // Cálculo en vivo sin efectos secundarios
  const liveCalc = useMemo(() => {
    const n = parseFloat(formTotal);
    return isFinite(n) && n > 0 ? calcular(n) : null;
  }, [formTotal]);

  // ── Ventas del día ─────────────────────────────────────────────────────
  const [todaySales, setTodaySales] = useState<SaleRecord[]>(initialSales);

  // ── Resumen mensual ────────────────────────────────────────────────────
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [monthSales, setMonthSales] = useState<SaleRecord[]>([]);
  const [monthLoading, setMonthLoading] = useState(false);

  const monthOptions = useMemo(() => {
    const now = new Date();
    const opts: { value: string; label: string }[] = [];
    for (let i = 0; i < 13; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      opts.push({
        value: `${y}-${String(m).padStart(2, '0')}`,
        label: d.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' }),
      });
    }
    return opts;
  }, []);

  // ── Carga de datos mensuales ───────────────────────────────────────────
  /**
   * Obtiene todas las ventas del mes `ym` (formato "YYYY-MM") y resuelve
   * los nombres de los meseros en una segunda consulta.
   */
  const loadMonthSales = useCallback(
    async (ym: string) => {
      setMonthLoading(true);
      const [yearStr, monthStr] = ym.split('-');
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10);
      const firstDay = `${year}-${String(month).padStart(2, '0')}-01`;
      const daysInMonth = new Date(year, month, 0).getDate();
      const lastDay = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

      const { data: salesData } = await supabase
        .from('sales')
        .select(
          'id, sale_date, shift, staff_id, total, contribution, glassware, captain_tip, to_deliver',
        )
        .gte('sale_date', firstDay)
        .lte('sale_date', lastDay)
        .order('sale_date', { ascending: true });

      if (!salesData?.length) {
        setMonthSales([]);
        setMonthLoading(false);
        return;
      }

      // Resolver nombres: consulta puntual solo para los staff_id presentes
      const staffIds = [
        ...new Set(
          (salesData as { staff_id: string }[]).map((s) => s.staff_id),
        ),
      ];
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', staffIds);

      const nameMap = new Map<string, string>(
        (profilesData ?? []).map(
          (p: { id: string; name: string | null }) => [
            p.id,
            p.name ?? '(sin nombre)',
          ],
        ),
      );

      const records: SaleRecord[] = (
        salesData as {
          id: string;
          sale_date: string;
          shift: string;
          staff_id: string;
          total: number | null;
          contribution: number | null;
          glassware: number | null;
          captain_tip: number | null;
          to_deliver: number | null;
        }[]
      ).map((s) => ({
        id: s.id,
        sale_date: s.sale_date,
        shift: s.shift as SaleShift,
        staff_id: s.staff_id,
        staff_name: nameMap.get(s.staff_id) ?? s.staff_id,
        total: Number(s.total) || 0,
        contribution: Number(s.contribution) || 0,
        glassware: Number(s.glassware) || 0,
        captain_tip: Number(s.captain_tip) || 0,
        to_deliver: Number(s.to_deliver) || 0,
      }));

      setMonthSales(records);
      setMonthLoading(false);
    },
    [supabase],
  );

  useEffect(() => {
    if (activeTab === 'mes') {
      loadMonthSales(selectedMonth);
    }
  }, [activeTab, selectedMonth, loadMonthSales]);

  // ── Agregado mensual (solo vista, no persiste) ─────────────────────────
  const monthSummary = useMemo(() => {
    type StaffAgg = {
      name: string;
      count: number;
      total: number;
      contribution: number;
      glassware: number;
      to_deliver: number;
    };
    const byStaff = new Map<string, StaffAgg>();

    for (const s of monthSales) {
      const existing = byStaff.get(s.staff_id);
      if (existing) {
        existing.count++;
        existing.total += s.total;
        existing.contribution += s.contribution;
        existing.glassware += s.glassware;
        existing.to_deliver += s.to_deliver;
      } else {
        byStaff.set(s.staff_id, {
          name: s.staff_name,
          count: 1,
          total: s.total,
          contribution: s.contribution,
          glassware: s.glassware,
          to_deliver: s.to_deliver,
        });
      }
    }

    let grandTotal = 0;
    let grandContrib = 0;
    let grandGlass = 0;
    let grandDeliver = 0;
    for (const v of byStaff.values()) {
      grandTotal += v.total;
      grandContrib += v.contribution;
      grandGlass += v.glassware;
      grandDeliver += v.to_deliver;
    }

    return {
      byStaff,
      grandTotal: Math.round(grandTotal * 100) / 100,
      grandContrib: Math.round(grandContrib * 100) / 100,
      grandGlass: Math.round(grandGlass * 100) / 100,
      grandDeliver: Math.round(grandDeliver * 100) / 100,
    };
  }, [monthSales]);

  // ── Guardar venta ──────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!formStaffId || !formTotal) return;
    const rawTotal = parseFloat(formTotal);
    if (!isFinite(rawTotal) || rawTotal <= 0) return;

    setSaving(true);
    const calc = calcular(rawTotal);

    const { data: inserted, error } = await supabase
      .from('sales')
      .insert({
        sale_date: today,
        shift: formShift,
        staff_id: formStaffId,
        total: calc.total,
        pct: APORTE_PCT,
        glassware: CRISTALERIA,
        captain_pct: CAPITAN_PCT,
        contribution: calc.contribution,
        captain_tip: calc.captain_tip,
        to_deliver: calc.to_deliver,
      })
      .select()
      .single();

    if (!error && inserted) {
      const record: SaleRecord = {
        id: (inserted as { id: string }).id,
        sale_date: today,
        shift: formShift,
        staff_id: formStaffId,
        staff_name: staff.find((s) => s.id === formStaffId)?.name ?? formStaffId,
        total: calc.total,
        contribution: calc.contribution,
        glassware: calc.glassware,
        captain_tip: calc.captain_tip,
        to_deliver: calc.to_deliver,
      };
      setTodaySales((prev) => [record, ...prev]);
      setFormTotal('');
      setSavedMsg(true);
      setTimeout(() => setSavedMsg(false), 2500);
      setActiveTab('hoy');
    }

    setSaving(false);
  }

  // ── Eliminar venta (solo managers) ────────────────────────────────────
  async function handleDelete(id: string) {
    if (!window.confirm('¿Eliminar esta venta?')) return;
    await supabase.from('sales').delete().eq('id', id);
    setTodaySales((prev) => prev.filter((s) => s.id !== id));
  }

  // ── Tab bar ────────────────────────────────────────────────────────────
  const tabs: { key: ActiveTab; label: string }[] = [
    { key: 'registrar', label: 'Registrar' },
    { key: 'hoy', label: `Hoy\u00a0(${todaySales.length})` },
    { key: 'mes', label: 'Mes' },
  ];

  return (
    <div className="min-h-screen bg-stone-50 text-stone-800">
      {/* Header */}
      <header className="bg-white border-b border-stone-200 px-4 py-3 flex items-center gap-3 shadow-sm sticky top-0 z-10">
        <Link
          href="/dashboard"
          className="text-stone-400 hover:text-stone-700 text-xl leading-none"
          aria-label="Volver"
        >
          &#8592;
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="font-extrabold text-amber-600 text-lg leading-tight">Ventas</h1>
          <p className="text-xs text-stone-500">{today}</p>
        </div>
        {savedMsg && (
          <span className="text-xs font-semibold text-emerald-600">&#10003; Guardado</span>
        )}
      </header>

      {/* Tabs */}
      <div className="bg-white border-b border-stone-200 flex sticky top-[57px] z-10">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 py-3 text-sm font-semibold transition border-b-2 ${
              activeTab === tab.key
                ? 'border-amber-500 text-amber-600'
                : 'border-transparent text-stone-500 hover:text-stone-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <main className="p-4 max-w-xl mx-auto">

        {/* ── Tab: Registrar ──────────────────────────────────────────── */}
        {activeTab === 'registrar' && (
          <form onSubmit={handleSubmit} className="space-y-4 pt-1">
            {/* Mesero */}
            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                Mesero
              </label>
              <select
                value={formStaffId}
                onChange={(e) => setFormStaffId(e.target.value)}
                required
                className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-500 text-stone-800 text-base bg-white"
              >
                <option value="">Seleccionar...</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Turno */}
            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                Turno
              </label>
              <div className="flex gap-2">
                {(['Matutino', 'Vespertino'] as SaleShift[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setFormShift(s)}
                    className={`flex-1 min-h-[44px] rounded-xl font-semibold text-sm transition ${
                      formShift === s
                        ? s === 'Matutino'
                          ? 'bg-amber-500 text-white shadow-sm'
                          : 'bg-sky-500 text-white shadow-sm'
                        : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Venta total */}
            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                Venta Total ($)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formTotal}
                onChange={(e) => setFormTotal(e.target.value)}
                placeholder="0.00"
                required
                className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-500 text-stone-800 text-base"
              />
            </div>

            {/* Vista previa del cálculo */}
            {liveCalc ? (
              <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4 space-y-2.5">
                <p className="text-xs font-bold text-stone-400 uppercase tracking-wider">
                  Vista previa del cierre
                </p>
                <div className="flex justify-between text-sm">
                  <span className="text-stone-600">
                    Aporte ({APORTE_PCT}%)
                  </span>
                  <span className="font-semibold text-stone-800">
                    {fmtMXN(liveCalc.contribution)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-stone-600">Cristaleria (fijo)</span>
                  <span className="font-semibold text-stone-800">
                    {fmtMXN(liveCalc.glassware)}
                  </span>
                </div>
                <div className="flex justify-between text-sm border-t border-stone-200 pt-2.5">
                  <span className="font-bold text-stone-900">Total a entregar</span>
                  <span className="font-bold text-xl text-amber-600">
                    {fmtMXN(liveCalc.to_deliver)}
                  </span>
                </div>
                <div className="flex justify-between text-xs pt-0.5">
                  <span className="text-stone-400 italic">
                    Propina Capitan ({CAPITAN_PCT}% — informativo)
                  </span>
                  <span className="text-stone-400 italic">
                    {fmtMXN(liveCalc.captain_tip)}
                  </span>
                </div>
              </div>
            ) : (
              <div className="bg-stone-50 border border-dashed border-stone-200 rounded-2xl p-5 text-center text-sm text-stone-400">
                Ingresa el monto para ver el calculo en vivo
              </div>
            )}

            <button
              type="submit"
              disabled={saving || !formStaffId || !formTotal}
              className="w-full min-h-[44px] bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white font-bold rounded-xl shadow transition text-sm disabled:opacity-50"
            >
              {saving ? 'Guardando...' : 'Guardar venta'}
            </button>
          </form>
        )}

        {/* ── Tab: Hoy ────────────────────────────────────────────────── */}
        {activeTab === 'hoy' && (
          <div className="space-y-3 pt-1">
            {todaySales.length === 0 ? (
              <div className="text-center py-14 text-stone-400 text-sm">
                Sin ventas registradas hoy.
              </div>
            ) : (
              <>
                {/* Resumen rápido del día */}
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                  <p className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-3">
                    Resumen del dia
                  </p>
                  <div className="flex gap-5 flex-wrap text-sm">
                    <div>
                      <p className="text-xs text-stone-500 mb-0.5">Total ventas</p>
                      <p className="font-bold text-stone-900">
                        {fmtMXN(
                          Math.round(
                            todaySales.reduce((a, s) => a + s.total, 0) * 100,
                          ) / 100,
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-stone-500 mb-0.5">A entregar total</p>
                      <p className="font-bold text-amber-600">
                        {fmtMXN(
                          Math.round(
                            todaySales.reduce((a, s) => a + s.to_deliver, 0) * 100,
                          ) / 100,
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-stone-500 mb-0.5">Registros</p>
                      <p className="font-bold text-stone-900">{todaySales.length}</p>
                    </div>
                  </div>
                </div>

                {/* Detalle por registro */}
                {todaySales.map((sale) => (
                  <div
                    key={sale.id}
                    className="bg-white rounded-2xl border border-stone-200 shadow-sm p-4"
                  >
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div>
                        <p className="font-bold text-stone-900 text-sm">
                          {sale.staff_name}
                        </p>
                        <span
                          className={`mt-1 inline-block text-xs px-2 py-0.5 rounded-full font-medium ${
                            sale.shift === 'Matutino'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-sky-100 text-sky-700'
                          }`}
                        >
                          {sale.shift}
                        </span>
                      </div>
                      {isManager && (
                        <button
                          onClick={() => handleDelete(sale.id)}
                          className="shrink-0 text-xs font-semibold text-red-400 hover:text-red-600 px-2 py-1 rounded-lg hover:bg-red-50 transition"
                        >
                          Eliminar
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-stone-500">Venta</span>
                        <span className="font-semibold">{fmtMXN(sale.total)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-stone-500">Aporte</span>
                        <span className="font-semibold">{fmtMXN(sale.contribution)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-stone-500">Cristaleria</span>
                        <span className="font-semibold">{fmtMXN(sale.glassware)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-bold text-stone-900">A entregar</span>
                        <span className="font-bold text-amber-600">
                          {fmtMXN(sale.to_deliver)}
                        </span>
                      </div>
                      <div className="flex justify-between col-span-2 pt-1.5 mt-0.5 border-t border-stone-100">
                        <span className="text-stone-400 italic">
                          Propina Cap. (info)
                        </span>
                        <span className="text-stone-400 italic">
                          {fmtMXN(sale.captain_tip)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {/* ── Tab: Mes ─────────────────────────────────────────────────── */}
        {activeTab === 'mes' && (
          <div className="space-y-4 pt-1">
            {/* Selector de mes */}
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-500 text-stone-800 text-base bg-white capitalize"
            >
              {monthOptions.map((opt) => (
                <option key={opt.value} value={opt.value} className="capitalize">
                  {opt.label}
                </option>
              ))}
            </select>

            {monthLoading ? (
              <div className="text-center py-14 text-stone-400 text-sm">
                Cargando...
              </div>
            ) : monthSales.length === 0 ? (
              <div className="text-center py-14 text-stone-400 text-sm">
                Sin ventas en este mes.
              </div>
            ) : (
              <>
                {/* Tarjetas por mesero */}
                {[...monthSummary.byStaff.entries()].map(([staffId, agg]) => (
                  <div
                    key={staffId}
                    className="bg-white rounded-2xl border border-stone-200 shadow-sm p-4"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <p className="font-bold text-stone-900 text-sm">{agg.name}</p>
                      <span className="text-xs text-stone-400">
                        {agg.count} registro{agg.count !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-stone-500">Total ventas</span>
                        <span className="font-semibold">
                          {fmtMXN(Math.round(agg.total * 100) / 100)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-stone-500">Aporte</span>
                        <span className="font-semibold">
                          {fmtMXN(Math.round(agg.contribution * 100) / 100)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-stone-500">Cristaleria</span>
                        <span className="font-semibold">
                          {fmtMXN(Math.round(agg.glassware * 100) / 100)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-bold text-stone-900">A entregar</span>
                        <span className="font-bold text-amber-600">
                          {fmtMXN(Math.round(agg.to_deliver * 100) / 100)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Totales del mes */}
                <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4">
                  <p className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-3">
                    Totales del mes &middot; {monthSales.length} registros
                  </p>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-stone-600">Total ventas</span>
                      <span className="font-semibold">
                        {fmtMXN(monthSummary.grandTotal)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-600">Aporte</span>
                      <span className="font-semibold">
                        {fmtMXN(monthSummary.grandContrib)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-600">Cristaleria</span>
                      <span className="font-semibold">
                        {fmtMXN(monthSummary.grandGlass)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-bold text-stone-900">A entregar</span>
                      <span className="font-bold text-amber-600">
                        {fmtMXN(monthSummary.grandDeliver)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Exportar CSV */}
                <button
                  onClick={() => exportarCSV(monthSales, selectedMonth)}
                  className="w-full min-h-[44px] bg-stone-700 hover:bg-stone-800 active:bg-stone-900 text-white font-bold rounded-xl shadow transition text-sm"
                >
                  Exportar CSV
                </button>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
