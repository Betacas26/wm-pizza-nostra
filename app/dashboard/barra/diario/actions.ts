'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

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
  if (role !== 'admin' && role !== 'encargado_barra' && role !== 'supervisor') {
    throw new Error('Se requiere rol de barra, supervisor o admin.');
  }
  return user.id;
}

export interface DailyEntryInput {
  inventory_id: string;
  product_name: string;
  category: string;
  bottle_ml: number;
  closed_bottles: number;
  open_fraction: number;
}

export interface SaveSnapshotInput {
  inventory_date: string;
  shift: 'Matutino' | 'Vespertino';
  snapshot_type: 'inicial' | 'arrastre';
  entries: DailyEntryInput[];
}

export async function saveSnapshotAction(params: SaveSnapshotInput): Promise<void> {
  const userId = await assertBarraRole();
  const admin = createAdminClient();

  // Delete existing snapshot for this combination, then re-insert
  await admin
    .from('bar_daily_inventory')
    .delete()
    .eq('inventory_date', params.inventory_date)
    .eq('shift', params.shift)
    .eq('snapshot_type', params.snapshot_type);

  if (params.entries.length === 0) return;

  const rows = params.entries.map((e) => ({
    inventory_date: params.inventory_date,
    shift: params.shift,
    snapshot_type: params.snapshot_type,
    inventory_id: e.inventory_id,
    product_name: e.product_name,
    category: e.category,
    bottle_ml: e.bottle_ml,
    closed_bottles: Math.max(0, Math.round(e.closed_bottles)),
    open_fraction: Math.min(1, Math.max(0, e.open_fraction)),
    recorded_by: userId,
  }));

  const { error } = await admin.from('bar_daily_inventory').insert(rows);
  if (error) throw new Error(error.message);
}
