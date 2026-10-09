'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ChevronLeft,
  AlertTriangle,
  Package,
  ClipboardList,
} from 'lucide-react';
import { updateInventoryStockAction, recordMermaAction } from './actions';

export interface InventoryItem {
  id: string;
  product_name: string;
  category: string;
  unit: string;
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
  });
}

const CARD =
  'bg-[#151D1A] rounded-2xl border border-[#223530] shadow-[0_2px_8px_rgba(0,0,0,0.2)]';

export default function BarraClient({ inventory: initInventory, mermasHoy: initMermas, today }: Props) {
  const [tab, setTab] = useState(0);
  const [inventory, setInventory] = useState<InventoryItem[]>(initInventory);
  const [mermas, setMermas] = useState<MermaRecord[]>(initMermas);
  const [saving, setSaving] = useState<string | null>(null);

  // Merma form state
  const [mermaProductId, setMermaProductId] = useState('');
  const [mermaQty, setMermaQty] = useState('');
  const [mermaReason, setMermaReason] = useState(REASONS[0]);
  const [mermaSubmitting, setMermaSubmitting] = useState(false);
  const [mermaError, setMermaError] = useState('');

  const lowStock = inventory.filter((i) => i.stock < i.min_stock);

  async function handleDelta(item: InventoryItem, delta: number) {
    if (saving === item.id) return;
    const newStock = Math.max(0, parseFloat((item.stock + delta).toFixed(2)));
    // Optimistic update
    setInventory((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, stock: newStock } : i)),
    );
    setSaving(item.id);
    try {
      await updateInventoryStockAction(item.id, newStock);
    } catch {
      // Revert on error
      setInventory((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, stock: item.stock } : i)),
      );
    } finally {
      setSaving(null);
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
      // Also reduce local inventory
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

  // Group inventory by category
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
        <div className="flex-1 min-w-0">
          <h1 className="font-extrabold text-[#E8899A] text-lg leading-tight">
            Barra
          </h1>
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

      {/* Low stock alert banner */}
      {lowStock.length > 0 && (
        <div className="mx-3 mt-3 flex items-start gap-2 bg-amber-950/50 border border-amber-700/60 rounded-xl px-3 py-2.5">
          <AlertTriangle size={16} strokeWidth={2} className="text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-300">
            <span className="font-bold">Desabasto detectado:</span>{' '}
            {lowStock.map((i) => i.product_name).join(', ')}
          </div>
        </div>
      )}

      {/* Tab bar */}
      <div className="px-3 pt-3">
        <div className="p-1 bg-[#0a0f0e] rounded-xl flex">
          {['Inventario', 'Mermas'].map((label, i) => (
            <button
              key={label}
              onClick={() => setTab(i)}
              className={`flex-1 h-9 rounded-lg text-xs font-semibold transition duration-150 ease-out active:scale-[0.98] select-none flex items-center justify-center gap-1.5 ${
                tab === i
                  ? 'bg-[#7A1D2E] text-white shadow-sm'
                  : 'text-[#7d9990] hover:text-[#e6edea]'
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
            {inventory.length === 0 ? (
              <div className="text-center py-12 text-[#7d9990] text-sm">
                Sin productos en inventario.
                <br />
                <span className="text-xs mt-1 block">Agrega productos desde Supabase.</span>
              </div>
            ) : (
              categories.map((cat) => {
                const items = inventory.filter((i) => i.category === cat);
                return (
                  <div key={cat}>
                    <p className="text-[10px] font-bold text-[#7d9990] uppercase tracking-wider px-1 mb-1.5">
                      {cat}
                    </p>
                    <div className="space-y-2">
                      {items.map((item) => {
                        const isSaving = saving === item.id;
                        const isLow = item.stock < item.min_stock;
                        return (
                          <div key={item.id} className={`${CARD} px-4 py-3`}>
                            <div className="flex items-center gap-3">
                              {/* Info */}
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-sm text-[#e6edea] leading-tight truncate">
                                  {item.product_name}
                                </p>
                                <p className="text-[10px] mt-0.5 flex items-center gap-1">
                                  {isLow ? (
                                    <span className="text-amber-400 font-semibold flex items-center gap-0.5">
                                      <AlertTriangle size={10} strokeWidth={2.5} />
                                      Bajo stock
                                    </span>
                                  ) : (
                                    <span className="text-[#7d9990]">
                                      Min: {item.min_stock} {item.unit}
                                    </span>
                                  )}
                                </p>
                              </div>

                              {/* Stock display */}
                              <div className="shrink-0 text-right min-w-[56px]">
                                <span
                                  className={`font-mono font-black text-xl tabular-nums leading-none ${
                                    isLow ? 'text-amber-400' : 'text-[#e6edea]'
                                  } ${isSaving ? 'opacity-50' : ''}`}
                                >
                                  {item.stock % 1 === 0 ? item.stock.toFixed(0) : item.stock.toFixed(2)}
                                </span>
                                <p className="text-[10px] text-[#7d9990]">{item.unit}</p>
                              </div>

                              {/* Delta buttons */}
                              <div className="shrink-0 flex flex-col gap-1">
                                <div className="flex gap-1">
                                  <button
                                    onClick={() => handleDelta(item, -1)}
                                    disabled={isSaving || item.stock <= 0}
                                    className="w-9 h-9 rounded-xl bg-[#1c2b27] border border-[#223530] text-[#e6edea] font-bold text-sm hover:bg-[#7A1D2E]/40 active:scale-[0.92] transition disabled:opacity-30 disabled:cursor-not-allowed select-none"
                                  >
                                    -1
                                  </button>
                                  <button
                                    onClick={() => handleDelta(item, 1)}
                                    disabled={isSaving}
                                    className="w-9 h-9 rounded-xl bg-[#7A1D2E] border border-[#9E2A3E]/60 text-white font-bold text-sm hover:bg-[#9E2A3E] active:scale-[0.92] transition disabled:opacity-50 select-none"
                                  >
                                    +1
                                  </button>
                                </div>
                                <div className="flex gap-1">
                                  <button
                                    onClick={() => handleDelta(item, -0.25)}
                                    disabled={isSaving || item.stock <= 0}
                                    className="w-9 h-7 rounded-lg bg-[#1c2b27] border border-[#223530] text-[#7d9990] font-semibold text-[10px] hover:bg-[#7A1D2E]/30 active:scale-[0.92] transition disabled:opacity-30 disabled:cursor-not-allowed select-none"
                                  >
                                    -.25
                                  </button>
                                  <button
                                    onClick={() => handleDelta(item, 0.25)}
                                    disabled={isSaving}
                                    className="w-9 h-7 rounded-lg bg-[#420F18]/60 border border-[#9E2A3E]/40 text-[#F5C2CB] font-semibold text-[10px] hover:bg-[#7A1D2E]/50 active:scale-[0.92] transition disabled:opacity-50 select-none"
                                  >
                                    +.25
                                  </button>
                                </div>
                              </div>
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
            {/* Merma form */}
            <div className={`${CARD} p-4`}>
              <p className="text-xs font-bold text-[#7d9990] uppercase tracking-wider mb-3">
                Registrar merma
              </p>
              <form onSubmit={handleMermaSubmit} className="space-y-3">
                {/* Product selector */}
                <select
                  value={mermaProductId}
                  onChange={(e) => setMermaProductId(e.target.value)}
                  className="w-full bg-[#0a0f0e] border border-[#223530] rounded-xl px-3 py-2.5 text-sm text-[#e6edea] focus:outline-none focus:ring-2 focus:ring-[#B8324B] appearance-none"
                >
                  <option value="">Seleccionar producto...</option>
                  {inventory.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.product_name} ({item.stock} {item.unit})
                    </option>
                  ))}
                </select>

                {/* Quantity + Reason row */}
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
                  <select
                    value={mermaReason}
                    onChange={(e) => setMermaReason(e.target.value)}
                    className="flex-1 bg-[#0a0f0e] border border-[#223530] rounded-xl px-3 py-2.5 text-sm text-[#e6edea] focus:outline-none focus:ring-2 focus:ring-[#B8324B] appearance-none"
                  >
                    {REASONS.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>

                {mermaError && (
                  <p className="text-xs text-red-400">{mermaError}</p>
                )}

                <button
                  type="submit"
                  disabled={mermaSubmitting}
                  className="w-full min-h-[44px] rounded-xl bg-[#7A1D2E] hover:bg-[#9E2A3E] active:scale-[0.98] text-white font-bold text-sm transition duration-150 ease-out disabled:opacity-50 select-none"
                >
                  {mermaSubmitting ? 'Registrando...' : 'Registrar Merma'}
                </button>
              </form>
            </div>

            {/* Merma history */}
            <div>
              <p className="text-[10px] font-bold text-[#7d9990] uppercase tracking-wider px-1 mb-1.5">
                Mermas del turno
              </p>
              {mermas.length === 0 ? (
                <div className="text-center py-8 text-[#7d9990] text-sm">
                  Sin mermas registradas hoy.
                </div>
              ) : (
                <div className="space-y-2">
                  {mermas.map((m) => (
                    <div key={m.id} className={`${CARD} px-4 py-3 flex items-center gap-3`}>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-[#e6edea] leading-tight truncate">
                          {m.product_name}
                        </p>
                        <p className="text-[10px] text-[#7d9990] mt-0.5">{m.reason}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-mono font-bold text-[#F5C2CB] text-sm">
                          -{m.quantity}
                        </p>
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
