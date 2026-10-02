'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import type { EvaluationRecord, EvaluationScore } from './actions';
import { submitEvaluationAction, deleteEvaluationAction, updateEvaluationAction } from './actions';

export interface StaffMember {
  id: string;
  name: string;
}

export type { EvaluationRecord, EvaluationScore };

const CRITERIA: { key: string; label: string; description: string }[] = [
  { key: 'punctuality',   label: 'Puntualidad y asistencia',  description: 'Llegada a tiempo, cumplimiento de horario' },
  { key: 'presentation',  label: 'Presentacion personal',     description: 'Uniforme, higiene y apariencia' },
  { key: 'teamwork',      label: 'Trabajo en equipo',         description: 'Colaboracion y apoyo a companeros' },
  { key: 'service',       label: 'Actitud de servicio',       description: 'Trato al cliente, disposicion y amabilidad' },
  { key: 'knowledge',     label: 'Conocimiento del puesto',   description: 'Dominio de menu, procesos y herramientas' },
  { key: 'efficiency',    label: 'Eficiencia en tareas',      description: 'Rapidez, organizacion y calidad del trabajo' },
  { key: 'situations',    label: 'Manejo de situaciones',     description: 'Respuesta ante quejas, imprevistos y presion' },
];

const SCORE_BTN_ON: Record<number, string> = {
  1: 'bg-red-600 text-white shadow-sm',
  2: 'bg-orange-500 text-white shadow-sm',
  3: 'bg-[#7A1D2E] text-white shadow-sm',
  4: 'bg-sky-600 text-white shadow-sm',
  5: 'bg-emerald-600 text-white shadow-sm',
};

const SCORE_LABEL: Record<number, string> = {
  1: 'Deficiente',
  2: 'Regular',
  3: 'Bueno',
  4: 'Muy bueno',
  5: 'Excelente',
};

const SCORE_BADGE: Record<number, string> = {
  1: 'bg-red-950/60 border border-red-800/50 text-red-300',
  2: 'bg-orange-950/60 border border-orange-800/50 text-orange-300',
  3: 'bg-[#420F18]/80 border border-[#9E2A3E]/60 text-[#E8899A]',
  4: 'bg-sky-950/60 border border-sky-700/50 text-sky-300',
  5: 'bg-emerald-950/60 border border-emerald-700/50 text-emerald-300',
};

function avgBadgeClass(avg: number): string {
  if (avg >= 4.5) return 'bg-emerald-950/60 border border-emerald-700/50 text-emerald-300';
  if (avg >= 4.0) return 'bg-sky-950/60 border border-sky-700/50 text-sky-300';
  if (avg >= 3.0) return 'bg-[#420F18]/80 border border-[#9E2A3E]/60 text-[#E8899A]';
  if (avg >= 2.0) return 'bg-orange-950/60 border border-orange-800/50 text-orange-300';
  return 'bg-red-950/60 border border-red-800/50 text-red-300';
}

function avgTextClass(avg: number): string {
  if (avg >= 4.5) return 'text-emerald-400';
  if (avg >= 4.0) return 'text-sky-400';
  if (avg >= 3.0) return 'text-[#E8899A]';
  if (avg >= 2.0) return 'text-orange-400';
  return 'text-red-400';
}

function avgLabel(avg: number): string {
  if (avg >= 4.5) return 'Excelente';
  if (avg >= 4.0) return 'Muy bueno';
  if (avg >= 3.0) return 'Bueno';
  if (avg >= 2.0) return 'Regular';
  return 'Deficiente';
}

