import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ChevronLeft } from 'lucide-react';
import MesasClient from './MesasClient';
import type { MeseroData, AyudanteData } from './MesasClient';

export default async function MesasPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const isManager =
    profile?.role === 'admin' || profile?.role === 'supervisor';

  const today = new Date().toISOString().split('T')[0];

  const [{ data: mData }, { data: aData }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, name, home_area')
      .eq('role', 'mesero')
      .eq('active', true)
      .order('name'),
    supabase
      .from('profiles')
      .select('id, name, home_area')
      .eq('role', 'ayudante')
      .eq('active', true)
      .order('name'),
  ]);

  const meseros: MeseroData[] = (mData ?? []).map(
    (p: { id: string; name: string | null; home_area: string | null }) => ({
      id: p.id,
      name: p.name ?? '(sin nombre)',
      home_area: p.home_area,
    }),
  );

  const ayudantes: AyudanteData[] = (aData ?? []).map(
    (p: { id: string; name: string | null; home_area: string | null }) => ({
      id: p.id,
      name: p.name ?? '(sin nombre)',
      home_area: p.home_area,
    }),
  );

  return (
    <div className="min-h-screen bg-[#0D1211] text-[#e6edea]">
      <header className="bg-[#151D1A] border-b border-[#223530] px-4 py-3 flex items-center gap-3 shadow-[0_2px_8px_rgba(0,0,0,0.2)] sticky top-0 z-10">
        <Link
          href="/dashboard"
          className="flex items-center justify-center w-9 h-9 rounded-xl text-[#7d9990] hover:text-[#e6edea] hover:bg-[#1c2b27] transition active:scale-[0.95]"
          aria-label="Volver"
        >
          <ChevronLeft size={22} strokeWidth={2.5} />
        </Link>
        <Image src="/icon-512.png" alt="" width={28} height={28} className="rounded-lg shrink-0" />
        <div>
          <h1 className="font-extrabold text-[#E8899A] text-lg leading-tight">
            Asignacion de Mesas
          </h1>
          <p className="text-xs text-[#7d9990]">
            {meseros.length} mesero{meseros.length !== 1 ? 's' : ''} activos
            {ayudantes.length > 0 && ` · ${ayudantes.length} ayudante${ayudantes.length !== 1 ? 's' : ''}`}
          </p>
        </div>
      </header>

      <main className="p-4 max-w-xl mx-auto">
        <MesasClient
          meseros={meseros}
          ayudantes={ayudantes}
          today={today}
          isManager={isManager}
        />
      </main>
    </div>
  );
}
