// ── Lógica de asignación de mesas ────────────────────────────────────────────
// Importado tanto por Server Actions como por el cliente para garantizar
// que la lógica de negocio viva en un único lugar canónico.

export type Area = 'PB' | 'PA' | 'TE';

export const AREA_TABLES: Record<Area, string[]> = {
  PB: ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'BR'],
  PA: ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9', 'PV'],
  TE: ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11'],
};

export const AREA_ORDER: Area[] = ['PB', 'PA', 'TE'];

export const AREA_LABELS: Record<Area, string> = {
  PB: 'Planta Baja',
  PA: 'Planta Alta',
  TE: 'Terraza',
};

export interface Mesero {
  id: string;
  name: string;
  home_area: string | null;
}

/**
 * Reparte mesas entre meseros activos.
 * - Cada mesero va a su home_area; si no tiene, se distribuye como cobertura.
 * - Si un área queda vacía, recibe el primer mesero sin área asignada.
 * - Dentro de cada área las mesas se alternan 50/50 (round-robin).
 */
export function computeAssignment(
  meseros: Mesero[],
): Map<string, { tables: string[]; area: Area }> {
  const byArea = new Map<Area, Mesero[]>([['PB', []], ['PA', []], ['TE', []]]);
  const leftoverPool: Mesero[] = [];

  for (const m of meseros) {
    const area = m.home_area as Area;
    if (AREA_ORDER.includes(area)) byArea.get(area)!.push(m);
    else leftoverPool.push(m);
  }

  // Garantizar al menos un mesero por área (prioridad PB → PA → TE)
  for (const area of AREA_ORDER) {
    if (byArea.get(area)!.length === 0 && leftoverPool.length > 0) {
      byArea.get(area)!.push(leftoverPool.shift()!);
    }
  }

  // Distribuir sobrantes como cobertura en round-robin
  let coverageIdx = 0;
  while (leftoverPool.length > 0) {
    const area = AREA_ORDER[coverageIdx % AREA_ORDER.length];
    byArea.get(area)!.push(leftoverPool.shift()!);
    coverageIdx++;
  }

  const result = new Map<string, { tables: string[]; area: Area }>();
  for (const [area, workers] of byArea.entries()) {
    if (workers.length === 0) continue;
    for (const w of workers) result.set(w.id, { tables: [], area });
    AREA_TABLES[area].forEach((table, idx) => {
      const workerIdx = idx % workers.length;
      result.get(workers[workerIdx].id)!.tables.push(table);
    });
  }
  return result;
}

/**
 * Dado un array de filas {table_code, staff_id} de UN día,
 * devuelve un mapa staffId → área asignada ese día.
 */
export function dayAreaMap(
  rows: { table_code: string; staff_id: string }[],
): Map<string, Area> {
  const result = new Map<string, Area>();
  for (const { table_code, staff_id } of rows) {
    if (result.has(staff_id)) continue; // primera mesa ya determina el área
    for (const [area, tables] of Object.entries(AREA_TABLES) as [Area, string[]][]) {
      if (tables.includes(table_code)) {
        result.set(staff_id, area);
        break;
      }
    }
  }
  return result;
}
