-- Tablas para el módulo de Barra
-- Ejecutar en: Supabase Dashboard > SQL Editor

-- 1. Inventario de barra
CREATE TABLE IF NOT EXISTS public.bar_inventory (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_name TEXT NOT NULL,
  category   TEXT NOT NULL DEFAULT 'licores',
  unit       TEXT NOT NULL DEFAULT 'botellas',
  stock      NUMERIC(10,2) NOT NULL DEFAULT 0,
  min_stock  NUMERIC(10,2) NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Registro de mermas
CREATE TABLE IF NOT EXISTS public.bar_mermas (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_id UUID REFERENCES public.bar_inventory(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  quantity     NUMERIC(10,2) NOT NULL,
  reason       TEXT NOT NULL,
  shift_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  recorded_by  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 3. RLS: habilitar y permitir lectura/escritura solo a admin y encargado_barra
ALTER TABLE public.bar_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bar_mermas    ENABLE ROW LEVEL SECURITY;

CREATE POLICY "barra_read" ON public.bar_inventory
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'encargado_barra')
    )
  );

CREATE POLICY "barra_write" ON public.bar_inventory
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'encargado_barra')
    )
  );

CREATE POLICY "mermas_read" ON public.bar_mermas
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'encargado_barra')
    )
  );

CREATE POLICY "mermas_write" ON public.bar_mermas
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'encargado_barra')
    )
  );

-- 4. Datos de ejemplo (opcional, borrar si no se necesitan)
INSERT INTO public.bar_inventory (product_name, category, unit, stock, min_stock) VALUES
  ('Tequila Patrón Silver',  'licores',   'botellas', 3.00, 1.00),
  ('Ron Bacardi Blanco',     'licores',   'botellas', 2.00, 1.00),
  ('Vodka Absolut',          'licores',   'botellas', 1.75, 1.00),
  ('Whisky Jack Daniel''s',  'licores',   'botellas', 1.00, 1.00),
  ('Cerveza Corona',         'cervezas',  'cajas',    2.00, 1.00),
  ('Cerveza Modelo Especial','cervezas',  'cajas',    3.00, 1.00),
  ('Coca-Cola 600ml',        'refrescos', 'piezas',  24.00, 12.00),
  ('Agua Mineral',           'refrescos', 'piezas',  12.00, 6.00)
ON CONFLICT DO NOTHING;
