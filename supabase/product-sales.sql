-- ============================================================
-- product_sales — WM Pizza Nostra
-- Ejecutar en Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- La tabla ya existe con columnas base (id, sale_date, staff_id, created_at).
-- Agregar las columnas faltantes:

ALTER TABLE public.product_sales
  ADD COLUMN IF NOT EXISTS category     text    NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS product_name text    NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS quantity     integer NOT NULL DEFAULT 1;

-- Limpiar defaults temporales
ALTER TABLE public.product_sales
  ALTER COLUMN category     DROP DEFAULT,
  ALTER COLUMN product_name DROP DEFAULT;

-- Restricción de integridad
ALTER TABLE public.product_sales
  DROP CONSTRAINT IF EXISTS product_sales_quantity_positive;
ALTER TABLE public.product_sales
  ADD CONSTRAINT product_sales_quantity_positive CHECK (quantity > 0);

-- Índices
CREATE INDEX IF NOT EXISTS product_sales_date_idx  ON public.product_sales(sale_date);
CREATE INDEX IF NOT EXISTS product_sales_staff_idx ON public.product_sales(staff_id);

-- RLS
ALTER TABLE public.product_sales ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "managers_all_product_sales"  ON public.product_sales;
DROP POLICY IF EXISTS "own_insert_product_sales"    ON public.product_sales;
DROP POLICY IF EXISTS "own_select_product_sales"    ON public.product_sales;

CREATE POLICY "managers_all_product_sales"
  ON public.product_sales
  USING      (auth_role() IN ('admin', 'supervisor'))
  WITH CHECK (auth_role() IN ('admin', 'supervisor'));

CREATE POLICY "own_insert_product_sales"
  ON public.product_sales
  FOR INSERT WITH CHECK (staff_id = auth.uid());

CREATE POLICY "own_select_product_sales"
  ON public.product_sales
  FOR SELECT USING (staff_id = auth.uid() OR auth_role() IN ('admin', 'supervisor'));
