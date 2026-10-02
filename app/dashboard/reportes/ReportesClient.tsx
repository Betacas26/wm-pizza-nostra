'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

// ── Tipos ──────────────────────────────────────────────────────────────────
type ReportTab = 'ventas' | 'capitan' | 'bonos' | 'ranking';

interface StaffSummary {
  staff_id: string;
  name: string;
  count: number;
  total: number;
  contribution: number;
  to_deliver: number;
  captain_tip: number;
  sanction_amount: number;
}

interface DaySummary {
  sale_date: string;
  captain_total: number;
  ventas_total: number;
  registros: number;
}

// ── Utilidades ─────────────────────────────────────────────────────────────
function fmtMXN(n: number): string {
  return `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// ── Componente ─────────────────────────────────────────────────────────────
export default function ReportesClient({ isAdmin }: { isAdmin: boolean }) {
  const supabase = useMemo(() => createClient(), []);

  const [tab, setTab] = useState<ReportTab>('ventas');
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth);
  const [loading, setLoading] = useState(false);

  const [staffSummaries, setStaffSummaries] = useState<StaffSummary[]>([]);
  const [daySummaries, setDaySummaries] = useState<DaySummary[]>([]);

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

  const loadData = useCallback(
    async (ym: string) => {
      setLoading(true);
      const [yearStr, monthStr] = ym.split('-');
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10);
      const firstDay = `${year}-${String(month).padStart(2, '0')}-01`;
      const daysInMonth = new Date(year, month, 0).getDate();
      const lastDay = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

      const { data: salesData } = await supabase
        .from('sales')
        .select(
          'sale_date, staff_id, total, contribution, to_deliver, captain_tip, sanction_amount',
        )
        .gte('sale_date', firstDay)
        .lte('sale_date', lastDay)
        .order('sale_date', { ascending: true });

      if (!salesData?.length) {
        setStaffSummaries([]);
        setDaySummaries([]);
        setLoading(false);
        return;
      }

      // Resolver nombres
      const staffIds = [...new Set((salesData as { staff_id: string }[]).map((s) => s.staff_id))];
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', staffIds);

      const nameMap = new Map<string, string>(
        (profilesData ?? []).map((p: { id: string; name: string | null }) => [
          p.id, p.name ?? '(sin nombre)',
        ]),
      );

      // Agregar por mesero
      const byStaff = new Map<string, StaffSummary>();
      const byDay = new Map<string, DaySummary>();

      for (const s of salesData as {
        sale_date: string; staff_id: string;
        total: number | null; contribution: number | null;
        to_deliver: number | null; captain_tip: number | null;
        sanction_amount: number | null;
      }[]) {
        const total = Number(s.total) || 0;
        const contribution = Number(s.contribution) || 0;
        const to_deliver = Number(s.to_deliver) || 0;
        const captain_tip = Number(s.captain_tip) || 0;
        const sanction_amount = Number(s.sanction_amount) || 0;

        // Por mesero
        const existing = byStaff.get(s.staff_id);
        if (existing) {
          existing.count++;
          existing.total += total;
          existing.contribution += contribution;
          existing.to_deliver += to_deliver;
          existing.captain_tip += captain_tip;
          existing.sanction_amount += sanction_amount;
        } else {
          byStaff.set(s.staff_id, {
            staff_id: s.staff_id,
            name: nameMap.get(s.staff_id) ?? s.staff_id,
            count: 1, total, contribution, to_deliver, captain_tip, sanction_amount,
          });
        }

        // Por día
        const dayExisting = byDay.get(s.sale_date);
        if (dayExisting) {
          dayExisting.captain_total += captain_tip;
          dayExisting.ventas_total += total;
          dayExisting.registros++;
        } else {
          byDay.set(s.sale_date, {
            sale_date: s.sale_date,
            captain_total: captain_tip,
            ventas_total: total,
            registros: 1,
          });
        }
      }

      const r = (n: number) => Math.round(n * 100) / 100;

      setStaffSummaries(
        [...byStaff.values()].map((s) => ({
          ...s,
          total: r(s.total), contribution: r(s.contribution),
          to_deliver: r(s.to_deliver), captain_tip: r(s.captain_tip),
          sanction_amount: r(s.sanction_amount),
        })).sort((a, b) => b.total - a.total),
      );

      setDaySummaries(
        [...byDay.values()].map((d) => ({
          ...d,
          captain_total: r(d.captain_total),
          ventas_total: r(d.ventas_total),
        })).sort((a, b) => a.sale_date.localeCompare(b.sale_date)),
      );

      setLoading(false);
    },
    [supabase],
  );

  useEffect(() => {
    loadData(selectedMonth);
  }, [selectedMonth, loadData]);

  const grandTotals = useMemo(() => {
    const r = (n: number) => Math.round(n * 100) / 100;
    return {
      total: r(staffSummaries.reduce((a, s) => a + s.total, 0)),
      to_deliver: r(staffSummaries.reduce((a, s) => a + s.to_deliver, 0)),
      captain_tip: r(staffSummaries.reduce((a, s) => a + s.captain_tip, 0)),
      sanction_amount: r(staffSummaries.reduce((a, s) => a + s.sanction_amount, 0)),
      count: staffSummaries.reduce((a, s) => a + s.count, 0),
    };
  }, [staffSummaries]);

  const TABS: { key: ReportTab; label: string }[] = [
    { key: 'ventas', label: 'Ventas' },
    ...(isAdmin ? [{ key: 'capitan' as ReportTab, label: 'Capitán' }] : []),
    { key: 'bonos', label: 'Bonos' },
    { key: 'ranking', label: 'Ranking' },
  ];

  return (
    <div className="min-h-screen bg-[#F8F7F4] text-stone-800">
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
          <h1 className="font-extrabold text-amber-600 text-lg leading-tight">Reportes</h1>
          <p className="text-xs text-stone-500 capitalize">
            {monthOptions.find((o) => o.value === selectedMonth)?.label ?? selectedMonth}
          </p>
        </div>
      </header>

      {/* Subtabs — segmented control */}
      <div className="bg-white border-b border-stone-200 sticky top-[57px] z-10 px-4 py-2">
        <div className="p-1 bg-stone-100 rounded-xl flex">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 h-9 rounded-lg text-sm font-semibold transition duration-150 ease-out active:scale-[0.98] select-none ${
                tab === t.key
                  ? 'bg-white text-stone-900 shadow-sm'
                  : 'text-stone-500 hover:text-stone-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <main className="p-4 max-w-2xl mx-auto space-y-4">
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

        {loading ? (
          <div className="text-center py-16 text-stone-400 text-sm">Cargando reportes...</div>
        ) : staffSummaries.length === 0 ? (
          <div className="text-center py-16 text-stone-400 text-sm">Sin datos en este mes.</div>
        ) : (
          <>
            {/* ── Ventas ── */}
            {tab === 'ventas' && (
              <div className="space-y-3">
                {/* Totales globales */}
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                  <p className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-3">
                    Total del mes &middot; {grandTotals.count} registros
                  </p>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-stone-500">Total ventas</p>
                      <p className="font-mono font-bold tracking-tight text-stone-900">{fmtMXN(grandTotals.total)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-stone-500">A entregar total</p>
                      <p className="font-mono font-bold tracking-tight text-amber-600">{fmtMXN(grandTotals.to_deliver)}</p>
                    </div>
                  </div>
                </div>

                {/* Por mesero */}
                {staffSummaries.map((s) => (
                  <div key={s.staff_id} className="bg-white rounded-2xl border border-stone-200/70 shadow-[0_2px_8px_rgba(0,0,0,0.04)] p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-bold text-stone-900 text-sm">{s.name}</p>
                      <span className="text-xs text-stone-400">{s.count} reg.</span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-stone-500">Total ventas</span>
                        <span className="font-semibold">{fmtMXN(s.total)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-stone-500">Aporte</span>
                        <span className="font-semibold">{fmtMXN(s.contribution)}</span>
                      </div>
                      <div className="flex justify-between col-span-2">
                        <span className="font-bold text-stone-900">A entregar</span>
                        <span className="font-bold text-amber-600">{fmtMXN(s.to_deliver)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── Capitán (solo admin) ── */}
            {tab === 'capitan' && isAdmin && (
              <div className="space-y-3">
                <div className="bg-sky-50 border border-sky-200 rounded-2xl p-4">
                  <p className="text-xs font-bold text-sky-700 uppercase tracking-wider mb-1">
                    Total propinas capitán
                  </p>
                  <p className="text-2xl font-mono font-extrabold tracking-tight text-sky-700">
                    {fmtMXN(grandTotals.captain_tip)}
                  </p>
                  <p className="text-xs text-stone-400 mt-1">
                    {daySummaries.length} días con ventas
                  </p>
                </div>

                {/* Por día */}
                <div className="bg-white rounded-2xl border border-stone-200/70 shadow-[0_2px_8px_rgba(0,0,0,0.04)] overflow-hidden">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b border-stone-100 bg-stone-50">
                        <th className="px-4 py-2.5 text-left text-xs font-bold text-stone-500 uppercase">Fecha</th>
                        <th className="px-3 py-2.5 text-right text-xs font-bold text-stone-500 uppercase">Ventas</th>
                        <th className="px-4 py-2.5 text-right text-xs font-bold text-sky-600 uppercase">Cap.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {daySummaries.map((d) => (
                        <tr key={d.sale_date} className="hover:bg-stone-50/50">
                          <td className="px-4 py-2.5 text-xs text-stone-700 font-medium">{d.sale_date}</td>
                          <td className="px-3 py-2.5 text-xs text-stone-500 text-right">{fmtMXN(d.ventas_total)}</td>
                          <td className="px-4 py-2.5 text-xs font-bold text-sky-700 text-right">{fmtMXN(d.captain_total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── Bonos ── */}
            {tab === 'bonos' && (
              <div className="space-y-3">
                {grandTotals.sanction_amount === 0 ? (
                  <div className="text-center py-12 text-stone-400 text-sm">
                    Sin bonos por sanción en este mes.
                  </div>
                ) : (
                  <>
                    <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4">
                      <p className="text-xs font-bold text-orange-700 uppercase tracking-wider mb-1">
                        Total bonos retenidos
                      </p>
                      <p className="text-2xl font-mono font-extrabold tracking-tight text-orange-600">
                        {fmtMXN(grandTotals.sanction_amount)}
                      </p>
                    </div>

                    {staffSummaries
                      .filter((s) => s.sanction_amount > 0)
                      .map((s) => (
                        <div key={s.staff_id} className="bg-white rounded-2xl border border-stone-200/70 shadow-[0_2px_8px_rgba(0,0,0,0.04)] p-4">
                          <div className="flex items-center justify-between">
                            <p className="font-bold text-stone-900 text-sm">{s.name}</p>
                            <p className="font-bold text-orange-600">{fmtMXN(s.sanction_amount)}</p>
                          </div>
                          <p className="text-xs text-stone-400 mt-0.5">
                            Ventas: {fmtMXN(s.total)} &middot; {s.count} registros
                          </p>
                        </div>
                      ))}
                  </>
                )}
              </div>
            )}

            {/* ── Ranking ── */}
            {tab === 'ranking' && (
              <div className="space-y-2">
                <p className="text-xs text-stone-400 px-1">Ordenado por total de ventas</p>
                {staffSummaries.map((s, idx) => (
                  <div key={s.staff_id} className="bg-white rounded-2xl border border-stone-200/70 shadow-[0_2px_8px_rgba(0,0,0,0.04)] p-4 flex items-center gap-4">
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center font-extrabold text-sm shrink-0 ${
                        idx === 0 ? 'bg-amber-400 text-white' :
                        idx === 1 ? 'bg-stone-300 text-stone-700' :
                        idx === 2 ? 'bg-orange-300 text-white' :
                        'bg-stone-100 text-stone-500'
                      }`}
                    >
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-stone-900 text-sm truncate">{s.name}</p>
                      <p className="text-xs text-stone-400">{s.count} reg. &middot; A entregar: {fmtMXN(s.to_deliver)}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-mono font-extrabold tracking-tight text-stone-900 text-base">{fmtMXN(s.total)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
