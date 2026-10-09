'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { assignTableAction, autoAssignDayAction } from './actions';

// ── Tipos ───────────────────────────────────────────────────────────────────
type Area = 'PB' | 'PA' | 'TE';
type Selection = string | 'delete' | null;

export interface MeseroData {
  id: string;
  name: string;
  home_area: string | null;
}

export interface AyudanteData {
  id: string;
  name: string;
  home_area: string | null;
}

// ── Constantes ──────────────────────────────────────────────────────────────
const AREA_TABLES: Record<Area, string[]> = {
  PB: ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'BR'],
  PA: ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9', 'PV'],
  TE: ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11'],
};

const AREA_ORDER: Area[] = ['PB', 'PA', 'TE'];

const AREA_LABELS: Record<Area, string> = {
  PB: 'Planta Baja',
  PA: 'Planta Alta',
  TE: 'Terraza',
};

const DAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];

const STAFF_COLORS = [
  {
    pill: 'bg-emerald-950/70 border-emerald-700/60 text-emerald-200',
    ring: 'ring-emerald-400',
    dot: 'bg-emerald-400',
    table: 'bg-emerald-950/50 border-emerald-700/60 text-emerald-200',
  },
  {
    pill: 'bg-purple-950/70 border-purple-700/60 text-purple-200',
    ring: 'ring-purple-400',
    dot: 'bg-purple-400',
    table: 'bg-purple-950/50 border-purple-700/60 text-purple-200',
  },
  {
    pill: 'bg-rose-950/70 border-rose-800/60 text-rose-200',
    ring: 'ring-rose-400',
    dot: 'bg-rose-400',
    table: 'bg-rose-950/50 border-rose-800/60 text-rose-200',
  },
  {
    pill: 'bg-sky-950/70 border-sky-800/60 text-sky-200',
    ring: 'ring-sky-400',
    dot: 'bg-sky-400',
    table: 'bg-sky-950/50 border-sky-800/60 text-sky-200',
  },
  {
    pill: 'bg-amber-950/70 border-amber-800/60 text-amber-200',
    ring: 'ring-amber-400',
    dot: 'bg-amber-400',
    table: 'bg-amber-950/50 border-amber-800/60 text-amber-200',
  },
  {
    pill: 'bg-lime-950/70 border-lime-800/60 text-lime-200',
    ring: 'ring-lime-400',
    dot: 'bg-lime-400',
    table: 'bg-lime-950/50 border-lime-800/60 text-lime-200',
  },
];

// ── Helpers de fecha ────────────────────────────────────────────────────────
function getWeekStart(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const sun = new Date(d);
  sun.setDate(d.getDate() - d.getDay());
  return sun.toISOString().split('T')[0];
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return `${DAY_LABELS[d.getDay()]} ${d.getDate()}`;
}

