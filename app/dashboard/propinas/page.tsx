import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import PropinasClient, { type Captain, type ShiftEntry } from './PropinasClient';

function getWeekStart(): string {
  const now = new Date();
  const day = now.getUTCDay(); // 0 = domingo
  const diff = day === 0 ? -6 : 1 - day; // lunes
  const ws = new Date(now);
  ws.setUTCDate(ws.getUTCDate() + diff);
  return ws.toISOString().split('T')[0];
}

export default async function PropinasPage() {
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

  if (!isManager) redirect('/dashboard');

  const weekStart = getWeekStart();
  const ws = new Date(weekStart + 'T00:00:00Z');
  ws.setUTCDate(ws.getUTCDate() + 6);
  const weekEnd = ws.toISOString().split('T')[0];

  // Capitanes: admins y supervisores activos
  const { data: profilesData } = await supabase
    .from('profiles')
    .select('id, name')
    .in('role', ['admin', 'supervisor'])
    .eq('active', true)
    .order('name');

  const captains: Captain[] = (profilesData ?? []).map(
    (p: { id: string; name: string | null }) => ({
      id: p.id,
      name: p.name ?? '(sin nombre)',
    }),
  );

  // Ventas de la semana
  type SRow = { sale_date: string; shift: string; total: number; captain_tip: number };
  const { data: salesData } = await supabase
    .from('sales')
    .select('sale_date, shift, total, captain_tip')
    .gte('sale_date', weekStart)
    .lte('sale_date', weekEnd)
    .order('sale_date')
    .order('shift');

  // Asignaciones de capitán
  type CRow = { shift_date: string; shift: string; captain_id: string };
  const { data: captainData } = await supabase
    .from('captain_shifts')
    .select('shift_date, shift, captain_id')
    .gte('shift_date', weekStart)
    .lte('shift_date', weekEnd);

  // Merge
  const assigns = new Map<string, string>();
  for (const c of ((captainData ?? []) as CRow[])) {
    assigns.set(`${c.shift_date}_${c.shift}`, c.captain_id);
  }

  const shiftMap = new Map<string, ShiftEntry>();
  for (const s of ((salesData ?? []) as SRow[])) {
    const key = `${s.sale_date}_${s.shift}`;
    const ex = shiftMap.get(key);
    const tip = Number(s.captain_tip) || 0;
    const total = Number(s.total) || 0;
    if (ex) {
      ex.sales_count++;
      ex.total_sales += total;
      ex.captain_tip += tip;
    } else {
      shiftMap.set(key, {
        shift_date: s.sale_date,
        shift: s.shift as 'Matutino' | 'Vespertino',
        sales_count: 1,
        total_sales: total,
        captain_tip: tip,
        captain_id: assigns.get(key) ?? null,
      });
    }
  }

  const initialEntries: ShiftEntry[] = [...shiftMap.values()].sort((a, b) =>
    a.shift_date !== b.shift_date
      ? a.shift_date.localeCompare(b.shift_date)
      : a.shift.localeCompare(b.shift),
  );

  return (
    <PropinasClient
      captains={captains}
      initialEntries={initialEntries}
      initialWeekStart={weekStart}
      isManager={isManager}
    />
  );
}
