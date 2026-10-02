'use client';

import { useState } from 'react';
import { assignTableAction } from './actions';

// ── Tipos ──────────────────────────────────────────────────────────────────
type Area = 'PB' | 'PA' | 'TE';
type Selection = string | 'delete' | null;

export interface MeseroData {
  id: string;
  name: string;
  home_area: string | null;
}

export interface WeeklyOverage {
  name: string;
  area: string;
  count: number;
}

// ── Constantes ─────────────────────────────────────────────────────────────
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

// ── Componente ─────────────────────────────────────────────────────────────
export default function MesasClient({
  meseros,
  initialAssignments,
  today,
  weeklyOverages = [],
}: {
  meseros: MeseroData[];
  initialAssignments: { tableCode: string; staffId: string }[];
  today: string;
  weeklyOverages?: WeeklyOverage[];
}) {
  const [activeArea, setActiveArea] = useState<Area>('PB');
  const [selected, setSelected] = useState<Selection>(null);
  const [assignments, setAssignments] = useState<Map<string, string>>(
    () => new Map(initialAssignments.map((a) => [a.tableCode, a.staffId])),
  );

  const colorMap = new Map<string, number>(
    meseros.map((m, i) => [m.id, i % STAFF_COLORS.length]),
  );
  const getColor = (staffId: string) =>
    STAFF_COLORS[colorMap.get(staffId) ?? 0];

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

    assignTableAction(tableCode, next, today).catch(() => {
      setAssignments((cur) => {
        const m = new Map(cur);
        if (prev === null) m.delete(tableCode);
        else m.set(tableCode, prev);
        return m;
      });
    });
  }

  const currentTables = AREA_TABLES[activeArea];

  return (
    <>
      {/* Alerta rotación semanal */}
      {weeklyOverages.length > 0 && (
        <div className="bg-rose-950/40 border border-rose-800/50 rounded-2xl p-4 space-y-1">
          <p className="text-xs font-bold text-rose-400 uppercase tracking-wider mb-1">
            Rotacion semanal excedida
          </p>
          {weeklyOverages.map((ovg, i) => (
            <p key={i} className="text-sm text-rose-300">
              <span className="font-semibold">{ovg.name}</span>{' '}
              en {ovg.area}{' '}
              <span className="font-mono text-xs bg-rose-900/60 px-1.5 py-0.5 rounded-full">
                {ovg.count} dias
              </span>
            </p>
          ))}
        </div>
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
      <section className="bg-[#141f1c] rounded-2xl border border-[#223530] overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.2)]">
        <div className="px-4 py-3 border-b border-[#223530] flex items-center justify-between">
          <h2 className="font-bold text-[#e6edea] text-sm">
            {AREA_LABELS[activeArea]}
            <span className="ml-2 text-xs font-normal text-[#7d9990]">
              ({activeArea})
            </span>
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
                <span className="font-mono font-black text-base leading-none">
                  {tableCode}
                </span>
                {assignedName ? (
                  <span className="text-[10px] font-medium leading-tight opacity-80">
                    {assignedName}
                  </span>
                ) : (
                  <span className="text-[10px] text-[#7d9990]/50 leading-tight">
                    Libre
                  </span>
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
    </>
  );
}
