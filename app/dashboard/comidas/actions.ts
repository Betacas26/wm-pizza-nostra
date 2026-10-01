'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export type BreakStatus = 'completed' | 'overdue';

export async function endMealBreakAction(
  breakId: string,
  endedAt: string,
  status: BreakStatus,
): Promise<void> {
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
  const isManager = role === 'admin' || role === 'supervisor';

  const admin = createAdminClient();

  if (!isManager) {
    // Verificar ownership: solo el propio empleado puede cerrar su comida
    const { data: breakRecord } = await admin
      .from('meal_breaks')
      .select('staff_id')
      .eq('id', breakId)
      .single();

    if (
      !breakRecord ||
      (breakRecord as { staff_id: string }).staff_id !== user.id
    ) {
      throw new Error('No autorizado: solo puedes cerrar tu propia comida.');
    }
  }

  const { error } = await admin
    .from('meal_breaks')
    .update({ ended_at: endedAt, status })
    .eq('id', breakId);

  if (error) throw new Error(error.message);
}
