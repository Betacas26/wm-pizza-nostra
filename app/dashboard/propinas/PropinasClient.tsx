'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, TrendingUp, UserCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { assignCaptainAction, removeCaptainAction } from './actions';

// ── Tipos ────────────────────────────────────────────────────────────────────
export interface Captain {
  id: string;
  name: string;
}

export interface ShiftEntry {
  shift_date: string;
  shift: 'Matutino' | 'Vespertino';
  sales_count: number;
  total_sales: number;
  captain_tip: number;
  captain_id: string | null;
}

export interface PropinasClientProps {
  captains: Captain[];
  initialEntries: ShiftEntry[];
  initialWeekStart: string;
  isManager: boolean;
}

// ── Utilidades ───────────────────────────────────────────────────────────────
function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().split('T')[0];
}

function fmtDate(iso: string): string {
  return new Date(iso + 'T00:00:00Z').toLocaleDateString('es-MX', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

function fmtMXN(n: number): string {
  return `$${n.toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function buildShiftEntries(
  salesData: { sale_date: string; shift: string; total: number; captain_tip: number }[],
  captainData: { shift_date: string; shift: string; captain_id: string }[],
): ShiftEntry[] {
  const assigns = new Map<string, string>();
  for (const c of captainData) assigns.set(`${c.shift_date}_${c.shift}`, c.captain_id);

  const map = new Map<string, ShiftEntry>();
  for (const s of salesData) {
    const key = `${s.sale_date}_${s.shift}`;
    const ex = map.get(key);
    const tip = Number(s.captain_tip) || 0;
    const total = Number(s.total) || 0;
    if (ex) {
      ex.sales_count++;
      ex.total_sales += total;
      ex.captain_tip += tip;
    } else {
      map.set(key, {
        shift_date: s.sale_date,
        shift: s.shift as 'Matutino' | 'Vespertino',
        sales_count: 1,
        total_sales: total,
        captain_tip: tip,
        captain_id: assigns.get(key) ?? null,
      });
    }
  }

  return [...map.values()].sort((a, b) =>
    a.shift_date !== b.shift_date
      ? a.shift_date.localeCompare(b.shift_date)
      : a.shift.localeCompare(b.shift),
  );
}

// ── Componente ───────────────────────────────────────────────────────────────
export default function PropinasClient({
  captains,
  initialEntries,
  initialWeekStart,
  isManager,
}: PropinasClientProps) {
  const supabase = useMemo(() => createClient(), []);

  const [weekStart, setWeekStart]   = useState(initialWeekStart);
  const [entries, setEntries]       = useState<ShiftEntry[]>(initialEntries);
  const [loading, setLoading]       = useState(false);
  const [saving, setSaving]         = useState<string | null>(null);

  const weekEnd = addDays(weekStart, 6);

  // Fetch when week changes
  useEffect(() => {
    if (weekStart === initialWeekStart) return;
    setLoading(true);

    type SRow = { sale_date: string; shift: string; total: number; captain_tip: number };
    type CRow = { shift_date: string; shift: string; captain_id: string };

    Promise.all([
      supabase
        .from('sales')
        .select('sale_date, shift, total, captain_tip')
        .gte('sale_date', weekStart)
        .lte('sale_date', weekEnd)
        .order('sale_date')
        .order('shift'),
      supabase
        .from('captain_shifts')
        .select('shift_date, shift, captain_id')
        .gte('shift_date', weekStart)
        .lte('shift_date', weekEnd),
    ]).then(([{ data: s }, { data: c }]) => {
      setEntries(buildShiftEntries((s ?? []) as SRow[], (c ?? []) as CRow[]));
      setLoading(false);
    });
  }, [weekStart, initialWeekStart, weekEnd, supabase]);

  // Navigation
  const today = new Date().toISOString().split('T')[0];
  const isCurrentWeek = weekStart === initialWeekStart;

  function prevWeek() { setWeekStart(addDays(weekStart, -7)); }
  function nextWeek()  {
    const next = addDays(weekStart, 7);
    if (next <= today) setWeekStart(next);
  }

  const weekLabel = (() => {
    const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', timeZone: 'UTC' };
    const ws = new Date(weekStart + 'T00:00:00Z').toLocaleDateString('es-MX', opts);
    const we = new Date(weekEnd   + 'T00:00:00Z').toLocaleDateString('es-MX', opts);
    return `${ws} – ${we}`;
  })();

  // Totals
  const totalTip    = useMemo(() => entries.reduce((a, e) => a + e.captain_tip, 0), [entries]);

  const captainSummary = useMemo(() => {
    const map = new Map<string, { name: string; shifts: number; tip: number }>();
    for (const e of entries) {
      if (!e.captain_id) continue;
      const cap = captains.find((c) => c.id === e.captain_id);
      if (!cap) continue;
      const ex = map.get(e.captain_id);
      if (ex) { ex.shifts++; ex.tip += e.captain_tip; }
      else map.set(e.captain_id, { name: cap.name, shifts: 1, tip: e.captain_tip });
    }
    return [...map.values()].sort((a, b) => b.tip - a.tip);
  }, [entries, captains]);

  const assignedTip = useMemo(() => captainSummary.reduce((a, c) => a + c.tip, 0), [captainSummary]);
  const pendingTip  = totalTip - assignedTip;

  // Assign handler
  async function handleAssign(entry: ShiftEntry, captainId: string) {
    const key = `${entry.shift_date}_${entry.shift}`;
    setSaving(key);
    try {
      if (captainId === '') {
        await removeCaptainAction(entry.shift_date, entry.shift);
        setEntries((prev) =>
          prev.map((e) =>
            e.shift_date === entry.shift_date && e.shift === entry.shift
              ? { ...e, captain_id: null }
              : e,
          ),
        );
      } else {
        await assignCaptainAction(entry.shift_date, entry.shift, captainId);
        setEntries((prev) =>
          prev.map((e) =>
            e.shift_date === entry.shift_date && e.shift === entry.shift
              ? { ...e, captain_id: captainId }
              : e,
          ),
        );
      }
    } catch {
      // silent
    }
    setSaving(null);
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0D1211] text-[#e6edea]">
      {/* Header */}
      <header className="bg-[#151D1A] border-b border-[#223530] px-4 py-3 flex items-center gap-3 shadow-[0_2px_8px_rgba(0,0,0,0.2)] sticky top-0 z-10">
        <Link
          href="/dashboard"
          className="flex items-center justify-center w-9 h-9 rounded-xl text-[#7d9990] hover:text-[#e6edea] hover:bg-[#1c2b27] transition active:scale-[0.95]"
          aria-label="Volver"
        >
          <ChevronLeft size={22} strokeWidth={2.5} />
        </Link>
        <Image src="/icon-512.png" alt="" width={28} height={28} className="rounded-lg shrink-0" />
        <div className="flex-1 min-w-0">
          <h1 className="font-extrabold text-[#E8899A] text-lg leading-tight">Propinas</h1>
          <p className="text-xs text-[#7d9990]">Capitanes de turno · 0.8%</p>
        </div>
      </header>

      <main className="p-3 max-w-xl mx-auto space-y-4 pb-8">

        {/* Navegador de semana */}
        <div className="flex items-center gap-2">
          <button
            onClick={prevWeek}
            className="flex items-center justify-center w-9 h-9 rounded-xl bg-[#1c2b27] border border-[#223530] text-[#7d9990] hover:text-[#e6edea] active:scale-[0.95] transition"
          >
            <ChevronLeft size={18} strokeWidth={2} />
          </button>
          <p className="flex-1 text-center text-sm font-semibold text-[#e6edea]">{weekLabel}</p>
          <button
            onClick={nextWeek}
            disabled={isCurrentWeek}
            className="flex items-center justify-center w-9 h-9 rounded-xl bg-[#1c2b27] border border-[#223530] text-[#7d9990] hover:text-[#e6edea] active:scale-[0.95] transition disabled:opacity-30"
          >
            <ChevronRight size={18} strokeWidth={2} />
          </button>
        </div>

        {/* Resumen global */}
        {entries.length > 0 && (
          <div className="bg-sky-950/30 border border-sky-800/50 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp size={16} strokeWidth={1.5} className="text-sky-400" />
              <p className="text-xs font-bold text-sky-400 uppercase tracking-wider">
                Propina generada
              </p>
            </div>
            <p className="text-2xl font-mono font-extrabold tracking-tight text-sky-400 mb-3">
              {fmtMXN(totalTip)}
            </p>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <p className="text-[#7d9990] mb-0.5">Asignada</p>
                <p className="font-mono font-bold text-emerald-400">{fmtMXN(assignedTip)}</p>
              </div>
              <div>
                <p className="text-[#7d9990] mb-0.5">Sin asignar</p>
                <p className={`font-mono font-bold ${pendingTip > 0 ? 'text-amber-400' : 'text-[#7d9990]'}`}>
                  {fmtMXN(pendingTip)}
                </p>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12 text-[#7d9990] text-sm">Cargando...</div>
        ) : entries.length === 0 ? (
          <div className="text-center py-14 text-[#7d9990] text-sm">
            Sin ventas registradas en esta semana.
          </div>
        ) : (
          <>
            {/* ── Turnos ── */}
            <section>
              <p className="text-[10px] font-bold text-[#7d9990] uppercase tracking-wider px-1 mb-2">
                Turnos ({entries.length})
              </p>
              <div className="space-y-2">
                {entries.map((entry) => {
                  const key = `${entry.shift_date}_${entry.shift}`;
                  const assignedCap = captains.find((c) => c.id === entry.captain_id);
                  const isSaving = saving === key;

                  return (
                    <div
                      key={key}
                      className="bg-[#151D1A] rounded-2xl border border-[#223530] shadow-[0_2px_8px_rgba(0,0,0,0.2)] px-4 py-3"
                    >
                      <div className="flex items-start justify-between gap-3 mb-2.5">
                        <div>
                          <p className="font-semibold text-sm text-[#e6edea] leading-tight">
                            {fmtDate(entry.shift_date)}
                          </p>
                          <span className={`mt-1 inline-block text-[10px] px-2 py-0.5 rounded-full font-medium ${
                            entry.shift === 'Matutino'
                              ? 'bg-[#420F18]/80 border border-[#9E2A3E]/60 text-[#E8899A]'
                              : 'bg-sky-950/60 border border-sky-700/50 text-sky-300'
                          }`}>
                            {entry.shift}
                          </span>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-mono font-bold text-sky-400 text-base leading-tight">
                            {fmtMXN(entry.captain_tip)}
                          </p>
                          <p className="text-[10px] text-[#7d9990] mt-0.5">
                            {entry.sales_count} cierre{entry.sales_count !== 1 ? 's' : ''}
                            {' · '}{fmtMXN(entry.total_sales)}
                          </p>
                        </div>
                      </div>

                      {isManager ? (
                        <div className="flex items-center gap-2">
                          <UserCheck size={13} strokeWidth={2} className="text-[#7d9990] shrink-0" />
                          <select
                            value={entry.captain_id ?? ''}
                            disabled={isSaving}
                            onChange={(e) => handleAssign(entry, e.target.value)}
                            className="flex-1 min-h-[36px] px-3 py-1.5 rounded-xl border border-[#223530] bg-[#1c2b27] text-[#e6edea] text-xs focus:outline-none focus:ring-2 focus:ring-[#7A1D2E] disabled:opacity-50"
                          >
                            <option value="">Sin asignar</option>
                            {captains.map((c) => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                          {isSaving && (
                            <span className="text-[10px] text-[#7d9990] shrink-0">...</span>
                          )}
                        </div>
                      ) : (
                        <p className={`text-xs flex items-center gap-1.5 ${
                          assignedCap ? 'text-[#e6edea] font-semibold' : 'text-[#7d9990] italic'
                        }`}>
                          <UserCheck size={12} strokeWidth={2} />
                          {assignedCap ? assignedCap.name : 'Sin asignar'}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            {/* ── Por capitán ── */}
            {captainSummary.length > 0 && (
              <section>
                <p className="text-[10px] font-bold text-[#7d9990] uppercase tracking-wider px-1 mb-2">
                  Por capitán
                </p>
                <div className="space-y-2">
                  {captainSummary.map((cap, idx) => (
                    <div
                      key={cap.name}
                      className="bg-[#151D1A] rounded-2xl border border-[#223530] shadow-[0_2px_8px_rgba(0,0,0,0.2)] px-4 py-3 flex items-center gap-3"
                    >
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center font-extrabold text-xs shrink-0 ${
                        idx === 0
                          ? 'bg-sky-700 text-white'
                          : idx === 1
                          ? 'bg-sky-900/60 border border-sky-700/50 text-sky-300'
                          : 'bg-[#1c2b27] border border-[#223530] text-[#7d9990]'
                      }`}>
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-[#e6edea] text-sm truncate">{cap.name}</p>
                        <p className="text-[10px] text-[#7d9990]">
                          {cap.shifts} turno{cap.shifts !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-mono font-bold text-sky-400">{fmtMXN(cap.tip)}</p>
                        <p className="text-[10px] text-[#7d9990]">propina</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
