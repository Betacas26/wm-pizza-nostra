'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
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
  Package,
  ChevronDown,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { signOutAction } from './actions';

export interface LiveStats {
  activeMeals: number;
  overdueMeals: number;
  salesCount: number;
  salesTotal: number;
  checklistCount: number;
  tablesAssigned: number;
}

interface Props {
  userName: string;
  userRole: string;
  isManager: boolean;
  isBarraManager: boolean;
  liveStats: LiveStats;
}

const CARD =
  'p-4 bg-[#151D1A] rounded-2xl border border-[#223530] shadow-[0_2px_8px_rgba(0,0,0,0.2)] text-left hover:border-[#9E2A3E]/60 active:scale-[0.98] active:bg-[#1c2b27] transition duration-150 ease-out select-none block';

interface Module {
  href: string;
  Icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  title: string;
  sub: string;
  badge?: React.ReactNode;
}

function fmtMXN(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}

export default function DashboardClient({
  userName,
  userRole,
  isManager,
  isBarraManager,
  liveStats,
}: Props) {
  const [tab, setTab] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);

  const tabs = ['Turno', 'Gestión'];

  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

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

  // Live badges
  const mesasBadge =
    liveStats.tablesAssigned > 0 ? (
      <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-400 mt-1">
        <CheckCircle2 size={10} strokeWidth={2.5} />
        {liveStats.tablesAssigned} asignadas
      </span>
    ) : (
      <span className="text-[10px] text-[#7d9990] mt-1 block">Sin asignar</span>
    );

  const comidasBadge =
    liveStats.activeMeals > 0 ? (
      <span
        className={`flex items-center gap-1 text-[10px] font-semibold mt-1 ${
          liveStats.overdueMeals > 0 ? 'text-red-400' : 'text-amber-400'
        }`}
      >
        {liveStats.overdueMeals > 0 && <AlertTriangle size={10} strokeWidth={2.5} />}
        {liveStats.activeMeals} en comida
        {liveStats.overdueMeals > 0 && ` · ${liveStats.overdueMeals} excedido${liveStats.overdueMeals !== 1 ? 's' : ''}`}
      </span>
    ) : (
      <span className="text-[10px] text-[#7d9990] mt-1 block">Todos en piso</span>
    );

  const ventasBadge =
    liveStats.salesCount > 0 ? (
      <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-400 mt-1">
        <CheckCircle2 size={10} strokeWidth={2.5} />
        {fmtMXN(liveStats.salesTotal)} · {liveStats.salesCount} cierre{liveStats.salesCount !== 1 ? 's' : ''}
      </span>
    ) : (
      <span className="text-[10px] text-[#7d9990] mt-1 block">Sin cierres hoy</span>
    );

  const checklistBadge =
    liveStats.checklistCount > 0 ? (
      <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-400 mt-1">
        <CheckCircle2 size={10} strokeWidth={2.5} />
        {liveStats.checklistCount} revision{liveStats.checklistCount !== 1 ? 'es' : ''} hoy
      </span>
    ) : (
      <span className="text-[10px] text-[#7d9990] mt-1 block">Pendiente</span>
    );

  const TURNO: Module[] = [
    { href: '/dashboard/mesas',     Icon: UtensilsCrossed, title: 'Mesas',     sub: 'Pick & Tap',         badge: mesasBadge },
    { href: '/dashboard/ventas',    Icon: Banknote,        title: 'Ventas',    sub: 'Cierre y propinas',  badge: ventasBadge },
    { href: '/dashboard/comidas',   Icon: Pizza,           title: 'Comidas',   sub: 'Control 30 min',     badge: comidasBadge },
    { href: '/dashboard/checklist', Icon: ClipboardList,   title: 'Checklist', sub: 'Apertura y cierre',  badge: checklistBadge },
  ];

  const GESTION: Module[] = [
    { href: '/dashboard/horarios',  Icon: Clock,   title: 'Horarios',  sub: 'Turnos semanales' },
    { href: '/dashboard/personal',  Icon: Users,   title: 'Personal',  sub: 'Colaboradores' },
    { href: '/dashboard/rubricas',  Icon: Star,    title: 'Rubricas',  sub: 'Evaluacion' },
    { href: '/dashboard/productos', Icon: Package, title: 'Productos', sub: 'Catalogo de ventas' },
  ];

  return (
    <div className="h-screen bg-[#0D1211] text-[#e6edea] flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-[#151D1A] border-b border-[#223530] px-4 py-3 flex items-center justify-between shadow-[0_2px_8px_rgba(0,0,0,0.2)] z-30 shrink-0 relative">
        <div className="flex items-center gap-2.5">
          <Image
            src="/icon-512.png"
            alt="WM Pizza Nostra"
            width={36}
            height={36}
            className="rounded-xl shrink-0"
            priority
          />
          <div>
            <h1 className="font-extrabold text-[#E8899A] text-lg leading-tight">
              WM Pizza Nostra
            </h1>
            <p className="text-xs text-[#7d9990] capitalize">{today}</p>
          </div>
        </div>

        {/* Avatar + dropdown */}
        <div ref={menuRef} className="relative">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#420F18]/80 border border-[#9E2A3E]/60 text-[#E8899A] active:scale-[0.98] transition duration-150 ease-out select-none"
            aria-label="Menu de usuario"
          >
            <span className="w-6 h-6 rounded-full flex items-center justify-center font-extrabold text-sm shrink-0">
              {userName.charAt(0).toUpperCase()}
            </span>
            <span className="text-[10px] font-semibold capitalize hidden xs:block">
              {userRole.replace('_', ' ')}
            </span>
            <ChevronDown
              size={13}
              strokeWidth={2.5}
              className={`transition-transform duration-200 ${menuOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {/* Dropdown */}
          {menuOpen && (
            <div className="absolute right-0 top-full mt-2 w-52 bg-[#151D1A] border border-[#223530] rounded-2xl shadow-2xl overflow-hidden z-50">
              {/* User info */}
              <div className="px-4 py-3 border-b border-[#223530]">
                <p className="font-bold text-[#e6edea] text-sm leading-tight">{userName}</p>
                <p className="text-xs text-[#7d9990] capitalize mt-0.5">{userRole.replace('_', ' ')}</p>
              </div>

              {/* Links */}
              <div className="py-1">
                {isManager && (
                  <Link
                    href="/dashboard/reportes"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-[#7d9990] hover:text-[#E8899A] hover:bg-[#1c2b27] transition duration-100"
                  >
                    <BarChart2 size={16} strokeWidth={1.5} className="shrink-0" />
                    <span className="text-sm font-semibold">Reportes</span>
                  </Link>
                )}
                <Link
                  href="/dashboard/ventas"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-[#7d9990] hover:text-[#E8899A] hover:bg-[#1c2b27] transition duration-100"
                >
                  <Banknote size={16} strokeWidth={1.5} className="shrink-0" />
                  <span className="text-sm font-semibold">Historial de ventas</span>
                </Link>
              </div>

              {/* Sign out */}
              <div className="border-t border-[#223530] py-1">
                <form action={signOutAction}>
                  <button
                    type="submit"
                    className="flex items-center gap-3 px-4 py-2.5 text-red-400 hover:text-red-300 hover:bg-[#1c2b27] transition duration-100 w-full text-left"
                  >
                    <LogOut size={16} strokeWidth={1.5} className="shrink-0" />
                    <span className="text-sm font-semibold">Cerrar sesión</span>
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
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
                  {m.badge}
                </Link>
              ))}
              {isBarraManager && (
                <Link href="/dashboard/barra" className={CARD}>
                  <Package size={22} strokeWidth={1.5} className="text-[#E8899A] mb-2" />
                  <span className="font-bold text-sm block text-[#e6edea]">Barra</span>
                  <span className="text-xs text-[#7d9990]">Inventario y mermas</span>
                </Link>
              )}
            </div>
          </section>

          {/* ── Gestión ── */}
          <section className="min-w-full h-full overflow-y-auto p-4 space-y-3">
            <div className="bg-[#151D1A] rounded-2xl border border-[#223530] p-4">
              <p className="text-xs font-bold text-[#7d9990] uppercase tracking-wider">
                Gestión del equipo
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
    </div>
  );
}
