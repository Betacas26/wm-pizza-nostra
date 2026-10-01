'use client';

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { endMealBreakAction } from './actions';

// ── Tipos ──────────────────────────────────────────────────────────────────
type BreakStatus = 'active' | 'completed' | 'overdue';
type TimerState = 'normal' | 'warning' | 'overdue';

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

// ── Constantes (logic.md) ──────────────────────────────────────────────────
/** Duración exacta de la comida en segundos. */
const DURATION_S = 30 * 60;
/** Umbral de alerta: quedan 5 minutos o menos. */
const WARNING_S = 5 * 60;

// ── Utilidades de temporizador ─────────────────────────────────────────────
/**
 * Calcula el tiempo restante y el estado de alerta a partir de `started_at`.
 * Determinista: nunca produce NaN ni desbordamientos.
 * @param startedAt - ISO timestamp de inicio
 * @param nowMs     - timestamp actual en milisegundos
 */
function getTimerInfo(
  startedAt: string,
  nowMs: number,
): { remaining: number; progressPct: number; state: TimerState } {
  const elapsed = Math.floor((nowMs - new Date(startedAt).getTime()) / 1000);
  const remaining = DURATION_S - elapsed;
  const progressPct = Math.min(100, Math.max(0, (elapsed / DURATION_S) * 100));
  const state: TimerState =
    remaining <= 0 ? 'overdue' : remaining <= WARNING_S ? 'warning' : 'normal';
  return { remaining, progressPct, state };
}

/**
 * Formatea segundos en MM:SS. Negativo indica tiempo excedido.
 */
