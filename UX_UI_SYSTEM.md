# Sistema de Diseño y Ergonomía UX/UI — WM Pizza Nostra

## 1. Tokens Visuales y Paleta
- **Fondos y Superficies:**
  - Fondo de app: `bg-[#F8F7F4]` (Tono cálido tipo masa/harina, reduce fatiga visual frente al blanco puro).
  - Superficies (Cards): `bg-white` con radio `rounded-2xl` y borde `border border-stone-200/70`.
  - Elevación: `shadow-[0_2px_8px_rgba(0,0,0,0.04)]`.
- **Acentos y Marca:**
  - Primario (Pizza Nostra): `bg-amber-600 hover:bg-amber-700 text-white`.
  - Acción Destacada: `bg-stone-900 text-white hover:bg-black`.
  - Feedback y Estados:
    * Éxito / En Turno: `emerald-600` / fondo `bg-emerald-50` / texto `text-emerald-800`.
    * Alerta / Advertencia: `amber-500` / fondo `bg-amber-50` / texto `text-amber-800`.
    * Peligro / Tiempo Agotado / Sanción: `rose-600` / fondo `bg-rose-50` / texto `text-rose-800`.
- **Tipografía:**
  - Moneda y Totales: `font-mono tracking-tight font-bold text-stone-900`.
  - Etiquetas y Metadatos: `text-xs font-semibold text-stone-500 uppercase tracking-wider`.

## 2. Reglas Táctiles Obligatorias (Mobile-First)
- **Tamaño de Toque Mínimo:** Todo botón, tab o casilla de verificación debe tener al menos `h-11` (44px) o `h-12` (48px) de altura para evitar clics erróneos con dedos mojados o apurados.
- **Micro-interacción háptica visual:** Cada botón táctil interactivo debe incluir:
  `active:scale-[0.98] transition duration-150 ease-out select-none`.
- **Inputs Numéricos:** Para captura de ventas o propinas:
  - Usar `inputMode="decimal"` y tamaño tipográfico grande (`text-2xl font-mono text-center font-bold text-stone-900`).
  - Mostrar desglose en vivo debajo del campo en chips dinámicos sin requerir scroll.

## 3. Rediseño Clave por Módulo
- **Mesas (`/dashboard/mesas`):**
  - Selector de áreas PB, PA, TE como **Segmented Control iOS** (`p-1 bg-stone-200/80 rounded-xl`).
  - Grid de mesas táctiles con tarjetas cuadradas:
    * Asignada: Fondo blanco, borde amber, nombre del mesero en negrita, badge "Propia" o "Cobertura".
    * Sin Asignar: Borde punteado `border-dashed border-stone-300 bg-stone-50/50`.
- **Comidas (`/dashboard/comidas`):**
  - Barra de progreso radial o barra continua superior (`h-2 rounded-full overflow-hidden`).
  - Cuando falten < 5 minutos: Animación suave `animate-pulse` en badge ámbar.
  - Al vencer: Card cambia a fondo `rose-50` y borde `border-rose-300` con indicador de minutos extra transcurridos (`+X min`).
- **Ventas (`/dashboard/ventas`):**
  - Resumen diario estilo ticket térmico moderno.
  - Indicador flotante en verde para aportes y cristalería ya calculados.
- **Navegación Global:**
  - Header compacto con avatar/iniciales, rol actual y botón táctil de regreso.
  - Barra de acción primaria flotante (`fixed bottom-4 left-4 right-4 z-40 max-w-lg mx-auto`).