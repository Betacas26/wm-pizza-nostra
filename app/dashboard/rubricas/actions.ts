'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

// ── Tipos compartidos ────────────────────────────────────────────────────────
export interface EvaluationScore {
  criterion_key: string;
  criterion_label: string;
  score: number;
}

export interface EvaluationRecord {
  id: string;
  eval_date: string;
  staff_id: string;
  staff_name: string;
  evaluator_id: string;
  evaluator_name: string;
  average_score: number;
  observations: string | null;
  scores: EvaluationScore[];
}

export interface SubmitEvalData {
  eval_date: string;
  staff_id: string;
  staff_name: string;
  average_score: number;
  observations: string | null;
  scores: EvaluationScore[];
}

// ── Auth guard ───────────────────────────────────────────────────────────────
async function verifyEvaluator() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, name')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin' && profile?.role !== 'supervisor') {
    throw new Error('No autorizado: se requiere rol admin o supervisor.');
  }

  return {
    user,
    evaluatorName: (profile?.name as string | null) ?? '(sin nombre)',
  };
}

// ── Server Action ────────────────────────────────────────────────────────────
export async function submitEvaluationAction(
  data: SubmitEvalData,
): Promise<EvaluationRecord> {
  const { user, evaluatorName } = await verifyEvaluator();
  const admin = createAdminClient();

  // Insertar encabezado de evaluación
  const { data: evaluation, error: evalError } = await admin
    .from('evaluations')
    .insert({
      eval_date: data.eval_date,
      staff_id: data.staff_id,
      staff_name: data.staff_name,
      evaluator_id: user.id,
      evaluator_name: evaluatorName,
      average_score: data.average_score,
      observations: data.observations,
    })
    .select()
    .single();

  if (evalError || !evaluation) {
    throw new Error(evalError?.message ?? 'Error al guardar la evaluación.');
  }

  const evalId = (evaluation as { id: string }).id;

  // Insertar puntajes individuales
  const scoreRows = data.scores.map((s) => ({
    evaluation_id: evalId,
    criterion_key: s.criterion_key,
    criterion_label: s.criterion_label,
    score: s.score,
  }));

  const { error: scoresError } = await admin
    .from('evaluation_scores')
    .insert(scoreRows);

  if (scoresError) {
    console.error('evaluation_scores insert error:', scoresError.message);
  }

  return {
    id: evalId,
    eval_date: data.eval_date,
    staff_id: data.staff_id,
    staff_name: data.staff_name,
    evaluator_id: user.id,
    evaluator_name: evaluatorName,
    average_score: data.average_score,
    observations: data.observations,
    scores: data.scores,
  };
}