function fmtTimer(seconds: number): string {
  const abs = Math.abs(seconds);
  const m = Math.floor(abs / 60).toString().padStart(2, '0');
  const s = (abs % 60).toString().padStart(2, '0');
  return seconds >= 0 ? `${m}:${s}` : `-${m}:${s}`;
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ── Variantes de estilo por estado ─────────────────────────────────────────
const CARD_BG: Record<TimerState, string> = {
  normal:  'bg-white border-stone-200',
  warning: 'bg-amber-50 border-amber-300',
  overdue: 'bg-red-50 border-red-300',
};

const TIMER_COLOR: Record<TimerState, string> = {
  normal:  'text-stone-700',
  warning: 'text-amber-600',
  overdue: 'text-red-600',
};

const PROGRESS_COLOR: Record<TimerState, string> = {
  normal:  'bg-emerald-500',
  warning: 'bg-amber-500',
  overdue: 'bg-red-500',
};

const BTN_COLOR: Record<TimerState, string> = {
  normal:  'bg-stone-700 hover:bg-stone-800 active:bg-stone-900 text-white',
  warning: 'bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white',
  overdue: 'bg-red-500 hover:bg-red-600 active:bg-red-700 text-white',
};

// ── Componente ─────────────────────────────────────────────────────────────
export default function ComidasClient({
  staff,
  initialBreaks,
  today,
}: ComidasClientProps) {
  const supabase = useMemo(() => createClient(), []);

  const [breaks, setBreaks] = useState<MealBreak[]>(initialBreaks);
  const [nowMs, setNowMs] = useState(Date.now());
  const [selectedStaffId, setSelectedStaffId] = useState(staff[0]?.id ?? '');
  const [starting, setStarting] = useState(false);

  // Tick cada segundo para el countdown en vivo
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const activeBreaks = useMemo(() => breaks.filter((b) => !b.ended_at), [breaks]);
  const finishedBreaks = useMemo(() => breaks.filter((b) => b.ended_at), [breaks]);

  // Personal disponible (sin comida activa)
  const availableStaff = useMemo(() => {
    const onBreak = new Set(activeBreaks.map((b) => b.staff_id));
    return staff.filter((s) => !onBreak.has(s.id));
  }, [staff, activeBreaks]);

  // Ajustar selección cuando cambia el personal disponible
  useEffect(() => {
    if (
      availableStaff.length > 0 &&
      !availableStaff.find((s) => s.id === selectedStaffId)
    ) {
      setSelectedStaffId(availableStaff[0].id);
    }
  }, [availableStaff, selectedStaffId]);

  // ── Iniciar comida ────────────────────────────────────────────────────
  async function handleStart() {
    if (!selectedStaffId || starting) return;
    setStarting(true);

    const startedAt = new Date().toISOString();
    const { data, error } = await supabase
      .from('meal_breaks')
      .insert({
        break_date: today,
        staff_id: selectedStaffId,
        started_at: startedAt,
        duration_minutes: 30,
        ended_at: null,
        status: 'active',
      })
      .select()
      .single();

    if (!error && data) {
      const staffName =
        staff.find((s) => s.id === selectedStaffId)?.name ?? selectedStaffId;
      setBreaks((prev) => [
        {
          id: (data as { id: string }).id,
          break_date: today,
          staff_id: selectedStaffId,
          staff_name: staffName,
          started_at: startedAt,
          duration_minutes: 30,
          ended_at: null,
          status: 'active',
        },
        ...prev,
      ]);
    }

    setStarting(false);
  }

  // ── Terminar comida ───────────────────────────────────────────────────
  async function handleEnd(breakId: string) {
    const endedAt = new Date().toISOString();
    const record = breaks.find((b) => b.id === breakId);
    if (!record) return;

    const elapsedS = Math.floor(
      (Date.now() - new Date(record.started_at).getTime()) / 1000,
    );
    const status: BreakStatus = elapsedS > DURATION_S ? 'overdue' : 'completed';

    // Optimistic update
    setBreaks((prev) =>
      prev.map((b) => (b.id === breakId ? { ...b, ended_at: endedAt, status } : b)),
    );

    try {
      await endMealBreakAction(breakId, endedAt, status);
    } catch {
      // Revertir si el servidor rechaza (ownership / no autenticado)
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
            {today} &middot; 30 min por turno
            {activeBreaks.length > 0 && (
              <span className="ml-1 font-semibold text-amber-600">
                &middot; {activeBreaks.length} activa{activeBreaks.length !== 1 ? 's' : ''}
              </span>
            )}
          </p>
        </div>
      </header>

      <main className="p-4 max-w-xl mx-auto space-y-5">

        {/* ── Iniciar comida ─────────────────────────────────────────── */}
        <section className="bg-white rounded-2xl border border-stone-200 shadow-sm p-4 space-y-3">
          <h2 className="text-xs font-bold text-stone-500 uppercase tracking-wider">
            Iniciar comida
          </h2>

          {availableStaff.length === 0 ? (
            <p className="text-sm text-stone-400 italic py-1">
              Todo el personal esta en comida o no hay colaboradores activos.
            </p>
          ) : (
            <>
              <select
                value={selectedStaffId}
                onChange={(e) => setSelectedStaffId(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-500 text-stone-800 text-base bg-white"
              >
                {availableStaff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>

              <button
                onClick={handleStart}
                disabled={starting || !selectedStaffId}
                className="w-full min-h-[44px] bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white font-bold rounded-xl shadow transition text-sm disabled:opacity-50"
              >
                {starting ? 'Iniciando...' : 'Iniciar comida (30 min)'}
              </button>
            </>
          )}
        </section>

        {/* ── Comidas activas ────────────────────────────────────────── */}
        {activeBreaks.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-xs font-bold text-stone-500 uppercase tracking-wider px-1">
              En comida ahora ({activeBreaks.length})
            </h2>

            {activeBreaks.map((b) => {
              const { remaining, progressPct, state } = getTimerInfo(
                b.started_at,
                nowMs,
              );
              return (
                <div
                  key={b.id}
                  className={`rounded-2xl border shadow-sm p-4 ${CARD_BG[state]}`}
                >
                  {/* Nombre + temporizador */}
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="font-bold text-stone-900 text-sm">
                        {b.staff_name}
                      </p>
                      <p className="text-xs text-stone-400">
                        Inicio: {fmtTime(b.started_at)}
                      </p>
                    </div>
                    <div
                      className={`font-mono font-black tabular-nums leading-none ${TIMER_COLOR[state]}`}
                      style={{ fontSize: '2rem' }}
                    >
                      {fmtTimer(remaining)}
                    </div>
                  </div>

                  {/* Barra de progreso */}
                  <div className="h-2.5 bg-stone-200 rounded-full overflow-hidden mb-3">
                    <div
                      className={`h-full rounded-full transition-all duration-1000 ${PROGRESS_COLOR[state]}`}
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>

                  {/* Estado textual */}
                  <p className={`text-xs mb-3 font-semibold ${TIMER_COLOR[state]}`}>
                    {state === 'overdue'
                      ? `Tiempo excedido por ${fmtTimer(remaining).replace('-', '')}`
                      : state === 'warning'
                      ? `Quedan menos de 5 minutos`
                      : `Tiempo restante: ${fmtTimer(remaining)}`}
                  </p>

                  <button
                    onClick={() => handleEnd(b.id)}
                    className={`w-full min-h-[44px] rounded-xl font-bold text-sm transition ${BTN_COLOR[state]}`}
                  >
                    {state === 'overdue'
                      ? 'Terminar (tiempo excedido)'
                      : 'Terminar comida'}
                  </button>
                </div>
              );
            })}
          </section>
        )}

        {/* ── Historial del dia ──────────────────────────────────────── */}
        {finishedBreaks.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-xs font-bold text-stone-500 uppercase tracking-wider px-1">
              Historial de hoy ({finishedBreaks.length})
            </h2>

            <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
              <ul className="divide-y divide-stone-100">
                {finishedBreaks.map((b) => {
                  const elapsedS = Math.floor(
                    (new Date(b.ended_at!).getTime() -
                      new Date(b.started_at).getTime()) /
                      1000,
                  );
                  const isOverdue = b.status === 'overdue';
                  return (
                    <li key={b.id} className="px-4 py-3 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-stone-800 truncate">
                          {b.staff_name}
                        </p>
                        <p className="text-xs text-stone-400">
                          {fmtTime(b.started_at)} &rarr; {fmtTime(b.ended_at!)}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <span
                          className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                            isOverdue
                              ? 'bg-red-100 text-red-700'
                              : 'bg-emerald-100 text-emerald-700'
                          }`}
                        >
                          {isOverdue ? 'Excedido' : 'OK'}
                        </span>
                        <p className="text-xs text-stone-400 mt-0.5">
                          {fmtTimer(DURATION_S - elapsedS).replace('-', '+')}
                          {elapsedS > DURATION_S ? ' extra' : ' restante'}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>
        )}

        {/* Estado vacío */}
        {activeBreaks.length === 0 && finishedBreaks.length === 0 && (
          <div className="text-center py-10 text-stone-400 text-sm">
            Sin comidas registradas hoy.
          </div>
        )}
      </main>
    </div>
  );
}
