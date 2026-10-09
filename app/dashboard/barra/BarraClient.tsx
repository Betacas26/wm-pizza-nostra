'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  ChevronLeft,
  AlertTriangle,
  Package,
  ClipboardList,
  Plus,
  X,
  Trash2,
  CalendarDays,
  BarChart2,
} from 'lucide-react';
import {
  updateInventoryStockAction,
  updateInventoryMinStockAction,
  updateInventoryBottleMlAction,
  updateInventoryProductNameAction,
  updateInventoryCategoryUnitAction,
  recordMermaAction,
  addInventoryProductAction,
  deleteInventoryProductAction,
} from './actions';

export interface InventoryItem {
  id: string;
  product_name: string;
  category: string;
  unit: string;
  bottle_ml: number;
  stock: number;
  min_stock: number;
}

export interface MermaRecord {
  id: string;
  product_name: string;
  quantity: number;
  reason: string;
  created_at: string;
}

interface Props {
  inventory: InventoryItem[];
  mermasHoy: MermaRecord[];
  today: string;
}

const REASONS = ['Rotura', 'Derrame', 'Vencimiento', 'Error de registro', 'Otro'];

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Mexico_City',
  });
}

const CARD = 'bg-[#151D1A] rounded-2xl border border-[#223530] shadow-[0_2px_8px_rgba(0,0,0,0.2)]';
const INPUT = 'w-full bg-[#0a0f0e] border border-[#223530] rounded-xl px-3 py-2.5 text-sm text-[#e6edea] focus:outline-none focus:ring-2 focus:ring-[#B8324B]';

