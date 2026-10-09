import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import BarraClient, { type InventoryItem, type MermaRecord } from './BarraClient';

export default async function BarraPage() {
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

  const role = (profile as { role: string | null } | null)?.role ?? '';
  if (role !== 'admin' && role !== 'encargado_barra' && role !== 'supervisor') {
    redirect('/dashboard');
  }

  const today = new Date().toISOString().split('T')[0];

  const [{ data: inventoryData }, { data: mermasData }] = await Promise.all([
    supabase
      .from('bar_inventory')
      .select('id, product_name, category, unit, bottle_ml, stock, min_stock')
      .order('category')
      .order('product_name'),
    supabase
      .from('bar_mermas')
      .select('id, product_name, quantity, reason, created_at')
      .eq('shift_date', today)
      .order('created_at', { ascending: false }),
  ]);

  const inventory: InventoryItem[] = (inventoryData ?? []).map(
    (r: { id: string; product_name: string; category: string; unit: string; bottle_ml: number | null; stock: number; min_stock: number }) => ({
      id: r.id,
      product_name: r.product_name,
      category: r.category,
      unit: r.unit,
      bottle_ml: r.bottle_ml ?? 750,
      stock: Number(r.stock),
      min_stock: Number(r.min_stock),
    }),
  );

  const mermasHoy: MermaRecord[] = (mermasData ?? []).map(
    (r: { id: string; product_name: string; quantity: number; reason: string; created_at: string }) => ({
      id: r.id,
      product_name: r.product_name,
      quantity: Number(r.quantity),
      reason: r.reason,
      created_at: r.created_at,
    }),
  );

  return (
    <BarraClient inventory={inventory} mermasHoy={mermasHoy} today={today} />
  );
}
