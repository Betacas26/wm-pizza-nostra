'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { createProductAction, toggleProductAction, deleteProductAction } from './actions';
import type { ProductRecord } from './actions';

const SUGGESTED_CATEGORIES = ['Pizza', 'Pasta', 'Bebida', 'Entrada', 'Postre', 'General'];

function Toggle({ active, onChange }: { active: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      onClick={onChange}
      aria-label={active ? 'Desactivar' : 'Activar'}
      className={`relative inline-flex w-11 h-6 shrink-0 rounded-full transition-colors duration-200 ${
        active ? 'bg-emerald-600' : 'bg-[#223530]'
      }`}
    >
      <span
        className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
          active ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

export default function ProductosClient({
  initialProducts,
}: {
  initialProducts: ProductRecord[];
}) {
  const [products, setProducts] = useState<ProductRecord[]>(initialProducts);
  const [showAdd, setShowAdd] = useState(false);
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState('General');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const map = new Map<string, ProductRecord[]>();
    for (const p of products) {
      if (!map.has(p.category)) map.set(p.category, []);
      map.get(p.category)!.push(p);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => a.name.localeCompare(b.name, 'es'));
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b, 'es'));
  }, [products]);

  const totalActive = products.filter((p) => p.active).length;

  async function handleToggle(id: string, current: boolean) {
    setProducts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, active: !current } : p)),
    );
    const result = await toggleProductAction(id, !current);
    if (!result.ok) {
      setProducts((prev) =>
        prev.map((p) => (p.id === id ? { ...p, active: current } : p)),
      );
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!window.confirm(`¿Eliminar "${name}"?`)) return;
    setProducts((prev) => prev.filter((p) => p.id !== id));
    await deleteProductAction(id);
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!formName.trim()) return;
    setCreating(true);
    setCreateError(null);
    const result = await createProductAction(formName, formCategory);
    if (result.ok) {
      setProducts((prev) => [...prev, result.data]);
      setFormName('');
      setFormCategory('General');
      setShowAdd(false);
    } else {
      setCreateError(result.error);
    }
    setCreating(false);
  }

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
            Productos
          </h1>
          <p className="text-xs text-[#7d9990]">
            {products.length} productos &middot;{' '}
            <span className="text-emerald-400 font-semibold">
              {totalActive} activos
            </span>
          </p>
        </div>
        <button
          onClick={() => { setCreateError(null); setShowAdd(true); }}
          className="bg-[#7A1D2E] hover:bg-[#9E2A3E] active:scale-[0.98] text-white text-sm font-bold px-3 min-h-[44px] rounded-xl shadow transition duration-150 ease-out select-none"
        >
          + Nuevo
        </button>
      </header>

      <main className="p-4 max-w-xl mx-auto space-y-4">
        {products.length === 0 && (
          <div className="text-center py-14 text-[#7d9990] text-sm">
            Sin productos registrados. Crea el primero.
          </div>
        )}

        {grouped.map(([category, items]) => (
          <section key={category}>
            <h2 className="text-xs font-bold text-[#7d9990] uppercase tracking-wider mb-2 px-1">
              {category}{' '}
              <span className="font-normal normal-case">({items.length})</span>
            </h2>
            <div className="bg-[#151D1A] rounded-2xl border border-[#223530] shadow-[0_2px_8px_rgba(0,0,0,0.2)] overflow-hidden">
              <ul className="divide-y divide-[#223530]">
                {items.map((product) => (
                  <li key={product.id} className="px-4 py-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p
                        className={`font-semibold text-sm leading-tight ${
                          product.active ? 'text-[#e6edea]' : 'text-[#7d9990] line-through'
                        }`}
                      >
                        {product.name}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDelete(product.id, product.name)}
                      className="shrink-0 text-xs text-red-500 hover:text-red-400 px-2 py-1 rounded-lg hover:bg-red-950/40 transition"
                    >
                      ✕
                    </button>
                    <Toggle
                      active={product.active}
                      onChange={() => handleToggle(product.id, product.active)}
                    />
                  </li>
                ))}
              </ul>
            </div>
          </section>
        ))}
      </main>

      {/* Modal: nuevo producto */}
      {showAdd && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowAdd(false); }}
        >
          <div className="bg-[#151D1A] border border-[#223530] rounded-2xl shadow-2xl w-full max-w-sm p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-extrabold text-[#e6edea] text-base">Nuevo producto</h2>
              <button
                onClick={() => setShowAdd(false)}
                className="text-[#7d9990] hover:text-[#e6edea] text-xl leading-none"
                aria-label="Cerrar"
              >
                &#10005;
              </button>
            </div>

            {createError && (
              <div className="p-3 rounded-xl bg-red-950/40 border border-red-800/50 text-sm text-red-300 font-medium">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-[#7d9990] uppercase tracking-wider mb-1">
                  Nombre del producto
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ej. Margarita Individual"
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-[#223530] bg-[#1c2b27] text-[#e6edea] text-base focus:outline-none focus:ring-2 focus:ring-[#7A1D2E]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#7d9990] uppercase tracking-wider mb-1">
                  Categoría
                </label>
                <div className="flex gap-2 flex-wrap">
                  {SUGGESTED_CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setFormCategory(cat)}
                      className={`h-9 px-3 rounded-xl border text-xs font-semibold transition active:scale-[0.98] ${
                        formCategory === cat
                          ? 'bg-[#7A1D2E] border-[#9E2A3E]/60 text-white'
                          : 'bg-[#1c2b27] border-[#223530] text-[#7d9990] hover:text-[#e6edea]'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  placeholder="O escribe una categoría..."
                  className="mt-2 w-full min-h-[44px] px-3 py-2 rounded-xl border border-[#223530] bg-[#1c2b27] text-[#e6edea] text-sm focus:outline-none focus:ring-2 focus:ring-[#7A1D2E]"
                />
              </div>

              <button
                type="submit"
                disabled={creating}
                className="w-full min-h-[44px] bg-[#7A1D2E] hover:bg-[#9E2A3E] active:scale-[0.98] text-white font-bold rounded-xl shadow transition text-sm disabled:opacity-50"
              >
                {creating ? 'Creando...' : 'Crear producto'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
