'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

// ── Tipos ───────────────────────────────────────────────────────────────────
type Role = 'mesero' | 'ayudante' | 'hostess' | 'barrero' | 'supervisor' | 'admin';

export interface ProfileRecord {
  id: string;
  name: string | null;
  role: string;
  home_area: string | null;
  active: boolean;
}

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

// ── Auth guard ──────────────────────────────────────────────────────────────
async function verifyAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  return profile?.role === 'admin' || profile?.role === 'supervisor';
}

// ── Crear colaborador ───────────────────────────────────────────────────────
export async function createStaffAction(formData: FormData): Promise<ActionResult<ProfileRecord>> {
  try {
    const ok = await verifyAdmin();
    if (!ok) return { ok: false, error: 'No autorizado.' };

    const name = (formData.get('name') as string).trim();
    const username = (formData.get('username') as string).trim().toLowerCase();
    const password = formData.get('password') as string;
    const role = formData.get('role') as Role;

    const email = `${username}@staff.pizzanostra.mx`;
    const admin = createAdminClient();

    const { data: userData, error: authError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError || !userData.user) {
      return { ok: false, error: authError?.message ?? 'Error al crear el usuario.' };
    }

    const newProfile: ProfileRecord = {
      id: userData.user.id,
      name,
      role,
      home_area: null,
      active: true,
    };

    const { error: profileError } = await admin.from('profiles').upsert(newProfile);

    if (profileError) {
      await admin.auth.admin.deleteUser(userData.user.id);
      return { ok: false, error: profileError.message };
    }

    return { ok: true, data: newProfile };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error desconocido.' };
  }
}

// ── Cambiar estado activo ───────────────────────────────────────────────────
export async function setActiveAction(id: string, active: boolean): Promise<ActionResult> {
  try {
    const ok = await verifyAdmin();
    if (!ok) return { ok: false, error: 'No autorizado.' };

    const admin = createAdminClient();
    const { error } = await admin.from('profiles').update({ active }).eq('id', id);
    if (error) return { ok: false, error: error.message };

    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error desconocido.' };
  }
}

// ── Actualizar home_area ────────────────────────────────────────────────────
export async function setHomeAreaAction(
  id: string,
  home_area: string | null,
): Promise<ActionResult> {
  try {
    const ok = await verifyAdmin();
    if (!ok) return { ok: false, error: 'No autorizado.' };

    const admin = createAdminClient();
    const { error } = await admin.from('profiles').update({ home_area }).eq('id', id);
    if (error) return { ok: false, error: error.message };

    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error desconocido.' };
  }
}
