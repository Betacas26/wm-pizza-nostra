import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import DiarioClient, {
  type DiarioProduct,
  type SnapshotEntry,
  type SnapshotMap,
} from './DiarioClient';

export default async function DiarioPage() {
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
  if (role !== 'admin' && role !== 'encargado_barra') redirect('/dashboard');

  const today = new Date().toISOString().split('T')[0];

  const [{ data: inventoryData }, { data: snapshotData }] = await Promise.all([
    supabase
      .from('bar_inventory')
      .select('id, product_name, category, bottle_ml, min_stock')
      .order('category')
      .order('product_name'),
    supabase
      .from('bar_daily_inventory')
      .select('shift, snapshot_type, inventory_id, closed_bottles, open_fraction')
      .eq('inventory_date', today),
  ]);

  const products: DiarioProduct[] = (inventoryData ?? []).map(
    (r: {
      id: string;
      product_name: string;
      category: string;
      bottle_ml: number | null;
      min_stock: number;
    }) => ({
      id: r.id,
      product_name: r.product_name,
      category: r.category,
      bottle_ml: r.bottle_ml ?? 750,
      min_stock: Number(r.min_stock),
    }),
  );

  const snapshots: SnapshotMap = {};
  for (const row of snapshotData ?? []) {
    const r = row as {
      shift: string;
      snapshot_type: string;
      inventory_id: string;
      closed_bottles: number;
      open_fraction: number;
    };
    const key = `${r.shift}:${r.snapshot_type}`;
    if (!snapshots[key]) snapshots[key] = [];
    (snapshots[key] as SnapshotEntry[]).push({
      inventory_id: r.inventory_id,
      closed_bottles: Number(r.closed_bottles),
      open_fraction: Number(r.open_fraction),
    });
  }

  return <DiarioClient products={products} today={today} initialSnapshots={snapshots} />;
}
