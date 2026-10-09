'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

async function assertManager() {
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

  const role = (profile as { role: string | null } | null)?.role ?? null;
  if (role !== 'admin' && role !== 'supervisor') {
    throw new Error('Solo managers pueden asignar capitanes.');
  }
}

export async function assignCaptainAction(
  shiftDate: string,
  shift: 'Matutino' | 'Vespertino',
  captainId: string,
): Promise<void> {
  await assertManager();
  const admin = createAdminClient();
  const { error } = await admin.from('captain_shifts').upsert(
    {
      shift_date: shiftDate,
      shift,
      captain_id: captainId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'shift_date,shift' },
  );
  if (error) throw new Error(error.message);
}

export async function removeCaptainAction(
  shiftDate: string,
  shift: 'Matutino' | 'Vespertino',
): Promise<void> {
  await assertManager();
  const admin = createAdminClient();
  const { error } = await admin
    .from('captain_shifts')
    .delete()
    .eq('shift_date', shiftDate)
    .eq('shift', shift);
  if (error) throw new Error(error.message);
}
