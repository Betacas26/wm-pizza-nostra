import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import RubricasClient, { type StaffMember, type EvaluationRecord, type EvaluationScore } from './RubricasClient';

// ── Tipos de filas de Supabase ───────────────────────────────────────────────
interface EvalDbRow {
  id: string;
  eval_date: string;
  staff_id: string;
  staff_name: string;
  evaluator_id: string;
  evaluator_name: string;
  average_score: number | null;
  observations: string | null;
}

interface ScoreDbRow {
  evaluation_id: string;
  criterion_key: string;
  criterion_label: string;
  score: number;
}

export default async function RubricasPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const today = new Date().toISOString().split('T')[0];
  const firstDayOfMonth = today.slice(0, 7) + '-01';

  // Consultas en paralelo: personal activo, mis datos, evaluaciones del mes
  const [{ data: profilesData }, { data: meData }, { data: evalsData }] =
    await Promise.all([
      supabase
        .from('profiles')
        .select('id, name')
        .eq('active', true)
        .order('name'),
      supabase
        .from('profiles')
        .select('role, name')
        .eq('id', user.id)
        .single(),
      supabase
        .from('evaluations')
        .select(
          'id, eval_date, staff_id, staff_name, evaluator_id, evaluator_name, average_score, observations',
        )
        .gte('eval_date', firstDayOfMonth)
        .lte('eval_date', today)
        .order('eval_date', { ascending: false }),
    ]);

  const staff: StaffMember[] = (profilesData ?? []).map(
    (p: { id: string; name: string | null }) => ({
      id: p.id,
      name: p.name ?? '(sin nombre)',
    }),
  );

  const meRole = (meData as { role: string | null } | null)?.role ?? null;
  const meName = (meData as { name: string | null } | null)?.name ?? '(sin nombre)';
  const isManager = meRole === 'admin' || meRole === 'supervisor';

  // Cargar puntajes de las evaluaciones del mes
  const evalIds = (evalsData ?? []).map((e: EvalDbRow) => e.id);

  const { data: scoresData } =
    evalIds.length > 0
      ? await supabase
          .from('evaluation_scores')
          .select('evaluation_id, criterion_key, criterion_label, score')
          .in('evaluation_id', evalIds)
      : { data: [] as ScoreDbRow[] };

  // Agrupar scores por evaluation_id
  const scoresByEval = new Map<string, EvaluationScore[]>();
  for (const s of (scoresData ?? []) as ScoreDbRow[]) {
    if (!scoresByEval.has(s.evaluation_id))
      scoresByEval.set(s.evaluation_id, []);
    scoresByEval.get(s.evaluation_id)!.push({
      criterion_key: s.criterion_key,
      criterion_label: s.criterion_label,
      score: s.score,
    });
  }

  const initialMonthEvals: EvaluationRecord[] = (evalsData ?? []).map(
    (e: EvalDbRow) => ({
      id: e.id,
      eval_date: e.eval_date,
      staff_id: e.staff_id,
      staff_name: e.staff_name,
      evaluator_id: e.evaluator_id,
      evaluator_name: e.evaluator_name,
      average_score: Number(e.average_score) || 0,
      observations: e.observations,
      scores: scoresByEval.get(e.id) ?? [],
    }),
  );

  return (
    <RubricasClient
      staff={staff}
      isManager={isManager}
      evaluatorName={meName}
      evaluatorId={user.id}
      initialMonthEvals={initialMonthEvals}
      today={today}
    />
  );
}
