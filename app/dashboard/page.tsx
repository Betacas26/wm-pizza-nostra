import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import DashboardClient from './DashboardClient';

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

  return (
    <DashboardClient
      userName={name}
      userRole={role}
      isManager={isManager}
    />
  );
}