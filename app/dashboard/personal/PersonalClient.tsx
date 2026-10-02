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
  mesero:     'bg-[#420F18]/80 border border-[#9E2A3E]/60 text-[#E8899A]',
  ayudante:   'bg-orange-950/60 border border-orange-800/50 text-orange-300',
  hostess:    'bg-pink-950/60 border border-pink-800/50 text-pink-300',
  barrero:    'bg-teal-950/60 border border-teal-700/50 text-teal-300',
  supervisor: 'bg-sky-950/60 border border-sky-700/50 text-sky-300',
  admin:      'bg-purple-950/60 border border-purple-700/50 text-purple-300',
};

// ── Toggle switch ────────────────────────────────────────────────────────────
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

// ── Componente principal ─────────────────────────────────────────────────────
export default function PersonalClient({
  initialProfiles,
}: {
  initialProfiles: ProfileRecord[];
}) {
  const [profiles, setProfiles] = useState<ProfileRecord[]>(initialProfiles);
  const [editingAreaId, setEditingAreaId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const [formName, setFormName] = useState('');
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRole, setFormRole] = useState<Role>('mesero');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const map = new Map<string, ProfileRecord[]>(ROLE_ORDER.map((r) => [r, []]));
    for (const p of profiles) {
      if (!map.has(p.role)) map.set(p.role, []);
      map.get(p.role)!.push(p);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'es'));
    }
    return [...map.entries()].filter(([, arr]) => arr.length > 0);
  }, [profiles]);

  async function handleToggle(id: string, current: boolean) {
    setProfiles((prev) =>
      prev.map((p) => (p.id === id ? { ...p, active: !current } : p)),
    );
    const result = await setActiveAction(id, !current);
    if (!result.ok) {
      setProfiles((prev) =>
        prev.map((p) => (p.id === id ? { ...p, active: current } : p)),
      );
    }
  }

  async function handleUpdateArea(profileId: string, newArea: string | null) {
    const prevArea = profiles.find((p) => p.id === profileId)?.home_area ?? null;
    setEditingAreaId(null);
    setProfiles((prev) =>
      prev.map((p) => (p.id === profileId ? { ...p, home_area: newArea } : p)),
    );
    const result = await setHomeAreaAction(profileId, newArea);
    if (!result.ok) {
      setProfiles((prev) =>
        prev.map((p) => (p.id === profileId ? { ...p, home_area: prevArea } : p)),
      );
    }
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);
    const fd = new FormData();
    fd.set('name', formName.trim());
    fd.set('username', formUsername.trim());
    fd.set('password', formPassword);
    fd.set('role', formRole);
    const result = await createStaffAction(fd);
    if (result.ok) {
      setProfiles((prev) => [...prev, result.data]);
      setShowCreate(false);
      setFormName('');
      setFormUsername('');
      setFormPassword('');
      setFormRole('mesero');
    } else {
      setCreateError(result.error);
    }
    setCreating(false);
  }

  const totalActive = profiles.filter((p) => p.active).length;

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
            Personal
          </h1>
          <p className="text-xs text-[#7d9990]">
            {profiles.length} colaborador{profiles.length !== 1 ? 'es' : ''}{' '}
            &middot;{' '}
            <span className="text-emerald-400 font-semibold">
              {totalActive} activo{totalActive !== 1 ? 's' : ''}
            </span>
          </p>
        </div>
        <button
          onClick={() => {
            setCreateError(null);
            setShowCreate(true);
          }}
          className="bg-[#7A1D2E] hover:bg-[#9E2A3E] active:scale-[0.98] text-white text-sm font-bold px-3 min-h-[44px] rounded-xl shadow transition duration-150 ease-out select-none"
        >
          + Nuevo
        </button>
      </header>

      {/* Lista */}
      <main className="p-4 max-w-xl mx-auto space-y-4">
        {profiles.length === 0 && (
          <div className="text-center py-14 text-[#7d9990] text-sm">
            Sin colaboradores registrados.
          </div>
        )}

        {grouped.map(([role, members]) => (
          <section key={role}>
            <h2 className="text-xs font-bold text-[#7d9990] uppercase tracking-wider mb-2 px-1">
              {ROLE_LABELS[role as Role] ?? role}{' '}
              <span className="font-normal normal-case">({members.length})</span>
            </h2>

            <div className="bg-[#151D1A] rounded-2xl border border-[#223530] shadow-[0_2px_8px_rgba(0,0,0,0.2)] overflow-hidden">
              <ul className="divide-y divide-[#223530]">
                {members.map((profile) => {
                  const badgeClass =
                    ROLE_BADGE[profile.role as Role] ??
                    'bg-[#1c2b27] border border-[#223530] text-[#7d9990]';
                  return (
                    <li key={profile.id} className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm ${
                            profile.active
                              ? badgeClass
                              : 'bg-[#1c2b27] border border-[#223530] text-[#7d9990]'
                          }`}
                        >
                          {(profile.name ?? '?').charAt(0).toUpperCase()}
                        </div>

                        <div className="flex-1 min-w-0">
                          <p
                            className={`font-semibold text-sm leading-tight truncate ${
                              profile.active
                                ? 'text-[#e6edea]'
                                : 'text-[#7d9990] line-through'
                            }`}
                          >
                            {profile.name ?? '(sin nombre)'}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <span
                              className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                                profile.active
                                  ? badgeClass
                                  : 'bg-[#1c2b27] border border-[#223530] text-[#7d9990]'
                              }`}
                            >
                              {ROLE_LABELS[profile.role as Role] ?? profile.role}
                            </span>

                            {profile.role === 'mesero' &&
                              (editingAreaId === profile.id ? (
                                <div className="flex gap-1 flex-wrap">
                                  {AREAS.map((area) => (
                                    <button
                                      key={area}
                                      type="button"
                                      onClick={() => handleUpdateArea(profile.id, area)}
                                      className={`text-xs px-2 py-0.5 rounded-full font-semibold transition ${
                                        profile.home_area === area
                                          ? 'bg-[#7A1D2E] text-white'
                                          : 'bg-[#1c2b27] border border-[#223530] text-[#7d9990] hover:text-[#e6edea]'
                                      }`}
                                    >
                                      {area}
                                    </button>
                                  ))}
                                  <button
                                    type="button"
                                    onClick={() => setEditingAreaId(null)}
                                    className="text-xs px-1.5 py-0.5 rounded-full bg-[#1c2b27] border border-[#223530] text-[#7d9990] hover:text-[#e6edea]"
                                  >
                                    ✕
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setEditingAreaId(profile.id)}
                                  className="text-xs px-1.5 py-0.5 rounded-full bg-[#1c2b27] border border-[#223530] text-[#7d9990] hover:text-[#e6edea] transition"
                                >
                                  {profile.home_area
                                    ? (AREA_LABELS[profile.home_area as Area] ??
                                      profile.home_area)
                                    : 'Sin area ✎'}
                                </button>
                              ))}
                          </div>
                        </div>

                        <Toggle
                          active={profile.active}
                          onChange={() => handleToggle(profile.id, profile.active)}
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
          className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowCreate(false);
          }}
        >
          <div className="bg-[#151D1A] border border-[#223530] rounded-2xl shadow-2xl w-full max-w-sm p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-extrabold text-[#e6edea] text-base">
                Nuevo colaborador
              </h2>
              <button
                onClick={() => setShowCreate(false)}
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
                  Nombre completo
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ej. Juan Perez"
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-[#223530] bg-[#1c2b27] text-[#e6edea] text-base focus:outline-none focus:ring-2 focus:ring-[#7A1D2E]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#7d9990] uppercase tracking-wider mb-1">
                  Usuario
                </label>
                <input
                  type="text"
                  required
                  value={formUsername}
                  onChange={(e) =>
                    setFormUsername(
                      e.target.value.replace(/[^a-z0-9._-]/gi, '').toLowerCase(),
                    )
                  }
                  placeholder="Ej. juan.perez"
                  autoCapitalize="none"
                  autoCorrect="off"
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-[#223530] bg-[#1c2b27] text-[#e6edea] text-base font-mono focus:outline-none focus:ring-2 focus:ring-[#7A1D2E]"
                />
                {formUsername && (
                  <p className="text-xs text-[#7d9990] mt-1 pl-1">
                    Acceso: {formUsername}@staff.pizzanostra.mx
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-[#7d9990] uppercase tracking-wider mb-1">
                  Contrasena temporal
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  placeholder="Minimo 6 caracteres"
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-[#223530] bg-[#1c2b27] text-[#e6edea] text-base focus:outline-none focus:ring-2 focus:ring-[#7A1D2E]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#7d9990] uppercase tracking-wider mb-1">
                  Rol
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {ROLES.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setFormRole(r)}
                      className={`min-h-[40px] rounded-xl text-xs font-semibold transition px-1 active:scale-[0.98] ${
                        formRole === r
                          ? ROLE_BADGE[r]
                          : 'bg-[#1c2b27] border border-[#223530] text-[#7d9990] hover:text-[#e6edea]'
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
                className="w-full min-h-[44px] bg-[#7A1D2E] hover:bg-[#9E2A3E] active:scale-[0.98] text-white font-bold rounded-xl shadow transition text-sm disabled:opacity-50"
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
