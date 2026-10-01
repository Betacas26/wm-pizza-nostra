'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setErrorMsg('Credenciales inválidas. Verifica tu correo y contraseña.');
      setLoading(false);
    } else {
      router.push('/dashboard');
      router.refresh();
    }
  };

  return (
    <div className="min-h-screen bg-stone-100 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white p-6 rounded-2xl shadow-lg border border-stone-200">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-black text-amber-600 tracking-wide">
            WM PIZZA NOSTRA
          </h1>
          <p className="text-sm text-stone-500 mt-1">Gestión operativa de turno</p>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm font-medium border border-red-200">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
              Correo
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-500 text-stone-800 text-base"
              placeholder="tu@correo.com"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
              Contraseña
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-500 text-stone-800 text-base"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl transition duration-150 disabled:opacity-50 mt-2 shadow"
          >
            {loading ? 'Verificando...' : 'Iniciar Sesión'}
          </button>
        </form>
      </div>
    </div>
  );
}