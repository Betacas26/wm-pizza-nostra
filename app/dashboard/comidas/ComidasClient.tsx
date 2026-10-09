'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ChevronLeft, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { startMealBreakAction, endMealBreakAction, MAX_CONCURRENT } from './actions';

// ── Tipos ───────────────────────────────────────────────────────────────────
type BreakStatus = 'activo' | 'completado' | 'excedido';

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

// ── Constantes ──────────────────────────────────────────────────────────────
const DURATION_S = 30 * 60;
const WARNING_S  = 5 * 60;

// ── Utilidades ──────────────────────────────────────────────────────────────
function getRemaining(startedAt: string, nowMs: number): number {
  return DURATION_S - Math.floor((nowMs - new Date(startedAt).getTime()) / 1000);
}

/** Muestra 00:00 en tiempo normal y +MM:SS cuando está excedido */
function fmtTimer(remaining: number): string {
  if (remaining >= 0) {
    const m = Math.floor(remaining / 60).toString().padStart(2, '0');
    const s = (remaining % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }
  const excess = Math.abs(remaining);
  const m = Math.floor(excess / 60).toString().padStart(2, '0');
  const s = (excess % 60).toString().padStart(2, '0');
  return `+${m}:${s}`;
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ── Componente ──────────────────────────────────────────────────────────────
export default function ComidasClient({
  staff,
  initialBreaks,
  today,
}: ComidasClientProps) {
  const [breaks, setBreaks] = useState<MealBreak[]>(initialBreaks);
  const [nowMs, setNowMs]   = useState(Date.now());
  const [starting, setStarting] = useState<string | null>(null);
  const [ending, setEnding]     = useState<string | null>(null);
  const [error, setError]       = useState('');

  // Reloj en vivo cada segundo
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Mapas rápidos
  const activeByStaff = useMemo(() => {
    const m = new Map<string, MealBreak>();
    for (const b of breaks) if (!b.ended_at) m.set(b.staff_id, b);
    return m;
  }, [breaks]);

  const finishedByStaff = useMemo(() => {
    const m = new Map<string, MealBreak>();
    for (const b of breaks) {
      if (!b.ended_at) continue;
      const prev = m.get(b.staff_id);
      if (!prev || b.ended_at > prev.ended_at!) m.set(b.staff_id, b);
    }
    return m;
  }, [breaks]);

  const activeBreaks = useMemo(
    () => breaks.filter((b) => !b.ended_at),
    [breaks],
  );
  const activeCount = activeBreaks.length;

  const staffInFloor = useMemo(
    () => staff.filter((m) => !activeByStaff.has(m.id)),
    [staff, activeByStaff],
  );

  // ── Acciones ───────────────────────────────────────────────────────────────
  async function handleStart(staffId: string) {
    if (starting) return;
    setError('');
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
          started_at: result.started_at, // timestamp real de la DB
          duration_minutes: result.duration_minutes,
          ended_at: null,
          status: 'activo',
        },
        ...prev,
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al iniciar comida.');
    }
    setStarting(null);
  }

  async function handleEnd(breakId: string) {
    if (ending) return;
    setError('');
    setEnding(breakId);
    try {
      // Status calculado server-side desde el started_at de la DB
      const { ended_at, status } = await endMealBreakAction(breakId);
      setBreaks((prev) =>
        prev.map((b) => (b.id === breakId ? { ...b, ended_at, status } : b)),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cerrar comida.');
    }
    setEnding(null);
  }

  // ── Render ─────────────────────────────────────────────────────────────────
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
          <h1 className="font-extrabold text-[#E8899A] text-lg leading-tight">
            Comidas
          </h1>
          <p className="text-xs text-[#7d9990]">
            {today} &middot; 30 min
            {activeCount > 0 && (
              <span className={`ml-1 font-semibold ${activeCount >= MAX_CONCURRENT ? 'text-red-400' : 'text-amber-400'}`}>
                &middot; {activeCount} en comida
              </span>
            )}
          </p>
        </div>
      </header>

      <main className="p-3 max-w-xl mx-auto space-y-4 pb-8">

        {/* Alerta de capacidad */}
        {activeCount >= MAX_CONCURRENT && (
          <div className="flex items-start gap-2 bg-rose-950/50 border border-rose-700/60 rounded-xl px-3 py-2.5">
            <AlertTriangle size={16} strokeWidth={2} className="text-rose-400 shrink-0 mt-0.5" />
            <p className="text-xs text-rose-300">
              <span className="font-bold">Capacidad al límite:</span>{' '}
              {activeCount} personas en comida simultáneamente. Considera esperar antes de enviar a más colaboradores.
            </p>
          </div>
        )}

        {/* Error general */}
        {error && (
          <p className="text-xs text-red-400 bg-red-950/40 border border-red-800/50 rounded-xl px-3 py-2">
            {error}
          </p>
        )}

        {/* ── Sección: En comida ─────────────────────────────────────────── */}
        {activeBreaks.length > 0 && (
          <section>
            <p className="text-[10px] font-bold text-[#7d9990] uppercase tracking-wider px-1 mb-2">
              En turno de comida ({activeBreaks.length})
            </p>
            <div className="space-y-2">
              {activeBreaks.map((b) => {
                const remaining = getRemaining(b.started_at, nowMs);
                const isOverdue  = remaining < 0;
                const isWarning  = !isOverdue && remaining <= WARNING_S;
                const progressPct = Math.min(100, Math.max(0, ((DURATION_S - remaining) / DURATION_S) * 100));

                const cardBorder = isOverdue
                  ? 'border-rose-700/60'
                  : isWarning
                  ? 'border-amber-700/50'
                  : 'border-[#223530]';

                const timerColor = isOverdue
                  ? 'text-rose-400 animate-pulse'
                  : isWarning
                  ? 'text-amber-400'
                  : 'text-emerald-400';

                const barColor = isOverdue
                  ? 'bg-rose-500'
                  : isWarning
                  ? 'bg-amber-500'
                  : 'bg-emerald-500';

                return (
                  <div
                    key={b.id}
                    className={`bg-[#151D1A] rounded-2xl border ${cardBorder} overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.2)]`}
                  >
                    <div className="px-4 py-3 flex items-center gap-3">
                      {/* Semáforo */}
                      <span className={`shrink-0 w-3 h-3 rounded-full ${
                        isOverdue ? 'bg-rose-500 animate-pulse' : isWarning ? 'bg-amber-500' : 'bg-emerald-500'
                      }`} />

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-[#e6edea] leading-tight truncate">
                          {b.staff_name}
                        </p>
                        <p className="text-[10px] text-[#7d9990] mt-0.5">
                          Salió: {fmtTime(b.started_at)}
                          {isOverdue && (
                            <span className="ml-1 text-rose-400 font-semibold">
                              · ¡TIEMPO EXCEDIDO!
                            </span>
                          )}
                          {isWarning && (
                            <span className="ml-1 text-amber-400 font-semibold">
                              · Últimos 5 min
                            </span>
                          )}
                        </p>
                      </div>

                      {/* Timer */}
                      <span className={`font-mono font-black tabular-nums text-lg leading-none shrink-0 ${timerColor}`}>
                        {fmtTimer(remaining)}
                      </span>

                      {/* Botón cerrar */}
                      <button
                        onClick={() => handleEnd(b.id)}
                        disabled={ending === b.id}
                        className={`shrink-0 min-h-[44px] px-3 rounded-xl text-xs font-bold border transition duration-150 ease-out active:scale-[0.98] select-none disabled:opacity-50 ${
                          isOverdue
                            ? 'bg-rose-900/60 border-rose-700/80 text-rose-200 hover:bg-rose-800/60'
                            : isWarning
                            ? 'bg-amber-900/60 border-amber-700/80 text-amber-200 hover:bg-amber-800/60'
                            : 'bg-emerald-900/60 border-emerald-700/80 text-emerald-200 hover:bg-emerald-800/60'
                        }`}
                      >
                        {ending === b.id
                          ? '...'
                          : isOverdue
                          ? 'Cerrar tardío'
                          : 'Regresar'}
                      </button>
                    </div>

                    {/* Barra de progreso */}
                    <div className="px-4 pb-3">
                      <div className="h-1.5 bg-[#1c2b27] rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-1000 ${barColor}`}
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Sección: Personal en piso ──────────────────────────────────── */}
        <section>
          <p className="text-[10px] font-bold text-[#7d9990] uppercase tracking-wider px-1 mb-2">
            Personal en piso ({staffInFloor.length})
          </p>

          {staffInFloor.length === 0 ? (
            <div className="text-center py-8 text-[#7d9990] text-sm">
              Todo el personal está en comida.
            </div>
          ) : (
            <div className="space-y-2">
              {staffInFloor.map((member) => {
                const finished   = finishedByStaff.get(member.id);
                const isStarting = starting === member.id;
                const atCapacity = activeCount >= MAX_CONCURRENT;

                return (
                  <div
                    key={member.id}
                    className="bg-[#151D1A] rounded-2xl border border-[#223530] px-4 py-3 flex items-center gap-3 shadow-[0_2px_8px_rgba(0,0,0,0.2)]"
                  >
                    {/* Indicador */}
                    <span className={`shrink-0 w-3 h-3 rounded-full ${
                      finished
                        ? finished.status === 'excedido'
                          ? 'bg-rose-800'
                          : 'bg-emerald-800'
                        : 'bg-[#223530]'
                    }`} />

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-[#e6edea] leading-tight truncate">
                        {member.name}
                      </p>
                      {finished ? (
                        <p className="text-[10px] text-[#7d9990] mt-0.5">
                          {fmtTime(finished.started_at)} → {fmtTime(finished.ended_at!)}
                        </p>
                      ) : (
                        <p className="text-[10px] text-[#7d9990] mt-0.5 capitalize">
                          {member.role || 'en piso'}
                        </p>
                      )}
                    </div>

                    {/* Badge si ya comió */}
                    {finished && (
                      <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                        finished.status === 'excedido'
                          ? 'bg-rose-950/60 border-rose-800/50 text-rose-300'
                          : 'bg-emerald-950/60 border-emerald-700/50 text-emerald-300'
                      }`}>
                        {finished.status === 'excedido' ? 'Excedido' : '✓ OK'}
                      </span>
                    )}

                    {/* Botón iniciar */}
                    {!finished && (
                      <button
                        onClick={() => handleStart(member.id)}
                        disabled={isStarting || atCapacity}
                        title={atCapacity ? 'Capacidad al límite' : undefined}
                        className="shrink-0 min-h-[44px] px-3 rounded-xl text-xs font-bold bg-[#7A1D2E] hover:bg-[#9E2A3E] active:scale-[0.98] text-white transition duration-150 ease-out select-none disabled:opacity-40"
                      >
                        {isStarting ? '...' : atCapacity ? (
                          <span className="flex items-center gap-1">
                            <AlertTriangle size={11} strokeWidth={2} />
                            Lleno
                          </span>
                        ) : 'Comer (30m)'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Sin personal */}
        {staff.length === 0 && (
          <div className="text-center py-14 text-[#7d9990] text-sm">
            Sin colaboradores activos registrados.
          </div>
        )}
      </main>
    </div>
  );
}