export default function BarraClient({ inventory: initInventory, mermasHoy: initMermas, today }: Props) {
  const [tab, setTab] = useState(0);
  const [inventory, setInventory] = useState<InventoryItem[]>(initInventory);
  const [mermas, setMermas] = useState<MermaRecord[]>(initMermas);

  // Ingresado / Salida per product
  const [adjusting, setAdjusting] = useState<string | null>(null);
  const [adjustments, setAdjustments] = useState<Record<string, { ingresado: string; salida: string }>>({});

  // Merma form
  const [mermaProductId, setMermaProductId] = useState('');
  const [mermaQty, setMermaQty] = useState('');
  const [mermaReason, setMermaReason] = useState(REASONS[0]);
  const [mermaSubmitting, setMermaSubmitting] = useState(false);
  const [mermaError, setMermaError] = useState('');

  // Add product form
  const [showAddForm, setShowAddForm] = useState(false);
  const [addName, setAddName] = useState('');
  const [addCategory, setAddCategory] = useState('licores');
  const [addUnit, setAddUnit] = useState('botellas');
  const [addBottleMl, setAddBottleMl] = useState('750');
  const [addStock, setAddStock] = useState('0');
  const [addMinStock, setAddMinStock] = useState('1');
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [addError, setAddError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Inline edit states
  const [editingMinId, setEditingMinId] = useState<string | null>(null);
  const [editingMinValue, setEditingMinValue] = useState('');
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [editingNameValue, setEditingNameValue] = useState('');
  const [editingMetaId, setEditingMetaId] = useState<string | null>(null);
  const [editingCategory, setEditingCategory] = useState('');
  const [editingUnit, setEditingUnit] = useState('');
  const [editingMlId, setEditingMlId] = useState<string | null>(null);
  const [editingMlValue, setEditingMlValue] = useState('');

  const lowStock = inventory.filter((i) => i.stock < i.min_stock);

  function setAdj(id: string, field: 'ingresado' | 'salida', value: string) {
    setAdjustments((prev) => ({
      ...prev,
      [id]: { ...{ ingresado: '', salida: '' }, ...prev[id], [field]: value },
    }));
  }

  async function handleAdjust(item: InventoryItem) {
    const adj = adjustments[item.id];
    const ingresado = parseFloat(adj?.ingresado || '0') || 0;
    const salida = parseFloat(adj?.salida || '0') || 0;
    if (ingresado === 0 && salida === 0) return;
    const newStock = Math.max(0, parseFloat((item.stock + ingresado - salida).toFixed(2)));

    setInventory((prev) => prev.map((i) => (i.id === item.id ? { ...i, stock: newStock } : i)));
    setAdjustments((prev) => { const n = { ...prev }; delete n[item.id]; return n; });
    setAdjusting(item.id);
    try {
      await updateInventoryStockAction(item.id, newStock);
    } catch {
      setInventory((prev) => prev.map((i) => (i.id === item.id ? { ...i, stock: item.stock } : i)));
    } finally {
      setAdjusting(null);
    }
  }

  async function handleMermaSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMermaError('');
    const qty = parseFloat(mermaQty);
    if (!mermaProductId || isNaN(qty) || qty <= 0) {
      setMermaError('Selecciona un producto y una cantidad válida.');
      return;
    }
    const product = inventory.find((i) => i.id === mermaProductId);
    if (!product) return;
    setMermaSubmitting(true);
    try {
      const newMerma = await recordMermaAction({
        inventoryId: mermaProductId,
        productName: product.product_name,
        quantity: qty,
        reason: mermaReason,
      });
      setMermas((prev) => [newMerma, ...prev]);
      setInventory((prev) =>
        prev.map((i) =>
          i.id === mermaProductId
            ? { ...i, stock: Math.max(0, parseFloat((i.stock - qty).toFixed(2))) }
            : i,
        ),
      );
      setMermaQty('');
      setMermaProductId('');
    } catch (err) {
      setMermaError(err instanceof Error ? err.message : 'Error al registrar merma.');
    } finally {
      setMermaSubmitting(false);
    }
  }

  async function handleAddProduct(e: React.FormEvent) {
    e.preventDefault();
    setAddError('');
    if (!addName.trim()) { setAddError('El nombre es obligatorio.'); return; }
    const stock = parseFloat(addStock);
    const minStock = parseFloat(addMinStock);
    if (isNaN(stock) || stock < 0) { setAddError('Stock inicial inválido.'); return; }
    if (isNaN(minStock) || minStock < 0) { setAddError('Stock mínimo inválido.'); return; }
    const bottleMl = parseInt(addBottleMl, 10);
    if (isNaN(bottleMl) || bottleMl <= 0) { setAddError('Mililitros inválidos.'); return; }
    setAddSubmitting(true);
    try {
      const newItem = await addInventoryProductAction({
        product_name: addName,
        category: addCategory,
        unit: addUnit,
        bottle_ml: bottleMl,
        stock,
        min_stock: minStock,
      });
      setInventory((prev) => [...prev, newItem]);
      setAddName('');
      setAddBottleMl('750');
      setAddStock('0');
      setAddMinStock('1');
      setShowAddForm(false);
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Error al agregar producto.');
    } finally {
      setAddSubmitting(false);
    }
  }

  async function handleSaveMeta(item: InventoryItem) {
    const prev = { category: item.category, unit: item.unit };
    setInventory((inv) => inv.map((i) => i.id === item.id ? { ...i, category: editingCategory, unit: editingUnit } : i));
    setEditingMetaId(null);
    try {
      await updateInventoryCategoryUnitAction(item.id, editingCategory, editingUnit);
    } catch {
      setInventory((inv) => inv.map((i) => i.id === item.id ? { ...i, ...prev } : i));
    }
  }

  async function handleSaveBottleMl(item: InventoryItem) {
    const val = parseInt(editingMlValue, 10);
    if (isNaN(val) || val <= 0) { setEditingMlId(null); return; }
    const prev = item.bottle_ml;
    setInventory((inv) => inv.map((i) => i.id === item.id ? { ...i, bottle_ml: val } : i));
    setEditingMlId(null);
    try {
      await updateInventoryBottleMlAction(item.id, val);
    } catch {
      setInventory((inv) => inv.map((i) => i.id === item.id ? { ...i, bottle_ml: prev } : i));
    }
  }

  async function handleSaveProductName(item: InventoryItem) {
    const newName = editingNameValue.trim();
    if (!newName) { setEditingNameId(null); return; }
    const prev = item.product_name;
    setInventory((inv) => inv.map((i) => i.id === item.id ? { ...i, product_name: newName } : i));
    setEditingNameId(null);
    try {
      await updateInventoryProductNameAction(item.id, newName);
    } catch {
      setInventory((inv) => inv.map((i) => i.id === item.id ? { ...i, product_name: prev } : i));
    }
  }

  async function handleSaveMinStock(item: InventoryItem) {
    const val = parseFloat(editingMinValue);
    if (isNaN(val) || val < 0) { setEditingMinId(null); return; }
    const prev = item.min_stock;
    setInventory((inv) => inv.map((i) => i.id === item.id ? { ...i, min_stock: val } : i));
    setEditingMinId(null);
    try {
      await updateInventoryMinStockAction(item.id, val);
    } catch {
      setInventory((inv) => inv.map((i) => i.id === item.id ? { ...i, min_stock: prev } : i));
    }
  }

  async function handleDeleteProduct(id: string, name: string) {
    if (!window.confirm(`¿Eliminar "${name}" del inventario?`)) return;
    setDeletingId(id);
    try {
      await deleteInventoryProductAction(id);
      setInventory((prev) => prev.filter((i) => i.id !== id));
    } catch {
      // silent
    } finally {
      setDeletingId(null);
    }
  }

  const categories = Array.from(new Set(inventory.map((i) => i.category)));

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
          <h1 className="font-extrabold text-[#E8899A] text-lg leading-tight">Barra</h1>
          <p className="text-xs text-[#7d9990]">
            {today}
            {lowStock.length > 0 && (
              <span className="ml-1 font-semibold text-amber-400">
                &middot; {lowStock.length} bajo stock
              </span>
            )}
          </p>
        </div>
      </header>

      {/* Low stock alert */}
      {lowStock.length > 0 && (
        <div className="mx-3 mt-3 flex items-start gap-2 bg-amber-950/50 border border-amber-700/60 rounded-xl px-3 py-2.5">
          <AlertTriangle size={16} strokeWidth={2} className="text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-300">
            <span className="font-bold">Desabasto detectado:</span>{' '}
            {lowStock.map((i) => i.product_name).join(', ')}
          </div>
        </div>
      )}

      {/* Shortcuts */}
      <div className="px-3 pt-3 flex gap-2">
        <Link
          href="/dashboard/barra/diario"
          className="flex-1 flex items-center gap-2.5 bg-[#151D1A] border border-[#223530] hover:border-[#7A1D2E]/60 rounded-2xl px-3 py-3 transition active:scale-[0.98] select-none"
        >
          <CalendarDays size={20} strokeWidth={1.5} className="text-[#E8899A] shrink-0" />
          <div className="min-w-0">
            <p className="font-bold text-sm text-[#e6edea]">Inventario Diario</p>
            <p className="text-xs text-[#7d9990]">Inicial y Arrastre</p>
          </div>
        </Link>
        <Link
          href="/dashboard/barra/reportes"
          className="flex-1 flex items-center gap-2.5 bg-[#151D1A] border border-[#223530] hover:border-[#7A1D2E]/60 rounded-2xl px-3 py-3 transition active:scale-[0.98] select-none"
        >
          <BarChart2 size={20} strokeWidth={1.5} className="text-[#E8899A] shrink-0" />
          <div className="min-w-0">
            <p className="font-bold text-sm text-[#e6edea]">Reportes</p>
            <p className="text-xs text-[#7d9990]">Consumo por fecha</p>
          </div>
        </Link>
      </div>

      {/* Tab bar */}
      <div className="px-3 pt-3">
        <div className="p-1 bg-[#0a0f0e] rounded-xl flex">
          {['Inventario', 'Mermas'].map((label, i) => (
            <button
              key={label}
              onClick={() => setTab(i)}
              className={`flex-1 h-9 rounded-lg text-xs font-semibold transition duration-150 ease-out active:scale-[0.98] select-none flex items-center justify-center gap-1.5 ${
                tab === i ? 'bg-[#7A1D2E] text-white shadow-sm' : 'text-[#7d9990] hover:text-[#e6edea]'
              }`}
            >
              {i === 0 ? <Package size={13} strokeWidth={2} /> : <ClipboardList size={13} strokeWidth={2} />}
              {label}
            </button>
          ))}
        </div>
      </div>

      <main className="p-3 max-w-xl mx-auto space-y-3 pb-8">
        {/* ── Inventario ── */}
        {tab === 0 && (
          <>
            {/* Agregar producto */}
            {!showAddForm ? (
              <button
                onClick={() => setShowAddForm(true)}
                className="w-full min-h-[44px] rounded-xl border border-dashed border-[#223530] text-[#7d9990] hover:text-[#e6edea] hover:border-[#7A1D2E] text-sm font-semibold flex items-center justify-center gap-2 transition active:scale-[0.98]"
              >
                <Plus size={15} strokeWidth={2.5} />
                Agregar producto al inventario
              </button>
            ) : (
              <div className={`${CARD} p-4`}>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-bold text-[#7d9990] uppercase tracking-wider">Nuevo producto</p>
                  <button onClick={() => { setShowAddForm(false); setAddError(''); }} className="text-[#7d9990] hover:text-[#e6edea] transition">
                    <X size={16} strokeWidth={2} />
                  </button>
                </div>
                <form onSubmit={handleAddProduct} className="space-y-2.5">
                  <input
                    type="text"
                    placeholder="Nombre del producto *"
                    value={addName}
                    onChange={(e) => setAddName(e.target.value)}
                    className={INPUT}
                  />
                  <div className="flex gap-2">
                    <select value={addCategory} onChange={(e) => setAddCategory(e.target.value)} className={`${INPUT} flex-1 appearance-none`}>
                      {['licores', 'cervezas', 'vinos', 'refrescos', 'mixers', 'otros'].map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                    <select value={addUnit} onChange={(e) => setAddUnit(e.target.value)} className={`${INPUT} flex-1 appearance-none`}>
                      {['botellas', 'cajas', 'piezas', 'litros', 'kg', 'latas'].map((u) => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>
                  </div>
                  {/* Bottle ml */}
                  <div>
                    <label className="block text-[10px] text-[#7d9990] mb-1.5 uppercase tracking-wider">Mililitros por botella</label>
                    <div className="flex gap-1.5 flex-wrap">
                      {[200, 375, 500, 700, 750, 1000, 1750].map((ml) => (
                        <button
                          key={ml}
                          type="button"
                          onClick={() => setAddBottleMl(String(ml))}
                          className={`h-8 px-3 rounded-lg text-xs font-semibold transition active:scale-[0.95] select-none ${
                            addBottleMl === String(ml)
                              ? 'bg-[#7A1D2E] text-white border border-[#9E2A3E]/60'
                              : 'bg-[#1c2b27] border border-[#223530] text-[#7d9990] hover:text-[#e6edea]'
                          }`}
                        >{ml}ml</button>
                      ))}
                      <input
                        type="number"
                        min="1"
                        placeholder="Otro"
                        value={[200, 375, 500, 700, 750, 1000, 1750].includes(parseInt(addBottleMl)) ? '' : addBottleMl}
                        onChange={(e) => setAddBottleMl(e.target.value)}
                        className="w-20 h-8 bg-[#0a0f0e] border border-[#223530] rounded-lg px-2 text-xs text-[#e6edea] focus:outline-none focus:ring-2 focus:ring-[#B8324B] placeholder:text-[#4a6560]"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="block text-[10px] text-[#7d9990] mb-1 uppercase tracking-wider">Stock inicial</label>
                      <input type="number" min="0" step="0.25" value={addStock} onChange={(e) => setAddStock(e.target.value)} className={INPUT} />
                    </div>
                    <div className="flex-1">
                      <label className="block text-[10px] text-[#7d9990] mb-1 uppercase tracking-wider">Stock mínimo</label>
                      <input type="number" min="0" step="0.25" value={addMinStock} onChange={(e) => setAddMinStock(e.target.value)} className={INPUT} />
                    </div>
                  </div>
                  {addError && <p className="text-xs text-red-400">{addError}</p>}
                  <button
                    type="submit"
                    disabled={addSubmitting}
                    className="w-full min-h-[44px] rounded-xl bg-[#7A1D2E] hover:bg-[#9E2A3E] active:scale-[0.98] text-white font-bold text-sm transition duration-150 ease-out disabled:opacity-50 select-none"
                  >
                    {addSubmitting ? 'Guardando...' : 'Guardar producto'}
                  </button>
                </form>
              </div>
            )}

            {inventory.length === 0 ? (
              <div className="text-center py-12 text-[#7d9990] text-sm">Sin productos en inventario.</div>
            ) : (
              categories.map((cat) => {
                const items = inventory.filter((i) => i.category === cat);
                return (
                  <div key={cat}>
                    <p className="text-[10px] font-bold text-[#7d9990] uppercase tracking-wider px-1 mb-1.5 flex items-center gap-1.5">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#7A1D2E]" />
                      {cat}
                    </p>
                    <div className="space-y-2">
                      {items.map((item) => {
                        const isAdjusting = adjusting === item.id;
                        const isLow = item.stock < item.min_stock;
                        const adj = adjustments[item.id];
                        const ingresado = parseFloat(adj?.ingresado || '0') || 0;
                        const salida = parseFloat(adj?.salida || '0') || 0;
                        const hasAdj = ingresado !== 0 || salida !== 0;
                        const newStock = Math.max(0, parseFloat((item.stock + ingresado - salida).toFixed(2)));

                        return (
                          <div key={item.id} className={`${CARD} p-4`}>
                            {/* Name + delete */}
                            <div className="flex items-start gap-2 mb-1">
                              <div className="flex-1 min-w-0">
                                {editingNameId === item.id ? (
                                  <form onSubmit={(e) => { e.preventDefault(); handleSaveProductName(item); }} className="flex items-center gap-1">
                                    <input
                                      type="text"
                                      autoFocus
                                      value={editingNameValue}
                                      onChange={(e) => setEditingNameValue(e.target.value)}
                                      className="flex-1 min-w-0 bg-[#0a0f0e] border border-[#7A1D2E] rounded-lg px-2 py-0.5 text-sm text-[#e6edea] focus:outline-none"
                                    />
                                    <button type="submit" className="text-[11px] font-bold text-emerald-400 px-1 shrink-0">✓</button>
                                    <button type="button" onClick={() => setEditingNameId(null)} className="text-[11px] text-[#7d9990] px-1 shrink-0">✕</button>
                                  </form>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => { setEditingNameId(item.id); setEditingNameValue(item.product_name); }}
                                    className="font-bold text-sm text-[#e6edea] leading-tight hover:text-[#E8899A] transition text-left w-full truncate"
                                  >
                                    {item.product_name}
                                  </button>
                                )}
                              </div>
                              {editingNameId !== item.id && (
                                <button
                                  onClick={() => handleDeleteProduct(item.id, item.product_name)}
                                  disabled={deletingId === item.id}
                                  className="shrink-0 text-[#7d9990] hover:text-red-400 transition disabled:opacity-30 mt-0.5"
                                >
                                  <Trash2 size={13} strokeWidth={2} />
                                </button>
                              )}
                            </div>

                            {/* Category / Unit */}
                            <div className="mb-0.5">
                              {editingMetaId === item.id ? (
                                <form onSubmit={(e) => { e.preventDefault(); handleSaveMeta(item); }} className="flex items-center gap-1 flex-wrap">
                                  <select value={editingCategory} onChange={(e) => setEditingCategory(e.target.value)} autoFocus className="bg-[#0a0f0e] border border-[#7A1D2E] rounded-lg px-2 py-0.5 text-[10px] text-[#e6edea] focus:outline-none">
                                    {['licores', 'cervezas', 'vinos', 'refrescos', 'mixers', 'otros'].map((c) => <option key={c} value={c}>{c}</option>)}
                                  </select>
                                  <select value={editingUnit} onChange={(e) => setEditingUnit(e.target.value)} className="bg-[#0a0f0e] border border-[#7A1D2E] rounded-lg px-2 py-0.5 text-[10px] text-[#e6edea] focus:outline-none">
                                    {['botellas', 'cajas', 'piezas', 'litros', 'kg', 'latas'].map((u) => <option key={u} value={u}>{u}</option>)}
                                  </select>
                                  <button type="submit" className="text-[10px] font-bold text-emerald-400 px-1">✓</button>
                                  <button type="button" onClick={() => setEditingMetaId(null)} className="text-[10px] text-[#7d9990] px-1">✕</button>
                                </form>
                              ) : (
                                <button type="button" onClick={() => { setEditingMetaId(item.id); setEditingCategory(item.category); setEditingUnit(item.unit); }} className="text-[10px] text-[#7d9990] hover:text-[#e6edea] transition underline decoration-dashed underline-offset-2">
                                  {item.category} · {item.unit}
                                </button>
                              )}
                            </div>

                            {/* Bottle ml */}
                            <div className="mb-1">
                              {editingMlId === item.id ? (
                                <form onSubmit={(e) => { e.preventDefault(); handleSaveBottleMl(item); }} className="flex items-center gap-1 flex-wrap">
                                  {[200, 375, 500, 700, 750, 1000, 1750].map((ml) => (
                                    <button key={ml} type="button" onClick={() => setEditingMlValue(String(ml))} className={`h-6 px-2 rounded-md text-[10px] font-semibold transition select-none ${editingMlValue === String(ml) ? 'bg-[#7A1D2E] text-white' : 'bg-[#1c2b27] border border-[#223530] text-[#7d9990]'}`}>{ml}</button>
                                  ))}
                                  <input type="number" min="1" autoFocus value={editingMlValue} onChange={(e) => setEditingMlValue(e.target.value)} className="w-16 bg-[#0a0f0e] border border-[#7A1D2E] rounded-lg px-2 py-0.5 text-[10px] text-[#e6edea] focus:outline-none" />
                                  <button type="submit" className="text-[10px] font-bold text-emerald-400 px-1">✓</button>
                                  <button type="button" onClick={() => setEditingMlId(null)} className="text-[10px] text-[#7d9990] px-1">✕</button>
                                </form>
                              ) : (
                                <button type="button" onClick={() => { setEditingMlId(item.id); setEditingMlValue(String(item.bottle_ml)); }} className="text-[10px] text-[#7d9990] hover:text-[#e6edea] transition underline decoration-dashed underline-offset-2">
                                  {item.bottle_ml}ml por botella
                                </button>
                              )}
                            </div>

                            {/* Divider */}
                            <div className="border-t border-[#1c2b27] my-2" />

                            {/* Stock actual */}
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs text-[#7d9990]">Stock actual</span>
                              <div className="flex items-center gap-2">
                                {isLow && <AlertTriangle size={12} strokeWidth={2.5} className="text-amber-400" />}
                                <span className={`font-mono font-black text-xl tabular-nums leading-none ${isLow ? 'text-amber-400' : 'text-[#e6edea]'} ${isAdjusting ? 'opacity-50' : ''}`}>
                                  {item.stock % 1 === 0 ? item.stock.toFixed(0) : item.stock.toFixed(2)}
                                </span>
                                <span className="text-xs text-[#7d9990]">{item.unit}</span>
                              </div>
                            </div>

                            {/* Ingresado / Salida inputs */}
                            <div className="grid grid-cols-2 gap-2 mb-2">
                              <div>
                                <label className="block text-[10px] font-bold text-emerald-400 uppercase tracking-wider mb-1">+ Ingresado</label>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.25"
                                  placeholder="0"
                                  value={adj?.ingresado ?? ''}
                                  onChange={(e) => setAdj(item.id, 'ingresado', e.target.value)}
                                  className="w-full bg-[#0a0f0e] border border-[#223530] focus:border-emerald-700 rounded-lg px-3 py-2 text-sm text-[#e6edea] focus:outline-none focus:ring-1 focus:ring-emerald-700"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-red-400 uppercase tracking-wider mb-1">− Salida</label>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.25"
                                  placeholder="0"
                                  value={adj?.salida ?? ''}
                                  onChange={(e) => setAdj(item.id, 'salida', e.target.value)}
                                  className="w-full bg-[#0a0f0e] border border-[#223530] focus:border-red-800 rounded-lg px-3 py-2 text-sm text-[#e6edea] focus:outline-none focus:ring-1 focus:ring-red-800"
                                />
                              </div>
                            </div>

                            {/* Preview + save */}
                            {hasAdj && (
                              <div className="flex items-center gap-2">
                                <div className="flex-1 flex items-center gap-1.5 bg-[#1c2b27] rounded-xl px-3 py-2">
                                  <span className="text-[10px] text-[#7d9990] shrink-0">= Quedan</span>
                                  <span className={`font-mono font-black text-base tabular-nums leading-none ml-auto ${newStock < item.min_stock ? 'text-amber-400' : 'text-emerald-400'}`}>
                                    {newStock % 1 === 0 ? newStock.toFixed(0) : newStock.toFixed(2)}
                                  </span>
                                  <span className="text-[10px] text-[#7d9990]">{item.unit}</span>
                                </div>
                                <button
                                  onClick={() => handleAdjust(item)}
                                  disabled={isAdjusting}
                                  className="shrink-0 min-h-[40px] px-4 rounded-xl bg-[#7A1D2E] hover:bg-[#9E2A3E] text-white font-bold text-xs transition active:scale-[0.97] disabled:opacity-50 select-none"
                                >
                                  {isAdjusting ? '...' : 'Actualizar'}
                                </button>
                              </div>
                            )}

                            {/* Min stock */}
                            <div className="mt-2 flex items-center gap-1">
                              {isLow && (
                                <span className="text-[10px] text-amber-400 font-semibold">Bajo stock ·&nbsp;</span>
                              )}
                              {editingMinId === item.id ? (
                                <form onSubmit={(e) => { e.preventDefault(); handleSaveMinStock(item); }} className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.25"
                                    autoFocus
                                    value={editingMinValue}
                                    onChange={(e) => setEditingMinValue(e.target.value)}
                                    className="w-20 bg-[#0a0f0e] border border-[#7A1D2E] rounded-lg px-2 py-0.5 text-xs text-[#e6edea] focus:outline-none"
                                  />
                                  <button type="submit" className="text-[10px] font-bold text-emerald-400 px-1">✓</button>
                                  <button type="button" onClick={() => setEditingMinId(null)} className="text-[10px] text-[#7d9990] px-1">✕</button>
                                </form>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => { setEditingMinId(item.id); setEditingMinValue(String(item.min_stock)); }}
                                  className="text-[10px] text-[#7d9990] hover:text-[#e6edea] transition underline decoration-dashed underline-offset-2"
                                >
                                  Mín: {item.min_stock} {item.unit}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </>
        )}

        {/* ── Mermas ── */}
        {tab === 1 && (
          <>
            <div className={`${CARD} p-4`}>
              <p className="text-xs font-bold text-[#7d9990] uppercase tracking-wider mb-3">Registrar merma</p>
              <form onSubmit={handleMermaSubmit} className="space-y-3">
                <select value={mermaProductId} onChange={(e) => setMermaProductId(e.target.value)} className={`${INPUT} appearance-none`}>
                  <option value="">Seleccionar producto...</option>
                  {inventory.map((item) => (
                    <option key={item.id} value={item.id}>{item.product_name} ({item.stock} {item.unit})</option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="0.25"
                    min="0.25"
                    placeholder="Cant."
                    value={mermaQty}
                    onChange={(e) => setMermaQty(e.target.value)}
                    className="w-24 bg-[#0a0f0e] border border-[#223530] rounded-xl px-3 py-2.5 text-sm text-[#e6edea] focus:outline-none focus:ring-2 focus:ring-[#B8324B] placeholder:text-[#4a6560]"
                  />
                  <select value={mermaReason} onChange={(e) => setMermaReason(e.target.value)} className={`${INPUT} flex-1 appearance-none`}>
                    {REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                {mermaError && <p className="text-xs text-red-400">{mermaError}</p>}
                <button type="submit" disabled={mermaSubmitting} className="w-full min-h-[44px] rounded-xl bg-[#7A1D2E] hover:bg-[#9E2A3E] active:scale-[0.98] text-white font-bold text-sm transition duration-150 ease-out disabled:opacity-50 select-none">
                  {mermaSubmitting ? 'Registrando...' : 'Registrar Merma'}
                </button>
              </form>
            </div>

            <div>
              <p className="text-[10px] font-bold text-[#7d9990] uppercase tracking-wider px-1 mb-1.5">Mermas del turno</p>
              {mermas.length === 0 ? (
                <div className="text-center py-8 text-[#7d9990] text-sm">Sin mermas registradas hoy.</div>
              ) : (
                <div className="space-y-2">
                  {mermas.map((m) => (
                    <div key={m.id} className={`${CARD} px-4 py-3 flex items-center gap-3`}>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-[#e6edea] leading-tight truncate">{m.product_name}</p>
                        <p className="text-[10px] text-[#7d9990] mt-0.5">{m.reason}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-mono font-bold text-[#F5C2CB] text-sm">-{m.quantity}</p>
                        <p className="text-[10px] text-[#7d9990]">{fmtTime(m.created_at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
