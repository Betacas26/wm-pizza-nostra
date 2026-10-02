'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export type Shift = 'Matutino' | 'Vespertino' | 'Descanso';

export interface CopiedShift {
  staff_id: string;
  day: string;
  shift: Shift;
}

// ── Auth guard ────────────────────────────────────────────────────────────────
async function verifyManager() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const role = (profile as { role: string | null } | null)?.role ?? null;
  if (role !== 'admin' && role !== 'supervisor') {
    throw new Error('No autorizado: se requiere rol admin o supervisor.');
  }
}

// ── Server Actions ─────────────────────────────────────────────────────────────
export async function deleteShiftAction(staffId: string, day: string): Promise<void> {
  await verifyManager();
  const admin = createAdminClient();
  const { error } = await admin
    .from('schedules')
    .delete()
    .eq('staff_id', staffId)
    .eq('day', day);
  if (error) throw new Error(error.message);
}

export async function saveShiftAction(
  staffId: string,
  day: string,
  shift: Shift,
): Promise<void> {
  await verifyManager();

  const admin = createAdminClient();
  const { error } = await admin
    .from('schedules')
    .upsert({ staff_id: staffId, day, shift }, { onConflict: 'staff_id,day' });

  if (error) throw new Error(error.message);
}

export async function copyPrevWeekAction(
  currentWeekDays: string[],
  prevWeekDays: string[],
): Promise<CopiedShift[]> {
  await verifyManager();

  const admin = createAdminClient();

  const { data: prevData, error: fetchError } = await admin
    .from('schedules')
    .select('staff_id, day, shift')
    .in('day', prevWeekDays);

  if (fetchError) throw new Error(fetchError.message);
  if (!prevData?.length) return [];

  const rows: CopiedShift[] = (
    prevData as { staff_id: string; day: string; shift: string }[]
  )
    .map((s) => {
      const idx = prevWeekDays.indexOf(s.day);
      if (idx === -1) return null;
      return {
        staff_id: s.staff_id,
        day: currentWeekDays[idx],
        shift: s.shift as Shift,
      };
    })
    .filter((r): r is CopiedShift => r !== null);

  if (rows.length > 0) {
    const { error: upsertError } = await admin
      .from('schedules')
      .upsert(rows, { onConflict: 'staff_id,day' });

    if (upsertError) throw new Error(upsertError.message);
  }

  return rows;
}
