import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import Link from 'next/link';

// ── Constantes de área ─────────────────────────────────────────────────────
type Area = 'PB' | 'PA' | 'TE';

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

// ── Tipos internos ─────────────────────────────────────────────────────────
interface Mesero {
  id: string;
  name: string;
  home_area: string | null;
}

interface WorkerSlot {
  id: string;
  name: string;
  tables: string[];
  isHome: boolean;
}

// ── Algoritmo de asignación ────────────────────────────────────────────────
/**
 * Reglas (logic.md):
 * 1. Respetar home_area de cada mesero.
 * 2. Orden de cobertura de sobrantes: PB → PA → TE.
 * 3. Reparto alternado ("mitad y mitad"): round-robin sobre las mesas del área.
 */
function computeAssignment(
  meseros: Mesero[],
): Map<string, { tables: string[]; area: Area }> {
  // Agrupar por home_area válida
  const byArea = new Map<Area, Mesero[]>([
    ['PB', []],
    ['PA', []],
    ['TE', []],
  ]);
  const leftoverPool: Mesero[] = [];

  for (const m of meseros) {
    const area = m.home_area as Area;
    if (AREA_ORDER.includes(area)) {
      byArea.get(area)!.push(m);
    } else {
      leftoverPool.push(m);
    }
  }

  // Primera pasada: dar al menos 1 mesero a áreas vacías (orden de cobertura)
  for (const area of AREA_ORDER) {
    if (byArea.get(area)!.length === 0 && leftoverPool.length > 0) {
      byArea.get(area)!.push(leftoverPool.shift()!);
    }
  }

  // Segunda pasada: distribuir sobrantes restantes en orden de cobertura
  let coverageIdx = 0;
  while (leftoverPool.length > 0) {
    const area = AREA_ORDER[coverageIdx % AREA_ORDER.length];
    byArea.get(area)!.push(leftoverPool.shift()!);
    coverageIdx++;
  }

  // Asignar mesas alternadas: round-robin dentro de cada área
  const result = new Map<string, { tables: string[]; area: Area }>();

  for (const [area, workers] of byArea.entries()) {
    if (workers.length === 0) continue;
    for (const w of workers) {
      result.set(w.id, { tables: [], area });
    }
    AREA_TABLES[area].forEach((table, idx) => {
      const workerIdx = idx % workers.length;
      result.get(workers[workerIdx].id)!.tables.push(table);
    });
  }

  return result;
}

// ── Helpers para Supabase ──────────────────────────────────────────────────
/**
 * Retorna los meseros activos con turno vigente para `today`.
 * Si no hay horario capturado en `schedules`, devuelve todos los meseros activos.
 * @param today - Fecha en formato YYYY-MM-DD
 */
async function fetchActiveMeseros(today: string): Promise<Mesero[]> {
  const supabase = await createClient();

  // Meseros con turno activo hoy (excluir Descanso)
  const { data: scheduleRows } = await supabase
    .from('schedules')
    .select('staff_id')
    .eq('day', today)
    .neq('shift', 'Descanso');

  const scheduledIds = (scheduleRows ?? []).map(
    (r: { staff_id: string }) => r.staff_id,
  );

  let query = supabase
    .from('profiles')
    .select('id, name, home_area')
    .eq('role', 'mesero')
    .eq('active', true);

  // Si hay horario capturado, filtrar; de lo contrario usar todos los activos
  if (scheduledIds.length > 0) {
    query = query.in('id', scheduledIds);
  }

  const { data: profiles } = await query;

  return (profiles ?? []).map(
    (p: { id: string; name: string | null; home_area: string | null }) => ({
      id: p.id,
      name: p.name ?? '(sin nombre)',
      home_area: p.home_area,
    }),
  );
}

// ── Server Action ──────────────────────────────────────────────────────────
async function autoAssignAction() {
  'use server';
  const supabase = await createClient();
  const today = new Date().toISOString().split('T')[0];

  // Verificar autenticación y rol autorizado
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin' && profile?.role !== 'supervisor') {
    throw new Error('No autorizado: se requiere rol admin o supervisor.');
  }

  const meseros = await fetchActiveMeseros(today);
  const assignment = computeAssignment(meseros);

  // Reemplazar asignación del día
  await supabase.from('table_assignments').delete().eq('day', today);

  const rows: { day: string; table_code: string; staff_id: string }[] = [];
  for (const [staffId, { tables }] of assignment.entries()) {
    for (const tableCode of tables) {
      rows.push({ day: today, table_code: tableCode, staff_id: staffId });
    }
  }

  if (rows.length > 0) {
    await supabase.from('table_assignments').insert(rows);
  }

  revalidatePath('/dashboard/mesas');
}

