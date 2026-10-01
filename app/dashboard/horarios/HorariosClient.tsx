'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

// ── Tipos ──────────────────────────────────────────────────────────────────
type Shift = 'Matutino' | 'Vespertino' | 'Descanso';

export interface StaffMember {
  id: string;
  name: string;
  role: string;
}

type ScheduleKey = `${string}:${string}`;

// ── Constantes ─────────────────────────────────────────────────────────────
const DAYS_SHORT = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'] as const;

const SHIFTS: Shift[] = ['Matutino', 'Vespertino', 'Descanso'];

const SHIFT_STYLE: Record<Shift, { on: string; off: string; label: string }> = {
  Matutino: {
    on: 'bg-amber-500 text-white shadow-sm',
    off: 'bg-stone-100 text-stone-500 hover:bg-amber-50 hover:text-amber-700',
    label: 'Mat',
  },
  Vespertino: {
    on: 'bg-sky-500 text-white shadow-sm',
    off: 'bg-stone-100 text-stone-500 hover:bg-sky-50 hover:text-sky-700',
    label: 'Ves',
  },
  Descanso: {
    on: 'bg-stone-400 text-white shadow-sm',
    off: 'bg-stone-100 text-stone-500 hover:bg-stone-200',
    label: 'Des',
  },
};

// ── Utilidades de fecha ────────────────────────────────────────────────────
/** Retorna el domingo de la semana que contiene `date`. */
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
  return `${fmt(weekStart)} \u2013 ${fmt(end)}`;
}

function scheduleKey(staffId: string, day: string): ScheduleKey {
  return `${staffId}:${day}`;
}

