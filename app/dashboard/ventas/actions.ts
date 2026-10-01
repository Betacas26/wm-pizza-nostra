'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

// ── Constantes de negocio (canon) ─────────────────────────────────────────────
const APORTE_PCT = 4.5;
const CRISTALERIA = 10.0;
const CAPITAN_PCT = 0.8;

function calcular(rawTotal: number) {
  const total = isFinite(rawTotal) && rawTotal > 0 ? rawTotal : 0;
  const contribution = Math.round(total * APORTE_PCT) / 100;
  const captain_tip = Math.round(total * CAPITAN_PCT) / 100;
  const to_deliver = Math.round((contribution + CRISTALERIA) * 100) / 100;
  return { total, contribution, glassware: CRISTALERIA, captain_tip, to_deliver };
}

export interface SaleInput {
  sale_date: string;
  shift: 'Matutino' | 'Vespertino';
  staff_id: string;
  total: number;
}

export interface SaleRow {
  id: string;
  sale_date: string;
  shift: string;
  staff_id: string;
  total: number | null;
  contribution: number | null;
  glassware: number | null;
  captain_tip: number | null;
  to_deliver: number | null;
}

// ── Auth guard ────────────────────────────────────────────────────────────────
async function verifyAuth() {
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

  const role = (profile as { role: string | null } | null)?.role ?? null;
  const isManager = role === 'admin' || role === 'supervisor';

  return { user, isManager };
}

// ── Server Actions ─────────────────────────────────────────────────────────────
export async function submitSaleAction(data: SaleInput): Promise<SaleRow> {
  const { user, isManager } = await verifyAuth();

  // Meseros solo pueden registrar ventas con su propio user.id
  if (!isManager && data.staff_id !== user.id) {
    throw new Error('No autorizado: solo puedes registrar tu propia venta.');
  }

  // Recalcular server-side — el cliente no dicta valores financieros
  const calc = calcular(data.total);

  const admin = createAdminClient();
  const { data: inserted, error } = await admin
    .from('sales')
    .insert({
      sale_date: data.sale_date,
      shift: data.shift,
      staff_id: data.staff_id,
      total: calc.total,
      pct: APORTE_PCT,
      glassware: CRISTALERIA,
      captain_pct: CAPITAN_PCT,
      contribution: calc.contribution,
      captain_tip: calc.captain_tip,
      to_deliver: calc.to_deliver,
    })
    .select()
    .single();

  if (error || !inserted) {
    throw new Error(error?.message ?? 'Error al guardar la venta.');
  }

  return inserted as SaleRow;
}

export async function deleteSaleAction(id: string): Promise<void> {
  const { isManager } = await verifyAuth();

  if (!isManager) {
    throw new Error('No autorizado: se requiere rol admin o supervisor para eliminar ventas.');
  }

  const admin = createAdminClient();
  const { error } = await admin.from('sales').delete().eq('id', id);

  if (error) throw new Error(error.message);
}
