import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import HorariosClient, { type StaffMember } from './HorariosClient';

interface ProfileRow {
  id: string;
  name: string | null;
  role: string | null;
}

export default async function HorariosPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Obtener personal activo y rol del usuario en paralelo
  const [{ data: profilesData }, { data: meData }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, name, role')
      .eq('active', true)
      .order('name'),
    supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single(),
  ]);

  const staff: StaffMember[] = (profilesData ?? []).map((p: ProfileRow) => ({
    id: p.id,
    name: p.name ?? '(sin nombre)',
    role: p.role ?? 'personal',
  }));

  const meRole = (meData as { role: string | null } | null)?.role ?? null;
  const isManager = meRole === 'admin' || meRole === 'supervisor';

  return <HorariosClient staff={staff} isManager={isManager} />;
}
