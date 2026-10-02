'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

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
  if (!user) throw new Error('No autorizado.');

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

// ── Delete checklist record ───────────────────────────────────────────────────
export async function deleteChecklistAction(id: string): Promise<void> {
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
    throw new Error('No autorizado: se requiere rol admin o supervisor.');
  }

  await supabase.from('closing_checks').delete().eq('closing_id', id);
  const { error } = await supabase.from('closings').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ── Checklist item types ──────────────────────────────────────────────────────
export interface ChecklistItemRecord {
  id: string;
  area: string;
  type: string;
  key: string;
  label: string;
  sort_order: number;
}

// ── Checklist item CRUD ───────────────────────────────────────────────────────
async function verifyManager() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No autorizado.');
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  const role = (profile as { role: string | null } | null)?.role ?? null;
  if (role !== 'admin' && role !== 'supervisor') throw new Error('No autorizado.');
}

export async function createChecklistItemAction(data: {
  area: string;
  type: string;
  label: string;
}): Promise<ChecklistItemRecord> {
  await verifyManager();
  const admin = createAdminClient();

  // Find or create template for this area+type
  let templateId: string;
  const { data: existing } = await admin
    .from('checklist_templates')
    .select('id')
    .eq('area', data.area)
    .eq('type', data.type)
    .maybeSingle();

  if (existing) {
    templateId = (existing as { id: string }).id;
  } else {
    const { data: newTemplate, error: tmplErr } = await admin
      .from('checklist_templates')
      .insert({ area: data.area, type: data.type })
      .select('id')
      .single();
    if (tmplErr || !newTemplate) throw new Error(tmplErr?.message ?? 'Error al crear plantilla.');
    templateId = (newTemplate as { id: string }).id;
  }

  // Get max position for this template
  const { data: maxRow } = await admin
    .from('checklist_items')
    .select('position')
    .eq('template_id', templateId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextPosition = ((maxRow as { position: number } | null)?.position ?? 0) + 1;

  const { data: row, error } = await admin
    .from('checklist_items')
    .insert({ template_id: templateId, section_title: '', item_text: data.label, position: nextPosition })
    .select('id, item_text, position, checklist_templates!inner(area, type)')
    .single();
  if (error || !row) throw new Error(error?.message ?? 'Error al crear item.');

  const r = row as { id: string; item_text: string; position: number; checklist_templates: { area: string; type: string } | { area: string; type: string }[] };
  const tmpl = Array.isArray(r.checklist_templates) ? r.checklist_templates[0] : r.checklist_templates;
  return {
    id: r.id,
    area: tmpl.area,
    type: tmpl.type,
    key: r.id,
    label: r.item_text,
    sort_order: r.position,
  };
}

export async function updateChecklistItemAction(data: {
  id: string;
  label: string;
}): Promise<void> {
  await verifyManager();
  const admin = createAdminClient();
  const { error } = await admin.from('checklist_items').update({ item_text: data.label }).eq('id', data.id);
  if (error) throw new Error(error.message);
}

export async function deleteChecklistItemAction(id: string): Promise<void> {
  await verifyManager();
  const admin = createAdminClient();
  const { error } = await admin.from('checklist_items').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
