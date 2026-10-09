'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ChevronLeft, Trash2, Download, TrendingUp, TrendingDown } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { addSanctionAction, deleteSanctionAction } from './actions';

// ── Tipos ────────────────────────────────────────────────────────────────────
export interface StaffMember {
  id: string;
  name: string;
  role: string;
}

export interface SancionRecord {
  id: string;
  record_date: string;
  staff_id: string;
  staff_name: string;
  type: 'sancion' | 'bono';
  amount: number;
  concept: string;
  created_at: string;
}

export interface SancionesClientProps {
  staff: StaffMember[];
  today: string;
}

type ActiveTab = 'registrar' | 'historial';

// ── Utilidades ───────────────────────────────────────────────────────────────
function todayStr(): string { return new Date().toISOString().split('T')[0]; }

function getPreset(preset: 'hoy' | 'semana' | 'mes'): [string, string] {
  const today = todayStr();
  const now = new Date();
  if (preset === 'hoy') return [today, today];
  if (preset === 'semana') {
    const day = now.getUTCDay();
    const diff = day === 0 ? -6 : 1 - day;
    const ws = new Date(now);
    ws.setUTCDate(ws.getUTCDate() + diff);
    return [ws.toISOString().split('T')[0], today];
  }
  const y = now.getUTCFullYear();
  const m = (now.getUTCMonth() + 1).toString().padStart(2, '0');
  return [`${y}-${m}-01`, today];
}

