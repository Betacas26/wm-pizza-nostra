-- ============================================================
-- Plantillas editables: criterios de rúbrica + ítems checklist
-- Ejecutar en Supabase → Dashboard → SQL Editor
-- ============================================================

-- ── rubric_criteria ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.rubric_criteria (
  id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  key         text    UNIQUE NOT NULL,
  label       text    NOT NULL,
  description text    NOT NULL DEFAULT '',
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE public.rubric_criteria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rc_select" ON public.rubric_criteria
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "rc_insert" ON public.rubric_criteria
  FOR INSERT WITH CHECK (auth_role() IN ('admin', 'supervisor'));

CREATE POLICY "rc_update" ON public.rubric_criteria
  FOR UPDATE USING (auth_role() IN ('admin', 'supervisor'));

CREATE POLICY "rc_delete" ON public.rubric_criteria
  FOR DELETE USING (auth_role() IN ('admin', 'supervisor'));

-- Datos iniciales
INSERT INTO public.rubric_criteria (key, label, description, sort_order) VALUES
  ('punctuality',   'Puntualidad y asistencia',  'Llegada a tiempo, cumplimiento de horario',          1),
  ('presentation',  'Presentacion personal',     'Uniforme, higiene y apariencia',                     2),
  ('teamwork',      'Trabajo en equipo',          'Colaboracion y apoyo a companeros',                  3),
  ('service',       'Actitud de servicio',        'Trato al cliente, disposicion y amabilidad',         4),
  ('knowledge',     'Conocimiento del puesto',    'Dominio de menu, procesos y herramientas',           5),
  ('efficiency',    'Eficiencia en tareas',       'Rapidez, organizacion y calidad del trabajo',        6),
  ('situations',    'Manejo de situaciones',      'Respuesta ante quejas, imprevistos y presion',       7)
ON CONFLICT (key) DO NOTHING;

-- ── checklist_items ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.checklist_items (
  id         uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  area       text    NOT NULL,
  type       text    NOT NULL,
  key        text    UNIQUE NOT NULL,
  label      text    NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.checklist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ci_select" ON public.checklist_items
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "ci_insert" ON public.checklist_items
  FOR INSERT WITH CHECK (auth_role() IN ('admin', 'supervisor'));

CREATE POLICY "ci_update" ON public.checklist_items
  FOR UPDATE USING (auth_role() IN ('admin', 'supervisor'));

CREATE POLICY "ci_delete" ON public.checklist_items
  FOR DELETE USING (auth_role() IN ('admin', 'supervisor'));

-- Datos iniciales: PB
INSERT INTO public.checklist_items (area, type, key, label, sort_order) VALUES
  ('PB','apertura','pb_ap_1','Limpiar y acomodar mesas y sillas',1),
  ('PB','apertura','pb_ap_2','Colocar manteleria limpia en todas las mesas',2),
  ('PB','apertura','pb_ap_3','Verificar menus (limpios y completos)',3),
  ('PB','apertura','pb_ap_4','Preparar mise en place (sal, pimienta, servilleteros)',4),
  ('PB','apertura','pb_ap_5','Revisar iluminacion y climatizacion',5),
  ('PB','apertura','pb_ap_6','Verificar material de servicio (charolas, platos)',6),
  ('PB','apertura','pb_ap_7','Revisar limpieza de piso y accesos',7),
  ('PB','cierre','pb_ci_1','Desmantelar mesas y clasificar manteleria sucia',1),
  ('PB','cierre','pb_ci_2','Limpiar y apilar sillas y mesas',2),
  ('PB','cierre','pb_ci_3','Barrer y trapear el piso del area',3),
  ('PB','cierre','pb_ci_4','Recoger y registrar objetos olvidados',4),
  ('PB','cierre','pb_ci_5','Apagar iluminacion y climatizacion',5),
  ('PB','cierre','pb_ci_6','Verificar que no queden alimentos ni bebidas',6),
  ('PB','cierre','pb_ci_7','Reportar incidencias o danos del turno',7),
-- PA
  ('PA','apertura','pa_ap_1','Limpiar y acomodar mesas y sillas',1),
  ('PA','apertura','pa_ap_2','Colocar manteleria limpia en todas las mesas',2),
  ('PA','apertura','pa_ap_3','Verificar menus (limpios y completos)',3),
  ('PA','apertura','pa_ap_4','Preparar mise en place',4),
  ('PA','apertura','pa_ap_5','Revisar iluminacion y climatizacion',5),
  ('PA','apertura','pa_ap_6','Revisar limpieza de escaleras y accesos',6),
  ('PA','apertura','pa_ap_7','Verificar material de servicio',7),
  ('PA','cierre','pa_ci_1','Desmantelar mesas y clasificar manteleria sucia',1),
  ('PA','cierre','pa_ci_2','Limpiar y apilar sillas y mesas',2),
  ('PA','cierre','pa_ci_3','Barrer y trapear piso y escaleras',3),
  ('PA','cierre','pa_ci_4','Recoger y registrar objetos olvidados',4),
  ('PA','cierre','pa_ci_5','Apagar iluminacion y climatizacion',5),
  ('PA','cierre','pa_ci_6','Verificar que no queden alimentos ni bebidas',6),
  ('PA','cierre','pa_ci_7','Reportar incidencias o danos del turno',7),
-- TE
  ('TE','apertura','te_ap_1','Limpiar y acomodar mobiliario de exterior',1),
  ('TE','apertura','te_ap_2','Desplegar y fijar parasoles (verificar estado)',2),
  ('TE','apertura','te_ap_3','Colocar manteleria o individuales en mesas',3),
  ('TE','apertura','te_ap_4','Verificar menus de terraza',4),
  ('TE','apertura','te_ap_5','Preparar mise en place',5),
  ('TE','apertura','te_ap_6','Revisar iluminacion exterior',6),
  ('TE','apertura','te_ap_7','Verificar estado del piso de terraza',7),
  ('TE','cierre','te_ci_1','Recoger y guardar manteleria o individuales',1),
  ('TE','cierre','te_ci_2','Plegar y asegurar parasoles',2),
  ('TE','cierre','te_ci_3','Limpiar y apilar mesas y sillas de exterior',3),
  ('TE','cierre','te_ci_4','Barrer piso de terraza',4),
  ('TE','cierre','te_ci_5','Recoger y registrar objetos olvidados',5),
  ('TE','cierre','te_ci_6','Apagar iluminacion exterior',6),
  ('TE','cierre','te_ci_7','Reportar incidencias o danos del turno',7),
-- BA
  ('BA','apertura','ba_ap_1','Revisar limpieza y orden de la barra',1),
  ('BA','apertura','ba_ap_2','Verificar inventario de bebidas y licores',2),
  ('BA','apertura','ba_ap_3','Preparar hielo y verificar hieleras',3),
  ('BA','apertura','ba_ap_4','Revisar herramientas de barra y cristaleria',4),
  ('BA','apertura','ba_ap_5','Verificar cristaleria limpia y sin roturas',5),
  ('BA','apertura','ba_ap_6','Revisar surtidores y conexiones de gas/CO2',6),
  ('BA','apertura','ba_ap_7','Verificar que la terminal de pago funcione',7),
  ('BA','cierre','ba_ci_1','Limpiar profundamente la superficie de la barra',1),
  ('BA','cierre','ba_ci_2','Guardar y asegurar licores y bebidas',2),
  ('BA','cierre','ba_ci_3','Lavar y guardar cristaleria',3),
  ('BA','cierre','ba_ci_4','Vaciar y limpiar hieleras',4),
  ('BA','cierre','ba_ci_5','Cerrar surtidores y llaves de gas/CO2',5),
  ('BA','cierre','ba_ci_6','Limpiar y guardar herramientas de barra',6),
  ('BA','cierre','ba_ci_7','Reportar incidencias, consumos y faltantes',7)
ON CONFLICT (key) DO NOTHING;
