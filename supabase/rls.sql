-- ============================================================
-- RLS — WM Pizza Nostra
-- Ejecutar en Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- ── Helper: rol del usuario autenticado ─────────────────────
create or replace function auth_role()
returns text language sql stable security definer as $$
  select role from public.profiles where id = auth.uid()
$$;

-- ── Habilitar RLS en todas las tablas operativas ─────────────
alter table public.profiles           enable row level security;
alter table public.sales              enable row level security;
alter table public.schedules          enable row level security;
alter table public.meal_breaks        enable row level security;
alter table public.closings           enable row level security;
alter table public.closing_checks     enable row level security;
alter table public.table_assignments  enable row level security;
alter table public.evaluations        enable row level security;
alter table public.evaluation_scores  enable row level security;

-- ============================================================
-- profiles
-- ============================================================
-- Cualquier autenticado puede ver perfiles activos
create policy "profiles_select" on public.profiles
  for select using (auth.role() = 'authenticated');

-- Solo admin/supervisor pueden crear o modificar perfiles
create policy "profiles_insert" on public.profiles
  for insert with check (auth_role() in ('admin', 'supervisor'));

create policy "profiles_update" on public.profiles
  for update using (
    id = auth.uid() or auth_role() in ('admin', 'supervisor')
  );

-- Solo admins pueden borrar perfiles
create policy "profiles_delete" on public.profiles
  for delete using (auth_role() = 'admin');

-- ============================================================
-- sales
-- ============================================================
create policy "sales_select" on public.sales
  for select using (auth.role() = 'authenticated');

-- Meseros solo insertan su propia venta; managers cualquiera
create policy "sales_insert" on public.sales
  for insert with check (
    staff_id = auth.uid()
    or auth_role() in ('admin', 'supervisor')
  );

-- Solo managers pueden borrar ventas
create policy "sales_delete" on public.sales
  for delete using (auth_role() in ('admin', 'supervisor'));

-- ============================================================
-- schedules
-- ============================================================
create policy "schedules_select" on public.schedules
  for select using (auth.role() = 'authenticated');

create policy "schedules_insert" on public.schedules
  for insert with check (auth_role() in ('admin', 'supervisor'));

create policy "schedules_update" on public.schedules
  for update using (auth_role() in ('admin', 'supervisor'));

create policy "schedules_delete" on public.schedules
  for delete using (auth_role() in ('admin', 'supervisor'));

-- ============================================================
-- meal_breaks
-- ============================================================
create policy "meal_breaks_select" on public.meal_breaks
  for select using (auth.role() = 'authenticated');

-- Cualquier autenticado puede iniciar una comida (supervisor inicia para mesero)
create policy "meal_breaks_insert" on public.meal_breaks
  for insert with check (auth.role() = 'authenticated');

-- Solo el propio empleado o un manager puede cerrar una comida
create policy "meal_breaks_update" on public.meal_breaks
  for update using (
    staff_id = auth.uid()
    or auth_role() in ('admin', 'supervisor')
  );

-- ============================================================
-- closings
-- ============================================================
create policy "closings_select" on public.closings
  for select using (auth.role() = 'authenticated');

-- Cualquier autenticado puede enviar un checklist
create policy "closings_insert" on public.closings
  for insert with check (auth.role() = 'authenticated');

-- Solo managers pueden corregir/borrar revisiones
create policy "closings_update" on public.closings
  for update using (auth_role() in ('admin', 'supervisor'));

create policy "closings_delete" on public.closings
  for delete using (auth_role() in ('admin', 'supervisor'));

-- ============================================================
-- closing_checks
-- ============================================================
create policy "closing_checks_select" on public.closing_checks
  for select using (auth.role() = 'authenticated');

create policy "closing_checks_insert" on public.closing_checks
  for insert with check (auth.role() = 'authenticated');

-- ============================================================
-- table_assignments
-- ============================================================
create policy "table_assignments_select" on public.table_assignments
  for select using (auth.role() = 'authenticated');

create policy "table_assignments_insert" on public.table_assignments
  for insert with check (auth_role() in ('admin', 'supervisor'));

create policy "table_assignments_delete" on public.table_assignments
  for delete using (auth_role() in ('admin', 'supervisor'));

-- ============================================================
-- evaluations
-- ============================================================
create policy "evaluations_select" on public.evaluations
  for select using (auth.role() = 'authenticated');

create policy "evaluations_insert" on public.evaluations
  for insert with check (auth_role() in ('admin', 'supervisor'));

-- Solo el evaluador original o admin puede modificar
create policy "evaluations_update" on public.evaluations
  for update using (
    evaluator_id = auth.uid()
    or auth_role() = 'admin'
  );

create policy "evaluations_delete" on public.evaluations
  for delete using (auth_role() = 'admin');

-- ============================================================
-- evaluation_scores
-- ============================================================
create policy "evaluation_scores_select" on public.evaluation_scores
  for select using (auth.role() = 'authenticated');

create policy "evaluation_scores_insert" on public.evaluation_scores
  for insert with check (auth_role() in ('admin', 'supervisor'));
