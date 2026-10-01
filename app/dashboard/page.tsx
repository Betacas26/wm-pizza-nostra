import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';

interface UserProfile {
  name: string | null;
  role: string | null;
  home_area: string | null;
}

const MODULE_CARD =
  'p-4 bg-white rounded-xl border border-stone-200 shadow-sm text-left hover:border-amber-400 active:bg-stone-50 transition block min-h-[80px]';

const MODULE_CARD_DISABLED =
  'p-4 bg-white rounded-xl border border-stone-100 shadow-sm text-left opacity-50 cursor-not-allowed block min-h-[80px]';

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data } = await supabase
    .from('profiles')
    .select('name, role, home_area')
    .eq('id', user.id)
    .single();

  const profile = data as UserProfile | null;

  return (
    <div className="min-h-screen bg-stone-50 text-stone-800">
      <header className="bg-white border-b border-stone-200 px-4 py-3 flex items-center justify-between shadow-sm sticky top-0 z-10">
        <div>
          <h1 className="font-extrabold text-amber-600 text-lg leading-tight">
            WM Pizza Nostra
          </h1>
          <p className="text-xs text-stone-500">
            {profile?.name ?? user.email ?? 'Usuario'} &middot;{' '}
            <span className="capitalize font-semibold text-stone-700">
              {profile?.role ?? 'Personal'}
            </span>
          </p>
        </div>
      </header>

      <main className="p-4 max-w-xl mx-auto space-y-4">
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm">
          <h2 className="text-base font-bold text-stone-900 mb-1">
            Panel Operativo
          </h2>
          <p className="text-sm text-stone-500">
            Selecciona un modulo para gestionar el turno:
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* ── Modulos funcionales ─────────────────────────────────── */}
          <Link href="/dashboard/mesas" className={MODULE_CARD}>
            <span className="text-2xl block mb-1">&#127869;&#65039;</span>
            <span className="font-bold text-sm block">Mesas</span>
            <span className="text-xs text-stone-400">Asignar por area</span>
          </Link>

          <Link href="/dashboard/horarios" className={MODULE_CARD}>
            <span className="text-2xl block mb-1">&#9200;</span>
            <span className="font-bold text-sm block">Horarios</span>
            <span className="text-xs text-stone-400">Turnos semanales</span>
          </Link>

          <Link href="/dashboard/ventas" className={MODULE_CARD}>
            <span className="text-2xl block mb-1">&#128181;</span>
            <span className="font-bold text-sm block">Ventas</span>
            <span className="text-xs text-stone-400">Cierre y propinas</span>
          </Link>

          <Link href="/dashboard/comidas" className={MODULE_CARD}>
            <span className="text-2xl block mb-1">&#127829;</span>
            <span className="font-bold text-sm block">Comidas</span>
            <span className="text-xs text-stone-400">Control 30 min</span>
          </Link>

          <Link href="/dashboard/personal" className={MODULE_CARD}>
            <span className="text-2xl block mb-1">&#128101;</span>
            <span className="font-bold text-sm block">Personal</span>
            <span className="text-xs text-stone-400">Colaboradores</span>
          </Link>

          {/* ── Modulos funcionales (continuación) ──────────────────── */}
          <Link href="/dashboard/checklist" className={MODULE_CARD}>
            <span className="text-2xl block mb-1">&#128203;</span>
            <span className="font-bold text-sm block">Checklist</span>
            <span className="text-xs text-stone-400">Apertura y cierre</span>
          </Link>

          <Link href="/dashboard/rubricas" className={`${MODULE_CARD} col-span-2`}>
            <span className="text-2xl block mb-1">&#11088;</span>
            <span className="font-bold text-sm block">Rubricas</span>
            <span className="text-xs text-stone-400">Evaluacion de desempeno</span>
          </Link>
        </div>
      </main>
    </div>
  );
}