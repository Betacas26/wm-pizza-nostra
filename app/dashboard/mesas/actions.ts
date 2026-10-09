'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { computeAssignment, AREA_ORDER, type Mesero } from '@/lib/mesas/assignment';

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
