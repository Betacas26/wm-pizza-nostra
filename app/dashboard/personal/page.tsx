import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export default async function PersonalPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return (
    <div className="min-h-screen bg-stone-50 text-stone-800">
      <header className="bg-white border-b border-stone-200 px-4 py-3 flex items-center gap-3 shadow-sm sticky top-0 z-10">
        <Link
          href="/dashboard"
          className="text-stone-400 hover:text-stone-700 text-xl leading-none"
          aria-label="Volver"
        >
          &#8592;
        </Link>
        <div>
          <h1 className="font-extrabold text-amber-600 text-lg leading-tight">
            Personal
          </h1>
          <p className="text-xs text-stone-500">Gestion de colaboradores</p>
        </div>
      </header>

      <main className="p-4 max-w-xl mx-auto mt-8">
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-8 text-center">
          <p className="text-5xl mb-4">&#128101;</p>
          <h2 className="font-bold text-stone-900 text-base mb-2">
            Gestion de Personal
          </h2>
          <p className="text-sm text-stone-400">
            Alta, edicion y roles de colaboradores. En construccion.
          </p>
        </div>
      </main>
    </div>
  );
}
