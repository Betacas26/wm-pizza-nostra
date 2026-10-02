'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import type { HistoryRecord, HistoryCheck } from './actions';
import { submitChecklistAction } from './actions';

// ── Tipos ────────────────────────────────────────────────────────────────────
export interface StaffMember {
  id: string;
  name: string;
}

export type ChecklistArea = 'PB' | 'PA' | 'TE' | 'BA';
export type ChecklistType = 'apertura' | 'cierre';

// ── Catálogo de ítems ────────────────────────────────────────────────────────
const AREA_LABELS: Record<ChecklistArea, string> = {
  PB: 'Planta Baja',
  PA: 'Planta Alta',
  TE: 'Terraza',
  BA: 'Barra',
};

const TYPE_LABELS: Record<ChecklistType, string> = {
  apertura: 'Apertura',
  cierre: 'Cierre',
};

const TYPE_STYLE: Record<ChecklistType, string> = {
  apertura: 'bg-amber-100 text-amber-700',
  cierre:   'bg-sky-100 text-sky-700',
};

interface CheckItem {
  key: string;
  label: string;
}

const CHECKLIST: Record<ChecklistArea, Record<ChecklistType, CheckItem[]>> = {
  PB: {
    apertura: [
      { key: 'pb_ap_1', label: 'Limpiar y acomodar mesas y sillas' },
      { key: 'pb_ap_2', label: 'Colocar mantelería limpia en todas las mesas' },
      { key: 'pb_ap_3', label: 'Verificar menús (limpios y completos)' },
      { key: 'pb_ap_4', label: 'Preparar mise en place (sal, pimienta, servilleteros)' },
      { key: 'pb_ap_5', label: 'Revisar iluminación y climatización' },
      { key: 'pb_ap_6', label: 'Verificar material de servicio (charolas, platos)' },
      { key: 'pb_ap_7', label: 'Revisar limpieza de piso y accesos' },
    ],
    cierre: [
      { key: 'pb_ci_1', label: 'Desmantelar mesas y clasificar mantelería sucia' },
      { key: 'pb_ci_2', label: 'Limpiar y apilar sillas y mesas' },
      { key: 'pb_ci_3', label: 'Barrer y trapear el piso del área' },
      { key: 'pb_ci_4', label: 'Recoger y registrar objetos olvidados' },
      { key: 'pb_ci_5', label: 'Apagar iluminación y climatización' },
      { key: 'pb_ci_6', label: 'Verificar que no queden alimentos ni bebidas' },
      { key: 'pb_ci_7', label: 'Reportar incidencias o daños del turno' },
    ],
  },
  PA: {
    apertura: [
      { key: 'pa_ap_1', label: 'Limpiar y acomodar mesas y sillas' },
      { key: 'pa_ap_2', label: 'Colocar mantelería limpia en todas las mesas' },
      { key: 'pa_ap_3', label: 'Verificar menús (limpios y completos)' },
      { key: 'pa_ap_4', label: 'Preparar mise en place' },
      { key: 'pa_ap_5', label: 'Revisar iluminación y climatización' },
      { key: 'pa_ap_6', label: 'Revisar limpieza de escaleras y accesos' },
      { key: 'pa_ap_7', label: 'Verificar material de servicio' },
    ],
    cierre: [
      { key: 'pa_ci_1', label: 'Desmantelar mesas y clasificar mantelería sucia' },
      { key: 'pa_ci_2', label: 'Limpiar y apilar sillas y mesas' },
      { key: 'pa_ci_3', label: 'Barrer y trapear piso y escaleras' },
      { key: 'pa_ci_4', label: 'Recoger y registrar objetos olvidados' },
      { key: 'pa_ci_5', label: 'Apagar iluminación y climatización' },
      { key: 'pa_ci_6', label: 'Verificar que no queden alimentos ni bebidas' },
      { key: 'pa_ci_7', label: 'Reportar incidencias o daños del turno' },
    ],
  },
  TE: {
    apertura: [
      { key: 'te_ap_1', label: 'Limpiar y acomodar mobiliario de exterior' },
      { key: 'te_ap_2', label: 'Desplegar y fijar parasoles (verificar estado)' },
      { key: 'te_ap_3', label: 'Colocar mantelería o individuales en mesas' },
      { key: 'te_ap_4', label: 'Verificar menús de terraza' },
      { key: 'te_ap_5', label: 'Preparar mise en place' },
      { key: 'te_ap_6', label: 'Revisar iluminación exterior' },
      { key: 'te_ap_7', label: 'Verificar estado del piso de terraza' },
    ],
    cierre: [
      { key: 'te_ci_1', label: 'Recoger y guardar mantelería o individuales' },
      { key: 'te_ci_2', label: 'Plegar y asegurar parasoles' },
      { key: 'te_ci_3', label: 'Limpiar y apilar mesas y sillas de exterior' },
      { key: 'te_ci_4', label: 'Barrer piso de terraza' },
      { key: 'te_ci_5', label: 'Recoger y registrar objetos olvidados' },
      { key: 'te_ci_6', label: 'Apagar iluminación exterior' },
      { key: 'te_ci_7', label: 'Reportar incidencias o daños del turno' },
    ],
  },
  BA: {
    apertura: [
      { key: 'ba_ap_1', label: 'Revisar limpieza y orden de la barra' },
      { key: 'ba_ap_2', label: 'Verificar inventario de bebidas y licores' },
      { key: 'ba_ap_3', label: 'Preparar hielo y verificar hieleras' },
      { key: 'ba_ap_4', label: 'Revisar herramientas de barra y cristalería' },
      { key: 'ba_ap_5', label: 'Verificar cristalería limpia y sin roturas' },
      { key: 'ba_ap_6', label: 'Revisar surtidores y conexiones de gas/CO₂' },
      { key: 'ba_ap_7', label: 'Verificar que la terminal de pago funcione' },
    ],
    cierre: [
      { key: 'ba_ci_1', label: 'Limpiar profundamente la superficie de la barra' },
      { key: 'ba_ci_2', label: 'Guardar y asegurar licores y bebidas' },
      { key: 'ba_ci_3', label: 'Lavar y guardar cristalería' },
      { key: 'ba_ci_4', label: 'Vaciar y limpiar hieleras' },
      { key: 'ba_ci_5', label: 'Cerrar surtidores y llaves de gas/CO₂' },
      { key: 'ba_ci_6', label: 'Limpiar y guardar herramientas de barra' },
      { key: 'ba_ci_7', label: 'Reportar incidencias, consumos y faltantes' },
    ],
  },
};

