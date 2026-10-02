'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import {
  saveShiftAction,
  deleteShiftAction,
  copyPrevWeekAction,
  type Shift,
} from './actions';

// ── Tipos ──────────────────────────────────────────────────────────────────
export interface StaffMember {
  id: string;
  name: string;
  role: string;
}

type ScheduleKey = `${string}:${string}`;

// ── Constantes ─────────────────────────────────────────────────────────────
const DAYS_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'] as const;
const SHIFTS: Shift[] = ['Matutino', 'Vespertino', 'Descanso'];

const SHIFT_STYLE: Record<Shift, string> = {
  Matutino: 'bg-amber-100 text-amber-700',
  Vespertino: 'bg-sky-100 text-sky-700',
  Descanso: 'bg-stone-200 text-stone-500',
};

const SHIFT_LABEL: Record<Shift, string> = {
  Matutino: 'M',
  Vespertino: 'V',
  Descanso: 'D',
};

// ── Utilidades ─────────────────────────────────────────────────────────────
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function toDateStr(date: Date): string {
  return date.toISOString().split('T')[0];
}

function formatWeekLabel(weekStart: Date): string {
  const end = addDays(weekStart, 6);
  const fmt = (d: Date) =>
    d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
  return `${fmt(weekStart)} – ${fmt(end)}`;
}

function scheduleKey(staffId: string, day: string): ScheduleKey {
  return `${staffId}:${day}`;
}

function nextShift(current: Shift | undefined): Shift | null {
  if (!current) return 'Matutino';
  if (current === 'Matutino') return 'Vespertino';
  if (current === 'Vespertino') return 'Descanso';
  return null;
}

