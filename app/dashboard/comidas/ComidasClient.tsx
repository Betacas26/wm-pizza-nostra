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
  return new Date(iso).toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ── Componente ─────────────────────────────────────────────────────────────
export default function ComidasClient({
  staff,
  initialBreaks,
  today,
}: ComidasClientProps) {
  const [breaks, setBreaks] = useState<MealBreak[]>(initialBreaks);
  const [nowMs, setNowMs] = useState(Date.now());
  const [starting, setStarting] = useState<string | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const activeByStaff = useMemo(() => {
    const m = new Map<string, MealBreak>();
    for (const b of breaks) {
      if (!b.ended_at) m.set(b.staff_id, b);
    }
    return m;
  }, [breaks]);

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

    const elapsedS = Math.floor(
      (Date.now() - new Date(record.started_at).getTime()) / 1000,
    );
    const status: BreakStatus = elapsedS > DURATION_S ? 'overdue' : 'completed';

    setBreaks((prev) =>
      prev.map((b) => (b.id === breakId ? { ...b, ended_at: endedAt, status } : b)),
    );

    try {
      await endMealBreakAction(breakId, endedAt, status);
    } catch {
      setBreaks((prev) =>
        prev.map((b) =>
          b.id === breakId ? { ...b, ended_at: null, status: 'active' } : b,
        ),
      );
    }
  }

  return (
    <div className="min-h-screen bg-[#0D1211] text-[#e6edea]">
      {/* Header */}
      <header className="bg-[#151D1A] border-b border-[#223530] px-4 py-3 flex items-center gap-3 shadow-[0_2px_8px_rgba(0,0,0,0.2)] sticky top-0 z-10">
        <Link
          href="/dashboard"
          className="text-[#7d9990] hover:text-[#e6edea] text-xl leading-none"
          aria-label="Volver"
        >
          &#8592;
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="font-extrabold text-[#E8899A] text-lg leading-tight">
            Comidas
          </h1>
          <p className="text-xs text-[#7d9990]">
            {today} &middot; 30 min
            {activeCount > 0 && (
              <span className="ml-1 font-semibold text-[#E8899A]">
                &middot; {activeCount} activa{activeCount !== 1 ? 's' : ''}
              </span>
            )}
          </p>
        </div>
      </header>

      <main className="p-3 max-w-xl mx-auto space-y-2.5 pb-6">
        {staff.length === 0 && (
          <div className="text-center py-12 text-[#7d9990] text-sm">
            Sin colaboradores activos.
          </div>
        )}

        {staff.map((member) => {
          const active = activeByStaff.get(member.id);
          const finished = finishedByStaff.get(member.id);
          const isStarting = starting === member.id;

          let remaining = 0;
          let timerState: 'normal' | 'warning' | 'overdue' = 'normal';
          let progressPct = 0;

          if (active) {
            remaining = getRemaining(active.started_at, nowMs);
            timerState =
              remaining <= 0
                ? 'overdue'
                : remaining <= WARNING_S
                ? 'warning'
                : 'normal';
            progressPct = Math.min(
              100,
              Math.max(0, ((DURATION_S - remaining) / DURATION_S) * 100),
            );
          }

          const dotClass = active
            ? timerState === 'overdue'
              ? 'bg-red-500 animate-pulse'
              : timerState === 'warning'
              ? 'bg-amber-500'
              : 'bg-emerald-500'
            : finished
            ? finished.status === 'overdue'
              ? 'bg-red-800'
              : 'bg-emerald-800'
            : 'bg-[#223530]';

          return (
            <div
              key={member.id}
              className="bg-[#151D1A] rounded-2xl border border-[#223530] overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.2)]"
            >
              <div className="px-4 py-3 flex items-center gap-3">
                {/* Semaforo */}
                <span className={`shrink-0 w-3 h-3 rounded-full ${dotClass}`} />

                {/* Nombre */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-[#e6edea] leading-tight truncate">
                    {member.name}
                  </p>
                  {active ? (
                    <p className="text-[10px] text-[#7d9990] mt-0.5">
                      Salio: {fmtTime(active.started_at)}
                    </p>
                  ) : finished ? (
                    <p className="text-[10px] text-[#7d9990] mt-0.5">
                      {fmtTime(finished.started_at)} &rarr;{' '}
                      {fmtTime(finished.ended_at!)}
                    </p>
                  ) : (
                    <p className="text-[10px] text-[#7d9990] mt-0.5 capitalize">
                      {member.role}
                    </p>
                  )}
                </div>

                {/* Timer o estado */}
                <div className="shrink-0 text-right">
                  {active ? (
                    <span
                      className={`font-mono font-black tabular-nums text-lg leading-none ${
                        timerState === 'overdue'
                          ? 'text-red-400 animate-pulse'
                          : timerState === 'warning'
                          ? 'text-amber-400'
                          : 'text-emerald-400'
                      }`}
                    >
                      {fmtTimer(remaining)}
                    </span>
                  ) : finished ? (
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                        finished.status === 'overdue'
                          ? 'bg-red-950/60 border-red-800/50 text-red-300'
                          : 'bg-emerald-950/60 border-emerald-700/50 text-emerald-300'
                      }`}
                    >
                      {finished.status === 'overdue' ? 'Excedido' : '✓ OK'}
                    </span>
                  ) : (
                    <span className="text-xs text-[#7d9990]">Libre</span>
                  )}
                </div>

                {/* Boton de accion */}
                <div className="shrink-0 ml-1">
                  {active ? (
                    <button
                      onClick={() => handleEnd(active.id)}
                      className={`min-h-[44px] px-3 rounded-xl text-xs font-bold border transition duration-150 ease-out active:scale-[0.98] select-none ${
                        timerState === 'overdue'
                          ? 'bg-red-900/60 border-red-700/80 text-red-200 hover:bg-red-800/60'
                          : timerState === 'warning'
                          ? 'bg-amber-900/60 border-amber-700/80 text-amber-200 hover:bg-amber-800/60'
                          : 'bg-emerald-900/60 border-emerald-700/80 text-emerald-200 hover:bg-emerald-800/60'
                      }`}
                    >
                      Regresar
                    </button>
                  ) : !finished ? (
                    <button
                      onClick={() => handleStart(member.id)}
                      disabled={isStarting}
                      className="min-h-[44px] px-3 rounded-xl text-xs font-bold bg-[#7A1D2E] hover:bg-[#9E2A3E] active:scale-[0.98] text-white transition duration-150 ease-out select-none disabled:opacity-50"
                    >
                      {isStarting ? '...' : 'Comer'}
                    </button>
                  ) : null}
                </div>
              </div>

              {/* Barra de progreso (solo si activo) */}
              {active && (
                <div className="px-4 pb-3">
                  <div className="h-1.5 bg-[#1c2b27] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-1000 ${
                        timerState === 'overdue'
                          ? 'bg-red-500'
                          : timerState === 'warning'
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                      }`}
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </main>
    </div>
  );
}