// ── Página ─────────────────────────────────────────────────────────────────
export default async function MesasPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const today = new Date().toISOString().split('T')[0];

  // Datos en paralelo: meseros activos + asignaciones guardadas
  const [meseros, { data: savedRows }] = await Promise.all([
    fetchActiveMeseros(today),
    supabase
      .from('table_assignments')
      .select('table_code, staff_id')
      .eq('day', today),
  ]);

  const hasSaved = (savedRows?.length ?? 0) > 0;

  // ── Construir mapa de display ──────────────────────────────────────────
  const meseroById = new Map<string, Mesero>(meseros.map((m) => [m.id, m]));

  // Mapa: area → lista de workers
  const byAreaDisplay = new Map<Area, WorkerSlot[]>(
    AREA_ORDER.map((a) => [a, []]),
  );

  if (hasSaved && savedRows) {
    // Reconstruir desde BD
    const staffTableMap = new Map<string, string[]>();
    for (const row of savedRows) {
      if (!staffTableMap.has(row.staff_id)) staffTableMap.set(row.staff_id, []);
      staffTableMap.get(row.staff_id)!.push(row.table_code);
    }

    for (const [staffId, tables] of staffTableMap.entries()) {
      const mesero = meseroById.get(staffId);
      // Inferir área por la primera mesa
      const area = (Object.entries(AREA_TABLES) as [Area, string[]][]).find(
        ([, ts]) => ts.includes(tables[0]),
      )?.[0];
      if (!area) continue;

      // Ordenar según AREA_TABLES para consistencia visual
      const ordered = AREA_TABLES[area].filter((t) => tables.includes(t));
      byAreaDisplay.get(area)!.push({
        id: staffId,
        name: mesero?.name ?? staffId,
        tables: ordered,
        isHome: mesero?.home_area === area,
      });
    }
  } else {
    // Usar asignación computada
    const computed = computeAssignment(meseros);
    for (const [staffId, { tables, area }] of computed.entries()) {
      const mesero = meseroById.get(staffId);
      byAreaDisplay.get(area)!.push({
        id: staffId,
        name: mesero?.name ?? staffId,
        tables,
        isHome: mesero?.home_area === area,
      });
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
        <div>
          <h1 className="font-extrabold text-amber-600 text-lg leading-tight">
            Asignacion de Mesas
          </h1>
          <p className="text-xs text-stone-500">
            {today} &middot; {meseros.length} mesero
            {meseros.length !== 1 ? 's' : ''} activos
            {hasSaved && (
              <span className="ml-1 text-emerald-600 font-semibold">
                &middot; Guardada
              </span>
            )}
          </p>
        </div>
      </header>

      <main className="p-4 max-w-xl mx-auto space-y-4">
        {/* Boton de accion */}
        <form action={autoAssignAction}>
          <button
            type="submit"
            className="w-full py-3.5 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white font-bold rounded-xl shadow transition text-sm"
          >
            {hasSaved ? 'Regenerar asignacion' : 'Asignar automaticamente'}
          </button>
        </form>

        {/* Aviso si no hay meseros */}
        {meseros.length === 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
            No hay meseros activos con turno hoy. Si aun no se capturaron
            horarios, se usaran todos los meseros activos.
          </div>
        )}

        {/* Tarjetas por area */}
        {AREA_ORDER.map((area) => {
          const workers = byAreaDisplay.get(area) ?? [];
          return (
            <section
              key={area}
              className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden"
            >
              <div className="px-4 py-3 border-b border-stone-100 flex items-center justify-between">
                <h2 className="font-bold text-stone-900 text-sm">
                  {AREA_LABELS[area]}
                  <span className="ml-2 text-xs font-normal text-stone-400">
                    ({area})
                  </span>
                </h2>
                <span className="text-xs text-stone-400">
                  {AREA_TABLES[area].length} mesas
                </span>
              </div>

              {workers.length === 0 ? (
                <p className="px-4 py-4 text-sm text-stone-400 italic">
                  Sin asignacion
                </p>
              ) : (
                <ul className="divide-y divide-stone-100">
                  {workers.map((w) => (
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
          );
        })}
      </main>
    </div>
  );
}
