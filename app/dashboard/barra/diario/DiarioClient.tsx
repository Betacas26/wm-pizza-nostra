'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  ChevronLeft,
  Save,
  AlertTriangle,
  CheckCircle2,
  CalendarDays,
} from 'lucide-react';
import { saveSnapshotAction, type DailyEntryInput } from './actions';

export interface DiarioProduct {
  id: string;
  product_name: string;
  category: string;
  bottle_ml: number;
  min_stock: number;
}

export interface SnapshotEntry {
  inventory_id: string;
  closed_bottles: number;
  open_fraction: number;
}

export interface SnapshotMap {
  [key: string]: SnapshotEntry[];
}

interface Props {
  products: DiarioProduct[];
  today: string;
  initialSnapshots: SnapshotMap;
}

type Shift = 'Matutino' | 'Vespertino';
type SnapType = 'inicial' | 'arrastre';

const FRACTIONS = [0, 0.25, 0.5, 0.75, 1.0];
const FRACTION_LABELS = ['0', '¼', '½', '¾', 'llena'];

const CARD =
  'bg-[#151D1A] rounded-2xl border border-[#223530] shadow-[0_2px_8px_rgba(0,0,0,0.2)]';

function snapKey(shift: Shift, type: SnapType) {
  return `${shift}:${type}`;
}

function toMap(entries: SnapshotEntry[]): Record<string, SnapshotEntry> {
  const m: Record<string, SnapshotEntry> = {};
  for (const e of entries) m[e.inventory_id] = e;
  return m;
}

function totalBtl(e: SnapshotEntry) {
  return e.closed_bottles + e.open_fraction;
}

