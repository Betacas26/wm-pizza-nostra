'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

export interface ProductRecord {
  id: string;
  name: string;
  category: string;
  active: boolean;
}

async function verifyManager() {
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

export async function createProductAction(
  name: string,
  category: string,
): Promise<ProductRecord> {
  await verifyManager();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('products')
    .insert({ name: name.trim(), category: category.trim() || 'General' })
    .select('id, name, category, active')
    .single();
  if (error || !data) throw new Error(error?.message ?? 'Error al crear producto');
  revalidatePath('/dashboard/productos');
  return data as ProductRecord;
}

export async function toggleProductAction(id: string, active: boolean): Promise<void> {
  await verifyManager();
  const admin = createAdminClient();
  const { error } = await admin.from('products').update({ active }).eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/dashboard/productos');
}

export async function deleteProductAction(id: string): Promise<void> {
  await verifyManager();
  const admin = createAdminClient();
  const { error } = await admin.from('products').delete().eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/dashboard/productos');
}
