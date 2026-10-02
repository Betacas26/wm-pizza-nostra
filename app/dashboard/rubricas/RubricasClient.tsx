'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import type { EvaluationRecord, EvaluationScore } from './actions';
import { submitEvaluationAction } from './actions';

// ── Tipos exportados ─────────────────────────────────────────────────────────
export interface StaffMember {
  id: string;
  name: string;
}

export type { EvaluationRecord, EvaluationScore };

// ── Catálogo de criterios ────────────────────────────────────────────────────
const CRITERIA: { key: string; label: string; description: string }[] = [
  { key: 'punctuality',    label: 'Puntualidad y asistencia',  description: 'Llegada a tiempo, cumplimiento de horario' },
  { key: 'presentation',  label: 'Presentación personal',     description: 'Uniforme, higiene y apariencia' },
  { key: 'teamwork',      label: 'Trabajo en equipo',         description: 'Colaboración y apoyo a compañeros' },
  { key: 'service',       label: 'Actitud de servicio',       description: 'Trato al cliente, disposición y amabilidad' },
  { key: 'knowledge',     label: 'Conocimiento del puesto',   description: 'Dominio de menú, procesos y herramientas' },
  { key: 'efficiency',    label: 'Eficiencia en tareas',      description: 'Rapidez, organización y calidad del trabajo' },
  { key: 'situations',    label: 'Manejo de situaciones',     description: 'Respuesta ante quejas, imprevistos y presión' },
];

// ── Mapas de estilo por puntaje ──────────────────────────────────────────────
const SCORE_BTN_ON: Record<number, string> = {
  1: 'bg-red-500 text-white shadow-sm',
  2: 'bg-orange-400 text-white shadow-sm',
  3: 'bg-amber-400 text-white shadow-sm',
  4: 'bg-sky-500 text-white shadow-sm',
  5: 'bg-emerald-500 text-white shadow-sm',
};

const SCORE_LABEL: Record<number, string> = {
  1: 'Deficiente',
  2: 'Regular',
  3: 'Bueno',
  4: 'Muy bueno',
  5: 'Excelente',
};

const SCORE_BADGE: Record<number, string> = {
  1: 'bg-red-100 text-red-700',
  2: 'bg-orange-100 text-orange-700',
  3: 'bg-amber-100 text-amber-700',
  4: 'bg-sky-100 text-sky-700',
  5: 'bg-emerald-100 text-emerald-700',
};

function avgBadgeClass(avg: number): string {
  if (avg >= 4.5) return 'bg-emerald-100 text-emerald-700';
  if (avg >= 4.0) return 'bg-sky-100 text-sky-700';
  if (avg >= 3.0) return 'bg-amber-100 text-amber-700';
  if (avg >= 2.0) return 'bg-orange-100 text-orange-700';
  return 'bg-red-100 text-red-700';
}