export default function DiarioClient({ products, today, initialSnapshots }: Props) {
  const [shift, setShift] = useState<Shift>('Matutino');
  const [snapType, setSnapType] = useState<SnapType>('inicial');
  const [saved, setSaved] = useState<SnapshotMap>(initialSnapshots);
  const [local, setLocal] = useState<Record<string, SnapshotEntry>>(() =>
    toMap(initialSnapshots[snapKey('Matutino', 'inicial')] ?? []),
  );
  const [catFilter, setCatFilter] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const categories = useMemo(
    () => Array.from(new Set(products.map((p) => p.category))).sort(),
    [products],
  );

  const filtered = useMemo(
    () => (catFilter ? products.filter((p) => p.category === catFilter) : products),
    [products, catFilter],
  );

  function switchTo(newShift: Shift, newType: SnapType) {
    setLocal(toMap(saved[snapKey(newShift, newType)] ?? []));
    setShift(newShift);
    setSnapType(newType);
    setSaveError('');
    setSavedAt(null);
  }

  function entry(id: string): SnapshotEntry {
    return local[id] ?? { inventory_id: id, closed_bottles: 0, open_fraction: 0 };
  }

  function setField(id: string, patch: Partial<SnapshotEntry>) {
    setLocal((prev) => ({ ...prev, [id]: { ...entry(id), ...patch, inventory_id: id } }));
    setSavedAt(null);
  }

  // Consumption: requires both snapshots saved for the selected shift
  const consumption = useMemo(() => {
    const ini = saved[snapKey(shift, 'inicial')];
    const arr = saved[snapKey(shift, 'arrastre')];
    if (!ini || !arr) return null;
    const iniMap = toMap(ini);
    const arrMap = toMap(arr);
    return products
      .map((p) => {
        const iniE = iniMap[p.id] ?? { inventory_id: p.id, closed_bottles: 0, open_fraction: 0 };
        const arrE = arrMap[p.id] ?? { inventory_id: p.id, closed_bottles: 0, open_fraction: 0 };
        const iniT = totalBtl(iniE as SnapshotEntry);
        const arrT = totalBtl(arrE as SnapshotEntry);
        return { product: p, iniT, arrT, consumed: Math.max(0, iniT - arrT), isLow: arrT < p.min_stock && p.min_stock > 0 };
      })
      .filter((c) => c.iniT > 0 || c.arrT > 0);
  }, [saved, shift, products]);

  async function handleSave() {
    setSaving(true);
    setSaveError('');
    try {
      const entries: DailyEntryInput[] = products
        .map((p) => {
          const e = entry(p.id);
          return {
            inventory_id: p.id,
            product_name: p.product_name,
            category: p.category,
            bottle_ml: p.bottle_ml,
            closed_bottles: e.closed_bottles,
            open_fraction: e.open_fraction,
          };
        })
        .filter((e) => e.closed_bottles > 0 || e.open_fraction > 0);

      await saveSnapshotAction({ inventory_date: today, shift, snapshot_type: snapType, entries });

      // Sync saved state with what we just persisted
      const key = snapKey(shift, snapType);
      const allEntries = products.map((p) => ({ ...entry(p.id), inventory_id: p.id }));
      setSaved((prev) => ({ ...prev, [key]: allEntries }));
      setSavedAt(
        new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
      );
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Error al guardar.');
    } finally {
      setSaving(false);
    }
  }

  const currentSaved = !!saved[snapKey(shift, snapType)];

  return (
    <div className="min-h-screen bg-[#0D1211] text-[#e6edea]">
      {/* Header */}
      <header className="bg-[#151D1A] border-b border-[#223530] px-4 py-3 flex items-center gap-3 shadow-[0_2px_8px_rgba(0,0,0,0.2)] sticky top-0 z-10">
        <Link
          href="/dashboard/barra"
          className="flex items-center justify-center w-9 h-9 rounded-xl text-[#7d9990] hover:text-[#e6edea] hover:bg-[#1c2b27] transition active:scale-[0.95]"
          aria-label="Volver"
        >
          <ChevronLeft size={22} strokeWidth={2.5} />
        </Link>
        <CalendarDays size={22} strokeWidth={1.5} className="text-[#E8899A] shrink-0" />
        <div className="flex-1 min-w-0">
          <h1 className="font-extrabold text-[#E8899A] text-lg leading-tight">
            Inventario Diario
          </h1>
          <p className="text-xs text-[#7d9990]">{today}</p>
        </div>
      </header>

      <main className="p-3 max-w-xl mx-auto space-y-3 pb-10">
        {/* Shift selector */}
        <div className="p-1 bg-[#0a0f0e] rounded-xl flex">
          {(['Matutino', 'Vespertino'] as Shift[]).map((s) => (
            <button
              key={s}
              onClick={() => switchTo(s, snapType)}
              className={`flex-1 h-10 rounded-lg text-sm font-semibold transition duration-150 active:scale-[0.98] select-none ${
                shift === s
                  ? 'bg-[#7A1D2E] text-white shadow-sm'
                  : 'text-[#7d9990] hover:text-[#e6edea]'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Snapshot type toggle */}
        <div className="p-1 bg-[#0a0f0e] rounded-xl flex gap-1">
          {(['inicial', 'arrastre'] as SnapType[]).map((t) => {
            const label = t === 'inicial' ? 'Inicial (Apertura)' : 'Arrastre (Cierre)';
            const isSaved = !!saved[snapKey(shift, t)];
            return (
              <button
                key={t}
                onClick={() => switchTo(shift, t)}
                className={`flex-1 h-10 rounded-lg text-xs font-semibold transition duration-150 active:scale-[0.98] select-none flex items-center justify-center gap-1.5 ${
                  snapType === t
                    ? 'bg-[#1c2b27] text-[#e6edea] shadow-sm border border-[#223530]'
                    : 'text-[#7d9990] hover:text-[#e6edea]'
                }`}
              >
                {isSaved && (
                  <CheckCircle2 size={11} strokeWidth={2.5} className="text-emerald-400 shrink-0" />
                )}
                {label}
              </button>
            );
          })}
        </div>

        {/* Category filter chips */}
        <div className="flex gap-2 overflow-x-auto pb-0.5">
          <button
            onClick={() => setCatFilter(null)}
            className={`shrink-0 px-3 h-7 rounded-full text-xs font-semibold transition ${
              catFilter === null
                ? 'bg-[#7A1D2E] text-white'
                : 'bg-[#151D1A] border border-[#223530] text-[#7d9990] hover:text-[#e6edea]'
            }`}
          >
            Todos
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCatFilter(catFilter === cat ? null : cat)}
              className={`shrink-0 px-3 h-7 rounded-full text-xs font-semibold capitalize transition ${
                catFilter === cat
                  ? 'bg-[#7A1D2E] text-white'
                  : 'bg-[#151D1A] border border-[#223530] text-[#7d9990] hover:text-[#e6edea]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Product cards */}
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-[#7d9990] text-sm">
            Sin productos en esta categoría.
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((product) => {
              const e = entry(product.id);
              const total = totalBtl(e);
              const isLow = product.min_stock > 0 && total < product.min_stock;
              return (
                <div key={product.id} className={`${CARD} px-4 py-3`}>
                  {/* Product header row */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0 pr-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-[#e6edea] leading-tight">
                          {product.product_name}
                        </span>
                        <span className="text-[10px] font-semibold text-[#7d9990] bg-[#1c2b27] px-1.5 py-0.5 rounded-md">
                          {product.bottle_ml}ml
                        </span>
                        {isLow && total > 0 && (
                          <span className="flex items-center gap-0.5 text-[10px] font-bold text-red-400 bg-red-950/60 border border-red-800/50 px-1.5 py-0.5 rounded-md">
                            <AlertTriangle size={9} strokeWidth={2.5} />
                            BAJO STOCK
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-[#7d9990] capitalize mt-0.5">
                        {product.category}
                      </p>
                    </div>
                    {/* Total bottles */}
                    <div className="shrink-0 text-right">
                      <span
                        className={`font-mono font-black text-xl tabular-nums leading-none ${
                          isLow && total > 0
                            ? 'text-red-400'
                            : total > 0
                              ? 'text-[#E8899A]'
                              : 'text-[#4a6560]'
                        }`}
                      >
                        {total % 1 === 0 ? total.toFixed(0) : total.toFixed(2)}
                      </span>
                      <p className="text-[10px] text-[#7d9990]">bot.</p>
                    </div>
                  </div>

                  {/* Closed bottles counter */}
                  <div className="mb-3">
                    <p className="text-[10px] text-[#7d9990] uppercase tracking-wider mb-1.5">
                      Botellas cerradas
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          setField(product.id, {
                            closed_bottles: Math.max(0, e.closed_bottles - 1),
                          })
                        }
                        disabled={e.closed_bottles <= 0}
                        className="w-11 h-11 rounded-xl bg-[#1c2b27] border border-[#223530] text-[#e6edea] font-bold text-xl hover:bg-[#7A1D2E]/40 active:scale-[0.92] transition disabled:opacity-30 disabled:cursor-not-allowed select-none"
                      >
                        −
                      </button>
                      <span className="flex-1 text-center font-mono font-black text-3xl text-[#e6edea] tabular-nums">
                        {e.closed_bottles}
                      </span>
                      <button
                        onClick={() =>
                          setField(product.id, { closed_bottles: e.closed_bottles + 1 })
                        }
                        className="w-11 h-11 rounded-xl bg-[#7A1D2E] border border-[#9E2A3E]/60 text-white font-bold text-xl hover:bg-[#9E2A3E] active:scale-[0.92] transition select-none"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Open fraction quick buttons */}
                  <div>
                    <p className="text-[10px] text-[#7d9990] uppercase tracking-wider mb-1.5">
                      Botella en uso
                    </p>
                    <div className="flex gap-1.5">
                      {FRACTIONS.map((f, i) => (
                        <button
                          key={f}
                          onClick={() => setField(product.id, { open_fraction: f })}
                          className={`flex-1 h-10 rounded-xl text-xs font-bold transition active:scale-[0.92] select-none ${
                            e.open_fraction === f
                              ? 'bg-[#7A1D2E] text-white border border-[#9E2A3E]/60 shadow-sm'
                              : 'bg-[#1c2b27] border border-[#223530] text-[#7d9990] hover:text-[#e6edea] hover:border-[#7A1D2E]/50'
                          }`}
                        >
                          {FRACTION_LABELS[i]}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Save button */}
        <div className="pt-1 space-y-2">
          {saveError && <p className="text-xs text-red-400 px-1">{saveError}</p>}
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full min-h-[52px] rounded-2xl bg-[#7A1D2E] hover:bg-[#9E2A3E] active:scale-[0.98] text-white font-bold text-base transition duration-150 ease-out disabled:opacity-50 select-none flex items-center justify-center gap-2"
          >
            <Save size={18} strokeWidth={2} />
            {saving
              ? 'Guardando...'
              : `Guardar ${snapType === 'inicial' ? 'Inicial' : 'Arrastre'} — ${shift}`}
          </button>
          {savedAt && (
            <p className="text-center text-xs text-emerald-400 flex items-center justify-center gap-1">
              <CheckCircle2 size={11} strokeWidth={2.5} />
              Guardado a las {savedAt}
            </p>
          )}
          {currentSaved && !savedAt && (
            <p className="text-center text-xs text-[#7d9990] flex items-center justify-center gap-1">
              <CheckCircle2 size={11} strokeWidth={2.5} className="text-emerald-500/60" />
              Ya guardado anteriormente
            </p>
          )}
        </div>

        {/* Consumption section */}
        {consumption && consumption.length > 0 && (
          <div className={`${CARD} p-4`}>
            <p className="text-xs font-bold text-[#7d9990] uppercase tracking-wider mb-3">
              Consumo del turno — {shift}
            </p>
            <div className="space-y-0">
              {consumption.map(({ product, iniT, arrT, consumed, isLow }) => (
                <div
                  key={product.id}
                  className="flex items-center gap-3 py-2 border-b border-[#223530] last:border-0"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="font-semibold text-sm text-[#e6edea] leading-tight">
                        {product.product_name}
                      </p>
                      {isLow && (
                        <span className="flex items-center gap-0.5 text-[9px] font-bold text-red-400 bg-red-950/60 border border-red-800/50 px-1 py-0.5 rounded">
                          <AlertTriangle size={8} strokeWidth={2.5} />
                          BAJO STOCK
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-[#7d9990] mt-0.5 font-mono">
                      {iniT % 1 === 0 ? iniT.toFixed(0) : iniT.toFixed(2)} →{' '}
                      {arrT % 1 === 0 ? arrT.toFixed(0) : arrT.toFixed(2)} bot.
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p
                      className={`font-mono font-bold text-sm ${
                        consumed > 0 ? 'text-[#F5C2CB]' : 'text-[#4a6560]'
                      }`}
                    >
                      −{consumed % 1 === 0 ? consumed.toFixed(0) : consumed.toFixed(2)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
