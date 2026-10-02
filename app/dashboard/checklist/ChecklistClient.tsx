'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import type { HistoryRecord, HistoryCheck } from './actions';
import { submitChecklistAction, deleteChecklistAction } from './actions';

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
  apertura: 'bg-[#420F18]/80 border border-[#9E2A3E]/60 text-[#E8899A]',
  cierre: 'bg-sky-950/60 border border-sky-700/50 text-sky-300',
};

interface CheckItem {
  key: string;
  label: string;
}

const CHECKLIST: Record<ChecklistArea, Record<ChecklistType, CheckItem[]>> = {
  PB: {
    apertura: [
      { key: 'pb_ap_1', label: 'Limpiar y acomodar mesas y sillas' },
      { key: 'pb_ap_2', label: 'Colocar manteleria limpia en todas las mesas' },
      { key: 'pb_ap_3', label: 'Verificar menus (limpios y completos)' },
      { key: 'pb_ap_4', label: 'Preparar mise en place (sal, pimienta, servilleteros)' },
      { key: 'pb_ap_5', label: 'Revisar iluminacion y climatizacion' },
      { key: 'pb_ap_6', label: 'Verificar material de servicio (charolas, platos)' },
      { key: 'pb_ap_7', label: 'Revisar limpieza de piso y accesos' },
    ],
    cierre: [
      { key: 'pb_ci_1', label: 'Desmantelar mesas y clasificar manteleria sucia' },
      { key: 'pb_ci_2', label: 'Limpiar y apilar sillas y mesas' },
      { key: 'pb_ci_3', label: 'Barrer y trapear el piso del area' },
      { key: 'pb_ci_4', label: 'Recoger y registrar objetos olvidados' },
      { key: 'pb_ci_5', label: 'Apagar iluminacion y climatizacion' },
      { key: 'pb_ci_6', label: 'Verificar que no queden alimentos ni bebidas' },
      { key: 'pb_ci_7', label: 'Reportar incidencias o danos del turno' },
    ],
  },
  PA: {
    apertura: [
      { key: 'pa_ap_1', label: 'Limpiar y acomodar mesas y sillas' },
      { key: 'pa_ap_2', label: 'Colocar manteleria limpia en todas las mesas' },
      { key: 'pa_ap_3', label: 'Verificar menus (limpios y completos)' },
      { key: 'pa_ap_4', label: 'Preparar mise en place' },
      { key: 'pa_ap_5', label: 'Revisar iluminacion y climatizacion' },
      { key: 'pa_ap_6', label: 'Revisar limpieza de escaleras y accesos' },
      { key: 'pa_ap_7', label: 'Verificar material de servicio' },
    ],
    cierre: [
      { key: 'pa_ci_1', label: 'Desmantelar mesas y clasificar manteleria sucia' },
      { key: 'pa_ci_2', label: 'Limpiar y apilar sillas y mesas' },
      { key: 'pa_ci_3', label: 'Barrer y trapear piso y escaleras' },
      { key: 'pa_ci_4', label: 'Recoger y registrar objetos olvidados' },
      { key: 'pa_ci_5', label: 'Apagar iluminacion y climatizacion' },
      { key: 'pa_ci_6', label: 'Verificar que no queden alimentos ni bebidas' },
      { key: 'pa_ci_7', label: 'Reportar incidencias o danos del turno' },
    ],
  },
  TE: {
    apertura: [
      { key: 'te_ap_1', label: 'Limpiar y acomodar mobiliario de exterior' },
      { key: 'te_ap_2', label: 'Desplegar y fijar parasoles (verificar estado)' },
      { key: 'te_ap_3', label: 'Colocar manteleria o individuales en mesas' },
      { key: 'te_ap_4', label: 'Verificar menus de terraza' },
      { key: 'te_ap_5', label: 'Preparar mise en place' },
      { key: 'te_ap_6', label: 'Revisar iluminacion exterior' },
      { key: 'te_ap_7', label: 'Verificar estado del piso de terraza' },
    ],
    cierre: [
      { key: 'te_ci_1', label: 'Recoger y guardar manteleria o individuales' },
      { key: 'te_ci_2', label: 'Plegar y asegurar parasoles' },
      { key: 'te_ci_3', label: 'Limpiar y apilar mesas y sillas de exterior' },
      { key: 'te_ci_4', label: 'Barrer piso de terraza' },
      { key: 'te_ci_5', label: 'Recoger y registrar objetos olvidados' },
      { key: 'te_ci_6', label: 'Apagar iluminacion exterior' },
      { key: 'te_ci_7', label: 'Reportar incidencias o danos del turno' },
    ],
  },
  BA: {
    apertura: [
      { key: 'ba_ap_1', label: 'Revisar limpieza y orden de la barra' },
      { key: 'ba_ap_2', label: 'Verificar inventario de bebidas y licores' },
      { key: 'ba_ap_3', label: 'Preparar hielo y verificar hieleras' },
      { key: 'ba_ap_4', label: 'Revisar herramientas de barra y cristaleria' },
      { key: 'ba_ap_5', label: 'Verificar cristaleria limpia y sin roturas' },
      { key: 'ba_ap_6', label: 'Revisar surtidores y conexiones de gas/CO2' },
      { key: 'ba_ap_7', label: 'Verificar que la terminal de pago funcione' },
    ],
    cierre: [
      { key: 'ba_ci_1', label: 'Limpiar profundamente la superficie de la barra' },
      { key: 'ba_ci_2', label: 'Guardar y asegurar licores y bebidas' },
      { key: 'ba_ci_3', label: 'Lavar y guardar cristaleria' },
      { key: 'ba_ci_4', label: 'Vaciar y limpiar hieleras' },
      { key: 'ba_ci_5', label: 'Cerrar surtidores y llaves de gas/CO2' },
      { key: 'ba_ci_6', label: 'Limpiar y guardar herramientas de barra' },
      { key: 'ba_ci_7', label: 'Reportar incidencias, consumos y faltantes' },
    ],
  },
};

