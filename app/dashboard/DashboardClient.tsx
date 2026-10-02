'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import {
  UtensilsCrossed,
  Banknote,
  Pizza,
  ClipboardList,
  Clock,
  Users,
  Star,
  BarChart2,
  LogOut,
} from 'lucide-react';
import { signOutAction } from './actions';

interface Props {
  userName: string;
  userRole: string;
  isManager: boolean;
}

const CARD =
  'p-4 bg-[#151D1A] rounded-2xl border border-[#223530] shadow-[0_2px_8px_rgba(0,0,0,0.2)] text-left hover:border-[#9E2A3E]/60 active:scale-[0.98] active:bg-[#1c2b27] transition duration-150 ease-out select-none block';

interface Module {
  href: string;
  Icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  title: string;
  sub: string;
}

const TURNO: Module[] = [
  { href: '/dashboard/mesas',     Icon: UtensilsCrossed, title: 'Mesas',     sub: 'Pick & Tap' },
  { href: '/dashboard/ventas',    Icon: Banknote,        title: 'Ventas',    sub: 'Cierre y propinas' },
  { href: '/dashboard/comidas',   Icon: Pizza,           title: 'Comidas',   sub: 'Control 30 min' },
  { href: '/dashboard/checklist', Icon: ClipboardList,   title: 'Checklist', sub: 'Apertura y cierre' },
];

const GESTION: Module[] = [
  { href: '/dashboard/horarios',  Icon: Clock,  title: 'Horarios',  sub: 'Turnos semanales' },
  { href: '/dashboard/personal',  Icon: Users,  title: 'Personal',  sub: 'Colaboradores' },
  { href: '/dashboard/rubricas',  Icon: Star,   title: 'Rubricas',  sub: 'Evaluacion' },
];

export default function DashboardClient({ userName, userRole, isManager }: Props) {
  const [tab, setTab] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const touchStartX = useRef(0);

  const tabs = ['Turno', 'Gestion', ...(isManager ? ['Reportes'] : [])];

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
    <div className="h-screen bg-[#0D1211] text-[#e6edea] flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-[#151D1A] border-b border-[#223530] px-4 py-3 flex items-center justify-between shadow-[0_2px_8px_rgba(0,0,0,0.2)] z-20 shrink-0">
        <div>
          <h1 className="font-extrabold text-[#E8899A] text-lg leading-tight">
            WM Pizza Nostra
          </h1>
          <p className="text-xs text-[#7d9990] capitalize">{today}</p>
        </div>
        <button
          onClick={() => setDrawerOpen(true)}
          className="w-10 h-10 rounded-full bg-[#420F18]/80 border border-[#9E2A3E]/60 text-[#E8899A] font-extrabold text-base flex items-center justify-center shrink-0 active:scale-[0.98] transition duration-150 ease-out"
          aria-label="Menu de usuario"
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
            <div className="bg-[#151D1A] rounded-2xl border border-[#223530] p-4">
              <p className="text-xs font-bold text-[#7d9990] uppercase tracking-wider">
                Operaciones del turno
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {TURNO.map((m) => (
                <Link key={m.href} href={m.href} className={CARD}>
                  <m.Icon size={22} strokeWidth={1.5} className="text-[#E8899A] mb-2" />
                  <span className="font-bold text-sm block text-[#e6edea]">{m.title}</span>
                  <span className="text-xs text-[#7d9990]">{m.sub}</span>
                </Link>
              ))}
            </div>
          </section>

          {/* ── Gestion ── */}
          <section className="min-w-full h-full overflow-y-auto p-4 space-y-3">
            <div className="bg-[#151D1A] rounded-2xl border border-[#223530] p-4">
              <p className="text-xs font-bold text-[#7d9990] uppercase tracking-wider">
                Gestion del equipo
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {GESTION.map((m) => (
                <Link key={m.href} href={m.href} className={CARD}>
                  <m.Icon size={22} strokeWidth={1.5} className="text-[#E8899A] mb-2" />
                  <span className="font-bold text-sm block text-[#e6edea]">{m.title}</span>
                  <span className="text-xs text-[#7d9990]">{m.sub}</span>
                </Link>
              ))}
            </div>
          </section>

          {/* ── Reportes (managers only) ── */}
          {isManager && (
            <section className="min-w-full h-full overflow-y-auto p-4 space-y-3">
              <div className="bg-[#151D1A] rounded-2xl border border-[#223530] p-4">
                <p className="text-xs font-bold text-[#7d9990] uppercase tracking-wider">
                  Reportes y analisis
                </p>
              </div>
              <Link href="/dashboard/reportes" className={`${CARD} col-span-2`}>
                <BarChart2 size={22} strokeWidth={1.5} className="text-[#E8899A] mb-2" />
                <span className="font-bold text-sm block text-[#e6edea]">Reportes</span>
                <span className="text-xs text-[#7d9990]">
                  Ventas, rubricas, capitan, ranking
                </span>
              </Link>
            </section>
          )}
        </div>
      </main>

      {/* Bottom tab bar */}
      <nav className="bg-[#151D1A] border-t border-[#223530] px-4 py-2.5 z-20 shrink-0">
        <div className="p-1 bg-[#0a0f0e] rounded-xl flex">
          {tabs.map((label, i) => (
            <button
              key={label}
              onClick={() => setTab(i)}
              className={`flex-1 h-9 rounded-lg text-xs font-semibold transition duration-150 ease-out active:scale-[0.98] select-none ${
                tab === i
                  ? 'bg-[#1c2b27] text-[#e6edea] shadow-sm'
                  : 'text-[#7d9990] hover:text-[#e6edea]'
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
          className="fixed inset-0 z-50 bg-black/60 flex items-end"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDrawerOpen(false);
          }}
        >
          <div className="bg-[#151D1A] border-t border-[#223530] rounded-t-3xl w-full px-6 pt-6 pb-8 shadow-2xl space-y-2">
            {/* User info */}
            <div className="flex items-center gap-4 pb-4 border-b border-[#223530]">
              <div className="w-12 h-12 rounded-full bg-[#420F18]/80 border border-[#9E2A3E]/60 text-[#E8899A] font-extrabold text-xl flex items-center justify-center shrink-0">
                {userName.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-bold text-[#e6edea] text-base">{userName}</p>
                <p className="text-xs text-[#7d9990] capitalize">{userRole}</p>
              </div>
            </div>

            {/* Nav links */}
            {isManager && (
              <Link
                href="/dashboard/reportes"
                onClick={() => setDrawerOpen(false)}
                className="flex items-center gap-3 py-3 text-[#7d9990] hover:text-[#E8899A] transition"
              >
                <BarChart2 size={20} strokeWidth={1.5} className="w-8 shrink-0" />
                <span className="font-semibold text-sm">Reportes</span>
              </Link>
            )}

            <Link
              href="/dashboard/ventas"
              onClick={() => setDrawerOpen(false)}
              className="flex items-center gap-3 py-3 text-[#7d9990] hover:text-[#E8899A] transition"
            >
              <Banknote size={20} strokeWidth={1.5} className="w-8 shrink-0" />
              <span className="font-semibold text-sm">Historial de ventas</span>
            </Link>

            <div className="border-t border-[#223530] pt-2">
              <form action={signOutAction}>
                <button
                  type="submit"
                  className="flex items-center gap-3 py-3 text-red-400 hover:text-red-300 transition w-full text-left"
                >
                  <LogOut size={20} strokeWidth={1.5} className="w-8 shrink-0" />
                  <span className="font-semibold text-sm">Cerrar sesion</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
