'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

// ── Tipos compartidos ────────────────────────────────────────────────────────
export interface HistoryCheck {
  item_key: string;
  item_label: string;
  checked: boolean;
  checked_at: string | null;
}

export interface HistoryRecord {
  id: string;
  closing_date: string;
  area: string;
  type: 'apertura' | 'cierre';
  staff_id: string;
  staff_name: string;
  total_items: number;
  checked_items: number;
  completed_at: string;
  checks: HistoryCheck[];
}

export interface SubmitData {
  closing_date: string;
  area: string;
  type: 'apertura' | 'cierre';
  staff_id: string;
  staff_name: string;
  checks: HistoryCheck[];
}

// ── Server Action ────────────────────────────────────────────────────────────
export async function submitChecklistAction(
  data: SubmitData,
): Promise<HistoryRecord> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Verificar rol: meseros solo pueden enviar en nombre propio
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const role = (profile as { role: string | null } | null)?.role ?? null;
  const isManager = role === 'admin' || role === 'supervisor';

  if (!isManager && data.staff_id !== user.id) {
    throw new Error('No autorizado: solo puedes enviar el checklist a tu propio nombre.');
  }

  const completedAt = new Date().toISOString();
  const checkedCount = data.checks.filter((c) => c.checked).length;

  // Insertar el encabezado de revisión
  const { data: closing, error: closingError } = await supabase
    .from('closings')
    .insert({
      closing_date: data.closing_date,
      area: data.area,
      type: data.type,
      staff_id: data.staff_id,
      staff_name: data.staff_name,
      total_items: data.checks.length,
      checked_items: checkedCount,
      completed_at: completedAt,
    })
    .select()
    .single();

  if (closingError || !closing) {
    throw new Error(closingError?.message ?? 'Error al guardar la revisión.');
  }

  // Insertar los ítems individuales
  const checkRows = data.checks.map((c) => ({
    closing_id: (closing as { id: string }).id,
    item_key: c.item_key,
    item_label: c.item_label,
    checked: c.checked,
    checked_at: c.checked_at,
  }));

  const { error: checksError } = await supabase
    .from('closing_checks')
    .insert(checkRows);

  if (checksError) {
    // El encabezado quedó, pero no es crítico para operación
    console.error('closing_checks insert error:', checksError.message);
  }

  return {
    id: (closing as { id: string }).id,
    closing_date: data.closing_date,
    area: data.area,
    type: data.type,
    staff_id: data.staff_id,
    staff_name: data.staff_name,
    total_items: data.checks.length,
    checked_items: checkedCount,
    completed_at: completedAt,
    checks: checkRows,
  };
}
