'use client';

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import Image from 'next/image';
import { ChevronLeft } from 'lucide-react';
import { submitSaleAction, deleteSaleAction, saveProductSalesAction } from './actions';

// ── Tipos ──────────────────────────────────────────────────────────────────
type SaleShift = 'Matutino' | 'Vespertino';
type ActiveTab = 'productos' | 'caja' | 'hoy';

export interface StaffMember {
  id: string;
  name: string;
}

export interface SaleRecord {
  id: string;
  sale_date: string;
  shift: SaleShift;
  staff_id: string;
  staff_name: string;
  total: number;
  contribution: number;
  glassware: number;
  captain_tip: number;
  to_deliver: number;
  sanction_pct: number;
  sanction_amount: number;
}

export interface VentasClientProps {
  staff: StaffMember[];
  initialSales: SaleRecord[];
  isManager: boolean;
  userRole: string;
  today: string;
}


// ── Constantes de negocio ──────────────────────────────────────────────────
const APORTE_PCT = 4.5;
const CRISTALERIA = 10.0;
const CAPITAN_PCT = 0.8;

function calcular(rawTotal: number, rawSanctionPct = 0) {
  const total = isFinite(rawTotal) && rawTotal > 0 ? rawTotal : 0;
  const sanctionPct =
    isFinite(rawSanctionPct) && rawSanctionPct > 0 ? rawSanctionPct : 0;
  const contribution = Math.round(total * APORTE_PCT) / 100;
  const captain_tip = Math.round(total * CAPITAN_PCT) / 100;
  const to_deliver = Math.round((contribution + CRISTALERIA) * 100) / 100;
  const sanction_amount = Math.round(total * sanctionPct) / 100;
  return {
    total,
    contribution,
    glassware: CRISTALERIA,
    captain_tip,
    to_deliver,
    sanction_amount,
  };
}

