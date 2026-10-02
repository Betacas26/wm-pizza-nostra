'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { startMealBreakAction, endMealBreakAction } from './actions';

// ── Tipos ──────────────────────────────────────────────────────────────────
type BreakStatus = 'active' | 'completed' | 'overdue';

export interface StaffMember {
  id: string;
  name: string;
  role: string;
}

export interface MealBreak {
  id: string;
  break_date: string;
  staff_id: string;
  staff_name: string;
  started_at: string;
  duration_minutes: number;
  ended_at: string | null;
  status: BreakStatus;
}

export interface ComidasClientProps {
  staff: StaffMember[];
  initialBreaks: MealBreak[];
  today: string;
}

// ── Constantes ─────────────────────────────────────────────────────────────
const DURATION_S = 30 * 60;
const WARNING_S = 5 * 60;

// ── Utilidades ─────────────────────────────────────────────────────────────
function getRemaining(startedAt: string, nowMs: number): number {
  return DURATION_S - Math.floor((nowMs - new Date(startedAt).getTime()) / 1000);
}

function fmtTimer(s: number): string {
  const abs = Math.abs(s);
  const m = Math.floor(abs / 60).toString().padStart(2, '0');
  const sec = (abs % 60).toString().padStart(2, '0');
  return s >= 0 ? `${m}:${sec}` : `-${m}:${sec}`;
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}

