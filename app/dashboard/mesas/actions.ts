'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

// ── Constantes compartidas ─────────────────────────────────────────────────
type Area = 'PB' | 'PA' | 'TE';

const AREA_TABLES: Record<Area, string[]> = {
  PB: ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'BR'],
  PA: ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9', 'PV'],
  TE: ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11'],
};
const AREA_ORDER: Area[] = ['PB', 'PA', 'TE'];

interface Mesero { id: string; name: string; home_area: string | null }

function computeAssignment(meseros: Mesero[]): Map<string, { tables: string[]; area: Area }> {
  const byArea = new Map<Area, Mesero[]>([['PB', []], ['PA', []], ['TE', []]]);
  const leftoverPool: Mesero[] = [];

  for (const m of meseros) {
    const area = m.home_area as Area;
    if (AREA_ORDER.includes(area)) byArea.get(area)!.push(m);
    else leftoverPool.push(m);
  }

  for (const area of AREA_ORDER) {
    if (byArea.get(area)!.length === 0 && leftoverPool.length > 0) {
      byArea.get(area)!.push(leftoverPool.shift()!);
    }
  }

  let coverageIdx = 0;
  while (leftoverPool.length > 0) {
    const area = AREA_ORDER[coverageIdx % AREA_ORDER.length];
    byArea.get(area)!.push(leftoverPool.shift()!);
    coverageIdx++;
  }

  const result = new Map<string, { tables: string[]; area: Area }>();
  for (const [area, workers] of byArea.entries()) {
    if (workers.length === 0) continue;
    for (const w of workers) result.set(w.id, { tables: [], area });
    AREA_TABLES[area].forEach((table, idx) => {
      const workerIdx = idx % workers.length;
      result.get(workers[workerIdx].id)!.tables.push(table);
    });
  }
  return result;
}

export async function autoAssignDayAction(day: string): Promise<void> {
  const supabase = await verifyManager();

  // Fetch active meseros with shift on this day
  const { data: scheduleRows } = await supabase
    .from('schedules')
    .select('staff_id')
    .eq('day', day)
    .neq('shift', 'Descanso');

  const scheduledIds = (scheduleRows ?? []).map((r: { staff_id: string }) => r.staff_id);

  let query = supabase
    .from('profiles')
    .select('id, name, home_area')
    .eq('role', 'mesero')
    .eq('active', true);

  if (scheduledIds.length > 0) query = query.in('id', scheduledIds);

  const { data: profiles } = await query;
  const meseros: Mesero[] = (profiles ?? []).map(
    (p: { id: string; name: string | null; home_area: string | null }) => ({
      id: p.id,
      name: p.name ?? '(sin nombre)',
      home_area: p.home_area,
    }),
  );

  const assignment = computeAssignment(meseros);

  await supabase.from('table_assignments').delete().eq('day', day);

  const rows: { day: string; table_code: string; staff_id: string }[] = [];
  for (const [staffId, { tables }] of assignment.entries()) {
    for (const tableCode of tables) {
      rows.push({ day, table_code: tableCode, staff_id: staffId });
    }
  }

  if (rows.length > 0) {
    await supabase.from('table_assignments').insert(rows);
  }

  revalidatePath('/dashboard/mesas');
}

async function verifyManager() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('No autorizado.');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin' && profile?.role !== 'supervisor') {
    throw new Error('No autorizado: se requiere rol admin o supervisor.');
  }
  return supabase;
}

export async function assignTableAction(
  tableCode: string,
  staffId: string | null,
  today: string,
) {
  const supabase = await verifyManager();

  await supabase
    .from('table_assignments')
    .delete()
    .eq('day', today)
    .eq('table_code', tableCode);

  if (staffId !== null) {
    await supabase
      .from('table_assignments')
      .insert({ day: today, table_code: tableCode, staff_id: staffId });
  }

  revalidatePath('/dashboard/mesas');
}
