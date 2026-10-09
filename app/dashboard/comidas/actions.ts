'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export type BreakStatus = 'activo' | 'completado' | 'excedido';

export interface NewBreakResult {
  id: string;
  break_date: string;
  staff_id: string;
  started_at: string;
  duration_minutes: number;
  ended_at: null;
  status: 'activo';
}

// ── Iniciar comida ─────────────────────────────────────────────────────────────
export async function startMealBreakAction(
  staffId: string,
): Promise<NewBreakResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('No autorizado.');

  const admin = createAdminClient();

  const { data: target } = await admin
    .from('profiles')
    .select('id')
    .eq('id', staffId)
    .eq('active', true)
    .single();

  if (!target) throw new Error('Colaborador no encontrado o inactivo.');

  const breakDate = new Date().toISOString().split('T')[0];
  const startedAt = new Date().toISOString();

  const { data: inserted, error } = await admin
    .from('meal_breaks')
    .insert({
      break_date: breakDate,
      staff_id: staffId,
      started_at: startedAt,
      duration_minutes: 30,
      ended_at: null,
      status: 'activo',
    })
    .select()
    .single();

  if (error || !inserted) {
    throw new Error(error?.message ?? 'Error al iniciar la comida.');
  }

  return {
    id: (inserted as { id: string }).id,
    break_date: breakDate,
    staff_id: staffId,
    started_at: startedAt,
    duration_minutes: 30,
    ended_at: null,
    status: 'activo',
  };
}

export async function endMealBreakAction(
  breakId: string,
  endedAt: string,
  status: BreakStatus,
): Promise<void> {
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
  const isManager = role === 'admin' || role === 'supervisor';

  const admin = createAdminClient();

  if (!isManager) {
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
