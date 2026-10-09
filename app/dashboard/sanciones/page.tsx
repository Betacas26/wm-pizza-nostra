import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import SancionesClient, { type StaffMember } from './SancionesClient';

export default async function SancionesPage() {
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

  const today = new Date().toISOString().split('T')[0];

  const { data: profilesData } = await supabase
    .from('profiles')
    .select('id, name, role')
    .eq('active', true)
    .order('name');

  const staff: StaffMember[] = (
    profilesData ?? []
  ).map((p: { id: string; name: string | null; role: string | null }) => ({
    id: p.id,
    name: p.name ?? '(sin nombre)',
    role: p.role ?? '',
  }));

  return <SancionesClient staff={staff} today={today} />;
}