const AREAS: ChecklistArea[] = ['PB', 'PA', 'TE', 'BA'];
const TYPES: ChecklistType[] = ['apertura', 'cierre'];

// ── Utilidad de hora ──────────────────────────────────────────────────────────
function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ── Tarjeta de historial ──────────────────────────────────────────────────────
function HistoryCard({ record }: { record: HistoryRecord }) {
  const [expanded, setExpanded] = useState(false);
  const allOk = record.checked_items === record.total_items;

  return (
    <div className="bg-white rounded-2xl border border-stone-200/70 shadow-[0_2px_8px_rgba(0,0,0,0.04)] overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full px-4 py-3 flex items-start gap-3 text-left active:bg-stone-50 transition"
      >
        {/* Área + tipo */}
        <div className="shrink-0 text-center">
          <span className="block font-black text-stone-900 text-base leading-none">
            {record.area}
          </span>
          <span
            className={`mt-1 inline-block text-xs px-1.5 py-0.5 rounded-full font-semibold ${TYPE_STYLE[record.type]}`}
          >
            {TYPE_LABELS[record.type]}
          </span>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-stone-900 text-sm truncate">
            {record.staff_name}
          </p>
          <p className="text-xs text-stone-400 mt-0.5">
            {AREA_LABELS[record.area as ChecklistArea] ?? record.area}
          </p>
        </div>

        {/* Estado y hora */}
        <div className="shrink-0 text-right">
          <p className="text-xs text-stone-500">{fmtTime(record.completed_at)}</p>
          <span
            className={`mt-1 inline-block text-xs font-bold px-2 py-0.5 rounded-full ${
              allOk
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-amber-100 text-amber-700'
            }`}
          >
            {record.checked_items}/{record.total_items}
          </span>
          <span className="block text-stone-400 text-xs mt-0.5">
            {expanded ? '▲' : '▼'}
          </span>
        </div>
      </button>

      {/* Detalle expandido */}
      {expanded && record.checks.length > 0 && (
        <ul className="border-t border-stone-100 divide-y divide-stone-100">
          {record.checks.map((c) => (
            <li
              key={c.item_key}
              className="flex items-center gap-3 px-4 py-2.5"
            >
              <span
                className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                  c.checked
                    ? 'bg-emerald-100 text-emerald-600'
                    : 'bg-red-100 text-red-500'
                }`}
              >
                {c.checked ? '✓' : '✗'}
              </span>
              <span
                className={`text-sm flex-1 ${
                  c.checked ? 'text-stone-700' : 'text-stone-400 line-through'
                }`}
              >
                {c.item_label}
              </span>
              {c.checked && c.checked_at && (
                <span className="shrink-0 text-xs text-stone-400">
                  {fmtTime(c.checked_at)}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function ChecklistClient({
  staff,
  initialHistory,
  today,
}: {
  staff: StaffMember[];
  initialHistory: HistoryRecord[];
  today: string;
}) {
  const [activeTab, setActiveTab] = useState<'nueva' | 'historial'>('nueva');
  const [history, setHistory] = useState<HistoryRecord[]>(initialHistory);

  // ── Configuración de la nueva revisión ───────────────────────────────
  const [selectedArea, setSelectedArea] = useState<ChecklistArea>('PB');
  const [selectedType, setSelectedType] = useState<ChecklistType>('apertura');
  const [selectedStaffId, setSelectedStaffId] = useState(staff[0]?.id ?? '');

  // checks: itemKey → { checked, checkedAt }
  type CheckState = { checked: boolean; checkedAt: string | null };
  const [checks, setChecks] = useState<Map<string, CheckState>>(new Map());

  // Ítems actuales según área + tipo
  const currentItems = useMemo(
    () => CHECKLIST[selectedArea][selectedType],
    [selectedArea, selectedType],
  );

  // Re-inicializar checks cuando cambia área o tipo
  useMemo(() => {
    const next = new Map<string, CheckState>(
      CHECKLIST[selectedArea][selectedType].map((item) => [
        item.key,
        { checked: false, checkedAt: null },
      ]),
    );
    setChecks(next);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedArea, selectedType]);

  const checkedCount = useMemo(
    () => [...checks.values()].filter((c) => c.checked).length,
    [checks],
  );
  const allChecked = checkedCount === currentItems.length;
  const progressPct =
    currentItems.length > 0
      ? Math.round((checkedCount / currentItems.length) * 100)
      : 0;

  // ── Toggle ítem ───────────────────────────────────────────────────────
  function handleToggleItem(key: string) {
    setChecks((prev) => {
      const next = new Map(prev);
      const cur = next.get(key) ?? { checked: false, checkedAt: null };
      next.set(key, {
        checked: !cur.checked,
        checkedAt: !cur.checked ? new Date().toISOString() : null,
      });
      return next;
    });
  }

  // ── Enviar revisión ───────────────────────────────────────────────────
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!selectedStaffId || submitting) return;
    setSubmitting(true);
    setSubmitError(null);

    const staffName =
      staff.find((s) => s.id === selectedStaffId)?.name ?? selectedStaffId;

    const checksPayload: HistoryCheck[] = currentItems.map((item) => {
      const state = checks.get(item.key) ?? { checked: false, checkedAt: null };
      return {
        item_key: item.key,
        item_label: item.label,
        checked: state.checked,
        checked_at: state.checkedAt,
      };
    });

    try {
      const result = await submitChecklistAction({
        closing_date: today,
        area: selectedArea,
        type: selectedType,
        staff_id: selectedStaffId,
        staff_name: staffName,
        checks: checksPayload,
      });

      setHistory((prev) => [result, ...prev]);
      // Resetear para nueva revisión
      setChecks(
        new Map(
          currentItems.map((item) => [
            item.key,
            { checked: false, checkedAt: null },
          ]),
        ),
      );
      setActiveTab('historial');
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Error al registrar la revisión.',
      );
    }
    setSubmitting(false);
  }

  const canSubmit = allChecked && !!selectedStaffId && !submitting;

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
            Checklist
          </h1>
          <p className="text-xs text-stone-500">
            {today}
            {history.length > 0 && (
              <span className="ml-1 font-semibold text-stone-600">
                &middot; {history.length} revisión{history.length !== 1 ? 'es' : ''} hoy
              </span>
            )}
          </p>
        </div>
      </header>

      {/* Tabs — segmented control */}
      <div className="bg-white border-b border-stone-200 sticky top-[57px] z-10 px-4 py-2">
        <div className="p-1 bg-stone-100 rounded-xl flex">
          {(['nueva', 'historial'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 h-9 rounded-lg text-sm font-semibold transition duration-150 ease-out active:scale-[0.98] select-none ${
                activeTab === tab
                  ? 'bg-white text-stone-900 shadow-sm'
                  : 'text-stone-500 hover:text-stone-700'
              }`}
            >
              {tab === 'historial'
                ? `Historial${history.length > 0 ? ` (${history.length})` : ''}`
                : 'Nueva revisión'}
            </button>
          ))}
        </div>
      </div>

      <main className="p-4 max-w-xl mx-auto space-y-4">

        {/* ── Tab: Nueva revisión ──────────────────────────────────────── */}
        {activeTab === 'nueva' && (
          <>
            {/* Selector de área */}
            <section className="bg-white rounded-2xl border border-stone-200/70 shadow-[0_2px_8px_rgba(0,0,0,0.04)] p-4 space-y-3">
              <h2 className="text-xs font-bold text-stone-400 uppercase tracking-wider">
                Área
              </h2>
              <div className="grid grid-cols-4 gap-2">
                {AREAS.map((area) => (
                  <button
                    key={area}
                    type="button"
                    onClick={() => setSelectedArea(area)}
                    className={`min-h-[60px] rounded-xl text-sm font-bold transition duration-150 ease-out active:scale-[0.98] select-none flex flex-col items-center justify-center gap-0.5 ${
                      selectedArea === area
                        ? 'bg-amber-500 text-white shadow-sm'
                        : 'bg-stone-100 text-stone-600 hover:bg-amber-50'
                    }`}
                  >
                    <span className="text-base font-black">{area}</span>
                    <span
                      className={`text-[10px] font-normal leading-tight text-center ${
                        selectedArea === area ? 'text-amber-100' : 'text-stone-400'
                      }`}
                    >
                      {AREA_LABELS[area].replace(' ', '\u00A0')}
                    </span>
                  </button>
                ))}
              </div>

              {/* Tipo */}
              <h2 className="text-xs font-bold text-stone-400 uppercase tracking-wider pt-1">
                Tipo de revisión
              </h2>
              <div className="flex gap-2">
                {TYPES.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setSelectedType(type)}
                    className={`flex-1 min-h-[44px] rounded-xl text-sm font-semibold transition duration-150 ease-out active:scale-[0.98] select-none capitalize ${
                      selectedType === type
                        ? type === 'apertura'
                          ? 'bg-amber-500 text-white shadow-sm'
                          : 'bg-sky-500 text-white shadow-sm'
                        : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
                    }`}
                  >
                    {TYPE_LABELS[type]}
                  </button>
                ))}
              </div>

              {/* Responsable */}
              <h2 className="text-xs font-bold text-stone-400 uppercase tracking-wider pt-1">
                Responsable del turno
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
                  <option value="">Seleccionar responsable...</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              )}
            </section>

            {/* Progreso */}
            <div className="bg-white rounded-2xl border border-stone-200 shadow-sm px-4 py-3 flex items-center gap-4">
              <div className="flex-1">
                <div className="flex justify-between text-xs text-stone-500 mb-1.5">
                  <span className="font-semibold text-stone-700">
                    {AREA_LABELS[selectedArea]} — {TYPE_LABELS[selectedType]}
                  </span>
                  <span>
                    {checkedCount}/{currentItems.length} ítems
                  </span>
                </div>
                <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      allChecked ? 'bg-emerald-500' : 'bg-amber-500'
                    }`}
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
              {allChecked && (
                <span className="shrink-0 text-emerald-600 font-black text-lg">
                  ✓
                </span>
              )}
            </div>

            {/* Lista de ítems */}
            <section className="bg-white rounded-2xl border border-stone-200/70 shadow-[0_2px_8px_rgba(0,0,0,0.04)] overflow-hidden">
              <ul className="divide-y divide-stone-100">
                {currentItems.map((item) => {
                  const state = checks.get(item.key) ?? {
                    checked: false,
                    checkedAt: null,
                  };
                  return (
                    <li key={item.key}>
                      <button
                        type="button"
                        onClick={() => handleToggleItem(item.key)}
                        className={`w-full flex items-center gap-3 px-4 py-4 text-left transition active:bg-stone-50 ${
                          state.checked ? 'bg-emerald-50/50' : 'bg-white'
                        }`}
                      >
                        {/* Checkbox táctil */}
                        <span
                          className={`shrink-0 w-7 h-7 rounded-lg border-2 flex items-center justify-center transition ${
                            state.checked
                              ? 'bg-emerald-500 border-emerald-500 text-white'
                              : 'border-stone-300 bg-white'
                          }`}
                        >
                          {state.checked && (
                            <svg
                              viewBox="0 0 12 10"
                              className="w-3.5 h-3.5"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <polyline points="1 5 4.5 9 11 1" />
                            </svg>
                          )}
                        </span>

                        {/* Texto del ítem */}
                        <span
                          className={`text-sm leading-snug flex-1 ${
                            state.checked
                              ? 'text-stone-400 line-through'
                              : 'text-stone-800'
                          }`}
                        >
                          {item.label}
                        </span>

                        {/* Hora de marcado */}
                        {state.checked && state.checkedAt && (
                          <span className="shrink-0 text-xs text-stone-400">
                            {fmtTime(state.checkedAt)}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>

            {/* Error */}
            {submitError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 font-medium">
                {submitError}
              </div>
            )}

            {/* Botón registrar */}
            <button
              type="button"
              disabled={!canSubmit}
              onClick={handleSubmit}
              className={`w-full min-h-[52px] font-bold rounded-xl shadow transition duration-150 ease-out select-none text-sm ${
                canSubmit
                  ? selectedType === 'apertura'
                    ? 'bg-amber-500 hover:bg-amber-600 active:scale-[0.98] text-white'
                    : 'bg-sky-500 hover:bg-sky-600 active:scale-[0.98] text-white'
                  : 'bg-stone-200 text-stone-400 cursor-not-allowed'
              }`}
            >
              {submitting
                ? 'Registrando...'
                : !selectedStaffId
                ? 'Selecciona un responsable'
                : !allChecked
                ? `Faltan ${currentItems.length - checkedCount} ítem${currentItems.length - checkedCount !== 1 ? 's' : ''}`
                : `Registrar ${TYPE_LABELS[selectedType].toLowerCase()} de ${selectedArea}`}
            </button>
          </>
        )}

        {/* ── Tab: Historial ───────────────────────────────────────────── */}
        {activeTab === 'historial' && (
          <>
            {history.length === 0 ? (
              <div className="text-center py-14 text-stone-400 text-sm">
                Sin revisiones registradas hoy.
              </div>
            ) : (
              <div className="space-y-3">
                {history.map((record) => (
                  <HistoryCard key={record.id} record={record} />
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
