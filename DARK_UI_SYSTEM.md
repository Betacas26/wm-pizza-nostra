# Sistema de Diseño Dark Wine & Especificación Operativa — WM Pizza Nostra

## 1. Tokens Visuales Universales
- **Fondo General de la App:** `#0D1211` (carbón natural con matiz de humo).
- **Superficies (Cards, Listas, Modales):** `#151D1A` con bordes `#24332D` y radios de 16px (`rounded-2xl`).
- **Acentos de Marca (Guindo Pizza Nostra):**
  - Primario interacción: `#7A1D2E` (hover `#631624`, texto en contraste blanco).
  - Badges y chips de acento: `bg-[#420F18]/80 text-[#F5C2CB] border border-[#9E2A3E]/60`.
  - Anillo de selección táctil activa: `ring-2 ring-[#B8324B]`.
- **Estados Semafóricos Operativos:**
  - Éxito / Completo / En Orden: `bg-emerald-950/60 text-emerald-200 border border-emerald-600/50`.
  - Advertencia / Alerta 5 min: `bg-amber-950/60 text-amber-200 border border-amber-600/50`.
  - Peligro / Tiempo Excedido / Desabasto: `bg-rose-950/60 text-rose-200 border border-rose-700/50`.
- **Tipografía y Jerarquía:**
  - Moneda, Tiempos, Contadores y Códigos de Mesa: `font-mono tracking-tight font-bold text-stone-200`.
  - Texto principal de interfaz: `#E8EFEA` (sans-serif legible en baja iluminación).
  - Metadatos y etiquetas secundarias: `#7E998F` (`text-xs uppercase tracking-wider`).
- **Iconografía:**
  - Estrictamente iconos vectoriales minimalistas de `lucide-react` con `strokeWidth={1.75}`.
  - Prohibido el uso de emojis infantiles en botones, encabezados o métricas.
- **Ergonomía Mobile-First:**
  - Altura mínima de impacto táctil: 44px (`h-11`) a 48px (`h-12`).
  - Micro-interacción háptica visual obligatoria: `active:scale-[0.98] transition-transform select-none`.

---

## 2. Rediseño Operativo de Módulos (App Router)

### A. Dashboard Principal (`app/dashboard/`)
- **Encabezado:** Isotipo oficial WM de Pizza Nostra en SVG, fecha operativa y badge visible de rol (`[ Rol: Admin ]`, `[ Rol: Encargado de Barra ]` o `[ Rol: Mesero ]`).
- **Grid de Operaciones en Vivo (2 Columnas Táctiles):**
  - **Mesas:** Icono `LayoutGrid`, métrica "X asignadas · 3 áreas" y badge semafórico (`[ Completo ✓ ]` o `[ Pendiente ]`).
  - **Comidas:** Icono `Clock`, conteo "X en comida · Y excedidos" y badge de alerta si hay retrasos activos.
  - **Ventas:** Icono `CircleDollarSign`, acumulado en dinero `$XX,XXX hoy` y contador de cierres capturados.
  - **Checklist:** Icono `ClipboardCheck`, avance de tareas del turno (`X/Y listas`) y estado de Apertura/Cierre.
- **Acceso Restringido a Barra:** Mostrar la tarjeta `Gestión de Barra` (`Package` / `Wine`) exclusivamente para usuarios con rol `admin` o `encargado_barra`.
- **Navegación Inferior Móvil:** Barra fija o tabs ergonómicas enlazadas a Turno, Gestión y Reportes.

### B. Control de Comidas (`app/dashboard/comidas/`)
- **Gestión de Tiempos en Servidor:**
  - Duración de descanso: 30 minutos estrictos.
  - Mutaciones en Server Actions (`meal_breaks`) guardando `started_at` con timestamp del servidor para garantizar que la cuenta regresiva no se reinicie si el usuario recarga la página.
- **Sección 'En Turno de Comida' (Tarjetas Individuales):**
  - Nombre del colaborador, hora exacta de salida, segundero en vivo y barra de progreso continua.
  - Semáforo visual reactivo:
    - Normal (0 a 25 min): badge esmeralda tenue y barra verde. Botón "✓ Marcar Regreso al Piso".
    - Alerta (últimos 5 min): badge ámbar parpadeante suave.
    - Excedido (> 30 min): borde `border-rose-700/60`, badge `¡TIEMPO EXCEDIDO!` mostrando minutos extra (`+MM:SS min`) con animación pulse. Botón "⚠ Cerrar Comida con Retraso".
- **Sección 'Personal Disponible en Piso':**
  - Lista de colaboradores activos con botón táctil directo: `Iniciar Comida (30m)`.
  - Candado de capacidad operativa: advertir visualmente si más de 2 personas por área intentan salir a comer simultáneamente.

### C. Asignación de Mesas (`app/dashboard/mesas/`)
- **Lógica Matemática (`lib/mesas/assignment.ts`):**
  - Áreas y Mesas: PB (A1-A8, BR), PA (S1-S9, PV), TE (T1-T11).
  - Prioridad de cobertura en caso de baja de personal: PB -> PA -> TE (Terraza es la primera en reducirse).
  - Reparto equilibrado dentro de cada área: alternado 50/50 mesa por mesa.
  - Balance semanal: máximo 2 repeticiones en la misma área por mesero en la semana, usando `homeArea` solo como desempate.
- **Mecánica Táctil "Pick & Tap":**
  1. Carrusel horizontal superior con meseros activos identificados con sus pastillas (pills) de color individual y el botón `⌫ Borrar mesa`.
  2. Al pulsar un mesero, se activa el anillo de foco guindo (`ring-2 ring-[#B8324B] scale-105`).
  3. Al tocar cualquier tarjeta de mesa en el mapa (PB, PA, TE), se asigna inmediatamente al mesero activo (o se libera si 'Borrar mesa' está activo).
  4. Guardado optimista y sincronización directa con `table_assignments`.
