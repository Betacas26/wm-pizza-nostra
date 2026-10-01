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

  // Obtener todo el personal activo ordenado por nombre
  const { data } = await supabase
    .from('profiles')
    .select('id, name, role')
    .eq('active', true)
    .order('name');

  const staff: StaffMember[] = (data ?? []).map((p: ProfileRow) => ({
    id: p.id,
    name: p.name ?? '(sin nombre)',
    role: p.role ?? 'personal',
  }));

  return <HorariosClient staff={staff} />;
}
