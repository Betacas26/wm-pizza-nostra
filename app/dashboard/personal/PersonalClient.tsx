'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import type { ProfileRecord } from './actions';
import {
  createStaffAction,
  setActiveAction,
  setHomeAreaAction,
} from './actions';

// ── Constantes ──────────────────────────────────────────────────────────────
const AREAS = ['PB', 'PA', 'TE'] as const;
type Area = (typeof AREAS)[number];

const ROLES = ['mesero', 'ayudante', 'hostess', 'barrero', 'supervisor', 'admin'] as const;
type Role = (typeof ROLES)[number];

const ROLE_ORDER: Role[] = ['admin', 'supervisor', 'hostess', 'mesero', 'barrero', 'ayudante'];

const AREA_LABELS: Record<Area, string> = {
  PB: 'Planta Baja',
  PA: 'Planta Alta',
  TE: 'Terraza',
};

const ROLE_LABELS: Record<Role, string> = {
  mesero: 'Mesero',
  ayudante: 'Ayudante',
  hostess: 'Hostess',
  barrero: 'Barrero',
  supervisor: 'Supervisor',
  admin: 'Admin',
};

const ROLE_BADGE: Record<Role, string> = {
  mesero: 'bg-amber-100 text-amber-700',
  ayudante: 'bg-orange-100 text-orange-700',
  hostess: 'bg-pink-100 text-pink-700',
  barrero: 'bg-teal-100 text-teal-700',
  supervisor: 'bg-sky-100 text-sky-700',
  admin: 'bg-violet-100 text-violet-700',
};