function fmtMXN(n: number): string {
  return `$${n.toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// ── Keypad ─────────────────────────────────────────────────────────────────
const KEYPAD_KEYS = ['1','2','3','4','5','6','7','8','9','.','0','⌫'];

function KeypadButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <button
      type="button"
      onClick={onPress}
      className="h-14 rounded-xl bg-[#1c2b27] border border-[#223530] text-[#e6edea] font-bold text-xl active:scale-[0.95] active:bg-[#223530] transition duration-100 ease-out select-none"
    >
      {label}
    </button>
  );
}

// ── Componente ─────────────────────────────────────────────────────────────
export default function VentasClient({
  staff,
  initialSales,
  isManager,
  userRole,
  today,
}: VentasClientProps) {
  const supabase = useMemo(() => createClient(), []);

  const [activeTab, setActiveTab] = useState<ActiveTab>('productos');

  // ── Productos del Día state ─────────────────────────────────────────────
  const [prodStaffId, setProdStaffId] = useState(staff[0]?.id ?? '');
  const [dbProducts, setDbProducts] = useState<{ id: string; name: string; category: string }[]>([]);
  const [dbProductsLoading, setDbProductsLoading] = useState(true);
  const [selectedProductName, setSelectedProductName] = useState('');
  const [quantities, setQuantities] = useState<Map<string, number>>(new Map());
  const [prodSaving, setProdSaving] = useState(false);
  const [prodSavedMsg, setProdSavedMsg] = useState(false);

  useEffect(() => {
    supabase
      .from('products')
      .select('id, name, category')
      .eq('active', true)
      .order('category', { ascending: true })
      .order('name', { ascending: true })
      .then(({ data }) => {
        const products = (data ?? []) as { id: string; name: string; category: string }[];
        setDbProducts(products);
        if (products.length > 0) setSelectedProductName(products[0].name);
        setDbProductsLoading(false);
      });
  }, [supabase]);

  const totalItems = useMemo(
    () => [...quantities.values()].reduce((a, b) => a + b, 0),
    [quantities],
  );

  function changeQty(productName: string, delta: number) {
    setQuantities((prev) => {
      const next = new Map(prev);
      const cur = next.get(productName) ?? 0;
      const val = cur + delta;
      if (val <= 0) next.delete(productName);
      else next.set(productName, val);
      return next;
    });
  }

  function handleAddProduct() {
    if (!selectedProductName) return;
    changeQty(selectedProductName, 1);
  }

  async function handleSaveProductos() {
    if (!prodStaffId || quantities.size === 0) return;
    setProdSaving(true);
    try {
      const items = [...quantities.entries()].map(([product_name, quantity]) => ({
        category: dbProducts.find((p) => p.name === product_name)?.category ?? 'General',
        product_name,
        quantity,
      }));
      await saveProductSalesAction({ sale_date: today, staff_id: prodStaffId, items });
      setQuantities(new Map());
      setProdSavedMsg(true);
      setTimeout(() => setProdSavedMsg(false), 2500);
    } catch {
      // silent
    }
    setProdSaving(false);
  }

  // ── Cierre de Caja state ────────────────────────────────────────────────
  const [formStaffId, setFormStaffId] = useState(staff[0]?.id ?? '');
  const [formShift, setFormShift] = useState<SaleShift>('Matutino');
  const [formSaleDate, setFormSaleDate] = useState(today);
  const [formTotal, setFormTotal] = useState('');
  const [formSanctionPct, setFormSanctionPct] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);
  const [dateError, setDateError] = useState('');

  // Compute min date for mesero (3 days back); managers have no limit
  const minSaleDate = useMemo(() => {
    if (userRole === 'mesero') {
      const d = new Date(today + 'T00:00:00Z');
      d.setUTCDate(d.getUTCDate() - 3);
      return d.toISOString().split('T')[0];
    }
    return undefined;
  }, [today, userRole]);

  const liveCalc = useMemo(() => {
    const n = parseFloat(formTotal);
    if (!isFinite(n) || n <= 0) return null;
    const s = parseFloat(formSanctionPct) || 0;
    return calcular(n, s);
  }, [formTotal, formSanctionPct]);

  function handleKeypad(key: string) {
    if (key === '⌫') {
      setFormTotal((prev) => prev.slice(0, -1));
      return;
    }
    if (key === '.') {
      setFormTotal((prev) => (prev.includes('.') ? prev : prev + '.'));
      return;
    }
    setFormTotal((prev) => {
      if (prev.length >= 9) return prev;
      const dotIdx = prev.indexOf('.');
      if (dotIdx !== -1 && prev.length - dotIdx > 2) return prev;
      return prev + key;
    });
  }

  // ── Ventas del dia ─────────────────────────────────────────────────────
  const [todaySales, setTodaySales] = useState<SaleRecord[]>(initialSales);

  const dayTotals = useMemo(() => {
    const r = (n: number) => Math.round(n * 100) / 100;
    return {
      total: r(todaySales.reduce((a, s) => a + s.total, 0)),
      to_deliver: r(todaySales.reduce((a, s) => a + s.to_deliver, 0)),
      captain_tip: r(todaySales.reduce((a, s) => a + s.captain_tip, 0)),
      sanction_amount: r(todaySales.reduce((a, s) => a + s.sanction_amount, 0)),
    };
  }, [todaySales]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!formStaffId || !formTotal) return;
    const rawTotal = parseFloat(formTotal);
    if (!isFinite(rawTotal) || rawTotal <= 0) return;

    // Client-side date validation for mesero
    if (userRole === 'mesero') {
      const todayMs = new Date(today + 'T00:00:00Z').getTime();
      const saleDateMs = new Date(formSaleDate + 'T00:00:00Z').getTime();
      const diffDays = Math.floor((todayMs - saleDateMs) / 86_400_000);
      if (diffDays > 3 || saleDateMs > todayMs) {
        setDateError('Solo puedes registrar ventas de los últimos 3 días.');
        return;
      }
    }
    setDateError('');

    setSaving(true);
    try {
      const inserted = await submitSaleAction({
        sale_date: formSaleDate,
        shift: formShift,
        staff_id: formStaffId,
        total: rawTotal,
        sanction_pct: parseFloat(formSanctionPct) || 0,
      });

      const record: SaleRecord = {
        id: inserted.id,
        sale_date: formSaleDate,
        shift: formShift,
        staff_id: formStaffId,
        staff_name:
          staff.find((s) => s.id === formStaffId)?.name ?? formStaffId,
        total: Number(inserted.total) || 0,
        contribution: Number(inserted.contribution) || 0,
        glassware: Number(inserted.glassware) || 0,
        captain_tip: Number(inserted.captain_tip) || 0,
        to_deliver: Number(inserted.to_deliver) || 0,
        sanction_pct: Number(inserted.sanction_pct) || 0,
        sanction_amount: Number(inserted.sanction_amount) || 0,
      };
      // Only add to today's list if sale date is today
      if (formSaleDate === today) {
        setTodaySales((prev) => [record, ...prev]);
      }
      setFormTotal('');
      setFormSanctionPct('');
      setSavedMsg(true);
      setTimeout(() => setSavedMsg(false), 2500);
      if (formSaleDate === today) setActiveTab('hoy');
    } catch {
      // silent
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!window.confirm('¿Eliminar esta venta?')) return;
    try {
      await deleteSaleAction(id);
      setTodaySales((prev) => prev.filter((s) => s.id !== id));
    } catch {
      // silent
    }
  }

  const tabs: { key: ActiveTab; label: string }[] = [
    { key: 'productos', label: 'Productos' },
    { key: 'caja',      label: 'Cierre' },
    { key: 'hoy',       label: `Hoy\u00a0(${todaySales.length})` },
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
          <h1 className="font-extrabold text-[#E8899A] text-lg leading-tight">
            Ventas
          </h1>
          <p className="text-xs text-[#7d9990]">{today}</p>
        </div>
        {(savedMsg || prodSavedMsg) && (
          <span className="text-xs font-semibold text-emerald-400">
            &#10003; Guardado
          </span>
        )}
      </header>

      {/* Tabs */}
      <div className="bg-[#151D1A] border-b border-[#223530] sticky top-[57px] z-10 px-4 py-2">
        <div className="p-1 bg-[#0a0f0e] rounded-xl flex">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 h-9 rounded-lg text-xs font-semibold transition duration-150 ease-out active:scale-[0.98] select-none ${
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

      <main className="p-4 max-w-xl mx-auto">

        {/* ── Tab: Productos del Día ───────────────────────────────────── */}
        {activeTab === 'productos' && (
          <div className="space-y-4 pt-1">
            {/* Mesero */}
            <div>
              <label className="block text-xs font-bold text-[#7d9990] uppercase tracking-wider mb-1.5">
                Mesero
              </label>
              <select
                value={prodStaffId}
                onChange={(e) => setProdStaffId(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-[#223530] bg-[#1c2b27] text-[#e6edea] text-base focus:outline-none focus:ring-2 focus:ring-[#7A1D2E]"
              >
                <option value="">Seleccionar...</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            {/* Agregar producto */}
            <div>
              <label className="block text-xs font-bold text-[#7d9990] uppercase tracking-wider mb-1.5">
                Agregar producto
              </label>
              {dbProductsLoading ? (
                <p className="text-xs text-[#7d9990] py-2">Cargando catalogo...</p>
              ) : dbProducts.length === 0 ? (
                <p className="text-xs text-[#7d9990] py-2">
                  Sin productos activos.{' '}
                  <a href="/dashboard/productos" className="text-[#E8899A] underline">
                    Configurar en Productos
                  </a>
                </p>
              ) : (
                <div className="flex gap-2">
                  <select
                    value={selectedProductName}
                    onChange={(e) => setSelectedProductName(e.target.value)}
                    className="flex-1 min-h-[44px] px-3 py-2 rounded-xl border border-[#223530] bg-[#1c2b27] text-[#e6edea] text-sm focus:outline-none focus:ring-2 focus:ring-[#7A1D2E]"
                  >
                    {dbProducts.map((p) => (
                      <option key={p.id} value={p.name}>{p.name}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleAddProduct}
                    disabled={!selectedProductName}
                    className="shrink-0 min-h-[44px] px-4 bg-[#7A1D2E] hover:bg-[#9E2A3E] active:scale-[0.98] text-white font-bold rounded-xl shadow transition duration-150 ease-out disabled:opacity-40 text-sm"
                  >
                    + Agregar
                  </button>
                </div>
              )}
            </div>

            {/* Lista de productos agregados */}
            {quantities.size > 0 && (
              <div className="bg-[#151D1A] rounded-2xl border border-[#223530] overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.2)]">
                <div className="px-4 py-2.5 border-b border-[#223530]">
                  <p className="text-xs font-bold text-[#7d9990] uppercase tracking-wider">
                    Productos seleccionados
                  </p>
                </div>
                <ul className="divide-y divide-[#223530]">
                  {[...quantities.entries()].map(([productName, qty]) => (
                    <li key={productName} className="px-4 py-3 flex items-center gap-3">
                      <p className="flex-1 text-sm font-medium text-[#e6edea] min-w-0 leading-tight">
                        {productName}
                      </p>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => changeQty(productName, -1)}
                          className="w-9 h-9 rounded-xl bg-[#1c2b27] border border-[#223530] text-[#e6edea] font-bold text-lg flex items-center justify-center active:scale-[0.95] transition"
                        >
                          −
                        </button>
                        <span className="w-7 text-center font-mono font-bold text-base text-[#E8899A]">
                          {qty}
                        </span>
                        <button
                          type="button"
                          onClick={() => changeQty(productName, 1)}
                          className="w-9 h-9 rounded-xl bg-[#7A1D2E] border border-[#9E2A3E]/60 text-white font-bold text-lg flex items-center justify-center active:scale-[0.95] transition"
                        >
                          +
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="px-4 py-2.5 border-t border-[#223530] flex justify-between items-center">
                  <span className="text-xs text-[#7d9990]">Total</span>
                  <span className="font-mono font-bold text-[#E8899A]">{totalItems} piezas</span>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={handleSaveProductos}
              disabled={prodSaving || !prodStaffId || quantities.size === 0}
              className="w-full min-h-[52px] bg-[#7A1D2E] hover:bg-[#9E2A3E] active:scale-[0.98] text-white font-bold rounded-xl shadow transition duration-150 ease-out select-none text-sm disabled:opacity-40"
            >
              {prodSaving ? 'Guardando...' : 'Guardar productos del dia'}
            </button>
          </div>
        )}

        {/* ── Tab: Cierre de Caja ──────────────────────────────────────── */}
        {activeTab === 'caja' && (
          <form onSubmit={handleSubmit} className="space-y-4 pt-1">
            {/* Mesero */}
            <div>
              <label className="block text-xs font-bold text-[#7d9990] uppercase tracking-wider mb-1.5">
                Mesero
              </label>
              <select
                value={formStaffId}
                onChange={(e) => setFormStaffId(e.target.value)}
                required
                className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-[#223530] bg-[#1c2b27] text-[#e6edea] text-base focus:outline-none focus:ring-2 focus:ring-[#7A1D2E]"
              >
                <option value="">Seleccionar...</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Turno */}
            <div>
              <label className="block text-xs font-bold text-[#7d9990] uppercase tracking-wider mb-1.5">
                Turno
              </label>
              <div className="flex gap-2">
                {(['Matutino', 'Vespertino'] as SaleShift[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setFormShift(s)}
                    className={`flex-1 min-h-[44px] rounded-xl font-semibold text-sm transition duration-150 ease-out active:scale-[0.98] select-none ${
                      formShift === s
                        ? s === 'Matutino'
                          ? 'bg-[#7A1D2E] border border-[#9E2A3E]/60 text-white shadow-sm'
                          : 'bg-sky-600 text-white shadow-sm'
                        : 'bg-[#1c2b27] border border-[#223530] text-[#7d9990] hover:text-[#e6edea]'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Fecha */}
            <div>
              <label className="block text-xs font-bold text-[#7d9990] uppercase tracking-wider mb-1.5">
                Fecha
              </label>
              <input
                type="date"
                value={formSaleDate}
                max={today}
                min={minSaleDate}
                onChange={(e) => {
                  setFormSaleDate(e.target.value);
                  setDateError('');
                }}
                className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-[#223530] bg-[#1c2b27] text-[#e6edea] text-base focus:outline-none focus:ring-2 focus:ring-[#7A1D2E]"
              />
              {dateError && (
                <p className="text-xs text-red-400 mt-1">{dateError}</p>
              )}
              {formSaleDate !== today && (
                <p className="text-xs text-amber-400 mt-1">
                  Registrando venta para fecha pasada: {formSaleDate}
                </p>
              )}
            </div>

            {/* Teclado POS */}
            <div>
              <label className="block text-xs font-bold text-[#7d9990] uppercase tracking-wider mb-1.5">
                Venta Total
              </label>

              <div className="bg-[#0a0f0e] border border-[#223530] rounded-xl px-4 py-3 mb-3 text-center">
                <span className="font-mono font-black text-3xl text-[#e6edea] tracking-tight">
                  ${formTotal || '0'}
                </span>
              </div>

              {liveCalc ? (
                <div className="bg-[#1c2b27] border border-[#223530] rounded-xl px-4 py-3 mb-3 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-[#7d9990]">Aporte ({APORTE_PCT}%)</span>
                    <span className="font-semibold text-[#e6edea]">
                      {fmtMXN(liveCalc.contribution)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-[#7d9990]">Cristaleria (fijo)</span>
                    <span className="font-semibold text-[#e6edea]">
                      {fmtMXN(liveCalc.glassware)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm border-t border-[#223530] pt-2">
                    <span className="font-bold text-[#e6edea]">Total a entregar</span>
                    <span className="font-mono font-bold text-xl text-[#E8899A]">
                      {fmtMXN(liveCalc.to_deliver)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs pt-0.5">
                    <span className="text-[#7d9990] italic">
                      Propina Capitan ({CAPITAN_PCT}% — info)
                    </span>
                    <span className="text-[#7d9990] italic">
                      {fmtMXN(liveCalc.captain_tip)}
                    </span>
                  </div>
                  {liveCalc.sanction_amount > 0 && (
                    <div className="flex justify-between text-xs bg-orange-950/40 border border-orange-800/50 rounded-xl px-3 py-2 mt-1">
                      <span className="text-orange-300 font-semibold">
                        Bono sancion ({parseFloat(formSanctionPct).toFixed(1)}%) — retenido
                      </span>
                      <span className="text-orange-300 font-bold">
                        {fmtMXN(liveCalc.sanction_amount)}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-[#0a0f0e] border border-dashed border-[#223530] rounded-xl p-3 text-center text-xs text-[#7d9990] mb-3">
                  Ingresa el monto para ver el calculo
                </div>
              )}

              <div className="grid grid-cols-3 gap-2">
                {KEYPAD_KEYS.map((key) => (
                  <KeypadButton
                    key={key}
                    label={key}
                    onPress={() => handleKeypad(key)}
                  />
                ))}
              </div>
            </div>

            {isManager && (
              <div>
                <label className="block text-xs font-bold text-[#7d9990] uppercase tracking-wider mb-1.5">
                  Sancion adicional (%) — se separa como bono
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={formSanctionPct}
                  onChange={(e) => setFormSanctionPct(e.target.value)}
                  placeholder="0 (opcional)"
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-[#223530] bg-[#1c2b27] text-[#e6edea] text-base focus:outline-none focus:ring-2 focus:ring-[#7A1D2E]"
                />
                <p className="text-[11px] text-[#7d9990] mt-1">
                  El 4.5% base siempre se entrega. El % adicional se registra aparte.
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={saving || !formStaffId || !formTotal}
              className="w-full min-h-[52px] bg-[#7A1D2E] hover:bg-[#9E2A3E] active:scale-[0.98] text-white font-bold rounded-xl shadow transition duration-150 ease-out select-none text-sm disabled:opacity-40"
            >
              {saving ? 'Guardando...' : 'Guardar venta'}
            </button>
          </form>
        )}

        {/* ── Tab: Hoy ────────────────────────────────────────────────── */}
        {activeTab === 'hoy' && (
          <div className="space-y-3 pt-1">
            {todaySales.length === 0 ? (
              <div className="text-center py-14 text-[#7d9990] text-sm">
                Sin ventas registradas hoy.
              </div>
            ) : (
              <>
                <div className="bg-[#420F18]/30 border border-[#9E2A3E]/50 rounded-2xl p-4">
                  <p className="text-xs font-bold text-[#E8899A] uppercase tracking-wider mb-3">
                    Resumen del dia
                  </p>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-[#7d9990] mb-0.5">Total ventas</p>
                      <p className="font-mono font-bold tracking-tight text-[#e6edea]">
                        {fmtMXN(dayTotals.total)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-[#7d9990] mb-0.5">A entregar total</p>
                      <p className="font-mono font-bold tracking-tight text-[#E8899A]">
                        {fmtMXN(dayTotals.to_deliver)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-[#7d9990] mb-0.5">Propina Capitan</p>
                      <p className="font-mono font-bold tracking-tight text-sky-400">
                        {fmtMXN(dayTotals.captain_tip)}
                      </p>
                    </div>
                    {dayTotals.sanction_amount > 0 && (
                      <div>
                        <p className="text-xs text-[#7d9990] mb-0.5">Bonos retenidos</p>
                        <p className="font-bold text-orange-400">
                          {fmtMXN(dayTotals.sanction_amount)}
                        </p>
                      </div>
                    )}
                    <div>
                      <p className="text-xs text-[#7d9990] mb-0.5">Registros</p>
                      <p className="font-bold text-[#e6edea]">{todaySales.length}</p>
                    </div>
                  </div>
                </div>

                {todaySales.map((sale) => (
                  <div
                    key={sale.id}
                    className="bg-[#151D1A] rounded-2xl border border-[#223530] shadow-[0_2px_8px_rgba(0,0,0,0.2)] p-4"
                  >
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div>
                        <p className="font-bold text-[#e6edea] text-sm">
                          {sale.staff_name}
                        </p>
                        <span
                          className={`mt-1 inline-block text-xs px-2 py-0.5 rounded-full font-medium ${
                            sale.shift === 'Matutino'
                              ? 'bg-[#420F18]/80 border border-[#9E2A3E]/60 text-[#E8899A]'
                              : 'bg-sky-950/60 border border-sky-700/50 text-sky-300'
                          }`}
                        >
                          {sale.shift}
                        </span>
                      </div>
                      {isManager && (
                        <button
                          onClick={() => handleDelete(sale.id)}
                          className="shrink-0 text-xs font-semibold text-red-500 hover:text-red-400 px-2 py-1 rounded-lg hover:bg-red-950/40 transition"
                        >
                          Eliminar
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-[#7d9990]">Venta</span>
                        <span className="font-semibold text-[#e6edea]">
                          {fmtMXN(sale.total)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#7d9990]">Aporte</span>
                        <span className="font-semibold text-[#e6edea]">
                          {fmtMXN(sale.contribution)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#7d9990]">Cristaleria</span>
                        <span className="font-semibold text-[#e6edea]">
                          {fmtMXN(sale.glassware)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-bold text-[#e6edea]">A entregar</span>
                        <span className="font-bold text-[#E8899A]">
                          {fmtMXN(sale.to_deliver)}
                        </span>
                      </div>
                      <div className="flex justify-between col-span-2 pt-1.5 mt-0.5 border-t border-[#223530]">
                        <span className="text-[#7d9990] italic">
                          Propina Cap. (info)
                        </span>
                        <span className="text-[#7d9990] italic">
                          {fmtMXN(sale.captain_tip)}
                        </span>
                      </div>
                      {sale.sanction_amount > 0 && (
                        <div className="flex justify-between col-span-2 text-orange-400">
                          <span className="font-semibold">
                            Bono sancion ({sale.sanction_pct}%)
                          </span>
                          <span className="font-bold">
                            {fmtMXN(sale.sanction_amount)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
