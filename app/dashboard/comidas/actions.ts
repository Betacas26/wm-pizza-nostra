'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export type BreakStatus = 'activo' | 'completado' | 'excedido';

const DURATION_S = 30 * 60;
const MAX_CONCURRENT = 3; // advertencia de capacidad si se alcanza

export interface NewBreakResult {
  id: string;
  break_date: string;
  staff_id: string;
  started_at: string; // timestamp real de la DB
  duration_minutes: number;
  ended_at: null;
  status: 'activo';
}

// ── Auth helper ─────────────────────────────────────────────────────────────
async function getAuthContext() {
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
  return { user, isManager };
}

// ── Iniciar comida ──────────────────────────────────────────────────────────
export async function startMealBreakAction(
  staffId: string,
): Promise<NewBreakResult> {
  const { user, isManager } = await getAuthContext();

  // Solo managers pueden iniciar comida para otros
  if (!isManager && staffId !== user.id) {
    throw new Error('No autorizado: solo puedes iniciar tu propia comida.');
  }

  const admin = createAdminClient();

  // Verificar que el colaborador existe y está activo
  const { data: target } = await admin
    .from('profiles')
    .select('id')
    .eq('id', staffId)
    .eq('active', true)
    .single();

  if (!target) throw new Error('Colaborador no encontrado o inactivo.');

  // Verificar que no tenga ya una comida activa hoy
  const breakDate = new Date().toISOString().split('T')[0];
  const { data: existing } = await admin
    .from('meal_breaks')
    .select('id')
    .eq('staff_id', staffId)
    .eq('break_date', breakDate)
    .is('ended_at', null)
    .maybeSingle();

  if (existing) throw new Error('Ya tiene una comida activa hoy.');

  // started_at lo genera la DB con now() — no se pasa desde el cliente
  const { data: inserted, error } = await admin
    .from('meal_breaks')
    .insert({
      break_date: breakDate,
      staff_id: staffId,
      duration_minutes: 30,
      ended_at: null,
      status: 'activo',
    })
    .select('id, break_date, staff_id, started_at, duration_minutes')
    .single();

  if (error || !inserted) {
    throw new Error(error?.message ?? 'Error al iniciar la comida.');
  }

  const row = inserted as {
    id: string;
    break_date: string;
    staff_id: string;
    started_at: string;
    duration_minutes: number;
  };

  return {
    id: row.id,
    break_date: row.break_date,
    staff_id: row.staff_id,
    started_at: row.started_at, // timestamp real de PostgreSQL
    duration_minutes: row.duration_minutes,
    ended_at: null,
    status: 'activo',
  };
}

// ── Cerrar comida (status calculado server-side desde DB started_at) ─────────
export async function endMealBreakAction(
  breakId: string,
): Promise<{ ended_at: string; status: BreakStatus }> {
  const { user, isManager } = await getAuthContext();
  const admin = createAdminClient();

  // Obtener el registro para verificar propiedad y calcular status
  const { data: breakRecord } = await admin
    .from('meal_breaks')
    .select('staff_id, started_at')
    .eq('id', breakId)
    .single();

  if (!breakRecord) throw new Error('Comida no encontrada.');

  if (!isManager && (breakRecord as { staff_id: string }).staff_id !== user.id) {
    throw new Error('No autorizado: solo puedes cerrar tu propia comida.');
  }

  // Calcular status con el timestamp real de la DB
  const endedAt = new Date().toISOString();
  const startedMs = new Date((breakRecord as { started_at: string }).started_at).getTime();
  const elapsedS = Math.floor((new Date(endedAt).getTime() - startedMs) / 1000);
  const status: BreakStatus = elapsedS > DURATION_S ? 'excedido' : 'completado';

  const { error } = await admin
    .from('meal_breaks')
    .update({ ended_at: endedAt, status })
    .eq('id', breakId);

  if (error) throw new Error(error.message);

  return { ended_at: endedAt, status };
}

export { MAX_CONCURRENT };