const AREAS: ChecklistArea[] = ['PB', 'PA', 'TE', 'BA'];
const TYPES: ChecklistType[] = ['apertura', 'cierre'];

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ── Tarjeta de historial ──────────────────────────────────────────────────────
function HistoryCard({
  record,
  isManager,
  onDelete,
}: {
  record: HistoryRecord;
  isManager: boolean;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const allOk = record.checked_items === record.total_items;

  async function handleDelete() {
    if (!confirm('¿Eliminar esta revision?')) return;
    setDeleting(true);
    try {
      await deleteChecklistAction(record.id);
      onDelete(record.id);
    } catch { setDeleting(false); }
  }

  return (
    <div className="bg-[#151D1A] rounded-2xl border border-[#223530] shadow-[0_2px_8px_rgba(0,0,0,0.2)] overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full px-4 py-3 flex items-start gap-3 text-left active:bg-[#1c2b27] transition"
      >
        <div className="shrink-0 text-center">
          <span className="block font-black text-[#e6edea] text-base leading-none">
            {record.area}
          </span>
          <span className={`mt-1 inline-block text-xs px-1.5 py-0.5 rounded-full font-semibold ${TYPE_STYLE[record.type]}`}>
            {TYPE_LABELS[record.type]}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-semibold text-[#e6edea] text-sm truncate">
            {record.staff_name}
          </p>
          <p className="text-xs text-[#7d9990] mt-0.5">
            {AREA_LABELS[record.area as ChecklistArea] ?? record.area}
          </p>
        </div>

        <div className="shrink-0 text-right">
          <p className="text-xs text-[#7d9990]">{fmtTime(record.completed_at)}</p>
          <span
            className={`mt-1 inline-block text-xs font-bold px-2 py-0.5 rounded-full border ${
              allOk
                ? 'bg-emerald-950/60 border-emerald-700/50 text-emerald-300'
                : 'bg-[#420F18]/80 border-[#9E2A3E]/60 text-[#E8899A]'
            }`}
          >
            {record.checked_items}/{record.total_items}
          </span>
          <span className="block text-[#7d9990] text-xs mt-0.5">
            {expanded ? '▲' : '▼'}
          </span>
        </div>
      </button>

      {isManager && (
        <div className="border-t border-[#223530]">
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="w-full py-2 text-xs font-semibold text-red-400 hover:text-red-300 hover:bg-[#1c2b27] transition disabled:opacity-50"
          >
            {deleting ? 'Eliminando...' : 'Eliminar revision'}
          </button>
        </div>
      )}

      {expanded && record.checks.length > 0 && (
        <ul className="border-t border-[#223530] divide-y divide-[#223530]">
          {record.checks.map((c) => (
            <li key={c.item_key} className="flex items-center gap-3 px-4 py-2.5">
              <span
                className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                  c.checked
                    ? 'bg-emerald-950/60 border border-emerald-700/50 text-emerald-400'
                    : 'bg-red-950/60 border border-red-800/50 text-red-400'
                }`}
              >
                {c.checked ? '✓' : '✗'}
              </span>
              <span
                className={`text-sm flex-1 ${
                  c.checked ? 'text-[#7d9990] line-through' : 'text-[#e6edea]'
                }`}
              >
                {c.item_label}
              </span>
              {c.checked && c.checked_at && (
                <span className="shrink-0 text-xs text-[#7d9990]">
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
  isManager,
}: {
  staff: StaffMember[];
  initialHistory: HistoryRecord[];
  today: string;
  isManager: boolean;
}) {
  const [activeTab, setActiveTab] = useState<'nueva' | 'historial'>('nueva');
  const [history, setHistory] = useState<HistoryRecord[]>(initialHistory);

  const [selectedArea, setSelectedArea] = useState<ChecklistArea>('PB');
  const [selectedType, setSelectedType] = useState<ChecklistType>('apertura');
  const [selectedStaffId, setSelectedStaffId] = useState(staff[0]?.id ?? '');

  type CheckState = { checked: boolean; checkedAt: string | null };
  const [checks, setChecks] = useState<Map<string, CheckState>>(new Map());

  const currentItems = useMemo(
    () => CHECKLIST[selectedArea][selectedType],
    [selectedArea, selectedType],
  );

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
        err instanceof Error ? err.message : 'Error al registrar la revision.',
      );
    }
    setSubmitting(false);
  }

  const canSubmit = allChecked && !!selectedStaffId && !submitting;

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
            Checklist
          </h1>
          <p className="text-xs text-[#7d9990]">
            {today}
            {history.length > 0 && (
              <span className="ml-1 font-semibold text-[#e6edea]">
                &middot; {history.length} revision{history.length !== 1 ? 'es' : ''} hoy
              </span>
            )}
          </p>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-[#151D1A] border-b border-[#223530] sticky top-[57px] z-10 px-4 py-2">
        <div className="p-1 bg-[#0a0f0e] rounded-xl flex">
          {(['nueva', 'historial'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 h-9 rounded-lg text-sm font-semibold transition duration-150 ease-out active:scale-[0.98] select-none ${
                activeTab === tab
                  ? 'bg-[#1c2b27] text-[#e6edea] shadow-sm'
                  : 'text-[#7d9990] hover:text-[#e6edea]'
              }`}
            >
              {tab === 'historial'
                ? `Historial${history.length > 0 ? ` (${history.length})` : ''}`
                : 'Nueva revision'}
            </button>
          ))}
        </div>
      </div>

      <main className="p-4 max-w-xl mx-auto space-y-4">

        {/* ── Tab: Nueva revisión ──────────────────────────────────────── */}
        {activeTab === 'nueva' && (
          <>
            <section className="bg-[#151D1A] rounded-2xl border border-[#223530] shadow-[0_2px_8px_rgba(0,0,0,0.2)] p-4 space-y-3">
              <h2 className="text-xs font-bold text-[#7d9990] uppercase tracking-wider">
                Area
              </h2>
              <div className="grid grid-cols-4 gap-2">
                {AREAS.map((area) => (
                  <button
                    key={area}
                    type="button"
                    onClick={() => setSelectedArea(area)}
                    className={`min-h-[60px] rounded-xl text-sm font-bold transition duration-150 ease-out active:scale-[0.98] select-none flex flex-col items-center justify-center gap-0.5 ${
                      selectedArea === area
                        ? 'bg-[#7A1D2E] text-white shadow-sm'
                        : 'bg-[#1c2b27] border border-[#223530] text-[#7d9990] hover:text-[#e6edea]'
                    }`}
                  >
                    <span className="text-base font-black">{area}</span>
                    <span
                      className={`text-[10px] font-normal leading-tight text-center ${
                        selectedArea === area ? 'text-amber-100' : 'text-[#7d9990]'
                      }`}
                    >
                      {AREA_LABELS[area].replace(' ', '\u00A0')}
                    </span>
                  </button>
                ))}
              </div>

              <h2 className="text-xs font-bold text-[#7d9990] uppercase tracking-wider pt-1">
                Tipo de revision
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
                          ? 'bg-[#7A1D2E] text-white shadow-sm'
                          : 'bg-sky-600 text-white shadow-sm'
                        : 'bg-[#1c2b27] border border-[#223530] text-[#7d9990] hover:text-[#e6edea]'
                    }`}
                  >
                    {TYPE_LABELS[type]}
                  </button>
                ))}
              </div>

              <h2 className="text-xs font-bold text-[#7d9990] uppercase tracking-wider pt-1">
                Responsable del turno
              </h2>
              {staff.length === 0 ? (
                <p className="text-sm text-[#7d9990] italic">
                  Sin colaboradores activos.
                </p>
              ) : (
                <select
                  value={selectedStaffId}
                  onChange={(e) => setSelectedStaffId(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-[#223530] bg-[#1c2b27] text-[#e6edea] text-base focus:outline-none focus:ring-2 focus:ring-[#7A1D2E]"
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
            <div className="bg-[#151D1A] border border-[#223530] rounded-2xl shadow-sm px-4 py-3 flex items-center gap-4">
              <div className="flex-1">
                <div className="flex justify-between text-xs text-[#7d9990] mb-1.5">
                  <span className="font-semibold text-[#e6edea]">
                    {AREA_LABELS[selectedArea]} — {TYPE_LABELS[selectedType]}
                  </span>
                  <span>
                    {checkedCount}/{currentItems.length} items
                  </span>
                </div>
                <div className="h-2 bg-[#1c2b27] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      allChecked ? 'bg-emerald-500' : 'bg-[#7A1D2E]'
                    }`}
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
              {allChecked && (
                <span className="shrink-0 text-emerald-400 font-black text-lg">✓</span>
              )}
            </div>

            {/* Lista de items */}
            <section className="bg-[#151D1A] rounded-2xl border border-[#223530] shadow-[0_2px_8px_rgba(0,0,0,0.2)] overflow-hidden">
              <ul className="divide-y divide-[#223530]">
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
                        className={`w-full flex items-center gap-3 px-4 py-4 text-left transition active:bg-[#1c2b27] ${
                          state.checked ? 'bg-emerald-950/20' : ''
                        }`}
                      >
                        <span
                          className={`shrink-0 w-7 h-7 rounded-lg border-2 flex items-center justify-center transition ${
                            state.checked
                              ? 'bg-emerald-500 border-emerald-500 text-white'
                              : 'border-[#223530] bg-[#1c2b27]'
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

                        <span
                          className={`text-sm leading-snug flex-1 ${
                            state.checked
                              ? 'text-[#7d9990] line-through'
                              : 'text-[#e6edea]'
                          }`}
                        >
                          {item.label}
                        </span>

                        {state.checked && state.checkedAt && (
                          <span className="shrink-0 text-xs text-[#7d9990]">
                            {fmtTime(state.checkedAt)}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
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
                  ? selectedType === 'apertura'
                    ? 'bg-[#7A1D2E] hover:bg-[#9E2A3E] active:scale-[0.98] text-white'
                    : 'bg-sky-600 hover:bg-sky-700 active:scale-[0.98] text-white'
                  : 'bg-[#1c2b27] border border-[#223530] text-[#7d9990] cursor-not-allowed'
              }`}
            >
              {submitting
                ? 'Registrando...'
                : !selectedStaffId
                ? 'Selecciona un responsable'
                : !allChecked
                ? `Faltan ${currentItems.length - checkedCount} item${currentItems.length - checkedCount !== 1 ? 's' : ''}`
                : `Registrar ${TYPE_LABELS[selectedType].toLowerCase()} de ${selectedArea}`}
            </button>
          </>
        )}

        {/* ── Tab: Historial ───────────────────────────────────────────── */}
        {activeTab === 'historial' && (
          <>
            {history.length === 0 ? (
              <div className="text-center py-14 text-[#7d9990] text-sm">
                Sin revisiones registradas hoy.
              </div>
            ) : (
              <div className="space-y-3">
                {history.map((record) => (
                  <HistoryCard
                    key={record.id}
                    record={record}
                    isManager={isManager}
                    onDelete={(id) => setHistory((prev) => prev.filter((r) => r.id !== id))}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
