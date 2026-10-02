'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

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
  if (!user) throw new Error('No autorizado.');

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

// ── Criterion types ───────────────────────────────────────────────────────────
export interface CriterionRecord {
  id: string;
  key: string;
  label: string;
  description: string;
  sort_order: number;
}

// ── Criterion CRUD ────────────────────────────────────────────────────────────
export async function createCriterionAction(data: {
  label: string;
  description: string;
}): Promise<CriterionRecord> {
  await verifyEvaluator();
  const admin = createAdminClient();
  const key = `crit_${Date.now()}`;
  const { data: row, error } = await admin
    .from('rubric_criteria')
    .insert({ key, label: data.label, description: data.description, sort_order: 99 })
    .select()
    .single();
  if (error || !row) throw new Error(error?.message ?? 'Error al crear criterio.');
  return row as CriterionRecord;
}

export async function updateCriterionAction(data: {
  id: string;
  label: string;
  description: string;
}): Promise<void> {
  await verifyEvaluator();
  const admin = createAdminClient();
  const { error } = await admin
    .from('rubric_criteria')
    .update({ label: data.label, description: data.description })
    .eq('id', data.id);
  if (error) throw new Error(error.message);
}

export async function deleteCriterionAction(id: string): Promise<void> {
  await verifyEvaluator();
  const admin = createAdminClient();
  const { error } = await admin.from('rubric_criteria').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ── Delete evaluation ─────────────────────────────────────────────────────────
export async function deleteEvaluationAction(id: string): Promise<void> {
  const { user } = await verifyEvaluator();
  const admin = createAdminClient();

  // Delete scores first (cascade may not be set)
  await admin.from('evaluation_scores').delete().eq('evaluation_id', id);
  const { error } = await admin.from('evaluations').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ── Update evaluation ─────────────────────────────────────────────────────────
export interface UpdateEvalData {
  id: string;
  average_score: number;
  observations: string | null;
  scores: EvaluationScore[];
}

export async function updateEvaluationAction(
  data: UpdateEvalData,
): Promise<void> {
  await verifyEvaluator();
  const admin = createAdminClient();

  const { error: evalError } = await admin
    .from('evaluations')
    .update({ average_score: data.average_score, observations: data.observations })
    .eq('id', data.id);
  if (evalError) throw new Error(evalError.message);

  // Replace scores: delete old, insert new
  await admin.from('evaluation_scores').delete().eq('evaluation_id', data.id);
  if (data.scores.length > 0) {
    const { error: scoresError } = await admin.from('evaluation_scores').insert(
      data.scores.map((s) => ({
        evaluation_id: data.id,
        criterion_key: s.criterion_key,
        criterion_label: s.criterion_label,
        score: s.score,
      })),
    );
    if (scoresError) throw new Error(scoresError.message);
  }
}
