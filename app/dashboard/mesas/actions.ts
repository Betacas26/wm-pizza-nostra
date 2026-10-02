'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

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
