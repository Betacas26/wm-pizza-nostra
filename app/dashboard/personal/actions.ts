'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

// ── Tipos ───────────────────────────────────────────────────────────────────
type Role = 'mesero' | 'ayudante' | 'hostess' | 'barrero' | 'supervisor' | 'admin';

export interface ProfileRecord {
  id: string;
  name: string | null;
  role: string;
  home_area: string | null;
  active: boolean;
}

// ── Auth guard ──────────────────────────────────────────────────────────────
async function verifyAdmin() {
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

  if (profile?.role !== 'admin' && profile?.role !== 'supervisor') {
    throw new Error('No autorizado: se requiere rol admin o supervisor.');
  }
}

// ── Crear colaborador ───────────────────────────────────────────────────────
export async function createStaffAction(formData: FormData): Promise<ProfileRecord> {
  await verifyAdmin();

  const name = (formData.get('name') as string).trim();
  const username = (formData.get('username') as string).trim().toLowerCase();
  const password = formData.get('password') as string;
  const role = formData.get('role') as Role;

  // Email interno auto-generado — los colaboradores no necesitan correo real
  const email = `${username}@staff.pizzanostra.mx`;

  const admin = createAdminClient();

  const { data: userData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authError || !userData.user) {
    throw new Error(authError?.message ?? 'Error al crear el usuario.');
  }

  const newProfile: ProfileRecord = {
    id: userData.user.id,
    name,
    role,
    home_area: null,
    active: true,
  };

  const { error: profileError } = await admin
    .from('profiles')
    .upsert(newProfile);

  if (profileError) {
    // Revertir: eliminar el usuario auth creado
    await admin.auth.admin.deleteUser(userData.user.id);
    throw new Error(profileError.message);
  }

  return newProfile;
}

// ── Cambiar estado activo ───────────────────────────────────────────────────
export async function setActiveAction(id: string, active: boolean): Promise<void> {
  await verifyAdmin();
  const admin = createAdminClient();
  const { error } = await admin.from('profiles').update({ active }).eq('id', id);
  if (error) throw new Error(error.message);
}

// ── Actualizar home_area ────────────────────────────────────────────────────
export async function setHomeAreaAction(
  id: string,
  home_area: string | null,
): Promise<void> {
  await verifyAdmin();
  const admin = createAdminClient();
  const { error } = await admin
    .from('profiles')
    .update({ home_area })
    .eq('id', id);
  if (error) throw new Error(error.message);
}
