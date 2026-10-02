# WM Pizza Nostra — Reglas y Contexto Técnico

## Stack
- Next.js (App Router, TypeScript)
- Tailwind CSS (Mobile-First estricto: botones grandes, sin tablas horizontales desbordadas)
- Supabase (PostgreSQL + Auth + RLS)

## Áreas y Mesas del Restaurante
- Planta Baja (PB): A1 a A8 + Barra (BR)
- Planta Alta (PA): S1 a S9 + Privado (PV)
- Terraza (TE): T1 a T11

## Roles
- `admin`, `supervisor`, `mesero`, `ayudante_mesero`, `hostess`, `barrero`

## Tablas Supabase
- `profiles` (id references auth.users, name, role, home_area, active)
- `table_assignments` (day, table_code, staff_id)
- `helper_assignments` (day, area, staff_id)
- `schedules` (day, staff_id, shift: 'Matutino'|'Vespertino'|'Descanso')
- `meal_breaks` (break_date, staff_id, started_at, duration_minutes, ended_at, status)
- `sales` (sale_date, shift, staff_id, total, pct, glassware, captain_pct, contribution, captain_tip, to_deliver)
- `products`, `product_sales`, `closings`, `closing_checks`, `evaluations`, `evaluation_scores`, `settings`

## Reglas de Negocio Críticas
1. Asignación automática de mesas:
   - Solo meseros activos con turno ese día en `schedules` (o todos si no hay horario capturado).
   - Respetar `home_area`. Los sobrantes cubren primero PB, luego PA y al final TE.
   - En cada área, repartir mesas alternadas ("mitad y mitad").
2. Ventas y Propinas:
   - Aporte = Venta * 4.5%
   - Cristalería = $10.00
   - Total a entregar = Aporte + Cristalería
   - Propina Capitán = Venta * 0.8% (puramente informativo, no se suma a to_deliver).
   