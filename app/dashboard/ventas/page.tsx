import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import VentasClient, {
  type StaffMember,
  type SaleRecord,
} from './VentasClient';

interface ProfileBasic {
  id: string;
  name: string | null;
}

interface ProfileWithRole {
  role: string | null;
}

interface SaleDbRow {
  id: string;
  sale_date: string;
  shift: string;
  staff_id: string;
  total: number | null;
  contribution: number | null;
  glassware: number | null;
  captain_tip: number | null;
  to_deliver: number | null;
  sanction_pct: number | null;
  sanction_amount: number | null;
}

export default async function VentasPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const today = new Date().toISOString().split('T')[0];

  // Tres consultas en paralelo: personal activo, ventas de hoy, rol del usuario
  const [{ data: profilesData }, { data: salesData }, { data: meData }] =
    await Promise.all([
      supabase
        .from('profiles')
        .select('id, name')
        .eq('active', true)
        .in('role', ['mesero', 'ayudante'])
        .order('name'),
      supabase
        .from('sales')
        .select(
          'id, sale_date, shift, staff_id, total, contribution, glassware, captain_tip, to_deliver, sanction_pct, sanction_amount',
        )
        .eq('sale_date', today)
        .order('id', { ascending: false }),
      supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single(),
    ]);

  const staff: StaffMember[] = (profilesData ?? []).map(
    (p: ProfileBasic) => ({
      id: p.id,
      name: p.name ?? '(sin nombre)',
    }),
  );

  // Mapa id → nombre para resolver las ventas del día
  const nameMap = new Map<string, string>(staff.map((s) => [s.id, s.name]));

  const initialSales: SaleRecord[] = (salesData ?? []).map(
    (s: SaleDbRow) => ({
      id: s.id,
      sale_date: s.sale_date,
      shift: s.shift as 'Matutino' | 'Vespertino',
      staff_id: s.staff_id,
      staff_name: nameMap.get(s.staff_id) ?? s.staff_id,
      total: Number(s.total) || 0,
      contribution: Number(s.contribution) || 0,
      glassware: Number(s.glassware) || 0,
      captain_tip: Number(s.captain_tip) || 0,
      to_deliver: Number(s.to_deliver) || 0,
      sanction_pct: Number(s.sanction_pct) || 0,
      sanction_amount: Number(s.sanction_amount) || 0,
    }),
  );

  const meRole = (meData as ProfileWithRole | null)?.role ?? null;
  const isManager = meRole === 'admin' || meRole === 'supervisor';

  return (
    <VentasClient
      staff={staff}
      initialSales={initialSales}
      isManager={isManager}
      today={today}
    />
  );
}
