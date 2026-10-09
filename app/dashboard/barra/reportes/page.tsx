import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import ReportesBarraClient from './ReportesBarraClient';

export default async function ReportesBarraPage() {
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

  const role = (profile as { role: string | null } | null)?.role ?? '';
  if (role !== 'admin' && role !== 'encargado_barra' && role !== 'supervisor') redirect('/dashboard');

  const today = new Date().toISOString().split('T')[0];

  return <ReportesBarraClient today={today} />;
}
