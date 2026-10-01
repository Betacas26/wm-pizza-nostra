import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import ComidasClient, {
  type StaffMember,
  type MealBreak,
} from './ComidasClient';

interface ProfileBasic {
  id: string;
  name: string | null;
}

interface MealBreakRow {
  id: string;
  break_date: string;
  staff_id: string;
  started_at: string;
  duration_minutes: number;
  ended_at: string | null;
  status: string;
}

export default async function ComidasPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const today = new Date().toISOString().split('T')[0];

  const [{ data: profilesData }, { data: breaksData }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, name')
      .eq('active', true)
      .order('name'),
    supabase
      .from('meal_breaks')
      .select('id, break_date, staff_id, started_at, duration_minutes, ended_at, status')
      .eq('break_date', today)
      .order('started_at', { ascending: false }),
  ]);

  const staff: StaffMember[] = (profilesData ?? []).map((p: ProfileBasic) => ({
    id: p.id,
    name: p.name ?? '(sin nombre)',
    role: '',
  }));

  const nameMap = new Map<string, string>(staff.map((s) => [s.id, s.name]));

  const initialBreaks: MealBreak[] = (breaksData ?? []).map(
    (b: MealBreakRow) => ({
      id: b.id,
      break_date: b.break_date,
      staff_id: b.staff_id,
      staff_name: nameMap.get(b.staff_id) ?? b.staff_id,
      started_at: b.started_at,
      duration_minutes: b.duration_minutes,
      ended_at: b.ended_at,
      status: b.status as 'active' | 'completed' | 'overdue',
    }),
  );

  return (
    <ComidasClient
      staff={staff}
      initialBreaks={initialBreaks}
      today={today}
    />
  );
}
