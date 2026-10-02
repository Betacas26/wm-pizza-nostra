'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { signOutAction } from './actions';

interface Props {
  userName: string;
  userRole: string;
  isManager: boolean;
}

const CARD =
  'p-4 bg-white rounded-2xl border border-stone-200/70 shadow-[0_2px_8px_rgba(0,0,0,0.04)] text-left hover:border-amber-400 active:scale-[0.98] active:bg-stone-50 transition duration-150 ease-out select-none block';

interface Module {
  href: string;
  icon: string;
  title: string;
  sub: string;
}

const TURNO: Module[] = [
  { href: '/dashboard/mesas',     icon: '🍽️', title: 'Mesas',     sub: 'Asignar por área' },
  { href: '/dashboard/ventas',    icon: '💵', title: 'Ventas',    sub: 'Cierre y propinas' },
  { href: '/dashboard/comidas',   icon: '🍕', title: 'Comidas',   sub: 'Control 30 min' },
  { href: '/dashboard/checklist', icon: '📋', title: 'Checklist', sub: 'Apertura y cierre' },
];

const GESTION: Module[] = [
  { href: '/dashboard/horarios',  icon: '⏰', title: 'Horarios',  sub: 'Turnos semanales' },
  { href: '/dashboard/personal',  icon: '👥', title: 'Personal',  sub: 'Colaboradores' },
  { href: '/dashboard/rubricas',  icon: '⭐', title: 'Rúbricas',  sub: 'Evaluación' },
];

export default function DashboardClient({ userName, userRole, isManager }: Props) {
  const [tab, setTab] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const touchStartX = useRef(0);

  const tabs = ['Turno', 'Gestión', ...(isManager ? ['Reportes'] : [])];

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }

  function onTouchEnd(e: React.TouchEvent) {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 60) {
      if (dx < 0 && tab < tabs.length - 1) setTab((t) => t + 1);
      if (dx > 0 && tab > 0) setTab((t) => t - 1);
    }
  }

  const today = new Date().toLocaleDateString('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <div className="h-screen bg-[#F8F7F4] text-stone-800 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-white border-b border-stone-200 px-4 py-3 flex items-center justify-between shadow-sm z-20 shrink-0">
        <div>
          <h1 className="font-extrabold text-amber-600 text-lg leading-tight">
            WM Pizza Nostra
          </h1>
          <p className="text-xs text-stone-400 capitalize">{today}</p>
        </div>
        <button
          onClick={() => setDrawerOpen(true)}
          className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 font-extrabold text-base flex items-center justify-center shrink-0 active:scale-[0.98] transition duration-150 ease-out"
          aria-label="Menú de usuario"
        >
          {userName.charAt(0).toUpperCase()}
        </button>
      </header>

      {/* Sliding panels */}
      <main
        className="flex-1 relative overflow-hidden"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div
          className="absolute inset-0 flex transition-transform duration-300 ease-in-out"
          style={{ transform: `translateX(-${tab * 100}%)` }}
        >
          {/* ── Turno ── */}
          <section className="min-w-full h-full overflow-y-auto p-4 space-y-3">
            <div className="bg-white rounded-2xl border border-stone-200/70 shadow-[0_2px_8px_rgba(0,0,0,0.04)] p-4">
              <p className="text-xs font-bold text-stone-400 uppercase tracking-wider">
                Operaciones del turno
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {TURNO.map((m) => (
                <Link key={m.href} href={m.href} className={CARD}>
                  <span className="text-2xl block mb-2">{m.icon}</span>
                  <span className="font-bold text-sm block">{m.title}</span>
                  <span className="text-xs text-stone-400">{m.sub}</span>
                </Link>
              ))}
            </div>
          </section>

          {/* ── Gestión ── */}
          <section className="min-w-full h-full overflow-y-auto p-4 space-y-3">
            <div className="bg-white rounded-2xl border border-stone-200/70 shadow-[0_2px_8px_rgba(0,0,0,0.04)] p-4">
              <p className="text-xs font-bold text-stone-400 uppercase tracking-wider">
                Gestión del equipo
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {GESTION.map((m) => (
                <Link key={m.href} href={m.href} className={CARD}>
                  <span className="text-2xl block mb-2">{m.icon}</span>
                  <span className="font-bold text-sm block">{m.title}</span>
                  <span className="text-xs text-stone-400">{m.sub}</span>
                </Link>
              ))}
            </div>
          </section>

          {/* ── Reportes (managers only) ── */}
          {isManager && (
            <section className="min-w-full h-full overflow-y-auto p-4 space-y-3">
              <div className="bg-white rounded-2xl border border-stone-200/70 shadow-[0_2px_8px_rgba(0,0,0,0.04)] p-4">
                <p className="text-xs font-bold text-stone-400 uppercase tracking-wider">
                  Reportes y análisis
                </p>
              </div>
              <Link href="/dashboard/reportes" className={`${CARD} col-span-2`}>
                <span className="text-2xl block mb-2">📊</span>
                <span className="font-bold text-sm block">Reportes</span>
                <span className="text-xs text-stone-400">
                  Ventas, rúbricas, capitán, ranking
                </span>
              </Link>
            </section>
          )}
        </div>
      </main>

      {/* Bottom tab bar */}
      <nav className="bg-white border-t border-stone-200 px-4 py-2.5 z-20 shrink-0">
        <div className="p-1 bg-stone-100 rounded-xl flex">
          {tabs.map((label, i) => (
            <button
              key={label}
              onClick={() => setTab(i)}
              className={`flex-1 h-9 rounded-lg text-xs font-semibold transition duration-150 ease-out active:scale-[0.98] select-none ${
                tab === i
                  ? 'bg-white text-stone-900 shadow-sm'
                  : 'text-stone-500 hover:text-stone-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </nav>

      {/* Drawer */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-end"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDrawerOpen(false);
          }}
        >
          <div className="bg-white rounded-t-3xl w-full px-6 pt-6 pb-8 shadow-2xl space-y-2">
            {/* User info */}
            <div className="flex items-center gap-4 pb-4 border-b border-stone-100">
              <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 font-extrabold text-xl flex items-center justify-center shrink-0">
                {userName.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-bold text-stone-900 text-base">{userName}</p>
                <p className="text-xs text-stone-400 capitalize">{userRole}</p>
              </div>
            </div>

            {/* Nav links */}
            {isManager && (
              <Link
                href="/dashboard/reportes"
                onClick={() => setDrawerOpen(false)}
                className="flex items-center gap-3 py-3 text-stone-700 hover:text-amber-600 transition"
              >
                <span className="text-xl w-8 text-center">📊</span>
                <span className="font-semibold text-sm">Reportes</span>
              </Link>
            )}

            <Link
              href="/dashboard/ventas"
              onClick={() => setDrawerOpen(false)}
              className="flex items-center gap-3 py-3 text-stone-700 hover:text-amber-600 transition"
            >
              <span className="text-xl w-8 text-center">💵</span>
              <span className="font-semibold text-sm">Historial de ventas</span>
            </Link>

            <div className="border-t border-stone-100 pt-2">
              <form action={signOutAction}>
                <button
                  type="submit"
                  className="flex items-center gap-3 py-3 text-red-500 hover:text-red-700 transition w-full text-left"
                >
                  <span className="text-xl w-8 text-center">🚪</span>
                  <span className="font-semibold text-sm">Cerrar sesión</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
