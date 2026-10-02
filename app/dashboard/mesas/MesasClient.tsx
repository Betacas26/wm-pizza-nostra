'use client';

import { useState } from 'react';

// ── Tipos ──────────────────────────────────────────────────────────────────
type Area = 'PB' | 'PA' | 'TE';

export interface WorkerSlotData {
  id: string;
  name: string;
  tables: string[];
  isHome: boolean;
}

export interface AreaData {
  area: Area;
  label: string;
  totalTables: number;
  workers: WorkerSlotData[];
}

export interface WeeklyOverage {
  name: string;
  area: string;
  count: number;
}

// ── Componente ─────────────────────────────────────────────────────────────
export default function MesasClient({
  areasData,
  noMeseros,
  weeklyOverages = [],
}: {
  areasData: AreaData[];
  noMeseros: boolean;
  weeklyOverages?: WeeklyOverage[];
}) {
  const [activeArea, setActiveArea] = useState<Area>(areasData[0]?.area ?? 'PB');

  const current = areasData.find((a) => a.area === activeArea);

  return (
    <>
      {noMeseros && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-800">
          No hay meseros activos con turno hoy. Si aun no se capturaron
          horarios, se usaran todos los meseros activos.
        </div>
      )}

      {/* Alerta de rotación semanal (spec §1: máx. 2 repeticiones/área/semana) */}
      {weeklyOverages.length > 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 space-y-1">
          <p className="text-xs font-bold text-rose-700 uppercase tracking-wider mb-1">
            Rotación semanal excedida
          </p>
          {weeklyOverages.map((ovg, i) => (
            <p key={i} className="text-sm text-rose-800">
              <span className="font-semibold">{ovg.name}</span>{' '}
              en {ovg.area}{' '}
              <span className="font-mono text-xs bg-rose-100 px-1.5 py-0.5 rounded-full">
                {ovg.count} días
              </span>
            </p>
          ))}
        </div>
      )}

      {/* Segmented control — áreas */}
      <div className="p-1 bg-stone-200/80 rounded-xl flex">
        {areasData.map((a) => (
          <button
            key={a.area}
            onClick={() => setActiveArea(a.area)}
            className={`flex-1 h-9 rounded-lg text-xs font-semibold transition duration-150 ease-out active:scale-[0.98] select-none ${
              activeArea === a.area
                ? 'bg-white text-stone-900 shadow-sm'
                : 'text-stone-600 hover:text-stone-800'
            }`}
          >
            {a.area}
          </button>
        ))}
      </div>

      {/* Tarjeta del área activa */}
      {current && (
        <section className="bg-white rounded-2xl border border-stone-200/70 shadow-[0_2px_8px_rgba(0,0,0,0.04)] overflow-hidden">
          <div className="px-4 py-3 border-b border-stone-100 flex items-center justify-between">
            <h2 className="font-bold text-stone-900 text-sm">
              {current.label}
              <span className="ml-2 text-xs font-normal text-stone-400">
                ({current.area})
              </span>
            </h2>
            <span className="text-xs text-stone-400">
              {current.totalTables} mesas
            </span>
          </div>

          {current.workers.length === 0 ? (
            <p className="px-4 py-4 text-sm text-stone-400 italic">
              Sin asignacion
            </p>
          ) : (
            <ul className="divide-y divide-stone-100">
              {current.workers.map((w) => (
                <li key={w.id} className="px-4 py-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-sm text-stone-800">
                      {w.name}
                    </span>
                    {w.isHome ? (
                      <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                        Area propia
                      </span>
                    ) : (
                      <span className="text-xs bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full">
                        Cobertura
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {w.tables.map((t) => (
                      <span
                        key={t}
                        className="text-xs font-mono bg-stone-100 text-stone-700 px-2 py-1 rounded-lg"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                  <p className="mt-1.5 text-xs text-stone-400">
                    {w.tables.length} mesa{w.tables.length !== 1 ? 's' : ''}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </>
  );
}
