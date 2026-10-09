import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import DashboardClient, { type LiveStats } from './DashboardClient';

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('name, role')
    .eq('id', user.id)
    .single();

  const name = (profile as { name: string | null } | null)?.name ?? user.email ?? 'Usuario';
  const role = (profile as { role: string | null } | null)?.role ?? 'personal';
  const isManager = role === 'admin' || role === 'supervisor';
  const isBarraManager = role === 'admin' || role === 'encargado_barra';

  const today = new Date().toISOString().split('T')[0];
  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

  const [
    { data: activeMealRows },
    { data: salesRows },
    { data: checklistRows },
    { data: tableRows },
  ] = await Promise.all([
    supabase
      .from('meal_breaks')
      .select('id, started_at')
      .eq('break_date', today)
      .is('ended_at', null),
    supabase
      .from('sales')
      .select('id, total')
      .eq('sale_date', today),
    supabase
      .from('closings')
      .select('id')
      .eq('closing_date', today),
    supabase
      .from('table_assignments')
      .select('table_code')
      .eq('day', today),
  ]);

  const activeMeals = (activeMealRows ?? []).length;
  const overdueMeals = (activeMealRows ?? []).filter(
    (r: { started_at: string }) => r.started_at < thirtyMinAgo,
  ).length;

  const salesCount = (salesRows ?? []).length;
  const salesTotal = (salesRows ?? []).reduce(
    (acc: number, r: { total: number }) => acc + (Number(r.total) || 0),
    0,
  );

  const checklistCount = (checklistRows ?? []).length;
  const tablesAssigned = (tableRows ?? []).length;

  const liveStats: LiveStats = {
    activeMeals,
    overdueMeals,
    salesCount,
    salesTotal,
    checklistCount,
    tablesAssigned,
  };

  return (
    <DashboardClient
      userName={name}
      userRole={role}
      isManager={isManager}
      isBarraManager={isBarraManager}
      liveStats={liveStats}
    />
  );
}