function formatLongDate(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

// ── PDF ─────────────────────────────────────────────────────────────────────
function buildWeeklyPrintHtml(
  allDays: { day: string; rows: { table_code: string; staff_id: string }[] }[],
  meseros: MeseroData[],
): string {
  const nameById = new Map(meseros.map((m) => [m.id, m.name]));

  let sections = '';
  for (const { day, rows } of allDays) {
    const assignMap = new Map(rows.map((r) => [r.table_code, r.staff_id]));
    const dayLabel = formatLongDate(day);
    let dayHtml = `<div class="day"><h2>${dayLabel}</h2>`;

    for (const area of AREA_ORDER) {
      const meseroTables = new Map<string, string[]>();
      for (const table of AREA_TABLES[area]) {
        const sid = assignMap.get(table);
        if (sid) {
          if (!meseroTables.has(sid)) meseroTables.set(sid, []);
          meseroTables.get(sid)!.push(table);
        }
      }
      const unassigned = AREA_TABLES[area].filter((t) => !assignMap.has(t));

      dayHtml += `<div class="area"><h3>${AREA_LABELS[area]}</h3><table><thead><tr><th>Mesero</th><th>Mesas</th></tr></thead><tbody>`;
      for (const [sid, tables] of meseroTables) {
        dayHtml += `<tr><td>${nameById.get(sid) ?? sid}</td><td>${tables.join(', ')}</td></tr>`;
      }
      if (unassigned.length > 0) {
        dayHtml += `<tr class="unassigned"><td>Sin asignar</td><td>${unassigned.join(', ')}</td></tr>`;
      }
      if (meseroTables.size === 0 && unassigned.length === AREA_TABLES[area].length) {
        dayHtml += `<tr><td colspan="2" class="empty">Sin asignacion</td></tr>`;
      }
      dayHtml += `</tbody></table></div>`;
    }
    dayHtml += '</div>';
    sections += dayHtml;
  }

  const firstDay = allDays[0]?.day ?? '';
  const lastDay = allDays[allDays.length - 1]?.day ?? '';

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Asignacion de Mesas — Semana</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, sans-serif; font-size: 12px; color: #111; background: #fff; padding: 20px; }
  h1 { font-size: 18px; margin-bottom: 4px; }
  .subtitle { color: #666; font-size: 12px; margin-bottom: 20px; }
  .day { margin-bottom: 24px; page-break-inside: avoid; }
  .day h2 { font-size: 14px; font-weight: 700; text-transform: capitalize; border-bottom: 2px solid #333; padding-bottom: 4px; margin-bottom: 10px; }
  .area { margin-bottom: 10px; }
  .area h3 { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: #555; margin-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: 4px 8px; border: 1px solid #ddd; }
  th { background: #f4f4f4; font-weight: 600; }
  .unassigned td { color: #999; font-style: italic; }
  .empty { text-align: center; color: #aaa; font-style: italic; }
  @media print { body { padding: 10px; } }
</style>
</head>
<body>
<h1>WM Pizza Nostra — Asignacion de Mesas</h1>
<p class="subtitle">Semana del ${firstDay} al ${lastDay}</p>
${sections}
</body>
</html>`;
}

// ── Componente ──────────────────────────────────────────────────────────────
export default function MesasClient({
  meseros,
  ayudantes,
  today,
  isManager,
}: {
  meseros: MeseroData[];
  ayudantes: AyudanteData[];
  today: string;
  isManager: boolean;
}) {
  const supabase = useMemo(() => createClient(), []);

  const [weekStart, setWeekStart] = useState(() => getWeekStart(today));
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  const [selectedDay, setSelectedDay] = useState(today);
  const [assignments, setAssignments] = useState<Map<string, string>>(new Map());
  const [loadingDay, setLoadingDay] = useState(true);
  const [autoAssigning, setAutoAssigning] = useState(false);
  const [printing, setPrinting] = useState(false);

  const [activeArea, setActiveArea] = useState<Area>('PB');
  const [selected, setSelected] = useState<Selection>(null);

  const colorMap = useMemo(
    () => new Map(meseros.map((m, i) => [m.id, i % STAFF_COLORS.length])),
    [meseros],
  );
  const getColor = (staffId: string) => STAFF_COLORS[colorMap.get(staffId) ?? 0];

  const loadDay = useCallback(
    async (day: string) => {
      setLoadingDay(true);
      const { data } = await supabase
        .from('table_assignments')
        .select('table_code, staff_id')
        .eq('day', day);
      setAssignments(
        new Map((data ?? []).map((r: { table_code: string; staff_id: string }) => [r.table_code, r.staff_id])),
      );
      setLoadingDay(false);
    },
    [supabase],
  );

  useEffect(() => {
    loadDay(selectedDay);
  }, [selectedDay, loadDay]);

  function handleSelectDay(day: string) {
    setSelectedDay(day);
    setSelected(null);
  }

  function handlePrevWeek() {
    const newStart = addDays(weekStart, -7);
    setWeekStart(newStart);
    setSelectedDay(addDays(selectedDay, -7));
  }

  function handleNextWeek() {
    const newStart = addDays(weekStart, 7);
    setWeekStart(newStart);
    setSelectedDay(addDays(selectedDay, 7));
  }

  function handleTableTap(tableCode: string) {
    if (selected === null) return;
    const prev = assignments.get(tableCode) ?? null;
    const next = selected === 'delete' ? null : selected;

    setAssignments((cur) => {
      const m = new Map(cur);
      if (next === null) m.delete(tableCode);
      else m.set(tableCode, next);
      return m;
    });

    assignTableAction(tableCode, next, selectedDay).catch(() => {
      setAssignments((cur) => {
        const m = new Map(cur);
        if (prev === null) m.delete(tableCode);
        else m.set(tableCode, prev);
        return m;
      });
    });
  }

  async function handleAutoAssign() {
    if (!isManager) return;
    setAutoAssigning(true);
    try {
      await autoAssignDayAction(selectedDay);
      await loadDay(selectedDay);
    } finally {
      setAutoAssigning(false);
    }
  }

  async function handlePrintWeek() {
    setPrinting(true);
    try {
      const allDays = await Promise.all(
        weekDays.map(async (day) => {
          const { data } = await supabase
            .from('table_assignments')
            .select('table_code, staff_id')
            .eq('day', day);
          return { day, rows: (data ?? []) as { table_code: string; staff_id: string }[] };
        }),
      );
      const html = buildWeeklyPrintHtml(allDays, meseros);
      const win = window.open('', '_blank');
      if (win) {
        win.document.write(html);
        win.document.close();
        win.focus();
        setTimeout(() => win.print(), 300);
      }
    } finally {
      setPrinting(false);
    }
  }

  const currentTables = AREA_TABLES[activeArea];

  const weekLabel = (() => {
    const last = addDays(weekStart, 6);
    const a = new Date(weekStart + 'T12:00:00');
    const b = new Date(last + 'T12:00:00');
    return `${a.getDate()} – ${b.getDate()} ${b.toLocaleDateString('es-MX', { month: 'short' })}`;
  })();

  return (
    <div className="space-y-4">
      {/* Navegacion semanal */}
      <div className="bg-[#151D1A] rounded-2xl border border-[#223530] overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#223530]">
          <button
            onClick={handlePrevWeek}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[#7d9990] hover:text-[#e6edea] hover:bg-[#1c2b27] transition"
          >
            &#8592;
          </button>
          <span className="text-xs font-bold text-[#e6edea]">{weekLabel}</span>
          <button
            onClick={handleNextWeek}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[#7d9990] hover:text-[#e6edea] hover:bg-[#1c2b27] transition"
          >
            &#8594;
          </button>
        </div>

        {/* Tabs de días */}
        <div className="grid grid-cols-7 divide-x divide-[#223530]">
          {weekDays.map((day) => {
            const isSelected = day === selectedDay;
            const isToday = day === today;
            return (
              <button
                key={day}
                onClick={() => handleSelectDay(day)}
                className={`py-2 flex flex-col items-center gap-0.5 transition duration-150 ease-out ${
                  isSelected
                    ? 'bg-[#1c2b27] text-[#e6edea]'
                    : 'text-[#7d9990] hover:text-[#e6edea] hover:bg-[#1c2b27]/50'
                }`}
              >
                <span className="text-[9px] font-bold uppercase">
                  {formatShortDate(day).split(' ')[0]}
                </span>
                <span
                  className={`text-sm font-bold leading-none ${
                    isToday ? 'text-[#E8899A]' : ''
                  }`}
                >
                  {formatShortDate(day).split(' ')[1]}
                </span>
                {isToday && (
                  <span className="w-1 h-1 rounded-full bg-[#E8899A]" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Dia seleccionado + acciones */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-[#7d9990] capitalize">
          {formatLongDate(selectedDay)}
          {loadingDay && <span className="ml-2 opacity-50">cargando...</span>}
        </p>
        <button
          onClick={handlePrintWeek}
          disabled={printing}
          className="shrink-0 h-9 px-3 rounded-xl border border-[#223530] bg-[#1c2b27] text-xs font-semibold text-[#7d9990] hover:text-[#e6edea] transition disabled:opacity-40"
        >
          {printing ? 'Cargando...' : '⎙ PDF semana'}
        </button>
      </div>

      {isManager && (
        <button
          onClick={handleAutoAssign}
          disabled={autoAssigning || loadingDay}
          className="w-full min-h-[44px] py-3 bg-[#7A1D2E] hover:bg-[#9E2A3E] active:scale-[0.98] text-white font-bold rounded-xl shadow transition duration-150 ease-out select-none text-sm disabled:opacity-50"
        >
          {autoAssigning ? 'Asignando...' : 'Asignar automaticamente este dia'}
        </button>
      )}

      {/* Carrusel de seleccion */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
        <button
          onClick={() => setSelected((prev) => (prev === 'delete' ? null : 'delete'))}
          className={`shrink-0 h-10 px-3 rounded-xl border font-bold text-sm transition duration-150 ease-out active:scale-[0.98] select-none ${
            selected === 'delete'
              ? 'bg-red-900/60 border-red-600/80 text-red-200 ring-2 ring-red-400 scale-105'
              : 'bg-[#1c2b27] border-[#223530] text-[#7d9990] hover:text-[#e6edea]'
          }`}
        >
          ⌫ Borrar
        </button>

        {meseros.length === 0 ? (
          <span className="shrink-0 h-10 flex items-center text-sm text-[#7d9990] italic px-1">
            Sin meseros activos
          </span>
        ) : (
          meseros.map((m) => {
            const color = getColor(m.id);
            const isSelected = selected === m.id;
            return (
              <button
                key={m.id}
                onClick={() => setSelected((prev) => (prev === m.id ? null : m.id))}
                className={`shrink-0 h-10 px-3 rounded-xl border font-semibold text-sm transition duration-150 ease-out active:scale-[0.98] select-none ${color.pill} ${
                  isSelected
                    ? `ring-2 ${color.ring} scale-105 opacity-100`
                    : 'opacity-60 hover:opacity-90'
                }`}
              >
                {m.name.split(' ')[0]}
              </button>
            );
          })
        )}
      </div>

      {/* Selector de area */}
      <div className="p-1 bg-[#0a0f0e] rounded-xl flex">
        {AREA_ORDER.map((area) => (
          <button
            key={area}
            onClick={() => setActiveArea(area)}
            className={`flex-1 h-9 rounded-lg text-xs font-semibold transition duration-150 ease-out active:scale-[0.98] select-none ${
              activeArea === area
                ? 'bg-[#1c2b27] text-[#e6edea] shadow-sm'
                : 'text-[#7d9990] hover:text-[#e6edea]'
            }`}
          >
            {area}
          </button>
        ))}
      </div>

      {/* Grid de mesas */}
      <section className="bg-[#151D1A] rounded-2xl border border-[#223530] overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.2)]">
        <div className="px-4 py-3 border-b border-[#223530] flex items-center justify-between">
          <h2 className="font-bold text-[#e6edea] text-sm">
            {AREA_LABELS[activeArea]}
            <span className="ml-2 text-xs font-normal text-[#7d9990]">({activeArea})</span>
          </h2>
          <span className="text-xs text-[#7d9990]">{currentTables.length} mesas</span>
        </div>

        <div className="p-3 grid grid-cols-3 gap-2">
          {currentTables.map((tableCode) => {
            const assignedId = assignments.get(tableCode);
            const color = assignedId ? getColor(assignedId) : null;
            const assignedName = assignedId
              ? meseros.find((m) => m.id === assignedId)?.name?.split(' ')[0] ?? '?'
              : null;

            return (
              <button
                key={tableCode}
                onClick={() => handleTableTap(tableCode)}
                className={`h-16 rounded-xl border font-bold text-sm flex flex-col items-center justify-center gap-0.5 transition duration-150 ease-out select-none
                  ${selected !== null ? 'active:scale-[0.94] cursor-pointer' : 'cursor-default'}
                  ${color ? color.table : 'bg-[#1c2b27] border-[#223530] text-[#7d9990]'}
                `}
              >
                <span className="font-mono font-black text-base leading-none">{tableCode}</span>
                {assignedName ? (
                  <span className="text-[10px] font-medium leading-tight opacity-80">
                    {assignedName}
                  </span>
                ) : (
                  <span className="text-[10px] text-[#7d9990]/50 leading-tight">Libre</span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* Leyenda */}
      {meseros.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {meseros.map((m) => {
            const color = getColor(m.id);
            const count = [...assignments.values()].filter((id) => id === m.id).length;
            return (
              <div
                key={m.id}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs ${color.pill}`}
              >
                <span className={`w-2 h-2 rounded-full shrink-0 ${color.dot}`} />
                <span className="font-semibold">{m.name.split(' ')[0]}</span>
                <span className="opacity-50">({count})</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Ayudantes por área */}
      {ayudantes.length > 0 && (
        <section className="bg-[#151D1A] rounded-2xl border border-[#223530] shadow-[0_2px_8px_rgba(0,0,0,0.2)] overflow-hidden">
          <div className="px-4 py-2.5 border-b border-[#223530]">
            <h2 className="text-xs font-bold text-[#7d9990] uppercase tracking-wider">
              Ayudantes por Area
            </h2>
          </div>
          <div className="grid grid-cols-3 divide-x divide-[#223530]">
            {AREA_ORDER.map((area) => {
              const inArea = ayudantes.filter(
                (a) => a.home_area === area,
              );
              return (
                <div key={area} className="p-3">
                  <p className="text-[10px] font-bold text-[#7d9990] uppercase tracking-wider mb-2">
                    {area}
                  </p>
                  {inArea.length === 0 ? (
                    <p className="text-[10px] text-[#223530] italic">—</p>
                  ) : (
                    <div className="flex flex-col gap-1">
                      {inArea.map((a) => (
                        <span
                          key={a.id}
                          className="text-xs font-semibold text-orange-300 bg-orange-950/50 border border-orange-800/40 px-2 py-0.5 rounded-lg truncate"
                        >
                          {a.name.split(' ')[0]}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Reporte de rotacion semanal */}
      {meseros.length > 0 && (
        <section className="bg-[#151D1A] rounded-2xl border border-[#223530] shadow-[0_2px_8px_rgba(0,0,0,0.2)] overflow-hidden">
          <div className="px-4 py-2.5 border-b border-[#223530]">
            <h2 className="text-xs font-bold text-[#7d9990] uppercase tracking-wider">
              Rotacion semanal — {weekLabel}
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#223530]">
                  <th className="sticky left-0 bg-[#151D1A] px-3 py-2 text-left font-bold text-[#7d9990] min-w-[90px]">
                    Mesero
                  </th>
                  {AREA_ORDER.map((a) => (
                    <th key={a} className="px-3 py-2 text-center font-bold text-[#7d9990]">
                      {a}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#223530]">
                {meseros.map((m) => {
                  // Count days assigned per area across the week
                  // We need weekly assignment data — use the current assignments for selectedDay only
                  // as a proxy (full weekly count would require loading all 7 days)
                  const assignedArea = (() => {
                    let area: Area | null = null;
                    for (const [tableCode, staffId] of assignments.entries()) {
                      if (staffId !== m.id) continue;
                      for (const [a, tables] of Object.entries(AREA_TABLES) as [Area, string[]][]) {
                        if (tables.includes(tableCode)) { area = a; break; }
                      }
                      if (area) break;
                    }
                    return area;
                  })();

                  return (
                    <tr key={m.id} className="hover:bg-[#1c2b27]/30">
                      <td className="sticky left-0 bg-[#151D1A] px-3 py-2 font-semibold text-[#e6edea] truncate max-w-[90px]">
                        {m.name.split(' ')[0]}
                      </td>
                      {AREA_ORDER.map((a) => {
                        const isHere = assignedArea === a;
                        const isHome = m.home_area === a;
                        return (
                          <td key={a} className="px-3 py-2 text-center">
                            {isHere ? (
                              <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg text-[10px] font-bold ${
                                isHome
                                  ? 'bg-emerald-950/60 border border-emerald-700/50 text-emerald-300'
                                  : 'bg-[#420F18]/60 border border-[#9E2A3E]/50 text-[#E8899A]'
                              }`}>
                                {isHome ? 'H' : 'C'}
                              </span>
                            ) : (
                              <span className="text-[#223530]">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 border-t border-[#223530] flex gap-3">
            <span className="flex items-center gap-1 text-[10px] text-emerald-400">
              <span className="w-4 h-4 rounded bg-emerald-950/60 border border-emerald-700/50 inline-flex items-center justify-center font-bold text-[8px]">H</span>
              Home area
            </span>
            <span className="flex items-center gap-1 text-[10px] text-[#E8899A]">
              <span className="w-4 h-4 rounded bg-[#420F18]/60 border border-[#9E2A3E]/50 inline-flex items-center justify-center font-bold text-[8px]">C</span>
              Cobertura
            </span>
          </div>
        </section>
      )}
    </div>
  );
}
