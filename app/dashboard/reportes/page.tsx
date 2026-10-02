import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import ReportesClient from './ReportesClient';

export default async function ReportesPage() {
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
  if (role !== 'admin' && role !== 'supervisor') redirect('/dashboard');

  const isAdmin = role === 'admin';

  return <ReportesClient isAdmin={isAdmin} />;
}