- **Ayudantes por Área:** Chips táctiles de asignación rápida para PB, PA y TE.
- **Reporte Semanal de Rotación:** Matriz con conteo acumulado de días por área y alerta en rojo si algún mesero supera el límite de 2 días.

### D. Ventas y Productos (`app/dashboard/ventas/`)
- **Control Segmentado de Dos Vistas:**
  1. **'Productos del Día':**
     - Selector de categorías: Pizzas Especiales, Bebidas, Postres, etc.
     - Selector de mesero para atribución de venta.
     - Contador rápido táctil (+1 / -1) para registrar unidades vendidas en tiempo real (`product_sales`).
     - Botón para administrar o dar de alta nuevos productos al catálogo con precio y categoría.
  2. **'Cierre de Caja':**
     - Captura de venta total bruta con campo numérico de gran tamaño (`inputMode="decimal"`).
     - Fórmulas financieras automatizadas en vivo:
       - Aporte de turno: 4.5% sobre la venta total.
       - Cristalería: $10.00 fijos por turno.
       - Total a entregar en caja: Aporte (4.5%) + Cristalería ($10.00) + Sanciones activas (si aplican).
       - Propina Capitán: 0.8% informativo (no se suma al efectivo a entregar en caja).
- **Captura de Ventas Históricas:**
  - Selector de fecha de operación, predeterminado en "Hoy" pero editable con calendario.
  - Regla de permisos: meseros pueden capturar ventas de hasta 3 días hacia atrás; supervisores y administradores no tienen límite de fecha retroactiva.
  - Persistencia: la fecha operativa seleccionada se guarda en `sale_date` y la marca temporal de inserción en `created_at`.
- **Comprobante de Cierre:** Botón "Compartir Ticket por WhatsApp" con el resumen formateado para conciliación rápida de caja.

### E. Checklist de Turno (`app/dashboard/checklist/`)
- Control segmentado para **Apertura** y **Cierre**.
- Verificación estructurada por áreas operativas: Planta Baja, Planta Alta, Terraza y Barra.
- Casillas táctiles amplias de al menos 44px de área de contacto con confirmación visual esmeralda.
- Barra de progreso del turno (`X/Y tareas completadas`) y registro de firma digital del responsable en `closings` y `closing_checks`.

### F. Gestión de Barra e Inventario (`app/dashboard/barra/`)
- Reemplazar la hoja física de 'Inventario Diario Licores' por un flujo digital de 'Inicial' (apertura) y 'Arrastre' (cierre).
- Vista de cada producto:
  - Nombre, categoría, tamaño en ml y stock mínimo.
  - Contador de botellas cerradas completas (+ / -).
  - Selector de fracciones para la botella abierta: botones rápidos de un toque (0, 0.25, 0.50, 0.75, 1.0) o slider táctil.
  - Cálculo instantáneo: Consumo = Inicial - Arrastre.
  - Alerta visual en badge rojo si el arrastre cae por debajo del stock mínimo.
- Pestañas por categoría (Tequila/Mezcal, Ginebra, Brandy/Cognac, Licores, Cervezas) para navegación rápida.
- Restringido exclusivamente a roles 'admin' y 'encargado_barra'.

---

## 3. Módulo de Reportes Multidimensional (`app/dashboard/reportes/`)
- **Selector Flexible de Rango de Fechas:**
  - Predeterminado: Mes en curso (del día 1 a la fecha actual).
  - Accesos rápidos de un toque: "Hoy", "Ayer", "Esta Semana", "Semana Anterior", "Mes Actual".
  - Modo personalizado: Campos "Desde [ DD/MM/AAAA ]" y "Hasta [ DD/MM/AAAA ]" con selector de calendario táctil.
- **Desglose por Pestañas Especializadas:**
  1. **'General':** Métricas agregadas del rango seleccionado (Venta Bruta Total, Aporte Acumulado 4.5%, Cristalería Total, Total entregado en Caja y Propina Acumulada de Capitanes).
  2. **'Capitanes':** Desglose del 0.8% de propina informativa agrupado por el Capitán o Supervisor que validó y cerró cada turno.
  3. **'Turnos':** Comparativa de rendimiento entre Turno Matutino y Turno Vespertino (número de cierres, monto total de venta y recaudación de aportes).
  4. **'Barra':** Resumen de consumos, mermas registradas, incidencias de cristalería y alertas de stock ocurridas durante el periodo.
- **Exportación de Datos:** Botón fijo inferior para generar y descargar archivos CSV estructurados con codificación UTF-8 con BOM (compatibilidad nativa con Microsoft Excel sin errores de tildes ni símbolos monetarios).

---

## 4. Blindaje, Seguridad y Arquitectura
- **Protección Antihackeo:**
  - Toda mutación de base de datos (`insert`, `update`, `delete`) debe ejecutarse mediante Server Actions tipadas en TypeScript.
  - Ninguna comprobación de seguridad debe delegarse a componentes de cliente; cada Server Action debe verificar la identidad del usuario con `supabase.auth.getUser()` y comprobar sus permisos en la tabla `profiles`.
  - Las Server Actions de ventas deben validar que un mesero solo registre ventas a su propio nombre (`staff_id = auth.uid()`), reservando la creación para terceros a `admin` y `supervisor`.
  - Sanitización obligatoria en montos monetarios (bloqueo de números negativos o valores fuera de rango).
- **Persistencia RLS:** Mantener activadas las políticas de Row Level Security (RLS) en PostgreSQL como capa defensiva secundaria frente a peticiones externas no autorizadas.