// ── Componente ─────────────────────────────────────────────────────────────
export default function ComidasClient({ staff, initialBreaks, today }: ComidasClientProps) {
  const [breaks, setBreaks] = useState<MealBreak[]>(initialBreaks);
  const [nowMs, setNowMs] = useState(Date.now());
  const [starting, setStarting] = useState<string | null>(null); // staffId being started

  // Tick cada segundo
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Mapa: staffId → break activo de hoy
  const activeByStaff = useMemo(() => {
    const m = new Map<string, MealBreak>();
    for (const b of breaks) {
      if (!b.ended_at) m.set(b.staff_id, b);
    }
    return m;
  }, [breaks]);

  // Mapa: staffId → último break terminado de hoy
  const finishedByStaff = useMemo(() => {
    const m = new Map<string, MealBreak>();
    for (const b of breaks) {
      if (b.ended_at) {
        const existing = m.get(b.staff_id);
        if (!existing || b.ended_at > existing.ended_at!) m.set(b.staff_id, b);
      }
    }
    return m;
  }, [breaks]);

  const activeCount = activeByStaff.size;

  async function handleStart(staffId: string) {
    if (starting) return;
    setStarting(staffId);
    try {
      const result = await startMealBreakAction(staffId);
      const staffName = staff.find((s) => s.id === staffId)?.name ?? staffId;
      setBreaks((prev) => [
        {
          id: result.id,
          break_date: result.break_date,
          staff_id: result.staff_id,
          staff_name: staffName,
          started_at: result.started_at,
          duration_minutes: result.duration_minutes,
          ended_at: null,
          status: 'active',
        },
        ...prev,
      ]);
    } catch {
      // silent
    }
    setStarting(null);
  }

  async function handleEnd(breakId: string) {
    const endedAt = new Date().toISOString();
    const record = breaks.find((b) => b.id === breakId);
    if (!record) return;

    const elapsedS = Math.floor((Date.now() - new Date(record.started_at).getTime()) / 1000);
    const status: BreakStatus = elapsedS > DURATION_S ? 'overdue' : 'completed';

    // Optimista
    setBreaks((prev) =>
      prev.map((b) => (b.id === breakId ? { ...b, ended_at: endedAt, status } : b)),
    );

    try {
      await endMealBreakAction(breakId, endedAt, status);
    } catch {
      // Revertir
      setBreaks((prev) =>
        prev.map((b) =>
          b.id === breakId ? { ...b, ended_at: null, status: 'active' } : b,
        ),
      );
    }
  }

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
          <h1 className="font-extrabold text-amber-600 text-lg leading-tight">
            Comidas
          </h1>
          <p className="text-xs text-stone-500">
            {today} &middot; 30 min
            {activeCount > 0 && (
              <span className="ml-1 font-semibold text-amber-600">
                &middot; {activeCount} activa{activeCount !== 1 ? 's' : ''}
              </span>
            )}
          </p>
        </div>
      </header>

      <main className="p-3 max-w-xl mx-auto">
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-stone-100 bg-stone-50">
                <th className="px-4 py-2.5 text-left text-xs font-bold text-stone-500 uppercase tracking-wider">
                  Colaborador
                </th>
                <th className="px-3 py-2.5 text-left text-xs font-bold text-stone-500 uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-3 py-2.5 text-right text-xs font-bold text-stone-500 uppercase tracking-wider w-[90px]">
                  Acción
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {staff.map((member) => {
                const active = activeByStaff.get(member.id);
                const finished = finishedByStaff.get(member.id);
                const isStarting = starting === member.id;

                let remaining = 0;
                let timerState: 'normal' | 'warning' | 'overdue' = 'normal';

                if (active) {
                  remaining = getRemaining(active.started_at, nowMs);
                  timerState = remaining <= 0 ? 'overdue' : remaining <= WARNING_S ? 'warning' : 'normal';
                }

                const rowBg = active
                  ? timerState === 'overdue'
                    ? 'bg-red-50'
                    : timerState === 'warning'
                    ? 'bg-amber-50'
                    : 'bg-sky-50/40'
                  : '';

                return (
                  <tr key={member.id} className={rowBg}>
                    {/* Nombre */}
                    <td className="px-4 py-3">
                      <p className="font-semibold text-sm text-stone-900 leading-tight">
                        {member.name}
                      </p>
                      {active && (
                        <p className="text-[10px] text-stone-400 mt-0.5">
                          Salió: {fmtTime(active.started_at)}
                        </p>
                      )}
                      {finished && !active && (
                        <p className="text-[10px] text-stone-400 mt-0.5">
                          {fmtTime(finished.started_at)} → {fmtTime(finished.ended_at!)}
                        </p>
                      )}
                    </td>

                    {/* Estado */}
                    <td className="px-3 py-3">
                      {active ? (
                        <span
                          className={`font-mono font-black tabular-nums text-sm ${
                            timerState === 'overdue' ? 'text-red-600' :
                            timerState === 'warning' ? 'text-amber-600' :
                            'text-sky-700'
                          }`}
                        >
                          {fmtTimer(remaining)}
                        </span>
                      ) : finished ? (
                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            finished.status === 'overdue'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-emerald-100 text-emerald-700'
                          }`}
                        >
                          {finished.status === 'overdue' ? 'Excedido' : '✓ OK'}
                        </span>
                      ) : (
                        <span className="text-xs text-stone-400">Libre</span>
                      )}
                    </td>

                    {/* Acción */}
                    <td className="px-3 py-3 text-right">
                      {active ? (
                        <button
                          onClick={() => handleEnd(active.id)}
                          className={`min-h-[36px] px-3 rounded-xl text-xs font-bold transition ${
                            timerState === 'overdue'
                              ? 'bg-red-500 hover:bg-red-600 text-white'
                              : timerState === 'warning'
                              ? 'bg-amber-500 hover:bg-amber-600 text-white'
                              : 'bg-sky-600 hover:bg-sky-700 text-white'
                          }`}
                        >
                          ⏹ Fin
                        </button>
                      ) : !finished ? (
                        <button
                          onClick={() => handleStart(member.id)}
                          disabled={isStarting}
                          className="min-h-[36px] px-3 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white transition disabled:opacity-50"
                        >
                          {isStarting ? '...' : '▶ Comer'}
                        </button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {staff.length === 0 && (
            <p className="text-center py-10 text-stone-400 text-sm">
              Sin colaboradores activos.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
