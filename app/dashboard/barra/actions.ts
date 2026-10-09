'use server';

/*
  SQL para crear las tablas en Supabase (ejecutar una sola vez):

  CREATE TABLE public.bar_inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'licores',
    unit TEXT NOT NULL DEFAULT 'botellas',
    stock NUMERIC(10,2) NOT NULL DEFAULT 0,
    min_stock NUMERIC(10,2) NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE TABLE public.bar_mermas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inventory_id UUID REFERENCES public.bar_inventory(id),
    product_name TEXT NOT NULL,
    quantity NUMERIC(10,2) NOT NULL,
    reason TEXT NOT NULL,
    shift_date DATE NOT NULL DEFAULT CURRENT_DATE,
    recorded_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
*/

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export interface MermaRecord {
  id: string;
  product_name: string;
  quantity: number;
  reason: string;
  created_at: string;
}

async function assertBarraRole(): Promise<string> {
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

  const role = (profile as { role: string | null } | null)?.role ?? '';
  if (role !== 'admin' && role !== 'encargado_barra') {
    throw new Error('Acceso denegado: se requiere rol de barra o admin.');
  }
  return user.id;
}

export interface InventoryItem {
  id: string;
  product_name: string;
  category: string;
  unit: string;
  stock: number;
  min_stock: number;
}

export async function addInventoryProductAction(params: {
  product_name: string;
  category: string;
  unit: string;
  stock: number;
  min_stock: number;
}): Promise<InventoryItem> {
  await assertBarraRole();
  const admin = createAdminClient();

  const { data: inserted, error } = await admin
    .from('bar_inventory')
    .insert({
      product_name: params.product_name.trim(),
      category: params.category.trim(),
      unit: params.unit.trim(),
      stock: params.stock,
      min_stock: params.min_stock,
    })
    .select('id, product_name, category, unit, stock, min_stock')
    .single();

  if (error || !inserted) throw new Error(error?.message ?? 'Error al agregar producto.');

  const row = inserted as InventoryItem;
  return row;
}

export async function deleteInventoryProductAction(inventoryId: string): Promise<void> {
  await assertBarraRole();
  const admin = createAdminClient();
  const { error } = await admin.from('bar_inventory').delete().eq('id', inventoryId);
  if (error) throw new Error(error.message);
}

export async function updateInventoryStockAction(
  inventoryId: string,
  newStock: number,
): Promise<void> {
  await assertBarraRole();
  const admin = createAdminClient();

  const { error } = await admin
    .from('bar_inventory')
    .update({ stock: newStock, updated_at: new Date().toISOString() })
    .eq('id', inventoryId);

  if (error) throw new Error(error.message);
}

export async function recordMermaAction(params: {
  inventoryId: string;
  productName: string;
  quantity: number;
  reason: string;
}): Promise<MermaRecord> {
  const userId = await assertBarraRole();
  const admin = createAdminClient();

  const today = new Date().toISOString().split('T')[0];

  const { data: inserted, error } = await admin
    .from('bar_mermas')
    .insert({
      inventory_id: params.inventoryId,
      product_name: params.productName,
      quantity: params.quantity,
      reason: params.reason,
      shift_date: today,
      recorded_by: userId,
    })
    .select('id, product_name, quantity, reason, created_at')
    .single();

  if (error || !inserted) throw new Error(error?.message ?? 'Error al registrar merma.');

  // Reduce inventory stock
  const { data: current } = await admin
    .from('bar_inventory')
    .select('stock')
    .eq('id', params.inventoryId)
    .single();

  if (current) {
    const currentStock = (current as { stock: number }).stock;
    const newStock = Math.max(0, parseFloat((currentStock - params.quantity).toFixed(2)));
    await admin
      .from('bar_inventory')
      .update({ stock: newStock, updated_at: new Date().toISOString() })
      .eq('id', params.inventoryId);
  }

  const row = inserted as { id: string; product_name: string; quantity: number; reason: string; created_at: string };
  return {
    id: row.id,
    product_name: row.product_name,
    quantity: row.quantity,
    reason: row.reason,
    created_at: row.created_at,
  };
}
