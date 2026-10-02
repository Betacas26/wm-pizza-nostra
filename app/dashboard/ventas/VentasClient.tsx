'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { submitSaleAction, deleteSaleAction, saveProductSalesAction } from './actions';

// ── Tipos ──────────────────────────────────────────────────────────────────
type SaleShift = 'Matutino' | 'Vespertino';
type ActiveTab = 'productos' | 'caja' | 'hoy' | 'mes';

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

function exportarCSV(records: SaleRecord[], monthLabel: string) {
  const headers = [
    'Fecha', 'Turno', 'Mesero', 'Venta Total',
    'Aporte (4.5%)', 'Cristaleria', 'Total a Entregar',
    'Propina Capitan', 'Sancion %', 'Bono Sancion',
  ];
  const rows = records.map((r) => [
    r.sale_date, r.shift,
    `"${r.staff_name.replace(/"/g, '""')}"`,
    r.total.toFixed(2), r.contribution.toFixed(2),
    r.glassware.toFixed(2), r.to_deliver.toFixed(2),
    r.captain_tip.toFixed(2),
    r.sanction_pct.toFixed(2), r.sanction_amount.toFixed(2),
  ]);
  const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ventas_${monthLabel}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
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
  const [formTotal, setFormTotal] = useState('');
  const [formSanctionPct, setFormSanctionPct] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);

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

  // ── Resumen mensual ────────────────────────────────────────────────────
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [monthSales, setMonthSales] = useState<SaleRecord[]>([]);
  const [monthLoading, setMonthLoading] = useState(false);

  const monthOptions = useMemo(() => {
    const now = new Date();
    const opts: { value: string; label: string }[] = [];
    for (let i = 0; i < 13; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      opts.push({
        value: `${y}-${String(m).padStart(2, '0')}`,
        label: d.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' }),
      });
    }
    return opts;
  }, []);

  const loadMonthSales = useCallback(
    async (ym: string) => {
      setMonthLoading(true);
      const [yearStr, monthStr] = ym.split('-');
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10);
      const firstDay = `${year}-${String(month).padStart(2, '0')}-01`;
      const daysInMonth = new Date(year, month, 0).getDate();
      const lastDay = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

      const { data: salesData } = await supabase
        .from('sales')
        .select(
          'id, sale_date, shift, staff_id, total, contribution, glassware, captain_tip, to_deliver, sanction_pct, sanction_amount',
        )
        .gte('sale_date', firstDay)
        .lte('sale_date', lastDay)
        .order('sale_date', { ascending: true });

      if (!salesData?.length) {
        setMonthSales([]);
        setMonthLoading(false);
        return;
      }

      const staffIds = [
        ...new Set((salesData as { staff_id: string }[]).map((s) => s.staff_id)),
      ];
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', staffIds);

      const nameMap = new Map<string, string>(
        (profilesData ?? []).map((p: { id: string; name: string | null }) => [
          p.id,
          p.name ?? '(sin nombre)',
        ]),
      );

      const records: SaleRecord[] = (
        salesData as {
          id: string;
          sale_date: string;
          shift: string;
          staff_id: string;
          total: number | null;
          contribution: number | null;
          glassware: number | null;
          captain_tip: number | null;
          to_deliver: number | null;
          sanction_pct: number | null;
          sanction_amount: number | null;
        }[]
      ).map((s) => ({
        id: s.id,
        sale_date: s.sale_date,
        shift: s.shift as SaleShift,
        staff_id: s.staff_id,
        staff_name: nameMap.get(s.staff_id) ?? s.staff_id,
        total: Number(s.total) || 0,
        contribution: Number(s.contribution) || 0,
        glassware: Number(s.glassware) || 0,
        captain_tip: Number(s.captain_tip) || 0,
        to_deliver: Number(s.to_deliver) || 0,
        sanction_pct: Number(s.sanction_pct) || 0,
        sanction_amount: Number(s.sanction_amount) || 0,
      }));

      setMonthSales(records);
      setMonthLoading(false);
    },
    [supabase],
  );

  useEffect(() => {
    if (activeTab === 'mes') {
      loadMonthSales(selectedMonth);
    }
  }, [activeTab, selectedMonth, loadMonthSales]);

  const monthSummary = useMemo(() => {
    type StaffAgg = {
      name: string;
      count: number;
      total: number;
      contribution: number;
      glassware: number;
      to_deliver: number;
      captain_tip: number;
      sanction_amount: number;
    };
    const byStaff = new Map<string, StaffAgg>();

    for (const s of monthSales) {
      const existing = byStaff.get(s.staff_id);
      if (existing) {
        existing.count++;
        existing.total += s.total;
        existing.contribution += s.contribution;
        existing.glassware += s.glassware;
        existing.to_deliver += s.to_deliver;
        existing.captain_tip += s.captain_tip;
        existing.sanction_amount += s.sanction_amount;
      } else {
        byStaff.set(s.staff_id, {
          name: s.staff_name,
          count: 1,
          total: s.total,
          contribution: s.contribution,
          glassware: s.glassware,
          to_deliver: s.to_deliver,
          captain_tip: s.captain_tip,
          sanction_amount: s.sanction_amount,
        });
      }
    }

    let grandTotal = 0, grandContrib = 0, grandGlass = 0,
        grandDeliver = 0, grandCaptain = 0, grandSanction = 0;
    for (const v of byStaff.values()) {
      grandTotal += v.total;
      grandContrib += v.contribution;
      grandGlass += v.glassware;
      grandDeliver += v.to_deliver;
      grandCaptain += v.captain_tip;
      grandSanction += v.sanction_amount;
    }

    const r = (n: number) => Math.round(n * 100) / 100;
    return {
      byStaff,
      grandTotal: r(grandTotal),
      grandContrib: r(grandContrib),
      grandGlass: r(grandGlass),
      grandDeliver: r(grandDeliver),
      grandCaptain: r(grandCaptain),
      grandSanction: r(grandSanction),
    };
  }, [monthSales]);

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

    setSaving(true);
    try {
      const inserted = await submitSaleAction({
        sale_date: today,
        shift: formShift,
        staff_id: formStaffId,
        total: rawTotal,
        sanction_pct: parseFloat(formSanctionPct) || 0,
      });

      const record: SaleRecord = {
        id: inserted.id,
        sale_date: today,
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
      setTodaySales((prev) => [record, ...prev]);
      setFormTotal('');
      setFormSanctionPct('');
      setSavedMsg(true);
      setTimeout(() => setSavedMsg(false), 2500);
      setActiveTab('hoy');
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
    { key: 'mes',       label: 'Mes' },
  ];

  return (
    <div className="min-h-screen bg-[#0D1211] text-[#e6edea]">
      {/* Header */}
      <header className="bg-[#151D1A] border-b border-[#223530] px-4 py-3 flex items-center gap-3 shadow-[0_2px_8px_rgba(0,0,0,0.2)] sticky top-0 z-10">
        <Link
          href="/dashboard"
          className="text-[#7d9990] hover:text-[#e6edea] text-xl leading-none"
          aria-label="Volver"
        >
          &#8592;
        </Link>
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

        {/* ── Tab: Mes ─────────────────────────────────────────────────── */}
        {activeTab === 'mes' && (
          <div className="space-y-4 pt-1">
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
                Cargando...
              </div>
            ) : monthSales.length === 0 ? (
              <div className="text-center py-14 text-[#7d9990] text-sm">
                Sin ventas en este mes.
              </div>
            ) : (
              <>
                {[...monthSummary.byStaff.entries()].map(([staffId, agg]) => (
                  <div
                    key={staffId}
                    className="bg-[#151D1A] rounded-2xl border border-[#223530] shadow-[0_2px_8px_rgba(0,0,0,0.2)] p-4"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <p className="font-bold text-[#e6edea] text-sm">{agg.name}</p>
                      <span className="text-xs text-[#7d9990]">
                        {agg.count} registro{agg.count !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-[#7d9990]">Total ventas</span>
                        <span className="font-semibold text-[#e6edea]">
                          {fmtMXN(Math.round(agg.total * 100) / 100)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#7d9990]">Aporte</span>
                        <span className="font-semibold text-[#e6edea]">
                          {fmtMXN(Math.round(agg.contribution * 100) / 100)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#7d9990]">Cristaleria</span>
                        <span className="font-semibold text-[#e6edea]">
                          {fmtMXN(Math.round(agg.glassware * 100) / 100)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-bold text-[#e6edea]">A entregar</span>
                        <span className="font-mono font-bold tracking-tight text-[#E8899A]">
                          {fmtMXN(Math.round(agg.to_deliver * 100) / 100)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#7d9990] italic">Propina Cap.</span>
                        <span className="text-sky-400 font-semibold">
                          {fmtMXN(Math.round(agg.captain_tip * 100) / 100)}
                        </span>
                      </div>
                      {agg.sanction_amount > 0 && (
                        <div className="flex justify-between">
                          <span className="text-orange-400">Bonos retenidos</span>
                          <span className="text-orange-400 font-semibold">
                            {fmtMXN(Math.round(agg.sanction_amount * 100) / 100)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                <div className="bg-[#420F18]/30 border border-[#9E2A3E]/50 rounded-2xl p-4">
                  <p className="text-xs font-bold text-[#E8899A] uppercase tracking-wider mb-3">
                    Totales del mes &middot; {monthSales.length} registros
                  </p>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-[#7d9990]">Total ventas</span>
                      <span className="font-semibold text-[#e6edea]">
                        {fmtMXN(monthSummary.grandTotal)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#7d9990]">Aporte</span>
                      <span className="font-semibold text-[#e6edea]">
                        {fmtMXN(monthSummary.grandContrib)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#7d9990]">Cristaleria</span>
                      <span className="font-semibold text-[#e6edea]">
                        {fmtMXN(monthSummary.grandGlass)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-bold text-[#e6edea]">A entregar</span>
                      <span className="font-mono font-bold tracking-tight text-[#E8899A]">
                        {fmtMXN(monthSummary.grandDeliver)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#7d9990]">Propina Capitan</span>
                      <span className="font-semibold text-sky-400">
                        {fmtMXN(monthSummary.grandCaptain)}
                      </span>
                    </div>
                    {monthSummary.grandSanction > 0 && (
                      <div className="flex justify-between">
                        <span className="text-orange-400">Bonos retenidos</span>
                        <span className="font-bold text-orange-400">
                          {fmtMXN(monthSummary.grandSanction)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => exportarCSV(monthSales, selectedMonth)}
                  className="w-full min-h-[44px] bg-[#1c2b27] border border-[#223530] hover:border-[#7d9990] active:scale-[0.98] text-[#e6edea] font-bold rounded-xl shadow transition duration-150 ease-out select-none text-sm"
                >
                  Exportar CSV
                </button>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