// ── Componente ─────────────────────────────────────────────────────────────
export default function HorariosClient({
  staff,
  isManager,
}: {
  staff: StaffMember[];
  isManager: boolean;
}) {
  const supabase = useMemo(() => createClient(), []);

  const [weekStart, setWeekStart] = useState<Date>(() => getWeekStart(new Date()));
  const [schedules, setSchedules] = useState<Map<ScheduleKey, Shift>>(new Map());
  const [loading, setLoading] = useState(true);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copying' | 'done' | 'empty'>('idle');

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );
  const weekDayStrs = useMemo(() => weekDays.map(toDateStr), [weekDays]);
  const todayStr = toDateStr(new Date());

  const loadSchedules = useCallback(
    async (days: string[]) => {
      setLoading(true);
      const { data } = await supabase
        .from('schedules')
        .select('staff_id, day, shift')
        .in('day', days);

      const map = new Map<ScheduleKey, Shift>();
      for (const row of data ?? []) {
        map.set(
          scheduleKey(row.staff_id as string, row.day as string),
          row.shift as Shift,
        );
      }
      setSchedules(map);
      setLoading(false);
    },
    [supabase],
  );

  useEffect(() => {
    loadSchedules(weekDayStrs);
  }, [weekDayStrs, loadSchedules]);

  // ── Tap en celda: cicla turnos ──────────────────────────────────────────
  async function handleCell(staffId: string, day: string) {
    if (!isManager) return;
    const k = scheduleKey(staffId, day);
    const current = schedules.get(k);
    const next = nextShift(current);

    // Optimista
    setSchedules((s) => {
      const n = new Map(s);
      if (next) n.set(k, next);
      else n.delete(k);
      return n;
    });

    try {
      if (next) {
        await saveShiftAction(staffId, day, next);
      } else {
        await deleteShiftAction(staffId, day);
      }
    } catch {
      // Revertir
      setSchedules((s) => {
        const n = new Map(s);
        if (current) n.set(k, current);
        else n.delete(k);
        return n;
      });
    }
  }

  // ── Copiar semana anterior ──────────────────────────────────────────────
  async function handleCopyPrev() {
    if (!isManager) return;
    setCopyStatus('copying');
    const prevStart = addDays(weekStart, -7);
    const prevDays = Array.from({ length: 7 }, (_, i) =>
      toDateStr(addDays(prevStart, i)),
    );
    try {
      const copied = await copyPrevWeekAction(weekDayStrs, prevDays);
      if (copied.length === 0) {
        setCopyStatus('empty');
        setTimeout(() => setCopyStatus('idle'), 2500);
        return;
      }
      await loadSchedules(weekDayStrs);
      setCopyStatus('done');
      setTimeout(() => setCopyStatus('idle'), 2500);
    } catch {
      setCopyStatus('idle');
    }
  }

  const copyLabel =
    copyStatus === 'copying' ? 'Copiando...' :
    copyStatus === 'done'    ? '✓ Semana copiada' :
    copyStatus === 'empty'   ? 'Sin datos la semana anterior' :
                               'Copiar semana anterior';

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
            Horarios
          </h1>
          <p className="text-xs text-stone-500 truncate">
            {formatWeekLabel(weekStart)}
          </p>
        </div>
      </header>

      <main className="p-3 max-w-2xl mx-auto space-y-3">
        {/* Navegación de semana */}
        <div className="flex gap-2">
          <button
            onClick={() => setWeekStart((d) => addDays(d, -7))}
            className="flex-1 min-h-[44px] bg-white border border-stone-200 rounded-xl font-semibold text-stone-600 hover:bg-stone-50 text-sm transition"
          >
            ← Anterior
          </button>
          <button
            onClick={() => setWeekStart(getWeekStart(new Date()))}
            className="px-4 min-h-[44px] bg-white border border-amber-300 rounded-xl font-bold text-amber-600 hover:bg-amber-50 text-sm transition"
          >
            Hoy
          </button>
          <button
            onClick={() => setWeekStart((d) => addDays(d, 7))}
            className="flex-1 min-h-[44px] bg-white border border-stone-200 rounded-xl font-semibold text-stone-600 hover:bg-stone-50 text-sm transition"
          >
            Siguiente →
          </button>
        </div>

        {/* Copiar semana */}
        {isManager && (
          <button
            onClick={handleCopyPrev}
            disabled={copyStatus === 'copying'}
            className={`w-full min-h-[44px] rounded-xl font-bold text-sm transition ${
              copyStatus === 'done'  ? 'bg-emerald-500 text-white' :
              copyStatus === 'empty' ? 'bg-stone-400 text-white' :
              'bg-stone-700 hover:bg-stone-800 text-white disabled:opacity-50'
            }`}
          >
            {copyLabel}
          </button>
        )}

        {/* Leyenda */}
        <div className="flex gap-2 text-xs px-1">
          {SHIFTS.map((s) => (
            <span key={s} className={`px-2 py-1 rounded-lg font-semibold ${SHIFT_STYLE[s]}`}>
              {s}
            </span>
          ))}
          <span className="px-2 py-1 rounded-lg font-semibold text-stone-300 border border-stone-200">
            Sin turno
          </span>
        </div>

        {/* Tabla */}
        {loading ? (
          <div className="text-center py-12 text-stone-400 text-sm">
            Cargando horarios...
          </div>
        ) : staff.length === 0 ? (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
            No hay colaboradores activos.
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-stone-100">
                    {/* Nombre (sticky) */}
                    <th className="sticky left-0 z-10 bg-stone-50 px-3 py-2 text-left text-xs font-bold text-stone-500 min-w-[110px]">
                      Colaborador
                    </th>
                    {weekDays.map((date, i) => {
                      const isToday = weekDayStrs[i] === todayStr;
                      return (
                        <th
                          key={weekDayStrs[i]}
                          className={`px-1 py-2 text-center text-xs font-bold min-w-[38px] ${
                            isToday ? 'text-amber-600' : 'text-stone-400'
                          }`}
                        >
                          <span className="block">{DAYS_SHORT[i]}</span>
                          <span className="block text-[10px] font-normal opacity-70">
                            {date.getDate()}
                          </span>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {staff.map((member) => (
                    <tr key={member.id} className="hover:bg-stone-50/50">
                      {/* Nombre (sticky) */}
                      <td className="sticky left-0 z-10 bg-white px-3 py-2 min-w-[110px]">
                        <p className="font-semibold text-xs text-stone-900 leading-tight truncate">
                          {member.name.split(' ')[0]}
                        </p>
                        <p className="text-[10px] text-stone-400 capitalize leading-tight truncate">
                          {member.role}
                        </p>
                      </td>

                      {/* Celdas de turno */}
                      {weekDayStrs.map((dayStr, i) => {
                        const shift = schedules.get(scheduleKey(member.id, dayStr));
                        const isToday = dayStr === todayStr;
                        return (
                          <td
                            key={dayStr}
                            className={`px-1 py-1.5 text-center ${isToday ? 'bg-amber-50/60' : ''}`}
                          >
                            <button
                              onClick={() => handleCell(member.id, dayStr)}
                              disabled={!isManager}
                              title={
                                !isManager ? 'Solo managers pueden editar' :
                                shift ? `${shift} → ${nextShift(shift) ?? 'Limpiar'}` :
                                'Sin turno → Matutino'
                              }
                              className={`w-8 h-8 rounded-lg flex items-center justify-center mx-auto text-[11px] font-bold transition
                                ${shift
                                  ? `${SHIFT_STYLE[shift]} hover:opacity-80`
                                  : 'text-stone-200 hover:bg-stone-100 hover:text-stone-400'}
                                ${isManager ? 'cursor-pointer active:scale-90' : 'cursor-default'}
                              `}
                            >
                              {shift ? SHIFT_LABEL[shift] : '—'}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!isManager && (
          <p className="text-xs text-stone-400 text-center px-4 pb-2">
            Solo supervisores y admins pueden editar horarios.
          </p>
        )}
      </main>
    </div>
  );
}