// ── Toggle switch ────────────────────────────────────────────────────────────
function Toggle({
  active,
  onChange,
}: {
  active: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      aria-label={active ? 'Desactivar' : 'Activar'}
      className={`relative inline-flex w-11 h-6 shrink-0 rounded-full transition-colors duration-200 ${
        active ? 'bg-emerald-500' : 'bg-stone-300'
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

// ── Componente principal ─────────────────────────────────────────────────────
export default function PersonalClient({
  initialProfiles,
}: {
  initialProfiles: ProfileRecord[];
}) {
  const [profiles, setProfiles] = useState<ProfileRecord[]>(initialProfiles);
  const [editingAreaId, setEditingAreaId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  // Estado del formulario de creación
  const [formName, setFormName] = useState('');
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRole, setFormRole] = useState<Role>('mesero');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // ── Agrupar por rol ────────────────────────────────────────────────────
  const grouped = useMemo(() => {
    const map = new Map<string, ProfileRecord[]>(ROLE_ORDER.map((r) => [r, []]));
    for (const p of profiles) {
      if (!map.has(p.role)) map.set(p.role, []);
      map.get(p.role)!.push(p);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) =>
        (a.name ?? '').localeCompare(b.name ?? '', 'es'),
      );
    }
    return [...map.entries()].filter(([, arr]) => arr.length > 0);
  }, [profiles]);

  // ── Handlers ──────────────────────────────────────────────────────────
  async function handleToggle(id: string, current: boolean) {
    // Optimista
    setProfiles((prev) =>
      prev.map((p) => (p.id === id ? { ...p, active: !current } : p)),
    );
    try {
      await setActiveAction(id, !current);
    } catch {
      // Revertir
      setProfiles((prev) =>
        prev.map((p) => (p.id === id ? { ...p, active: current } : p)),
      );
    }
  }

  async function handleUpdateArea(profileId: string, newArea: string | null) {
    const prevArea =
      profiles.find((p) => p.id === profileId)?.home_area ?? null;
    setEditingAreaId(null);
    // Optimista
    setProfiles((prev) =>
      prev.map((p) =>
        p.id === profileId ? { ...p, home_area: newArea } : p,
      ),
    );
    try {
      await setHomeAreaAction(profileId, newArea);
    } catch {
      // Revertir
      setProfiles((prev) =>
        prev.map((p) =>
          p.id === profileId ? { ...p, home_area: prevArea } : p,
        ),
      );
    }
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);
    try {
      const fd = new FormData();
      fd.set('name', formName.trim());
      fd.set('username', formUsername.trim());
      fd.set('password', formPassword);
      fd.set('role', formRole);
      const created = await createStaffAction(fd);
      setProfiles((prev) => [...prev, created]);
      setShowCreate(false);
      setFormName('');
      setFormUsername('');
      setFormPassword('');
      setFormRole('mesero');
    } catch (err) {
      setCreateError(
        err instanceof Error ? err.message : 'Error al crear el colaborador.',
      );
    }
    setCreating(false);
  }

  const totalActive = profiles.filter((p) => p.active).length;

  return (
    <div className="min-h-screen bg-stone-50 text-stone-800">
      {/* Header */}
      <header className="bg-white border-b border-stone-200 px-4 py-3 flex items-center gap-3 shadow-sm sticky top-0 z-10">
        <Link
          href="/dashboard"
          className="text-stone-400 hover:text-stone-700 text-xl leading-none"
          aria-label="Volver"
        >
          &#8592;
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="font-extrabold text-amber-600 text-lg leading-tight">
            Personal
          </h1>
          <p className="text-xs text-stone-500">
            {profiles.length} colaborador{profiles.length !== 1 ? 'es' : ''}{' '}
            &middot;{' '}
            <span className="text-emerald-600 font-semibold">
              {totalActive} activo{totalActive !== 1 ? 's' : ''}
            </span>
          </p>
        </div>
        <button
          onClick={() => {
            setCreateError(null);
            setShowCreate(true);
          }}
          className="bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white text-sm font-bold px-3 py-2 rounded-xl shadow transition"
        >
          + Nuevo
        </button>
      </header>

      {/* Lista */}
      <main className="p-4 max-w-xl mx-auto space-y-4">
        {profiles.length === 0 && (
          <div className="text-center py-14 text-stone-400 text-sm">
            Sin colaboradores registrados.
          </div>
        )}

        {grouped.map(([role, members]) => (
          <section key={role}>
            <h2 className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-2 px-1">
              {ROLE_LABELS[role as Role] ?? role}{' '}
              <span className="font-normal normal-case">({members.length})</span>
            </h2>

            <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
              <ul className="divide-y divide-stone-100">
                {members.map((profile) => {
                  const badgeClass =
                    ROLE_BADGE[profile.role as Role] ??
                    'bg-stone-100 text-stone-600';
                  return (
                    <li key={profile.id} className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {/* Avatar inicial */}
                        <div
                          className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm ${
                            profile.active
                              ? badgeClass
                              : 'bg-stone-100 text-stone-400'
                          }`}
                        >
                          {(profile.name ?? '?').charAt(0).toUpperCase()}
                        </div>

                        {/* Nombre + badges */}
                        <div className="flex-1 min-w-0">
                          <p
                            className={`font-semibold text-sm leading-tight truncate ${
                              profile.active
                                ? 'text-stone-900'
                                : 'text-stone-400 line-through'
                            }`}
                          >
                            {profile.name ?? '(sin nombre)'}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <span
                              className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                                profile.active
                                  ? badgeClass
                                  : 'bg-stone-100 text-stone-400'
                              }`}
                            >
                              {ROLE_LABELS[profile.role as Role] ?? profile.role}
                            </span>

                            {/* Área editable (solo meseros) */}
                            {profile.role === 'mesero' &&
                              (editingAreaId === profile.id ? (
                                <div className="flex gap-1 flex-wrap">
                                  {AREAS.map((area) => (
                                    <button
                                      key={area}
                                      type="button"
                                      onClick={() =>
                                        handleUpdateArea(profile.id, area)
                                      }
                                      className={`text-xs px-2 py-0.5 rounded-full font-semibold transition ${
                                        profile.home_area === area
                                          ? 'bg-amber-500 text-white'
                                          : 'bg-stone-100 text-stone-600 hover:bg-amber-100'
                                      }`}
                                    >
                                      {area}
                                    </button>
                                  ))}
                                  <button
                                    type="button"
                                    onClick={() => setEditingAreaId(null)}
                                    className="text-xs px-1.5 py-0.5 rounded-full bg-stone-100 text-stone-500 hover:bg-stone-200"
                                  >
                                    ✕
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setEditingAreaId(profile.id)
                                  }
                                  className="text-xs px-1.5 py-0.5 rounded-full bg-stone-100 text-stone-500 hover:bg-stone-200 transition"
                                >
                                  {profile.home_area
                                    ? (AREA_LABELS[profile.home_area as Area] ??
                                      profile.home_area)
                                    : 'Sin área ✎'}
                                </button>
                              ))}
                          </div>
                        </div>

                        {/* Toggle activo */}
                        <Toggle
                          active={profile.active}
                          onChange={() =>
                            handleToggle(profile.id, profile.active)
                          }
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>
        ))}
      </main>

      {/* Modal: nuevo colaborador */}
      {showCreate && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowCreate(false);
          }}
        >
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-extrabold text-stone-900 text-base">
                Nuevo colaborador
              </h2>
              <button
                onClick={() => setShowCreate(false)}
                className="text-stone-400 hover:text-stone-700 text-xl leading-none"
                aria-label="Cerrar"
              >
                &#10005;
              </button>
            </div>

            {createError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 font-medium">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-3">
              {/* Nombre */}
              <div>
                <label className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-1">
                  Nombre completo
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ej. Juan Pérez"
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-500 text-stone-800 text-base"
                />
              </div>

              {/* Usuario */}
              <div>
                <label className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-1">
                  Usuario
                </label>
                <input
                  type="text"
                  required
                  value={formUsername}
                  onChange={(e) =>
                    setFormUsername(e.target.value.replace(/[^a-z0-9._-]/gi, '').toLowerCase())
                  }
                  placeholder="Ej. juan.perez"
                  autoCapitalize="none"
                  autoCorrect="off"
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-500 text-stone-800 text-base font-mono"
                />
                {formUsername && (
                  <p className="text-xs text-stone-400 mt-1 pl-1">
                    Acceso: {formUsername}@staff.pizzanostra.mx
                  </p>
                )}
              </div>

              {/* Contraseña temporal */}
              <div>
                <label className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-1">
                  Contraseña temporal
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-500 text-stone-800 text-base"
                />
              </div>

              {/* Rol */}
              <div>
                <label className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-1">
                  Rol
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {ROLES.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setFormRole(r)}
                      className={`min-h-[40px] rounded-xl text-xs font-semibold transition px-1 ${
                        formRole === r
                          ? ROLE_BADGE[r]
                          : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
                      }`}
                    >
                      {ROLE_LABELS[r]}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={creating}
                className="w-full min-h-[44px] bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white font-bold rounded-xl shadow transition text-sm disabled:opacity-50"
              >
                {creating ? 'Creando...' : 'Crear colaborador'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
