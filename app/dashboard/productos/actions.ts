'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';


export interface ProductRecord {
  id: string;
  name: string;
  category: string;
  active: boolean;
}

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

async function verifyManager() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('No autorizado.');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin' && profile?.role !== 'supervisor') {
    return null;
  }
  return true;
}

export async function createProductAction(
  name: string,
  category: string,
): Promise<ActionResult<ProductRecord>> {
  try {
    const ok = await verifyManager();
    if (!ok) return { ok: false, error: 'No autorizado.' };

    const admin = createAdminClient();
    const { data, error } = await admin
      .from('products')
      .insert({ name: name.trim(), category: category.trim() || 'General' })
      .select('id, name, category, active')
      .single();

    if (error || !data) return { ok: false, error: error?.message ?? 'Error al crear producto.' };

    return { ok: true, data: data as ProductRecord };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error desconocido.' };
  }
}

export async function toggleProductAction(
  id: string,
  active: boolean,
): Promise<ActionResult> {
  try {
    const ok = await verifyManager();
    if (!ok) return { ok: false, error: 'No autorizado.' };

    const admin = createAdminClient();
    const { error } = await admin.from('products').update({ active }).eq('id', id);

    if (error) return { ok: false, error: error.message };

    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error desconocido.' };
  }
}

export async function deleteProductAction(id: string): Promise<ActionResult> {
  try {
    const ok = await verifyManager();
    if (!ok) return { ok: false, error: 'No autorizado.' };

    const admin = createAdminClient();
    const { error } = await admin.from('products').delete().eq('id', id);

    if (error) return { ok: false, error: error.message };

    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error desconocido.' };
  }
}
