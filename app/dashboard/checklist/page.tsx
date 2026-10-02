import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import ChecklistClient, { type StaffMember } from './ChecklistClient';
import type { HistoryRecord, HistoryCheck, ChecklistItemRecord } from './actions';

// ── Tipos de filas de Supabase ───────────────────────────────────────────────
interface ClosingRow {
  id: string;
  closing_date: string;
  area: string;
  type: string;
  staff_id: string;
  staff_name: string;
  total_items: number | null;
  checked_items: number | null;
  completed_at: string | null;
}

interface CheckRow {
  closing_id: string;
  item_key: string;
  item_label: string;
  checked: boolean;
  checked_at: string | null;
}

export default async function ChecklistPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const today = new Date().toISOString().split('T')[0];

  const { data: meData } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const meRole = (meData as { role: string | null } | null)?.role ?? null;
  const isManager = meRole === 'admin' || meRole === 'supervisor';

  // Cargar en paralelo: personal activo + revisiones del día + items de checklist
  const [{ data: profilesData }, { data: closingsData }, { data: itemsData }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, name')
      .eq('active', true)
      .order('name'),
    supabase
      .from('closings')
      .select('id, closing_date, area, type, staff_id, staff_name, total_items, checked_items, completed_at')
      .eq('closing_date', today)
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: false }),
    supabase
      .from('checklist_items')
      .select('id, area, type, key, label, sort_order')
      .order('sort_order'),
  ]);

  const staff: StaffMember[] = (profilesData ?? []).map(
    (p: { id: string; name: string | null }) => ({
      id: p.id,
      name: p.name ?? '(sin nombre)',
    }),
  );

  // Cargar los ítems de las revisiones del día
  const closingIds = (closingsData ?? []).map((c: ClosingRow) => c.id);

  const { data: checksData } =
    closingIds.length > 0
      ? await supabase
          .from('closing_checks')
          .select('closing_id, item_key, item_label, checked, checked_at')
          .in('closing_id', closingIds)
      : { data: [] as CheckRow[] };

  // Agrupar checks por closing_id
  const checksByClosing = new Map<string, HistoryCheck[]>();
  for (const c of checksData ?? []) {
    const row = c as CheckRow;
    if (!checksByClosing.has(row.closing_id)) {
      checksByClosing.set(row.closing_id, []);
    }
    checksByClosing.get(row.closing_id)!.push({
      item_key: row.item_key,
      item_label: row.item_label,
      checked: row.checked,
      checked_at: row.checked_at,
    });
  }

  const initialHistory: HistoryRecord[] = (closingsData ?? [])
    .filter((c: ClosingRow) => c.completed_at !== null)
    .map((c: ClosingRow) => ({
      id: c.id,
      closing_date: c.closing_date,
      area: c.area,
      type: c.type as 'apertura' | 'cierre',
      staff_id: c.staff_id,
      staff_name: c.staff_name,
      total_items: c.total_items ?? 0,
      checked_items: c.checked_items ?? 0,
      completed_at: c.completed_at!,
      checks: checksByClosing.get(c.id) ?? [],
    }));

  const checklistItems: ChecklistItemRecord[] = (itemsData ?? []).map(
    (i: { id: string; area: string; type: string; key: string; label: string; sort_order: number }) => i,
  );

  return (
    <ChecklistClient
      staff={staff}
      initialHistory={initialHistory}
      today={today}
      isManager={isManager}
      initialItems={checklistItems}
    />
  );
}
