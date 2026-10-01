import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import PersonalClient from './PersonalClient';
import type { ProfileRecord } from './actions';

export default async function PersonalPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data } = await supabase
    .from('profiles')
    .select('id, name, role, home_area, active')
    .order('role', { ascending: true })
    .order('name', { ascending: true });

  const profiles: ProfileRecord[] = (data ?? []).map(
    (p: {
      id: string;
      name: string | null;
      role: string | null;
      home_area: string | null;
      active: boolean | null;
    }) => ({
      id: p.id,
      name: p.name,
      role: p.role ?? 'mesero',
      home_area: p.home_area,
      active: p.active ?? false,
    }),
  );

  return <PersonalClient initialProfiles={profiles} />;
}
