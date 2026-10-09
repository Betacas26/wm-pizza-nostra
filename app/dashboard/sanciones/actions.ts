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
    throw new Error('Solo managers pueden registrar sanciones y bonos.');
  }
  return { userId: user.id };
}

export interface AddSanctionInput {
  record_date: string;
  staff_id: string;
  type: 'sancion' | 'bono';
  amount: number;
  concept: string;
}

export interface SanctionRow {
  id: string;
  record_date: string;
  staff_id: string;
  type: 'sancion' | 'bono';
  amount: number;
  concept: string;
  created_at: string;
}

export async function addSanctionAction(
  input: AddSanctionInput,
): Promise<SanctionRow> {
  const { userId } = await assertManager();

  if (!input.staff_id) throw new Error('Colaborador requerido.');
  if (!input.amount || input.amount <= 0) throw new Error('El monto debe ser mayor a 0.');
  if (!input.concept.trim()) throw new Error('El concepto es requerido.');

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('sanctions')
    .insert({
      record_date: input.record_date,
      staff_id: input.staff_id,
      type: input.type,
      amount: Math.round(input.amount * 100) / 100,
      concept: input.concept.trim(),
      created_by: userId,
    })
    .select('id, record_date, staff_id, type, amount, concept, created_at')
    .single();

  if (error || !data) throw new Error(error?.message ?? 'Error al guardar.');

  return data as SanctionRow;
}

export async function deleteSanctionAction(id: string): Promise<void> {
  await assertManager();
  const admin = createAdminClient();
  const { error } = await admin.from('sanctions').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
