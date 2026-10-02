-- Agregar columnas de sanción y bono a la tabla sales
-- Ejecutar en Supabase SQL Editor

alter table public.sales
  add column if not exists sanction_pct  numeric default 0,
  add column if not exists sanction_amount numeric default 0;

-- Actualizar política de inserción para incluir los nuevos campos
-- (La política existente ya cubre cualquier columna de la tabla)