function fmtDate(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

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

function EvalCard({
  record,
  isManager,
  onDelete,
  onUpdate,
}: {
  record: EvaluationRecord;
  isManager: boolean;
  onDelete: (id: string) => void;
  onUpdate: (updated: EvaluationRecord) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editScores, setEditScores] = useState<Map<string, number>>(new Map());
  const [editObs, setEditObs] = useState('');
  const avg = record.average_score;

  function openEdit() {
    const map = new Map<string, number>();
    for (const s of record.scores) map.set(s.criterion_key, s.score);
    setEditScores(map);
    setEditObs(record.observations ?? '');
    setEditMode(true);
    setExpanded(true);
  }

  function handleEditScore(key: string, val: number) {
    setEditScores((prev) => { const n = new Map(prev); n.set(key, val); return n; });
  }

  const editAvg = useMemo(() => {
    const vals = [...editScores.values()].filter((v) => v > 0);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  }, [editScores]);

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    const scores: EvaluationScore[] = CRITERIA.map((c) => ({
      criterion_key: c.key,
      criterion_label: c.label,
      score: editScores.get(c.key) ?? 0,
    }));
    const avg2 = Math.round(editAvg * 100) / 100;
    try {
      await updateEvaluationAction({ id: record.id, average_score: avg2, observations: editObs.trim() || null, scores });
      onUpdate({ ...record, average_score: avg2, observations: editObs.trim() || null, scores });
      setEditMode(false);
    } catch { /* ignore */ }
    setSaving(false);
  }

  async function handleDelete() {
    if (!confirm('¿Eliminar esta evaluación?')) return;
    setDeleting(true);
    try {
      await deleteEvaluationAction(record.id);
      onDelete(record.id);
    } catch { setDeleting(false); }
  }

  return (
    <div className="bg-[#151D1A] rounded-2xl border border-[#223530] shadow-[0_2px_8px_rgba(0,0,0,0.2)] overflow-hidden">
      <button
        type="button"
        onClick={() => { if (!editMode) setExpanded((v) => !v); }}
        className="w-full px-4 py-3 flex items-start gap-3 text-left active:bg-[#1c2b27] transition"
      >
        <div
          className={`shrink-0 w-12 h-12 rounded-xl flex flex-col items-center justify-center font-black text-xl border ${avgBadgeClass(editMode ? editAvg : avg)}`}
        >
          {(editMode ? editAvg : avg).toFixed(1)}
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-bold text-[#e6edea] text-sm truncate">{record.staff_name}</p>
          <p className="text-xs text-[#7d9990] mt-0.5 truncate">
            Evaluado por {record.evaluator_name}
          </p>
          {!editMode && record.observations && (
            <p className="text-xs text-[#7d9990] mt-1 truncate italic">
              &ldquo;{record.observations}&rdquo;
            </p>
          )}
        </div>

        <div className="shrink-0 text-right">
          <p className="text-xs text-[#7d9990]">{fmtDate(record.eval_date)}</p>
          <span className={`mt-1 inline-block text-xs font-semibold px-2 py-0.5 rounded-full border ${avgBadgeClass(editMode ? editAvg : avg)}`}>
            {avgLabel(editMode ? editAvg : avg)}
          </span>
          {!editMode && <p className="text-xs text-[#7d9990] mt-1">{expanded ? '▲' : '▼'}</p>}
        </div>
      </button>

      {isManager && !editMode && (
        <div className="border-t border-[#223530] flex">
          <button
            type="button"
            onClick={openEdit}
            className="flex-1 py-2 text-xs font-semibold text-[#7d9990] hover:text-[#e6edea] hover:bg-[#1c2b27] transition border-r border-[#223530]"
          >
            Editar
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="flex-1 py-2 text-xs font-semibold text-red-400 hover:text-red-300 hover:bg-[#1c2b27] transition disabled:opacity-50"
          >
            {deleting ? 'Eliminando...' : 'Eliminar'}
          </button>
        </div>
      )}

      {expanded && !editMode && record.scores.length > 0 && (
        <ul className="border-t border-[#223530] divide-y divide-[#223530]">
          {record.scores.map((s) => (
            <li key={s.criterion_key} className="flex items-center justify-between px-4 py-2.5 gap-3">
              <span className="text-sm text-[#e6edea] flex-1 min-w-0 truncate">{s.criterion_label}</span>
              <span className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded-full border ${SCORE_BADGE[s.score] ?? 'bg-[#1c2b27] border-[#223530] text-[#7d9990]'}`}>
                {s.score} — {SCORE_LABEL[s.score]}
              </span>
            </li>
          ))}
        </ul>
      )}

      {editMode && (
        <div className="border-t border-[#223530] p-4 space-y-3">
          <ul className="space-y-3">
            {CRITERIA.map((crit) => {
              const score = editScores.get(crit.key) ?? 0;
              return (
                <li key={crit.key}>
                  <p className="text-xs font-semibold text-[#e6edea] mb-1.5">{crit.label}</p>
                  <div className="flex gap-1.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => handleEditScore(crit.key, n)}
                        className={`flex-1 h-10 rounded-xl font-black text-base transition active:scale-[0.96] select-none ${score === n ? SCORE_BTN_ON[n] : 'bg-[#1c2b27] border border-[#223530] text-[#7d9990]'}`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
          <textarea
            value={editObs}
            onChange={(e) => setEditObs(e.target.value)}
            placeholder="Observaciones (opcional)..."
            rows={2}
            className="w-full px-3 py-2 rounded-xl border border-[#223530] bg-[#1c2b27] text-[#e6edea] text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#7A1D2E] placeholder:text-[#7d9990]"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setEditMode(false)}
              className="flex-1 h-10 rounded-xl border border-[#223530] text-xs font-semibold text-[#7d9990] hover:text-[#e6edea] bg-[#1c2b27] transition"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex-1 h-10 rounded-xl bg-[#7A1D2E] hover:bg-[#9E2A3E] text-white text-xs font-bold transition disabled:opacity-50"
            >
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function RubricasClient({
  staff,
  isManager,
  evaluatorName,
  evaluatorId,
  initialMonthEvals,
  today,
}: {
  staff: StaffMember[];
  isManager: boolean;
  evaluatorName: string;
  evaluatorId: string;
  initialMonthEvals: EvaluationRecord[];
  today: string;
}) {
  const supabase = useMemo(() => createClient(), []);

  const [activeTab, setActiveTab] = useState<'nueva' | 'historial'>(
    isManager ? 'nueva' : 'historial',
  );

  const [selectedStaffId, setSelectedStaffId] = useState(staff[0]?.id ?? '');
  const [scores, setScores] = useState<Map<string, number>>(new Map());
  const [observations, setObservations] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function handleScore(key: string, value: number) {
    setScores((prev) => {
      const next = new Map(prev);
      next.set(key, value);
      return next;
    });
  }

  const scoredCount = [...scores.values()].filter((s) => s > 0).length;
  const allScored = scoredCount === CRITERIA.length;

  const average = useMemo(() => {
    const vals = [...scores.values()].filter((s) => s > 0);
    if (vals.length === 0) return 0;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }, [scores]);

  const [selectedMonth, setSelectedMonth] = useState(() => today.slice(0, 7));
  const [monthEvals, setMonthEvals] = useState<EvaluationRecord[]>(initialMonthEvals);
  const [monthLoading, setMonthLoading] = useState(false);

  const monthOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = [];
    const now = new Date();
    for (let i = 0; i < 13; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      opts.push({
        value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        label: d.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' }),
      });
    }
    return opts;
  }, []);

  const loadMonthEvals = useCallback(
    async (ym: string) => {
      setMonthLoading(true);
      const [yearStr, monthStr] = ym.split('-');
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10);
      const firstDay = `${year}-${String(month).padStart(2, '0')}-01`;
      const lastDay = `${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate()}`;

      const { data: evalsData } = await supabase
        .from('evaluations')
        .select(
          'id, eval_date, staff_id, staff_name, evaluator_id, evaluator_name, average_score, observations',
        )
        .gte('eval_date', firstDay)
        .lte('eval_date', lastDay)
        .order('eval_date', { ascending: false });

      if (!evalsData?.length) {
        setMonthEvals([]);
        setMonthLoading(false);
        return;
      }

      const evalIds = (evalsData as EvalDbRow[]).map((e) => e.id);
      const { data: scoresData } = await supabase
        .from('evaluation_scores')
        .select('evaluation_id, criterion_key, criterion_label, score')
        .in('evaluation_id', evalIds);

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

      const records: EvaluationRecord[] = (evalsData as EvalDbRow[]).map((e) => ({
        id: e.id,
        eval_date: e.eval_date,
        staff_id: e.staff_id,
        staff_name: e.staff_name,
        evaluator_id: e.evaluator_id,
        evaluator_name: e.evaluator_name,
        average_score: Number(e.average_score) || 0,
        observations: e.observations,
        scores: scoresByEval.get(e.id) ?? [],
      }));

      setMonthEvals(records);
      setMonthLoading(false);
    },
    [supabase],
  );

  useEffect(() => {
    if (activeTab === 'historial') {
      loadMonthEvals(selectedMonth);
    }
  }, [activeTab, selectedMonth, loadMonthEvals]);

  const staffSummary = useMemo(() => {
    const byStaff = new Map<string, { name: string; count: number; total: number }>();
    for (const ev of monthEvals) {
      const existing = byStaff.get(ev.staff_id);
      if (existing) {
        existing.count++;
        existing.total += ev.average_score;
      } else {
        byStaff.set(ev.staff_id, { name: ev.staff_name, count: 1, total: ev.average_score });
      }
    }
    return [...byStaff.entries()]
      .map(([id, d]) => ({
        id,
        name: d.name,
        count: d.count,
        avg: Math.round((d.total / d.count) * 10) / 10,
      }))
      .sort((a, b) => b.avg - a.avg);
  }, [monthEvals]);

  async function handleSubmit() {
    if (!selectedStaffId || !allScored || submitting) return;
    setSubmitting(true);
    setSubmitError(null);

    const staffName = staff.find((s) => s.id === selectedStaffId)?.name ?? selectedStaffId;

    const scoresPayload: EvaluationScore[] = CRITERIA.map((c) => ({
      criterion_key: c.key,
      criterion_label: c.label,
      score: scores.get(c.key) ?? 0,
    }));

    const roundedAvg = Math.round(average * 100) / 100;

    try {
      const result = await submitEvaluationAction({
        eval_date: today,
        staff_id: selectedStaffId,
        staff_name: staffName,
        average_score: roundedAvg,
        observations: observations.trim() || null,
        scores: scoresPayload,
      });

      if (selectedMonth === today.slice(0, 7)) {
        setMonthEvals((prev) => [result, ...prev]);
      }

      setScores(new Map());
      setObservations('');
      setActiveTab('historial');
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Error al guardar la evaluacion.',
      );
    }
    setSubmitting(false);
  }

  const canSubmit = allScored && !!selectedStaffId && !submitting;

  const tabs = isManager
    ? [{ key: 'nueva', label: 'Nueva evaluacion' }, { key: 'historial', label: 'Historial' }]
    : [{ key: 'historial', label: 'Historial' }];

  return (
    <div className="min-h-screen bg-[#0D1211] text-[#e6edea]">
      {/* Header */}
      <header className="bg-[#151D1A] border-b border-[#223530] px-4 py-3 flex items-center gap-3 shadow-[0_2px_8px_rgba(0,0,0,0.2)] sticky top-0 z-10">
        <Link
          href="/dashboard"
          className="flex items-center justify-center w-9 h-9 rounded-xl text-[#7d9990] hover:text-[#e6edea] hover:bg-[#1c2b27] transition active:scale-[0.95]"
          aria-label="Volver"
        >
          <ChevronLeft size={22} strokeWidth={2.5} />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="font-extrabold text-[#E8899A] text-lg leading-tight">
            Rubricas
          </h1>
          <p className="text-xs text-[#7d9990]">
            {isManager ? evaluatorName : 'Consulta de evaluaciones'}
          </p>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-[#151D1A] border-b border-[#223530] sticky top-[57px] z-10 px-4 py-2">
        <div className="p-1 bg-[#0a0f0e] rounded-xl flex">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as 'nueva' | 'historial')}
              className={`flex-1 h-9 rounded-lg text-sm font-semibold transition duration-150 ease-out active:scale-[0.98] select-none ${
                activeTab === tab.key
                  ? 'bg-[#1c2b27] text-[#e6edea] shadow-sm'
                  : 'text-[#7d9990] hover:text-[#e6edea]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <main className="p-4 max-w-xl mx-auto space-y-4">

        {/* ── Tab: Nueva evaluacion ─────────────────────────────────────── */}
        {activeTab === 'nueva' && isManager && (
          <>
            <section className="bg-[#151D1A] rounded-2xl border border-[#223530] shadow-[0_2px_8px_rgba(0,0,0,0.2)] p-4 space-y-3">
              <h2 className="text-xs font-bold text-[#7d9990] uppercase tracking-wider">
                Colaborador a evaluar
              </h2>
              {staff.length === 0 ? (
                <p className="text-sm text-[#7d9990] italic">Sin colaboradores activos.</p>
              ) : (
                <select
                  value={selectedStaffId}
                  onChange={(e) => setSelectedStaffId(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-[#223530] bg-[#1c2b27] text-[#e6edea] text-base focus:outline-none focus:ring-2 focus:ring-[#7A1D2E]"
                >
                  <option value="">Seleccionar colaborador...</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              )}
              <p className="text-xs text-[#7d9990]">
                Evaluador: <span className="font-semibold text-[#e6edea]">{evaluatorName}</span>
                &ensp;&middot;&ensp;Fecha: <span className="font-semibold text-[#e6edea]">{fmtDate(today)}</span>
              </p>
            </section>

            {scoredCount > 0 && (
              <div className="bg-[#151D1A] border border-[#223530] rounded-2xl shadow-sm px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-xs text-[#7d9990] uppercase tracking-wider font-bold">
                    Promedio actual
                  </p>
                  <p className="text-xs text-[#7d9990] mt-0.5">
                    {scoredCount}/{CRITERIA.length} criterios puntuados
                  </p>
                </div>
                <div className="text-right">
                  <p className={`text-4xl font-black tabular-nums ${avgTextClass(average)}`}>
                    {average.toFixed(1)}
                  </p>
                  <p className={`text-xs font-semibold ${avgTextClass(average)}`}>
                    {avgLabel(average)}
                  </p>
                </div>
              </div>
            )}

            <section className="bg-[#151D1A] rounded-2xl border border-[#223530] shadow-[0_2px_8px_rgba(0,0,0,0.2)] overflow-hidden">
              <div className="px-4 py-3 border-b border-[#223530]">
                <h2 className="text-xs font-bold text-[#7d9990] uppercase tracking-wider">
                  Criterios de evaluacion — Puntaje 1 al 5
                </h2>
              </div>
              <ul className="divide-y divide-[#223530]">
                {CRITERIA.map((crit) => {
                  const score = scores.get(crit.key) ?? 0;
                  return (
                    <li key={crit.key} className="px-4 py-3">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0 pr-3">
                          <p className="font-semibold text-[#e6edea] text-sm leading-tight">
                            {crit.label}
                          </p>
                          <p className="text-xs text-[#7d9990] mt-0.5 leading-tight">
                            {crit.description}
                          </p>
                        </div>
                        {score > 0 && (
                          <span className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded-full border ${SCORE_BADGE[score]}`}>
                            {SCORE_LABEL[score]}
                          </span>
                        )}
                      </div>
                      <div className="flex gap-1.5">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => handleScore(crit.key, n)}
                            className={`flex-1 min-h-[44px] rounded-xl font-black text-base transition duration-150 ease-out active:scale-[0.98] select-none ${
                              score === n
                                ? SCORE_BTN_ON[n]
                                : 'bg-[#1c2b27] border border-[#223530] text-[#7d9990] hover:text-[#e6edea]'
                            }`}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>

            <section className="bg-[#151D1A] rounded-2xl border border-[#223530] shadow-[0_2px_8px_rgba(0,0,0,0.2)] p-4 space-y-2">
              <h2 className="text-xs font-bold text-[#7d9990] uppercase tracking-wider">
                Observaciones
              </h2>
              <textarea
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                placeholder="Aspectos destacados, areas de mejora u observaciones adicionales (opcional)..."
                rows={3}
                maxLength={500}
                className="w-full px-3 py-2 rounded-xl border border-[#223530] bg-[#1c2b27] text-[#e6edea] text-base resize-none focus:outline-none focus:ring-2 focus:ring-[#7A1D2E] placeholder:text-[#7d9990]"
              />
              {observations.length > 0 && (
                <p className="text-xs text-[#7d9990] text-right">
                  {observations.length}/500
                </p>
              )}
            </section>

            {submitError && (
              <div className="p-3 rounded-xl bg-red-950/40 border border-red-800/50 text-sm text-red-300 font-medium">
                {submitError}
              </div>
            )}

            <button
              type="button"
              disabled={!canSubmit}
              onClick={handleSubmit}
              className={`w-full min-h-[52px] font-bold rounded-xl shadow transition duration-150 ease-out select-none text-sm ${
                canSubmit
                  ? 'bg-[#7A1D2E] hover:bg-[#9E2A3E] active:scale-[0.98] text-white'
                  : 'bg-[#1c2b27] border border-[#223530] text-[#7d9990] cursor-not-allowed'
              }`}
            >
              {submitting
                ? 'Guardando...'
                : !selectedStaffId
                ? 'Selecciona un colaborador'
                : !allScored
                ? `Faltan ${CRITERIA.length - scoredCount} criterio${CRITERIA.length - scoredCount !== 1 ? 's' : ''}`
                : 'Guardar evaluacion'}
            </button>
          </>
        )}

        {/* ── Tab: Historial ───────────────────────────────────────────── */}
        {activeTab === 'historial' && (
          <>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-[#223530] bg-[#1c2b27] text-[#e6edea] text-base focus:outline-none focus:ring-2 focus:ring-[#7A1D2E] capitalize"
            >
              {monthOptions.map((opt) => (
                <option key={opt.value} value={opt.value} className="capitalize">
                  {opt.label}
                </option>
              ))}
            </select>

            {monthLoading ? (
              <div className="text-center py-14 text-[#7d9990] text-sm">
                Cargando evaluaciones...
              </div>
            ) : monthEvals.length === 0 ? (
              <div className="text-center py-14 text-[#7d9990] text-sm">
                Sin evaluaciones en este mes.
              </div>
            ) : (
              <>
                <section className="bg-[#151D1A] rounded-2xl border border-[#223530] shadow-[0_2px_8px_rgba(0,0,0,0.2)] overflow-hidden">
                  <div className="px-4 py-3 border-b border-[#223530] flex items-center justify-between">
                    <h2 className="text-xs font-bold text-[#7d9990] uppercase tracking-wider">
                      Desempeno mensual
                    </h2>
                    <span className="text-xs text-[#7d9990]">
                      {monthEvals.length} evaluacion{monthEvals.length !== 1 ? 'es' : ''}
                    </span>
                  </div>
                  <ul className="divide-y divide-[#223530]">
                    {staffSummary.map((entry) => (
                      <li key={entry.id} className="flex items-center gap-3 px-4 py-3">
                        <div
                          className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center font-black text-base border ${avgBadgeClass(entry.avg)}`}
                        >
                          {entry.avg.toFixed(1)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-[#e6edea] text-sm truncate">
                            {entry.name}
                          </p>
                          <p className="text-xs text-[#7d9990] mt-0.5">
                            {entry.count} evaluacion{entry.count !== 1 ? 'es' : ''}
                          </p>
                        </div>
                        <span className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full border ${avgBadgeClass(entry.avg)}`}>
                          {avgLabel(entry.avg)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>

                <div className="space-y-3">
                  {monthEvals.map((record) => (
                    <EvalCard
                      key={record.id}
                      record={record}
                      isManager={isManager}
                      onDelete={(id) => setMonthEvals((prev) => prev.filter((e) => e.id !== id))}
                      onUpdate={(updated) => setMonthEvals((prev) => prev.map((e) => e.id === updated.id ? updated : e))}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