function avgTextClass(avg: number): string {
  if (avg >= 4.5) return 'text-emerald-600';
  if (avg >= 4.0) return 'text-sky-600';
  if (avg >= 3.0) return 'text-amber-600';
  if (avg >= 2.0) return 'text-orange-500';
  return 'text-red-600';
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

// ── Tipos DB ─────────────────────────────────────────────────────────────────
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

// ── Tarjeta de evaluación (historial) ────────────────────────────────────────
function EvalCard({ record }: { record: EvaluationRecord }) {
  const [expanded, setExpanded] = useState(false);
  const avg = record.average_score;

  return (
    <div className="bg-white rounded-2xl border border-stone-200/70 shadow-[0_2px_8px_rgba(0,0,0,0.04)] overflow-hidden">
      {/* Cabecera tocable */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full px-4 py-3 flex items-start gap-3 text-left active:bg-stone-50 transition"
      >
        {/* Promedio grande */}
        <div
          className={`shrink-0 w-12 h-12 rounded-xl flex flex-col items-center justify-center font-black text-xl ${avgBadgeClass(avg)}`}
        >
          {avg.toFixed(1)}
        </div>

        {/* Info principal */}
        <div className="flex-1 min-w-0">
          <p className="font-bold text-stone-900 text-sm truncate">
            {record.staff_name}
          </p>
          <p className="text-xs text-stone-400 mt-0.5 truncate">
            Evaluado por {record.evaluator_name}
          </p>
          {record.observations && (
            <p className="text-xs text-stone-500 mt-1 truncate italic">
              &ldquo;{record.observations}&rdquo;
            </p>
          )}
        </div>

        {/* Fecha + toggle */}
        <div className="shrink-0 text-right">
          <p className="text-xs text-stone-500">{fmtDate(record.eval_date)}</p>
          <span
            className={`mt-1 inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${avgBadgeClass(avg)}`}
          >
            {avgLabel(avg)}
          </span>
          <p className="text-xs text-stone-400 mt-1">{expanded ? '▲' : '▼'}</p>
        </div>
      </button>

      {/* Detalle de criterios */}
      {expanded && record.scores.length > 0 && (
        <ul className="border-t border-stone-100 divide-y divide-stone-100">
          {record.scores.map((s) => (
            <li
              key={s.criterion_key}
              className="flex items-center justify-between px-4 py-2.5 gap-3"
            >
              <span className="text-sm text-stone-700 flex-1 min-w-0 truncate">
                {s.criterion_label}
              </span>
              <span
                className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded-full ${SCORE_BADGE[s.score] ?? 'bg-stone-100 text-stone-600'}`}
              >
                {s.score} — {SCORE_LABEL[s.score]}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
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

  // ── Estado formulario ────────────────────────────────────────────────
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

  // ── Estado historial ─────────────────────────────────────────────────
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

  // ── Resumen mensual por colaborador ──────────────────────────────────
  const staffSummary = useMemo(() => {
    const byStaff = new Map<
      string,
      { name: string; count: number; total: number }
    >();
    for (const ev of monthEvals) {
      const existing = byStaff.get(ev.staff_id);
      if (existing) {
        existing.count++;
        existing.total += ev.average_score;
      } else {
        byStaff.set(ev.staff_id, {
          name: ev.staff_name,
          count: 1,
          total: ev.average_score,
        });
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

  // ── Enviar evaluación ────────────────────────────────────────────────
  async function handleSubmit() {
    if (!selectedStaffId || !allScored || submitting) return;
    setSubmitting(true);
    setSubmitError(null);

    const staffName =
      staff.find((s) => s.id === selectedStaffId)?.name ?? selectedStaffId;

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

      // Agregar al historial si corresponde al mes actual
      if (selectedMonth === today.slice(0, 7)) {
        setMonthEvals((prev) => [result, ...prev]);
      }

      // Resetear formulario
      setScores(new Map());
      setObservations('');
      setActiveTab('historial');
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Error al guardar la evaluación.',
      );
    }
    setSubmitting(false);
  }

  const canSubmit = allScored && !!selectedStaffId && !submitting;

  // ── Tabs disponibles ─────────────────────────────────────────────────
  const tabs = isManager
    ? [{ key: 'nueva', label: 'Nueva evaluación' }, { key: 'historial', label: 'Historial' }]
    : [{ key: 'historial', label: 'Historial' }];

  return (
    <div className="min-h-screen bg-[#F8F7F4] text-stone-800">
      {/* Header */}
      <header className="bg-white border-b border-stone-200 px-4 py-3 flex items-center gap-3 shadow-sm sticky top-0 z-10">
        <Link
          href="/dashboard"
          className="text-stone-400 hover:text-stone-700 text-xl leading-none"
          aria-label="Volver"
        >
          &#8592;
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="font-extrabold text-amber-600 text-lg leading-tight">
            Rúbricas
          </h1>
          <p className="text-xs text-stone-500">
            {isManager ? evaluatorName : 'Consulta de evaluaciones'}
          </p>
        </div>
      </header>

      {/* Tabs — segmented control */}
      <div className="bg-white border-b border-stone-200 sticky top-[57px] z-10 px-4 py-2">
        <div className="p-1 bg-stone-100 rounded-xl flex">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as 'nueva' | 'historial')}
              className={`flex-1 h-9 rounded-lg text-sm font-semibold transition duration-150 ease-out active:scale-[0.98] select-none ${
                activeTab === tab.key
                  ? 'bg-white text-stone-900 shadow-sm'
                  : 'text-stone-500 hover:text-stone-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <main className="p-4 max-w-xl mx-auto space-y-4">

        {/* ── Tab: Nueva evaluación ────────────────────────────────────── */}
        {activeTab === 'nueva' && isManager && (
          <>
            {/* Selector de colaborador */}
            <section className="bg-white rounded-2xl border border-stone-200/70 shadow-[0_2px_8px_rgba(0,0,0,0.04)] p-4 space-y-3">
              <h2 className="text-xs font-bold text-stone-400 uppercase tracking-wider">
                Colaborador a evaluar
              </h2>
              {staff.length === 0 ? (
                <p className="text-sm text-stone-400 italic">
                  Sin colaboradores activos.
                </p>
              ) : (
                <select
                  value={selectedStaffId}
                  onChange={(e) => setSelectedStaffId(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-500 text-stone-800 text-base bg-white"
                >
                  <option value="">Seleccionar colaborador...</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              )}
              <p className="text-xs text-stone-400">
                Evaluador: <span className="font-semibold text-stone-600">{evaluatorName}</span>
                &ensp;&middot;&ensp;Fecha: <span className="font-semibold text-stone-600">{fmtDate(today)}</span>
              </p>
            </section>

            {/* Promedio en tiempo real */}
            {scoredCount > 0 && (
              <div className="bg-white rounded-2xl border border-stone-200 shadow-sm px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-xs text-stone-400 uppercase tracking-wider font-bold">
                    Promedio actual
                  </p>
                  <p className="text-xs text-stone-500 mt-0.5">
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

            {/* Criterios */}
            <section className="bg-white rounded-2xl border border-stone-200/70 shadow-[0_2px_8px_rgba(0,0,0,0.04)] overflow-hidden">
              <div className="px-4 py-3 border-b border-stone-100">
                <h2 className="text-xs font-bold text-stone-400 uppercase tracking-wider">
                  Criterios de evaluación &mdash; Puntaje 1 al 5
                </h2>
              </div>
              <ul className="divide-y divide-stone-100">
                {CRITERIA.map((crit) => {
                  const score = scores.get(crit.key) ?? 0;
                  return (
                    <li key={crit.key} className="px-4 py-3">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0 pr-3">
                          <p className="font-semibold text-stone-800 text-sm leading-tight">
                            {crit.label}
                          </p>
                          <p className="text-xs text-stone-400 mt-0.5 leading-tight">
                            {crit.description}
                          </p>
                        </div>
                        {score > 0 && (
                          <span
                            className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded-full ${SCORE_BADGE[score]}`}
                          >
                            {SCORE_LABEL[score]}
                          </span>
                        )}
                      </div>
                      {/* Botones 1-5 */}
                      <div className="flex gap-1.5">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => handleScore(crit.key, n)}
                            className={`flex-1 min-h-[44px] rounded-xl font-black text-base transition duration-150 ease-out active:scale-[0.98] select-none ${
                              score === n
                                ? SCORE_BTN_ON[n]
                                : 'bg-stone-100 text-stone-400 hover:bg-stone-200'
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

            {/* Observaciones */}
            <section className="bg-white rounded-2xl border border-stone-200/70 shadow-[0_2px_8px_rgba(0,0,0,0.04)] p-4 space-y-2">
              <h2 className="text-xs font-bold text-stone-400 uppercase tracking-wider">
                Observaciones
              </h2>
              <textarea
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                placeholder="Aspectos destacados, áreas de mejora u observaciones adicionales (opcional)..."
                rows={3}
                maxLength={500}
                className="w-full px-3 py-2 rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-500 text-stone-800 text-base resize-none"
              />
              {observations.length > 0 && (
                <p className="text-xs text-stone-400 text-right">
                  {observations.length}/500
                </p>
              )}
            </section>

            {/* Error */}
            {submitError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 font-medium">
                {submitError}
              </div>
            )}

            {/* Botón guardar */}
            <button
              type="button"
              disabled={!canSubmit}
              onClick={handleSubmit}
              className={`w-full min-h-[52px] font-bold rounded-xl shadow transition duration-150 ease-out select-none text-sm ${
                canSubmit
                  ? 'bg-amber-500 hover:bg-amber-600 active:scale-[0.98] text-white'
                  : 'bg-stone-200 text-stone-400 cursor-not-allowed'
              }`}
            >
              {submitting
                ? 'Guardando...'
                : !selectedStaffId
                ? 'Selecciona un colaborador'
                : !allScored
                ? `Faltan ${CRITERIA.length - scoredCount} criterio${CRITERIA.length - scoredCount !== 1 ? 's' : ''}`
                : 'Guardar evaluación'}
            </button>
          </>
        )}

        {/* ── Tab: Historial ───────────────────────────────────────────── */}
        {activeTab === 'historial' && (
          <>
            {/* Selector de mes */}
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-500 text-stone-800 text-base bg-white capitalize"
            >
              {monthOptions.map((opt) => (
                <option key={opt.value} value={opt.value} className="capitalize">
                  {opt.label}
                </option>
              ))}
            </select>

            {monthLoading ? (
              <div className="text-center py-14 text-stone-400 text-sm">
                Cargando evaluaciones...
              </div>
            ) : monthEvals.length === 0 ? (
              <div className="text-center py-14 text-stone-400 text-sm">
                Sin evaluaciones en este mes.
              </div>
            ) : (
              <>
                {/* Resumen mensual por colaborador */}
                <section className="bg-white rounded-2xl border border-stone-200/70 shadow-[0_2px_8px_rgba(0,0,0,0.04)] overflow-hidden">
                  <div className="px-4 py-3 border-b border-stone-100 flex items-center justify-between">
                    <h2 className="text-xs font-bold text-stone-400 uppercase tracking-wider">
                      Desempeño mensual
                    </h2>
                    <span className="text-xs text-stone-400">
                      {monthEvals.length} evaluación{monthEvals.length !== 1 ? 'es' : ''}
                    </span>
                  </div>
                  <ul className="divide-y divide-stone-100">
                    {staffSummary.map((entry) => (
                      <li
                        key={entry.id}
                        className="flex items-center gap-3 px-4 py-3"
                      >
                        {/* Promedio */}
                        <div
                          className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center font-black text-base ${avgBadgeClass(entry.avg)}`}
                        >
                          {entry.avg.toFixed(1)}
                        </div>
                        {/* Nombre */}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-stone-900 text-sm truncate">
                            {entry.name}
                          </p>
                          <p className="text-xs text-stone-400 mt-0.5">
                            {entry.count} evaluación{entry.count !== 1 ? 'es' : ''}
                          </p>
                        </div>
                        {/* Badge */}
                        <span
                          className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${avgBadgeClass(entry.avg)}`}
                        >
                          {avgLabel(entry.avg)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>

                {/* Lista de evaluaciones */}
                <div className="space-y-3">
                  {monthEvals.map((record) => (
                    <EvalCard key={record.id} record={record} />
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
