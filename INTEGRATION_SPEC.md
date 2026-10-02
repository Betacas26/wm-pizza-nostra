# Especificación Funcional, Lógica y UX/UI — WM Pizza Nostra

## 1. Módulo Mesas (`app/dashboard/mesas/`)
- **Lógica Matemática (`logic.ts`):**
  - Áreas fijas: Planta Baja (PB: A1-A8, BR), Planta Alta (PA: S1-S9, PV), Terraza (TE: T1-T11)[cite: 1, 2].
  - Solo meseros activos con turno != 'Descanso' entran en la rotación automática[cite: 1, 2].
  - Prioridad de cobertura en caso de falta de personal: PB -> PA -> TE (Terraza es la primera en quedar reducida)[cite: 1, 2].
  - Reparto dentro del área: Alternado mitad y mitad mesa por mesa (round-robin)[cite: 1, 2].
  - Límite semanal: Máximo 2 repeticiones en la misma área por persona durante la semana[cite: 1].
- **UI/UX Táctil:**
  - Selector segmentado para cambiar entre PB, PA y TE.
  - Grid de mesas con badges visuales distintivos: "Área propia" vs "Cobertura"[cite: 3].
  - Botón principal flotante para "Asignar automáticamente" y reporte de rotación semanal con alertas si alguien excede las 2 repeticiones.

## 2. Módulo Ventas y Sanciones (`app/dashboard/ventas/`)
- **Fórmulas Financieras:**
  - Aporte obligatorio: 4.5% sobre la venta total capturada[cite: 2].
  - Cristalería: $10.00 fijos por turno/registro[cite: 2].
  - Total a entregar = Aporte + Cristalería + Sanción (si aplica).
  - Propina Capitán: 0.8% (solo lectura / puramente informativo, no se suma al total a entregar)[cite: 2].
- **Regla de Sanción (`add-sales-sanction.sql`):**
  - Si el mesero tiene sanción activa por incumplimiento de uniforme o checklist, sumar el recargo al total a entregar[cite: 3].
- **UI/UX Táctil:**
  - Campo numérico gigante (`inputMode="decimal"`) con vista previa en tiempo real de los desgloses conforme el mesero escribe el monto[cite: 3].
  - Pestañas táctiles: "Registrar", "Hoy" (con opción de borrado solo para roles admin/supervisor) y "Mes" con selector de periodos y exportación a CSV con BOM UTF-8[cite: 2, 3].

## 3. Módulo Comidas (`app/dashboard/comidas/`)
- **Reglas del Temporizador:**
  - Turnos de comida de exactamente 30 minutos[cite: 2].
  - Solo se permite una comida activa por colaborador a la vez[cite: 3].
  - Estados: Normal (0-25 min) -> Alerta (últimos 5 min) -> Excedido (+minutos extra en rojo con animación `pulse`)[cite: 3].
- **UI/UX Táctil:**
  - Selector rápido de personal y botón grande de salida rápida[cite: 3].
  - Cards de turnos activos con barra de progreso reactiva y cronómetro dinámico en vivo (`tick` cada segundo)[cite: 3].

## 4. Módulo Horarios (`app/dashboard/horarios/`)
- **Reglas Operativas:**
  - Asignación por colaborador para cada día (Dom-Sáb) con 3 turnos posibles: Matutino, Vespertino o Descanso[cite: 2, 3].
  - Guardado optimista en Supabase (`upsert`)[cite: 3].
  - Función "Copiar semana anterior": clona el patrón completo de turnos hacia la semana activa[cite: 2, 3].
- **UI/UX Táctil:**
  - Botones táctiles grandes para alternar entre turnos sin necesidad de menús desplegables diminutos[cite: 2].
  - Resaltado visual del día en curso[cite: 3].

## 5. Checklist Operativo (`app/dashboard/checklist/`)
- **Reglas:**
  - Verificación de apertura y cierre por área física (PB, PA, Terraza, Barra)[cite: 3].
  - Guardado en tablas `closings` y `closing_checks` con marca de tiempo y responsable del turno[cite: 2, 3].
- **UI/UX Táctil:**
  - Casillas de verificación grandes de toque directo (mínimo 44px de área de impacto)[cite: 3].
  - Estado visual de progreso del checklist en tiempo real (% completado)[cite: 3].

## 6. Rúbricas y Evaluaciones (`app/dashboard/rubricas/`)
- **Reglas:**
  - Evaluación de estándares del 1 al 5 para colaboradores[cite: 2, 3].
  - Cálculo instantáneo del promedio y persistencia en `evaluations` y `evaluation_scores`[cite: 2, 3].
  - Historial de desempeño del colaborador[cite: 2, 3].

## 7. Personal y Reportes (`app/dashboard/personal/` y `app/dashboard/reportes/`)
- **Reglas:**
  - Gestión completa de perfiles: alta, cambio de rol, cambio de `home_area` y switch activo/inactivo[cite: 2, 3].
  - Reportes consolidados de horas, rotación y ventas exportables[cite: 3].