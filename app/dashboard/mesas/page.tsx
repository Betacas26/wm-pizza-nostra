import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import Link from 'next/link';
import MesasClient from './MesasClient';

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

  // Calcular fechas de la semana actual (Dom-Sáb) para alertas de rotación
  const todayDate = new Date(today);
  const weekDates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const wd = new Date(todayDate);
    wd.setDate(todayDate.getDate() - todayDate.getDay() + i);
    weekDates.push(wd.toISOString().split('T')[0]);
  }

  // Datos en paralelo: meseros activos + asignaciones guardadas + asignaciones semanales
  const [meseros, { data: savedRows }, { data: weekAssignmentsData }] = await Promise.all([
    fetchActiveMeseros(today),
    supabase
      .from('table_assignments')
      .select('table_code, staff_id')
      .eq('day', today),
    supabase
      .from('table_assignments')
      .select('day, table_code, staff_id')
      .in('day', weekDates),
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

  // ── Alertas de rotación semanal (spec §1: máx. 2 repeticiones/área/semana) ──
  interface WeekOvg { name: string; area: string; count: number }
  const weeklyOverages: WeekOvg[] = [];

  if (weekAssignmentsData && weekAssignmentsData.length > 0) {
    const staffAreaDays = new Map<string, Map<string, Set<string>>>();
    for (const row of weekAssignmentsData as { day: string; table_code: string; staff_id: string }[]) {
      const area = (Object.entries(AREA_TABLES) as [Area, string[]][]).find(
        ([, tables]) => tables.includes(row.table_code),
      )?.[0];
      if (!area) continue;
      if (!staffAreaDays.has(row.staff_id)) staffAreaDays.set(row.staff_id, new Map());
      const areaMap = staffAreaDays.get(row.staff_id)!;
      if (!areaMap.has(area)) areaMap.set(area, new Set());
      areaMap.get(area)!.add(row.day);
    }
    for (const [staffId, areaMap] of staffAreaDays.entries()) {
      const name = meseroById.get(staffId)?.name ?? staffId;
      for (const [area, days] of areaMap.entries()) {
        if (days.size > 2) weeklyOverages.push({ name, area, count: days.size });
      }
    }
  }

  return (
    <div className="min-h-screen bg-[#F8F7F4] text-stone-800">
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
            className="w-full min-h-[44px] py-3.5 bg-amber-500 hover:bg-amber-600 active:scale-[0.98] text-white font-bold rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] transition duration-150 ease-out select-none text-sm"
          >
            {hasSaved ? 'Regenerar asignacion' : 'Asignar automaticamente'}
          </button>
        </form>

        <MesasClient
          areasData={AREA_ORDER.map((area) => ({
            area,
            label: AREA_LABELS[area],
            totalTables: AREA_TABLES[area].length,
            workers: byAreaDisplay.get(area) ?? [],
          }))}
          noMeseros={meseros.length === 0}
          weeklyOverages={weeklyOverages}
        />
      </main>
    </div>
  );
}