function fmtMXN(n: number): string {
  return `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(iso: string): string {
  return new Date(iso + 'T00:00:00Z').toLocaleDateString('es-MX', {
    weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC',
  });
}

// ── Componente ───────────────────────────────────────────────────────────────
export default function SancionesClient({ staff, today }: SancionesClientProps) {
  const supabase = useMemo(() => createClient(), []);

  const [activeTab, setActiveTab] = useState<ActiveTab>('registrar');

  // ── Estado: Registrar ───────────────────────────────────────────────────────
  const [formStaffId, setFormStaffId] = useState(staff[0]?.id ?? '');
  const [formType, setFormType]       = useState<'sancion' | 'bono'>('sancion');
  const [formAmount, setFormAmount]   = useState('');
  const [formConcept, setFormConcept] = useState('');
  const [formDate, setFormDate]       = useState(today);
  const [saving, setSaving]           = useState(false);
  const [savedMsg, setSavedMsg]       = useState('');
  const [formError, setFormError]     = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amount = parseFloat(formAmount);
    if (!formStaffId) { setFormError('Selecciona un colaborador.'); return; }
    if (!isFinite(amount) || amount <= 0) { setFormError('Monto inválido.'); return; }
    if (!formConcept.trim()) { setFormError('El concepto es requerido.'); return; }
    setFormError('');
    setSaving(true);
    try {
      await addSanctionAction({
        record_date: formDate,
        staff_id: formStaffId,
        type: formType,
        amount,
        concept: formConcept,
      });
      setFormAmount('');
      setFormConcept('');
      setSavedMsg(formType === 'bono' ? 'Bono guardado' : 'Sanción guardada');
      setTimeout(() => setSavedMsg(''), 2500);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error al guardar.');
    }
    setSaving(false);
  }

  // ── Estado: Historial ───────────────────────────────────────────────────────
  const [histPreset, setHistPreset] = useState<'hoy' | 'semana' | 'mes' | 'custom'>('mes');
  const [histFrom, setHistFrom]     = useState(() => getPreset('mes')[0]);
  const [histTo, setHistTo]         = useState(() => getPreset('mes')[1]);
  const [histStaff, setHistStaff]   = useState(''); // '' = todos
  const [records, setRecords]       = useState<SancionRecord[]>([]);
  const [histLoading, setHistLoading] = useState(false);
  const [deleting, setDeleting]     = useState<string | null>(null);

  const staffNameMap = useMemo(
    () => new Map(staff.map((s) => [s.id, s.name])),
    [staff],
  );

  const fetchHistory = useCallback(() => {
    setHistLoading(true);
    type Row = {
      id: string; record_date: string; staff_id: string;
      type: string; amount: number; concept: string; created_at: string;
    };
    supabase
      .from('sanctions')
      .select('id, record_date, staff_id, type, amount, concept, created_at')
      .gte('record_date', histFrom)
      .lte('record_date', histTo)
      .order('record_date', { ascending: false })
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setRecords(
          ((data ?? []) as Row[]).map((r) => ({
            ...r,
            type: r.type as 'sancion' | 'bono',
            amount: Number(r.amount),
            staff_name: staffNameMap.get(r.staff_id) ?? r.staff_id,
          })),
        );
        setHistLoading(false);
      });
  }, [histFrom, histTo, supabase, staffNameMap]);

  useEffect(() => {
    if (activeTab === 'historial') fetchHistory();
  }, [activeTab, fetchHistory]);

  function applyPreset(p: 'hoy' | 'semana' | 'mes') {
    const [f, t] = getPreset(p);
    setHistPreset(p);
    setHistFrom(f);
    setHistTo(t);
  }

  async function handleDelete(id: string) {
    if (!window.confirm('¿Eliminar este registro?')) return;
    setDeleting(id);
    try {
      await deleteSanctionAction(id);
      setRecords((prev) => prev.filter((r) => r.id !== id));
    } catch { /* silent */ }
    setDeleting(null);
  }

  // Filtro por colaborador en historial
  const filteredRecords = useMemo(
    () => (histStaff ? records.filter((r) => r.staff_id === histStaff) : records),
    [records, histStaff],
  );

  // Balance por colaborador
  const balanceByStaff = useMemo(() => {
    const map = new Map<string, { name: string; bonos: number; sanciones: number; net: number }>();
    for (const r of filteredRecords) {
      const ex = map.get(r.staff_id);
      const isBono = r.type === 'bono';
      if (ex) {
        if (isBono) ex.bonos += r.amount; else ex.sanciones += r.amount;
        ex.net += isBono ? r.amount : -r.amount;
      } else {
        map.set(r.staff_id, {
          name: r.staff_name,
          bonos: isBono ? r.amount : 0,
          sanciones: isBono ? 0 : r.amount,
          net: isBono ? r.amount : -r.amount,
        });
      }
    }
    return [...map.values()].sort((a, b) => b.net - a.net);
  }, [filteredRecords]);

  const grandBonos    = useMemo(() => filteredRecords.filter((r) => r.type === 'bono').reduce((a, r) => a + r.amount, 0), [filteredRecords]);
  const grandSanciones = useMemo(() => filteredRecords.filter((r) => r.type === 'sancion').reduce((a, r) => a + r.amount, 0), [filteredRecords]);

  function exportCSV() {
    const BOM = '\uFEFF';
    const headers = 'Fecha,Colaborador,Tipo,Monto,Concepto';
    const rows = filteredRecords.map((r) =>
      `${r.record_date},"${r.staff_name}",${r.type === 'bono' ? 'Bono' : 'Sanción'},${r.amount.toFixed(2)},"${r.concept}"`,
    );
    const csv = BOM + [headers, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sanciones_bonos_${histFrom}_${histTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  const tabs: { key: ActiveTab; label: string }[] = [
    { key: 'registrar', label: 'Registrar' },
    { key: 'historial', label: 'Historial' },
  ];

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
        <Image src="/icon-512.png" alt="" width={28} height={28} className="rounded-lg shrink-0" />
        <div className="flex-1 min-w-0">
          <h1 className="font-extrabold text-[#E8899A] text-lg leading-tight">Sanciones y Bonos</h1>
          <p className="text-xs text-[#7d9990]">Registro por colaborador</p>
        </div>
        {savedMsg && (
          <span className="text-xs font-semibold text-emerald-400 shrink-0">&#10003; {savedMsg}</span>
        )}
      </header>

      {/* Tabs */}
      <div className="bg-[#151D1A] border-b border-[#223530] sticky top-[57px] z-10 px-4 py-2">
        <div className="p-1 bg-[#0a0f0e] rounded-xl flex">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex-1 h-9 rounded-lg text-xs font-semibold transition duration-150 ease-out active:scale-[0.98] select-none ${
                activeTab === t.key
                  ? 'bg-[#1c2b27] text-[#e6edea] shadow-sm'
                  : 'text-[#7d9990] hover:text-[#e6edea]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <main className="p-4 max-w-xl mx-auto pb-8">

        {/* ══════════════════════════════ Tab: Registrar ══════════════════════════════ */}
        {activeTab === 'registrar' && (
          <form onSubmit={handleSubmit} className="space-y-4 pt-1">

            {/* Tipo */}
            <div>
              <label className="block text-xs font-bold text-[#7d9990] uppercase tracking-wider mb-1.5">
                Tipo
              </label>
              <div className="flex gap-2">
                {(['sancion', 'bono'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setFormType(t)}
                    className={`flex-1 min-h-[44px] rounded-xl font-semibold text-sm transition duration-150 active:scale-[0.98] select-none border ${
                      formType === t
                        ? t === 'sancion'
                          ? 'bg-rose-900/70 border-rose-700/60 text-rose-200'
                          : 'bg-emerald-900/70 border-emerald-700/60 text-emerald-200'
                        : 'bg-[#1c2b27] border-[#223530] text-[#7d9990] hover:text-[#e6edea]'
                    }`}
                  >
                    {t === 'sancion' ? 'Sanción' : 'Bono'}
                  </button>
                ))}
              </div>
            </div>

            {/* Colaborador */}
            <div>
              <label className="block text-xs font-bold text-[#7d9990] uppercase tracking-wider mb-1.5">
                Colaborador
              </label>
              <select
                value={formStaffId}
                onChange={(e) => setFormStaffId(e.target.value)}
                required
                className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-[#223530] bg-[#1c2b27] text-[#e6edea] text-base focus:outline-none focus:ring-2 focus:ring-[#7A1D2E]"
              >
                <option value="">Seleccionar...</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            {/* Monto */}
            <div>
              <label className="block text-xs font-bold text-[#7d9990] uppercase tracking-wider mb-1.5">
                Monto ($)
              </label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={formAmount}
                onChange={(e) => setFormAmount(e.target.value)}
                placeholder="0.00"
                required
                className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-[#223530] bg-[#1c2b27] text-[#e6edea] text-base focus:outline-none focus:ring-2 focus:ring-[#7A1D2E]"
              />
            </div>

            {/* Concepto */}
            <div>
              <label className="block text-xs font-bold text-[#7d9990] uppercase tracking-wider mb-1.5">
                Concepto
              </label>
              <input
                type="text"
                value={formConcept}
                onChange={(e) => setFormConcept(e.target.value)}
                placeholder="Ej. Tardanza, Bono puntualidad, Uniforme..."
                maxLength={120}
                required
                className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-[#223530] bg-[#1c2b27] text-[#e6edea] text-base focus:outline-none focus:ring-2 focus:ring-[#7A1D2E]"
              />
            </div>

            {/* Fecha */}
            <div>
              <label className="block text-xs font-bold text-[#7d9990] uppercase tracking-wider mb-1.5">
                Fecha
              </label>
              <input
                type="date"
                value={formDate}
                max={today}
                onChange={(e) => setFormDate(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-[#223530] bg-[#1c2b27] text-[#e6edea] text-base focus:outline-none focus:ring-2 focus:ring-[#7A1D2E]"
              />
            </div>

            {formError && (
              <p className="text-xs text-red-400 bg-red-950/40 border border-red-800/50 rounded-xl px-3 py-2">
                {formError}
              </p>
            )}

            <button
              type="submit"
              disabled={saving}
              className={`w-full min-h-[52px] font-bold rounded-xl shadow transition duration-150 text-sm active:scale-[0.98] select-none disabled:opacity-40 text-white ${
                formType === 'sancion'
                  ? 'bg-rose-800 hover:bg-rose-700'
                  : 'bg-emerald-800 hover:bg-emerald-700'
              }`}
            >
              {saving ? 'Guardando...' : formType === 'sancion' ? 'Registrar Sanción' : 'Registrar Bono'}
            </button>
          </form>
        )}

        {/* ══════════════════════════════ Tab: Historial ══════════════════════════════ */}
        {activeTab === 'historial' && (
          <div className="space-y-4 pt-1">

            {/* Presets */}
            <div className="flex gap-2">
              {(['hoy', 'semana', 'mes'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => applyPreset(p)}
                  className={`flex-1 h-9 rounded-xl text-xs font-semibold transition duration-150 active:scale-[0.98] select-none border ${
                    histPreset === p
                      ? 'bg-[#7A1D2E] border-[#9E2A3E]/60 text-white'
                      : 'bg-[#1c2b27] border-[#223530] text-[#7d9990] hover:text-[#e6edea]'
                  }`}
                >
                  {p === 'hoy' ? 'Hoy' : p === 'semana' ? 'Semana' : 'Mes'}
                </button>
              ))}
            </div>

            {/* Rango manual */}
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-[10px] font-bold text-[#7d9990] uppercase tracking-wider mb-1">Desde</label>
                <input
                  type="date"
                  value={histFrom}
                  max={histTo}
                  onChange={(e) => { setHistFrom(e.target.value); setHistPreset('custom'); }}
                  className="w-full min-h-[40px] px-3 py-1.5 rounded-xl border border-[#223530] bg-[#1c2b27] text-[#e6edea] text-sm focus:outline-none focus:ring-2 focus:ring-[#7A1D2E]"
                />
              </div>
              <div className="flex-1">
                <label className="block text-[10px] font-bold text-[#7d9990] uppercase tracking-wider mb-1">Hasta</label>
                <input
                  type="date"
                  value={histTo}
                  min={histFrom}
                  max={today}
                  onChange={(e) => { setHistTo(e.target.value); setHistPreset('custom'); }}
                  className="w-full min-h-[40px] px-3 py-1.5 rounded-xl border border-[#223530] bg-[#1c2b27] text-[#e6edea] text-sm focus:outline-none focus:ring-2 focus:ring-[#7A1D2E]"
                />
              </div>
            </div>

            {/* Filtro colaborador */}
            <select
              value={histStaff}
              onChange={(e) => setHistStaff(e.target.value)}
              className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-[#223530] bg-[#1c2b27] text-[#e6edea] text-sm focus:outline-none focus:ring-2 focus:ring-[#7A1D2E]"
            >
              <option value="">Todos los colaboradores</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>

            {/* Botones buscar + CSV */}
            <div className="flex gap-2">
              <button
                onClick={fetchHistory}
                disabled={histLoading}
                className="flex-1 min-h-[44px] bg-[#7A1D2E] hover:bg-[#9E2A3E] active:scale-[0.98] text-white font-bold rounded-xl shadow transition duration-150 text-sm disabled:opacity-40"
              >
                {histLoading ? 'Cargando...' : 'Ver historial'}
              </button>
              {filteredRecords.length > 0 && (
                <button
                  onClick={exportCSV}
                  className="flex items-center gap-2 px-4 min-h-[44px] bg-[#1c2b27] border border-[#223530] hover:border-[#9E2A3E]/60 active:scale-[0.98] text-[#7d9990] hover:text-[#e6edea] font-semibold rounded-xl transition text-sm"
                >
                  <Download size={15} strokeWidth={2} />
                  CSV
                </button>
              )}
            </div>

            {histLoading ? (
              <div className="text-center py-10 text-[#7d9990] text-sm">Cargando...</div>
            ) : filteredRecords.length === 0 ? (
              <div className="text-center py-14 text-[#7d9990] text-sm">Sin registros para este período.</div>
            ) : (
              <>
                {/* Resumen global */}
                <div className="bg-[#151D1A] rounded-2xl border border-[#223530] p-4 space-y-3">
                  <p className="text-xs font-bold text-[#7d9990] uppercase tracking-wider">Resumen del período</p>
                  <div className="grid grid-cols-3 gap-3 text-xs">
                    <div>
                      <p className="text-[#7d9990] mb-0.5">Bonos</p>
                      <p className="font-mono font-bold text-emerald-400">{fmtMXN(grandBonos)}</p>
                    </div>
                    <div>
                      <p className="text-[#7d9990] mb-0.5">Sanciones</p>
                      <p className="font-mono font-bold text-rose-400">{fmtMXN(grandSanciones)}</p>
                    </div>
                    <div>
                      <p className="text-[#7d9990] mb-0.5">Balance</p>
                      <p className={`font-mono font-bold ${grandBonos - grandSanciones >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {fmtMXN(grandBonos - grandSanciones)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Balance por colaborador */}
                {balanceByStaff.length > 1 && (
                  <section>
                    <p className="text-[10px] font-bold text-[#7d9990] uppercase tracking-wider px-1 mb-2">
                      Balance por colaborador
                    </p>
                    <div className="space-y-2">
                      {balanceByStaff.map((b) => (
                        <div
                          key={b.name}
                          className="bg-[#151D1A] rounded-2xl border border-[#223530] px-4 py-3 flex items-center gap-3"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm text-[#e6edea] truncate">{b.name}</p>
                            <div className="flex gap-3 mt-0.5">
                              {b.bonos > 0 && (
                                <span className="flex items-center gap-0.5 text-[10px] text-emerald-400">
                                  <TrendingUp size={10} strokeWidth={2} />
                                  {fmtMXN(b.bonos)}
                                </span>
                              )}
                              {b.sanciones > 0 && (
                                <span className="flex items-center gap-0.5 text-[10px] text-rose-400">
                                  <TrendingDown size={10} strokeWidth={2} />
                                  {fmtMXN(b.sanciones)}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className={`font-mono font-bold text-base ${b.net >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {b.net >= 0 ? '+' : ''}{fmtMXN(b.net)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Lista de registros */}
                <section>
                  <p className="text-[10px] font-bold text-[#7d9990] uppercase tracking-wider px-1 mb-2">
                    Registros ({filteredRecords.length})
                  </p>
                  <div className="space-y-2">
                    {filteredRecords.map((r) => (
                      <div
                        key={r.id}
                        className={`bg-[#151D1A] rounded-2xl border shadow-[0_2px_8px_rgba(0,0,0,0.2)] px-4 py-3 ${
                          r.type === 'bono' ? 'border-emerald-800/40' : 'border-rose-800/40'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-semibold text-sm text-[#e6edea] truncate">{r.staff_name}</p>
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                                r.type === 'bono'
                                  ? 'bg-emerald-950/60 border border-emerald-700/50 text-emerald-300'
                                  : 'bg-rose-950/60 border border-rose-700/50 text-rose-300'
                              }`}>
                                {r.type === 'bono' ? 'Bono' : 'Sanción'}
                              </span>
                            </div>
                            <p className="text-xs text-[#7d9990] mt-1 leading-snug">{r.concept}</p>
                            <p className="text-[10px] text-[#7d9990] mt-0.5">{fmtDate(r.record_date)}</p>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <p className={`font-mono font-bold text-base ${r.type === 'bono' ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {r.type === 'bono' ? '+' : '-'}{fmtMXN(r.amount)}
                            </p>
                            <button
                              onClick={() => handleDelete(r.id)}
                              disabled={deleting === r.id}
                              className="text-[#7d9990] hover:text-red-400 transition disabled:opacity-40"
                            >
                              <Trash2 size={15} strokeWidth={2} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