// ── Componente ─────────────────────────────────────────────────────────────
export default function HorariosClient({ staff }: { staff: StaffMember[] }) {
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

  // ── Carga de horarios ──────────────────────────────────────────────────
  /**
   * Obtiene los registros de `schedules` para los días indicados
   * y reconstruye el mapa local de turnos.
   */
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

  // ── Asignar turno ──────────────────────────────────────────────────────
  async function handleShift(staffId: string, day: string, shift: Shift) {
    const k = scheduleKey(staffId, day);
    // Actualización optimista
    setSchedules((prev) => {
      const next = new Map(prev);
      next.set(k, shift);
      return next;
    });
    await supabase
      .from('schedules')
      .upsert({ staff_id: staffId, day, shift }, { onConflict: 'staff_id,day' });
  }

  // ── Copiar semana anterior ─────────────────────────────────────────────
  async function handleCopyPrev() {
    setCopyStatus('copying');

    const prevStart = addDays(weekStart, -7);
    const prevDays = Array.from({ length: 7 }, (_, i) =>
      toDateStr(addDays(prevStart, i)),
    );

    const { data: prevData } = await supabase
      .from('schedules')
      .select('staff_id, day, shift')
      .in('day', prevDays);

    if (!prevData?.length) {
      setCopyStatus('empty');
      setTimeout(() => setCopyStatus('idle'), 2500);
      return;
    }

    // Mapear cada registro al mismo índice de día de la semana actual
    const rows = prevData
      .map((s) => {
        const idx = prevDays.indexOf(s.day as string);
        if (idx === -1) return null;
        return {
          staff_id: s.staff_id as string,
          day: weekDayStrs[idx],
          shift: s.shift as Shift,
        };
      })
      .filter(
        (r): r is { staff_id: string; day: string; shift: Shift } => r !== null,
      );

    if (rows.length > 0) {
      await supabase
        .from('schedules')
        .upsert(rows, { onConflict: 'staff_id,day' });
    }

    await loadSchedules(weekDayStrs);
    setCopyStatus('done');
    setTimeout(() => setCopyStatus('idle'), 2500);
  }

  const copyLabel =
    copyStatus === 'copying' ? 'Copiando...' :
    copyStatus === 'done'    ? 'Semana copiada' :
    copyStatus === 'empty'   ? 'Sin datos la semana anterior' :
                               'Copiar semana anterior';

  const copyClass =
    copyStatus === 'done'  ? 'bg-emerald-500 text-white' :
    copyStatus === 'empty' ? 'bg-stone-400 text-white' :
                             'bg-stone-700 hover:bg-stone-800 active:bg-stone-900 text-white disabled:opacity-50';

  return (
    <div className="min-h-screen bg-stone-50 text-stone-800">
      {/* Header */}
      <header className="bg-white border-b border-stone-200 px-4 py-3 flex items-center gap-3 shadow-sm sticky top-0 z-10">
        <Link
          href="/dashboard"
          className="text-stone-400 hover:text-stone-700 text-xl leading-none"
          aria-label="Volver al panel"
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

      <main className="p-4 max-w-xl mx-auto space-y-3">
        {/* Navegacion de semana */}
        <div className="flex gap-2">
          <button
            onClick={() => setWeekStart((d) => addDays(d, -7))}
            className="flex-1 min-h-[44px] bg-white border border-stone-200 rounded-xl font-semibold text-stone-600 hover:bg-stone-50 active:bg-stone-100 text-sm transition"
          >
            &#8592; Anterior
          </button>
          <button
            onClick={() => setWeekStart(getWeekStart(new Date()))}
            className="px-4 min-h-[44px] bg-white border border-amber-300 rounded-xl font-bold text-amber-600 hover:bg-amber-50 active:bg-amber-100 text-sm transition"
          >
            Hoy
          </button>
          <button
            onClick={() => setWeekStart((d) => addDays(d, 7))}
            className="flex-1 min-h-[44px] bg-white border border-stone-200 rounded-xl font-semibold text-stone-600 hover:bg-stone-50 active:bg-stone-100 text-sm transition"
          >
            Siguiente &#8594;
          </button>
        </div>

        {/* Copiar semana anterior */}
        <button
          onClick={handleCopyPrev}
          disabled={copyStatus === 'copying'}
          className={`w-full min-h-[44px] font-bold rounded-xl shadow transition text-sm ${copyClass}`}
        >
          {copyLabel}
        </button>

        {/* Leyenda */}
        <div className="flex gap-2 text-xs">
          <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-lg font-semibold">
            Matutino
          </span>
          <span className="px-2 py-1 bg-sky-100 text-sky-700 rounded-lg font-semibold">
            Vespertino
          </span>
          <span className="px-2 py-1 bg-stone-200 text-stone-600 rounded-lg font-semibold">
            Descanso
          </span>
        </div>

        {/* Grid de horarios */}
        {loading ? (
          <div className="text-center py-12 text-stone-400 text-sm">
            Cargando horarios...
          </div>
        ) : staff.length === 0 ? (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
            No hay colaboradores activos registrados.
          </div>
        ) : (
          staff.map((member) => (
            <section
              key={member.id}
              className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden"
            >
              {/* Cabecera del colaborador */}
              <div className="px-4 py-3 border-b border-stone-100 bg-stone-50/60">
                <p className="font-bold text-stone-900 text-sm leading-tight">
                  {member.name}
                </p>
                <p className="text-xs text-stone-400 capitalize mt-0.5">
                  {member.role.replace(/_/g, ' ')}
                </p>
              </div>

              {/* Filas de días Dom-Sab */}
              <ul className="divide-y divide-stone-100">
                {weekDays.map((date, idx) => {
                  const dayStr = weekDayStrs[idx];
                  const current = schedules.get(scheduleKey(member.id, dayStr));
                  const isToday = dayStr === todayStr;

                  return (
                    <li
                      key={dayStr}
                      className={`flex items-center gap-2 px-3 py-2 ${
                        isToday ? 'bg-amber-50' : ''
                      }`}
                    >
                      {/* Etiqueta del día */}
                      <div className="w-9 shrink-0 text-center select-none">
                        <span
                          className={`block text-xs font-bold ${
                            isToday ? 'text-amber-600' : 'text-stone-500'
                          }`}
                        >
                          {DAYS_SHORT[idx]}
                        </span>
                        <span
                          className={`block text-xs leading-tight ${
                            isToday ? 'text-amber-400' : 'text-stone-400'
                          }`}
                        >
                          {date.getDate()}
                        </span>
                      </div>

                      {/* Botones de turno */}
                      <div className="flex gap-1.5 flex-1">
                        {SHIFTS.map((shift) => {
                          const style = SHIFT_STYLE[shift];
                          const isActive = current === shift;
                          return (
                            <button
                              key={shift}
                              onClick={() => handleShift(member.id, dayStr, shift)}
                              className={`flex-1 min-h-[44px] rounded-lg text-xs font-semibold transition ${
                                isActive ? style.on : style.off
                              }`}
                            >
                              {style.label}
                            </button>
                          );
                        })}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
        )}
      </main>
    </div>
  );
}
