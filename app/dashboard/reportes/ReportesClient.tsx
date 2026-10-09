'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import Image from 'next/image';
import { ChevronLeft, Download, AlertTriangle, TrendingUp } from 'lucide-react';

type ReportTab = 'general' | 'capitanes' | 'turnos' | 'productos' | 'sanciones' | 'checklist' | 'horarios' | 'rubricas' | 'barra';

interface RawSale {
  sale_date: string;
  shift: string;
  staff_id: string;
  total: number;
  contribution: number;
  to_deliver: number;
  captain_tip: number;
  sanction_amount: number;
}

interface StaffSummary {
  staff_id: string;
  name: string;
  count: number;
  total: number;
  contribution: number;
  to_deliver: number;
  captain_tip: number;
  sanction_amount: number;
}

interface ShiftSummary {
  shift: string;
  count: number;
  total: number;
  contribution: number;
  to_deliver: number;
  captain_tip: number;
}

interface DaySummary {
  sale_date: string;
  ventas_total: number;
  captain_total: number;
  registros: number;
}

interface ProductSaleRow {
  product_name: string;
  category: string;
  quantity: number;
  amount: number;
}

interface ProductSummary {
  product_name: string;
  category: string;
  total_qty: number;
  total_amount: number;
}

interface SanctionRow {
  id: string;
  staff_id: string;
  type: 'sancion' | 'bono';
  amount: number;
  concept: string;
  record_date: string;
}

interface StaffSanctionSummary {
  staff_id: string;
  name: string;
  bonos: number;
  sanciones: number;
  balance: number;
  count: number;
}

interface EvalRow {
  id: string;
  eval_date: string;
  staff_id: string;
  staff_name: string;
  evaluator_name: string;
  average_score: number;
  observations: string | null;
}

interface EvalScoreRow {
  evaluation_id: string;
  criterion_label: string;
  score: number;
}

interface ScheduleRow {
  staff_id: string;
  day: string;
  shift: 'Matutino' | 'Vespertino' | 'Descanso';
}

interface ClosingRow {
  id: string;
  closing_date: string;
  area: string;
  type: 'apertura' | 'cierre';
  staff_name: string;
  total_items: number;
  checked_items: number;
  completed_at: string;
}

interface BarDiarioRow {
  inventory_date: string;
  shift: string;
  snapshot_type: string;
  inventory_id: string;
  product_name: string;
  category: string;
  bottle_ml: number;
  closed_bottles: number;
  open_fraction: number;
}

interface BarConsumedProduct {
  inventory_id: string;
  product_name: string;
  category: string;
  bottle_ml: number;
  total_bottles: number;
  total_liters: number;
}

interface BarItem {
  id: string;
  product_name: string;
  category: string;
  unit: string;
  stock: number;
  min_stock: number;
}

interface BarMerma {
  id: string;
  product_name: string;
  quantity: number;
  reason: string;
  shift_date: string;
}

// ── Utils ──────────────────────────────────────────────────────────────────────
function fmtMXN(n: number): string {
  return `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function r2(n: number) { return Math.round(n * 100) / 100; }

function todayStr() { return new Date().toISOString().split('T')[0]; }

function getPreset(preset: 'hoy' | 'semana' | 'mes'): [string, string] {
  const today = todayStr();
  const now = new Date();
  if (preset === 'hoy') return [today, today];
  if (preset === 'semana') {
    const d = new Date(now);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return [d.toISOString().split('T')[0], today];
  }
  const first = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  return [first, today];
}

function fmtRange(from: string, to: string): string {
  const fmt = (s: string) =>
    new Date(s + 'T12:00:00').toLocaleDateString('es-MX', {
      day: 'numeric', month: 'short',
    });
  return from === to ? fmt(from) : `${fmt(from)} – ${fmt(to)}`;
}

function exportCSV(rows: string[][], filename: string) {
  const BOM = '\uFEFF';
  const content =
    BOM +
    rows
      .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\r\n');
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Componente principal ───────────────────────────────────────────────────────
export default function ReportesClient({ isAdmin }: { isAdmin: boolean }) {
  const supabase = useMemo(() => createClient(), []);

  const [tab, setTab] = useState<ReportTab>('general');
  const [dateFrom, setDateFrom] = useState(() => getPreset('mes')[0]);
  const [dateTo, setDateTo] = useState(() => getPreset('mes')[1]);
  const [loading, setLoading] = useState(false);

  const [rawSales, setRawSales] = useState<RawSale[]>([]);
  const [nameMap, setNameMap] = useState<Map<string, string>>(new Map());

  // Productos state
  const [productSales, setProductSales] = useState<ProductSaleRow[]>([]);
  const [prodLoading, setProdLoading] = useState(false);

  // Sanciones state
  const [sanctions, setSanctions] = useState<SanctionRow[]>([]);
  const [sanctionNames, setSanctionNames] = useState<Map<string, string>>(new Map());
  const [sanctionLoading, setSanctionLoading] = useState(false);

  // Rúbricas state
  const [evals, setEvals] = useState<EvalRow[]>([]);
  const [evalScores, setEvalScores] = useState<EvalScoreRow[]>([]);
  const [rubricasLoading, setRubricasLoading] = useState(false);

  // Horarios state
  const [schedules, setSchedules] = useState<ScheduleRow[]>([]);
  const [scheduleNames, setScheduleNames] = useState<Map<string, string>>(new Map());
  const [horariosLoading, setHorariosLoading] = useState(false);

  // Checklist state
  const [closings, setClosings] = useState<ClosingRow[]>([]);
  const [checklistLoading, setChecklistLoading] = useState(false);

  // Barra state
  const [barInventory, setBarInventory] = useState<BarItem[]>([]);
  const [barMermas, setBarMermas] = useState<BarMerma[]>([]);
  const [barDiario, setBarDiario] = useState<BarDiarioRow[]>([]);
  const [barLoading, setBarLoading] = useState(false);

  const loadData = useCallback(
    async (from: string, to: string) => {
      setLoading(true);
      const { data: salesData } = await supabase
        .from('sales')
        .select('sale_date, shift, staff_id, total, contribution, to_deliver, captain_tip, sanction_amount')
        .gte('sale_date', from)
        .lte('sale_date', to)
        .order('sale_date', { ascending: true });

      const raw = (salesData ?? []) as RawSale[];
      setRawSales(raw);

      if (raw.length > 0) {
        const ids = [...new Set(raw.map((s) => s.staff_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name')
          .in('id', ids);
        setNameMap(
          new Map(
            (profiles ?? []).map((p: { id: string; name: string | null }) => [
              p.id,
              p.name ?? '(sin nombre)',
            ]),
          ),
        );
      }
      setLoading(false);
    },
    [supabase],
  );

  const loadProductos = useCallback(
    async (from: string, to: string) => {
      setProdLoading(true);
      try {
        const { data } = await supabase
          .from('product_sales')
          .select('product_name, category, quantity, amount')
          .gte('sale_date', from)
          .lte('sale_date', to);
        setProductSales((data ?? []) as ProductSaleRow[]);
      } catch { /* silent */ }
      setProdLoading(false);
    },
    [supabase],
  );

  const loadSanciones = useCallback(
    async (from: string, to: string) => {
      setSanctionLoading(true);
      try {
        const { data: rows } = await supabase
          .from('sanctions')
          .select('id, staff_id, type, amount, concept, record_date')
          .gte('record_date', from)
          .lte('record_date', to)
          .order('record_date', { ascending: false });
        const raw = (rows ?? []) as SanctionRow[];
        setSanctions(raw);
        if (raw.length > 0) {
          const ids = [...new Set(raw.map((s) => s.staff_id))];
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, name')
            .in('id', ids);
          setSanctionNames(
            new Map(
              (profiles ?? []).map((p: { id: string; name: string | null }) => [
                p.id,
                p.name ?? '(sin nombre)',
              ]),
            ),
          );
        }
      } catch { /* silent */ }
      setSanctionLoading(false);
    },
    [supabase],
  );

  const loadRubricas = useCallback(
    async (from: string, to: string) => {
      setRubricasLoading(true);
      try {
        const { data: evalData } = await supabase
          .from('evaluations')
          .select('id, eval_date, staff_id, staff_name, evaluator_name, average_score, observations')
          .gte('eval_date', from)
          .lte('eval_date', to)
          .order('eval_date', { ascending: false });
        const rows = (evalData ?? []) as EvalRow[];
        setEvals(rows);
        if (rows.length > 0) {
          const ids = rows.map((e) => e.id);
          const { data: scoresData } = await supabase
            .from('evaluation_scores')
            .select('evaluation_id, criterion_label, score')
            .in('evaluation_id', ids);
          setEvalScores((scoresData ?? []) as EvalScoreRow[]);
        } else {
          setEvalScores([]);
        }
      } catch { /* silent */ }
      setRubricasLoading(false);
    },
    [supabase],
  );

  const loadHorarios = useCallback(
    async (from: string, to: string) => {
      setHorariosLoading(true);
      try {
        const [{ data: schData }, { data: profilesData }] = await Promise.all([
          supabase
            .from('schedules')
            .select('staff_id, day, shift')
            .gte('day', from)
            .lte('day', to)
            .order('day'),
          supabase
            .from('profiles')
            .select('id, name')
            .eq('active', true)
            .order('name'),
        ]);
        setSchedules((schData ?? []) as ScheduleRow[]);
        setScheduleNames(
          new Map(
            (profilesData ?? []).map((p: { id: string; name: string | null }) => [
              p.id,
              p.name ?? '(sin nombre)',
            ]),
          ),
        );
      } catch { /* silent */ }
      setHorariosLoading(false);
    },
    [supabase],
  );

  const loadChecklist = useCallback(
    async (from: string, to: string) => {
      setChecklistLoading(true);
      try {
        const { data } = await supabase
          .from('closings')
          .select('id, closing_date, area, type, staff_name, total_items, checked_items, completed_at')
          .gte('closing_date', from)
          .lte('closing_date', to)
          .not('completed_at', 'is', null)
          .order('closing_date', { ascending: false })
          .order('completed_at', { ascending: false });
        setClosings((data ?? []) as ClosingRow[]);
      } catch { /* silent */ }
      setChecklistLoading(false);
    },
    [supabase],
  );

  const loadBarra = useCallback(
    async (from: string, to: string) => {
      setBarLoading(true);
      try {
        const [{ data: inv }, { data: mermas }, { data: diario }] = await Promise.all([
          supabase.from('bar_inventory').select('id, product_name, category, unit, stock, min_stock').order('category').order('product_name'),
          supabase.from('bar_mermas').select('id, product_name, quantity, reason, shift_date').gte('shift_date', from).lte('shift_date', to).order('shift_date', { ascending: false }),
          supabase.from('bar_daily_inventory').select('inventory_date, shift, snapshot_type, inventory_id, product_name, category, bottle_ml, closed_bottles, open_fraction').gte('inventory_date', from).lte('inventory_date', to),
        ]);
        setBarInventory((inv ?? []) as BarItem[]);
        setBarMermas((mermas ?? []) as BarMerma[]);
        setBarDiario((diario ?? []) as BarDiarioRow[]);
      } catch {
        // Tables may not exist — fail silently
      }
      setBarLoading(false);
    },
    [supabase],
  );

  useEffect(() => { loadData(dateFrom, dateTo); }, [dateFrom, dateTo, loadData]);
  useEffect(() => {
    if (tab === 'productos') loadProductos(dateFrom, dateTo);
  }, [tab, dateFrom, dateTo, loadProductos]);
  useEffect(() => {
    if (tab === 'sanciones') loadSanciones(dateFrom, dateTo);
  }, [tab, dateFrom, dateTo, loadSanciones]);
  useEffect(() => {
    if (tab === 'rubricas') loadRubricas(dateFrom, dateTo);
  }, [tab, dateFrom, dateTo, loadRubricas]);
  useEffect(() => {
    if (tab === 'horarios') loadHorarios(dateFrom, dateTo);
  }, [tab, dateFrom, dateTo, loadHorarios]);
  useEffect(() => {
    if (tab === 'checklist') loadChecklist(dateFrom, dateTo);
  }, [tab, dateFrom, dateTo, loadChecklist]);
  useEffect(() => {
    if (tab === 'barra') loadBarra(dateFrom, dateTo);
  }, [tab, dateFrom, dateTo, loadBarra]);

  // ── Derived data ────────────────────────────────────────────────────────────
  const staffSummaries = useMemo((): StaffSummary[] => {
    const m = new Map<string, StaffSummary>();
    for (const s of rawSales) {
      const total = Number(s.total) || 0;
      const contribution = Number(s.contribution) || 0;
      const to_deliver = Number(s.to_deliver) || 0;
      const captain_tip = Number(s.captain_tip) || 0;
      const sanction_amount = Number(s.sanction_amount) || 0;
      const ex = m.get(s.staff_id);
      if (ex) {
        ex.count++;
        ex.total += total;
        ex.contribution += contribution;
        ex.to_deliver += to_deliver;
        ex.captain_tip += captain_tip;
        ex.sanction_amount += sanction_amount;
      } else {
        m.set(s.staff_id, {
          staff_id: s.staff_id,
          name: nameMap.get(s.staff_id) ?? s.staff_id,
          count: 1, total, contribution, to_deliver, captain_tip, sanction_amount,
        });
      }
    }
    return [...m.values()]
      .map((x) => ({ ...x, total: r2(x.total), contribution: r2(x.contribution), to_deliver: r2(x.to_deliver), captain_tip: r2(x.captain_tip), sanction_amount: r2(x.sanction_amount) }))
      .sort((a, b) => b.total - a.total);
  }, [rawSales, nameMap]);

  const shiftSummaries = useMemo((): ShiftSummary[] => {
    const m = new Map<string, ShiftSummary>();
    for (const s of rawSales) {
      const total = Number(s.total) || 0;
      const contribution = Number(s.contribution) || 0;
      const to_deliver = Number(s.to_deliver) || 0;
      const captain_tip = Number(s.captain_tip) || 0;
      const ex = m.get(s.shift);
      if (ex) {
        ex.count++;
        ex.total += total;
        ex.contribution += contribution;
        ex.to_deliver += to_deliver;
        ex.captain_tip += captain_tip;
      } else {
        m.set(s.shift, { shift: s.shift, count: 1, total, contribution, to_deliver, captain_tip });
      }
    }
    return [...m.values()].map((x) => ({ ...x, total: r2(x.total), contribution: r2(x.contribution), to_deliver: r2(x.to_deliver), captain_tip: r2(x.captain_tip) }));
  }, [rawSales]);

  const daySummaries = useMemo((): DaySummary[] => {
    const m = new Map<string, DaySummary>();
    for (const s of rawSales) {
      const total = Number(s.total) || 0;
      const captain_tip = Number(s.captain_tip) || 0;
      const ex = m.get(s.sale_date);
      if (ex) { ex.ventas_total += total; ex.captain_total += captain_tip; ex.registros++; }
      else m.set(s.sale_date, { sale_date: s.sale_date, ventas_total: total, captain_total: captain_tip, registros: 1 });
    }
    return [...m.values()].map((x) => ({ ...x, ventas_total: r2(x.ventas_total), captain_total: r2(x.captain_total) })).sort((a, b) => a.sale_date.localeCompare(b.sale_date));
  }, [rawSales]);

  const grandTotals = useMemo(() => ({
    total:          r2(staffSummaries.reduce((a, s) => a + s.total, 0)),
    to_deliver:     r2(staffSummaries.reduce((a, s) => a + s.to_deliver, 0)),
    captain_tip:    r2(staffSummaries.reduce((a, s) => a + s.captain_tip, 0)),
    sanction_amount:r2(staffSummaries.reduce((a, s) => a + s.sanction_amount, 0)),
    count:          staffSummaries.reduce((a, s) => a + s.count, 0),
  }), [staffSummaries]);

  // ── Derived: productos ──────────────────────────────────────────────────────
  const productSummaries = useMemo((): ProductSummary[] => {
    const m = new Map<string, ProductSummary>();
    for (const p of productSales) {
      const key = p.product_name;
      const ex = m.get(key);
      if (ex) {
        ex.total_qty += Number(p.quantity) || 0;
        ex.total_amount += Number(p.amount) || 0;
      } else {
        m.set(key, {
          product_name: p.product_name,
          category: p.category,
          total_qty: Number(p.quantity) || 0,
          total_amount: Number(p.amount) || 0,
        });
      }
    }
    return [...m.values()]
      .map((x) => ({ ...x, total_qty: r2(x.total_qty), total_amount: r2(x.total_amount) }))
      .sort((a, b) => b.total_qty - a.total_qty);
  }, [productSales]);

  const productCategories = useMemo(
    () => Array.from(new Set(productSummaries.map((p) => p.category))),
    [productSummaries],
  );

  // ── Derived: sanciones ──────────────────────────────────────────────────────
  const staffSanctionSummaries = useMemo((): StaffSanctionSummary[] => {
    const m = new Map<string, StaffSanctionSummary>();
    for (const s of sanctions) {
      const name = sanctionNames.get(s.staff_id) ?? s.staff_id;
      const ex = m.get(s.staff_id);
      const amount = Number(s.amount) || 0;
      if (ex) {
        if (s.type === 'bono') ex.bonos += amount;
        else ex.sanciones += amount;
        ex.balance = r2(ex.bonos - ex.sanciones);
        ex.count++;
      } else {
        m.set(s.staff_id, {
          staff_id: s.staff_id,
          name,
          bonos: s.type === 'bono' ? amount : 0,
          sanciones: s.type === 'sancion' ? amount : 0,
          balance: s.type === 'bono' ? amount : -amount,
          count: 1,
        });
      }
    }
    return [...m.values()].sort((a, b) => b.balance - a.balance);
  }, [sanctions, sanctionNames]);

  const sanctionTotals = useMemo(() => ({
    bonos: r2(staffSanctionSummaries.reduce((a, s) => a + s.bonos, 0)),
    sanciones: r2(staffSanctionSummaries.reduce((a, s) => a + s.sanciones, 0)),
    balance: r2(staffSanctionSummaries.reduce((a, s) => a + s.balance, 0)),
  }), [staffSanctionSummaries]);

  // ── Derived: rúbricas ───────────────────────────────────────────────────────
  const evalStaffSummaries = useMemo(() => {
    const m = new Map<string, { staff_id: string; name: string; count: number; totalScore: number }>();
    for (const e of evals) {
      const ex = m.get(e.staff_id);
      if (ex) { ex.count++; ex.totalScore += Number(e.average_score); }
      else m.set(e.staff_id, { staff_id: e.staff_id, name: e.staff_name, count: 1, totalScore: Number(e.average_score) });
    }
    return [...m.values()]
      .map((x) => ({ ...x, avgScore: r2(x.totalScore / x.count) }))
      .sort((a, b) => b.avgScore - a.avgScore);
  }, [evals]);

  const criterionAverages = useMemo(() => {
    const m = new Map<string, { label: string; total: number; count: number }>();
    for (const s of evalScores) {
      const ex = m.get(s.criterion_label);
      if (ex) { ex.total += Number(s.score); ex.count++; }
      else m.set(s.criterion_label, { label: s.criterion_label, total: Number(s.score), count: 1 });
    }
    return [...m.values()]
      .map((x) => ({ label: x.label, avg: r2(x.total / x.count) }))
      .sort((a, b) => b.avg - a.avg);
  }, [evalScores]);

  const evalGlobalAvg = useMemo(() =>
    evals.length > 0 ? r2(evals.reduce((s, e) => s + Number(e.average_score), 0) / evals.length) : 0,
  [evals]);

  // ── Derived: horarios ───────────────────────────────────────────────────────
  const scheduleStaffSummaries = useMemo(() => {
    const m = new Map<string, { staff_id: string; name: string; matutino: number; vespertino: number; descanso: number }>();
    for (const s of schedules) {
      const name = scheduleNames.get(s.staff_id) ?? s.staff_id;
      if (!m.has(s.staff_id)) m.set(s.staff_id, { staff_id: s.staff_id, name, matutino: 0, vespertino: 0, descanso: 0 });
      const ex = m.get(s.staff_id)!;
      if (s.shift === 'Matutino') ex.matutino++;
      else if (s.shift === 'Vespertino') ex.vespertino++;
      else ex.descanso++;
    }
    return [...m.values()]
      .map((x) => ({ ...x, total: x.matutino + x.vespertino }))
      .sort((a, b) => b.total - a.total);
  }, [schedules, scheduleNames]);

  const scheduleDays = useMemo(() => {
    const days = [...new Set(schedules.map((s) => s.day))].sort();
    return days;
  }, [schedules]);

  const scheduleTotals = useMemo(() => ({
    matutino: schedules.filter((s) => s.shift === 'Matutino').length,
    vespertino: schedules.filter((s) => s.shift === 'Vespertino').length,
    descanso: schedules.filter((s) => s.shift === 'Descanso').length,
  }), [schedules]);

  // ── Derived: checklist ──────────────────────────────────────────────────────
  const checklistDayRows = useMemo(() => {
    const m = new Map<string, { date: string; apertura: ClosingRow[]; cierre: ClosingRow[] }>();
    for (const c of closings) {
      if (!m.has(c.closing_date)) m.set(c.closing_date, { date: c.closing_date, apertura: [], cierre: [] });
      m.get(c.closing_date)![c.type].push(c);
    }
    return [...m.values()].sort((a, b) => b.date.localeCompare(a.date));
  }, [closings]);

  const checklistStaffRows = useMemo(() => {
    const m = new Map<string, { name: string; count: number; totalPct: number }>();
    for (const c of closings) {
      const pct = c.total_items > 0 ? (c.checked_items / c.total_items) * 100 : 100;
      const ex = m.get(c.staff_name);
      if (ex) { ex.count++; ex.totalPct += pct; }
      else m.set(c.staff_name, { name: c.staff_name, count: 1, totalPct: pct });
    }
    return [...m.values()]
      .map((x) => ({ ...x, avgPct: Math.round(x.totalPct / x.count) }))
      .sort((a, b) => b.count - a.count);
  }, [closings]);

  const checklistTotals = useMemo(() => ({
    total: closings.length,
    apertura: closings.filter((c) => c.type === 'apertura').length,
    cierre: closings.filter((c) => c.type === 'cierre').length,
    avgPct: closings.length > 0
      ? Math.round(closings.reduce((s, c) => s + (c.total_items > 0 ? (c.checked_items / c.total_items) * 100 : 100), 0) / closings.length)
      : 0,
  }), [closings]);

  // ── Derived: bar consumption ────────────────────────────────────────────────
  const barConsumedProducts = useMemo((): BarConsumedProduct[] => {
    type EntryMap = Map<string, { closed_bottles: number; open_fraction: number; product_name: string; category: string; bottle_ml: number }>;
    const byShift = new Map<string, { inicial: EntryMap; arrastre: EntryMap }>();

    for (const row of barDiario) {
      const key = `${row.inventory_date}|${row.shift}`;
      if (!byShift.has(key)) byShift.set(key, { inicial: new Map(), arrastre: new Map() });
      const sd = byShift.get(key)!;
      const target = row.snapshot_type === 'inicial' ? sd.inicial : sd.arrastre;
      target.set(row.inventory_id, {
        closed_bottles: Number(row.closed_bottles),
        open_fraction: Number(row.open_fraction),
        product_name: row.product_name,
        category: row.category,
        bottle_ml: Number(row.bottle_ml),
      });
    }

    const productMap = new Map<string, BarConsumedProduct>();
    for (const sd of byShift.values()) {
      if (sd.inicial.size === 0 || sd.arrastre.size === 0) continue;
      const allIds = new Set([...sd.inicial.keys(), ...sd.arrastre.keys()]);
      for (const id of allIds) {
        const ini = sd.inicial.get(id);
        const arr = sd.arrastre.get(id);
        const iniT = ini ? ini.closed_bottles + ini.open_fraction : 0;
        const arrT = arr ? arr.closed_bottles + arr.open_fraction : 0;
        const consumed = Math.max(0, iniT - arrT);
        if (consumed === 0) continue;
        const meta = ini ?? arr!;
        const liters = r2(consumed * (meta.bottle_ml / 1000));
        const ex = productMap.get(id);
        if (ex) {
          ex.total_bottles = r2(ex.total_bottles + consumed);
          ex.total_liters = r2(ex.total_liters + liters);
        } else {
          productMap.set(id, {
            inventory_id: id,
            product_name: meta.product_name,
            category: meta.category,
            bottle_ml: meta.bottle_ml,
            total_bottles: r2(consumed),
            total_liters: liters,
          });
        }
      }
    }
    return [...productMap.values()].sort((a, b) => b.total_bottles - a.total_bottles);
  }, [barDiario]);

  const barConsumedCategories = useMemo(
    () => Array.from(new Set(barConsumedProducts.map((p) => p.category))),
    [barConsumedProducts],
  );

  // ── CSV Export ──────────────────────────────────────────────────────────────
  function handleExportCSV() {
    const range = fmtRange(dateFrom, dateTo).replace(/\s/g, '_');
    if (tab === 'general') {
      exportCSV(
        [
          ['Mesero', 'Cierres', 'Total Ventas', 'Aporte', 'A Entregar', 'Propina Cap.', 'Sancion'],
          ...staffSummaries.map((s) => [s.name, String(s.count), fmtMXN(s.total), fmtMXN(s.contribution), fmtMXN(s.to_deliver), fmtMXN(s.captain_tip), fmtMXN(s.sanction_amount)]),
          ['TOTAL', String(grandTotals.count), fmtMXN(grandTotals.total), '', fmtMXN(grandTotals.to_deliver), fmtMXN(grandTotals.captain_tip), fmtMXN(grandTotals.sanction_amount)],
        ],
        `ventas_${range}.csv`,
      );
    } else if (tab === 'capitanes') {
      exportCSV(
        [
          ['Fecha', 'Registros', 'Total Ventas', 'Propina Capitan (0.8%)'],
          ...daySummaries.map((d) => [d.sale_date, String(d.registros), fmtMXN(d.ventas_total), fmtMXN(d.captain_total)]),
          ['TOTAL', String(grandTotals.count), fmtMXN(grandTotals.total), fmtMXN(grandTotals.captain_tip)],
        ],
        `capitanes_${range}.csv`,
      );
    } else if (tab === 'turnos') {
      exportCSV(
        [
          ['Turno', 'Cierres', 'Total Ventas', 'Aportes', 'A Entregar', 'Propina Cap.'],
          ...shiftSummaries.map((s) => [s.shift, String(s.count), fmtMXN(s.total), fmtMXN(s.contribution), fmtMXN(s.to_deliver), fmtMXN(s.captain_tip)]),
        ],
        `turnos_${range}.csv`,
      );
    } else if (tab === 'productos') {
      exportCSV(
        [
          ['Producto', 'Categoria', 'Cantidad', 'Monto'],
          ...productSummaries.map((p) => [p.product_name, p.category, String(p.total_qty), fmtMXN(p.total_amount)]),
        ],
        `productos_${range}.csv`,
      );
    } else if (tab === 'sanciones') {
      exportCSV(
        [
          ['Colaborador', 'Bonos', 'Sanciones', 'Balance', 'Registros'],
          ...staffSanctionSummaries.map((s) => [s.name, fmtMXN(s.bonos), fmtMXN(s.sanciones), fmtMXN(s.balance), String(s.count)]),
          ['TOTAL', fmtMXN(sanctionTotals.bonos), fmtMXN(sanctionTotals.sanciones), fmtMXN(sanctionTotals.balance), ''],
        ],
        `sanciones_${range}.csv`,
      );
    } else if (tab === 'rubricas') {
      exportCSV(
        [
          ['Fecha', 'Colaborador', 'Evaluador', 'Promedio', 'Observaciones'],
          ...evals.map((e) => [e.eval_date, e.staff_name, e.evaluator_name, String(e.average_score), e.observations ?? '']),
        ],
        `rubricas_${range}.csv`,
      );
    } else if (tab === 'horarios') {
      exportCSV(
        [
          ['Colaborador', 'Matutino', 'Vespertino', 'Descanso', 'Turnos activos'],
          ...scheduleStaffSummaries.map((s) => [s.name, String(s.matutino), String(s.vespertino), String(s.descanso), String(s.total)]),
          ['TOTAL', String(scheduleTotals.matutino), String(scheduleTotals.vespertino), String(scheduleTotals.descanso), String(scheduleTotals.matutino + scheduleTotals.vespertino)],
        ],
        `horarios_${range}.csv`,
      );
    } else if (tab === 'checklist') {
      exportCSV(
        [
          ['Fecha', 'Tipo', 'Área', 'Responsable', 'Ítems', 'Completados', '% Completado'],
          ...closings.map((c) => [
            c.closing_date,
            c.type,
            c.area,
            c.staff_name,
            String(c.total_items),
            String(c.checked_items),
            `${c.total_items > 0 ? Math.round((c.checked_items / c.total_items) * 100) : 100}%`,
          ]),
        ],
        `checklist_${range}.csv`,
      );
    } else if (tab === 'barra') {
      exportCSV(
        [
          ['Producto', 'Categoria', 'Stock Actual', 'Unidad', 'Stock Minimo'],
          ...barInventory.map((i) => [i.product_name, i.category, String(i.stock), i.unit, String(i.min_stock)]),
        ],
        `inventario_barra_${range}.csv`,
      );
    }
  }

  const TABS: { key: ReportTab; label: string }[] = [
    { key: 'general',   label: 'General' },
    { key: 'capitanes', label: 'Capitanes' },
    { key: 'turnos',    label: 'Turnos' },
    { key: 'productos', label: 'Productos' },
    { key: 'sanciones',  label: 'Sanciones' },
    { key: 'checklist',  label: 'Checklist' },
    { key: 'horarios',   label: 'Horarios' },
    { key: 'rubricas',   label: 'Rúbricas' },
    { key: 'barra',      label: 'Barra' },
  ];

  const hasData = rawSales.length > 0;

  return (
    <div className="min-h-screen bg-[#0D1211] text-[#e6edea]">
      {/* Header */}
      <header className="bg-[#151D1A] border-b border-[#223530] px-4 py-3 flex items-center gap-3 shadow-[0_2px_8px_rgba(0,0,0,0.2)] sticky top-0 z-10">
        <Link
          href="/dashboard"
          className="flex items-center justify-center w-9 h-9 rounded-xl text-[#7d9990] hover:text-[#e6edea] hover:bg-[#1c2b27] transition active:scale-[0.95]"
          aria-label="Volver"
        >
          <ChevronLeft size={22} strokeWidth={2.5} />
        </Link>
        <Image src="/icon-512.png" alt="" width={28} height={28} className="rounded-lg shrink-0" />
        <div className="flex-1 min-w-0">
          <h1 className="font-extrabold text-[#E8899A] text-lg leading-tight">Reportes</h1>
          <p className="text-xs text-[#7d9990] truncate">{fmtRange(dateFrom, dateTo)}</p>
        </div>
        {hasData && (
          <button
            onClick={handleExportCSV}
            className="shrink-0 flex items-center gap-1.5 h-9 px-3 rounded-xl border border-[#223530] bg-[#1c2b27] text-xs font-semibold text-[#7d9990] hover:text-[#e6edea] transition"
          >
            <Download size={13} strokeWidth={2} />
            CSV
          </button>
        )}
      </header>

      {/* Tab bar — scrollable */}
      <div className="bg-[#151D1A] border-b border-[#223530] sticky top-[57px] z-10 px-3 py-2">
        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`shrink-0 h-9 px-4 rounded-xl text-xs font-semibold transition duration-150 ease-out active:scale-[0.98] select-none ${
                tab === t.key
                  ? 'bg-[#7A1D2E] text-white shadow-sm'
                  : 'bg-[#1c2b27] border border-[#223530] text-[#7d9990] hover:text-[#e6edea]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <main className="p-4 max-w-2xl mx-auto space-y-4">

        {/* ── Selector de rango ── */}
        <div className="bg-[#151D1A] rounded-2xl border border-[#223530] p-4 space-y-3">
          <div className="flex gap-1.5">
            {(['hoy', 'semana', 'mes'] as const).map((p) => {
              const labels = { hoy: 'Hoy', semana: 'Esta semana', mes: 'Mes actual' };
              const [f, t] = getPreset(p);
              const active = f === dateFrom && t === dateTo;
              return (
                <button
                  key={p}
                  onClick={() => { setDateFrom(f); setDateTo(t); }}
                  className={`flex-1 h-8 rounded-lg text-xs font-semibold transition active:scale-[0.98] select-none ${
                    active
                      ? 'bg-[#7A1D2E] text-white'
                      : 'bg-[#1c2b27] border border-[#223530] text-[#7d9990] hover:text-[#e6edea]'
                  }`}
                >
                  {labels[p]}
                </button>
              );
            })}
          </div>
          <div className="flex gap-2 items-center">
            <div className="flex-1">
              <label className="block text-[10px] font-bold text-[#7d9990] uppercase tracking-wider mb-1">Desde</label>
              <input
                type="date"
                value={dateFrom}
                max={dateTo}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-[#223530] bg-[#1c2b27] text-[#e6edea] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8324B]"
              />
            </div>
            <span className="text-[#7d9990] mt-5 shrink-0">—</span>
            <div className="flex-1">
              <label className="block text-[10px] font-bold text-[#7d9990] uppercase tracking-wider mb-1">Hasta</label>
              <input
                type="date"
                value={dateTo}
                min={dateFrom}
                max={todayStr()}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-[#223530] bg-[#1c2b27] text-[#e6edea] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8324B]"
              />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-16 text-[#7d9990] text-sm">Cargando...</div>
        ) : (

          <>
            {/* ══ GENERAL ══════════════════════════════════════════════════════ */}
            {tab === 'general' && (
              <div className="space-y-3">
                {/* Summary card */}
                <div className="bg-[#420F18]/30 border border-[#9E2A3E]/50 rounded-2xl p-4">
                  <p className="text-xs font-bold text-[#E8899A] uppercase tracking-wider mb-3">
                    Resumen del periodo &middot; {grandTotals.count} cierres
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-[#7d9990]">Total ventas</p>
                      <p className="font-mono font-bold text-[#e6edea]">{fmtMXN(grandTotals.total)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-[#7d9990]">A entregar</p>
                      <p className="font-mono font-bold text-[#E8899A]">{fmtMXN(grandTotals.to_deliver)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-[#7d9990]">Propina Cap. (info)</p>
                      <p className="font-mono font-bold text-sky-400">{fmtMXN(grandTotals.captain_tip)}</p>
                    </div>
                    {grandTotals.sanction_amount > 0 && (
                      <div>
                        <p className="text-xs text-[#7d9990]">Bonos retenidos</p>
                        <p className="font-mono font-bold text-orange-400">{fmtMXN(grandTotals.sanction_amount)}</p>
                      </div>
                    )}
                  </div>
                </div>

                {!hasData ? (
                  <div className="text-center py-12 text-[#7d9990] text-sm">Sin ventas en este periodo.</div>
                ) : (
                  <>
                    <p className="text-[10px] font-bold text-[#7d9990] uppercase tracking-wider px-1">
                      Por mesero — ordenado por venta
                    </p>
                    {staffSummaries.map((s, idx) => (
                      <div key={s.staff_id} className="bg-[#151D1A] rounded-2xl border border-[#223530] shadow-[0_2px_8px_rgba(0,0,0,0.2)] p-4">
                        <div className="flex items-center gap-3 mb-2">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center font-extrabold text-xs shrink-0 ${
                            idx === 0 ? 'bg-[#7A1D2E] text-white' :
                            idx === 1 ? 'bg-[#223530] text-[#e6edea]' :
                            idx === 2 ? 'bg-orange-900/60 border border-orange-700/50 text-orange-300' :
                            'bg-[#1c2b27] border border-[#223530] text-[#7d9990]'
                          }`}>{idx + 1}</div>
                          <p className="font-bold text-[#e6edea] text-sm flex-1 truncate">{s.name}</p>
                          <span className="text-xs text-[#7d9990]">{s.count} reg.</span>
                        </div>
                        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
                          <div className="flex justify-between">
                            <span className="text-[#7d9990]">Total</span>
                            <span className="font-semibold text-[#e6edea]">{fmtMXN(s.total)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[#7d9990]">Aporte</span>
                            <span className="font-semibold text-[#e6edea]">{fmtMXN(s.contribution)}</span>
                          </div>
                          <div className="flex justify-between col-span-2 border-t border-[#223530] pt-1 mt-0.5">
                            <span className="font-bold text-[#e6edea]">A entregar</span>
                            <span className="font-bold text-[#E8899A]">{fmtMXN(s.to_deliver)}</span>
                          </div>
                          {s.sanction_amount > 0 && (
                            <div className="flex justify-between col-span-2 text-orange-400 text-[10px]">
                              <span>Bono retenido</span>
                              <span className="font-bold">{fmtMXN(s.sanction_amount)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}

            {/* ══ CAPITANES ════════════════════════════════════════════════════ */}
            {tab === 'capitanes' && (
              <div className="space-y-3">
                <div className="bg-sky-950/30 border border-sky-800/50 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp size={16} strokeWidth={1.5} className="text-sky-400" />
                    <p className="text-xs font-bold text-sky-400 uppercase tracking-wider">Propina Capitan (0.8%)</p>
                  </div>
                  <p className="text-2xl font-mono font-extrabold tracking-tight text-sky-400">
                    {fmtMXN(grandTotals.captain_tip)}
                  </p>
                  <p className="text-xs text-[#7d9990] mt-1">
                    {daySummaries.length} dias con ventas &middot; {grandTotals.count} cierres
                  </p>
                </div>

                {!hasData ? (
                  <div className="text-center py-12 text-[#7d9990] text-sm">Sin ventas en este periodo.</div>
                ) : (
                  <>
                    <p className="text-[10px] font-bold text-[#7d9990] uppercase tracking-wider px-1">
                      Ranking por mesero
                    </p>
                    {staffSummaries.map((s, idx) => (
                      <div key={s.staff_id} className="bg-[#151D1A] rounded-2xl border border-[#223530] shadow-[0_2px_8px_rgba(0,0,0,0.2)] px-4 py-3 flex items-center gap-3">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center font-extrabold text-xs shrink-0 ${
                          idx === 0 ? 'bg-sky-700 text-white' :
                          idx === 1 ? 'bg-sky-900/60 border border-sky-700/50 text-sky-300' :
                          'bg-[#1c2b27] border border-[#223530] text-[#7d9990]'
                        }`}>{idx + 1}</div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-[#e6edea] text-sm truncate">{s.name}</p>
                          <p className="text-[10px] text-[#7d9990]">
                            {s.count} cierres &middot; venta {fmtMXN(s.total)}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-mono font-bold text-sky-400">{fmtMXN(s.captain_tip)}</p>
                          <p className="text-[10px] text-[#7d9990]">0.8%</p>
                        </div>
                      </div>
                    ))}

                    <p className="text-[10px] font-bold text-[#7d9990] uppercase tracking-wider px-1 pt-2">
                      Por dia
                    </p>
                    <div className="bg-[#151D1A] rounded-2xl border border-[#223530] shadow-[0_2px_8px_rgba(0,0,0,0.2)] overflow-hidden">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="border-b border-[#223530] bg-[#1c2b27]/40">
                            <th className="px-4 py-2.5 text-left text-xs font-bold text-[#7d9990] uppercase">Fecha</th>
                            <th className="px-3 py-2.5 text-center text-xs font-bold text-[#7d9990]">Reg.</th>
                            <th className="px-3 py-2.5 text-right text-xs font-bold text-[#7d9990] uppercase">Ventas</th>
                            <th className="px-4 py-2.5 text-right text-xs font-bold text-sky-400 uppercase">Cap.</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#223530]">
                          {daySummaries.map((d) => (
                            <tr key={d.sale_date} className="hover:bg-[#1c2b27]/30">
                              <td className="px-4 py-2.5 text-xs text-[#e6edea] font-medium">{d.sale_date}</td>
                              <td className="px-3 py-2.5 text-xs text-[#7d9990] text-center">{d.registros}</td>
                              <td className="px-3 py-2.5 text-xs text-[#7d9990] text-right">{fmtMXN(d.ventas_total)}</td>
                              <td className="px-4 py-2.5 text-xs font-bold text-sky-400 text-right">{fmtMXN(d.captain_total)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ══ TURNOS ═══════════════════════════════════════════════════════ */}
            {tab === 'turnos' && (
              <div className="space-y-3">
                {!hasData ? (
                  <div className="text-center py-12 text-[#7d9990] text-sm">Sin ventas en este periodo.</div>
                ) : shiftSummaries.length === 0 ? (
                  <div className="text-center py-12 text-[#7d9990] text-sm">Sin datos de turnos.</div>
                ) : (
                  <>
                    {/* Side-by-side comparison */}
                    <div className="grid grid-cols-2 gap-3">
                      {(['Matutino', 'Vespertino'] as const).map((shift) => {
                        const s = shiftSummaries.find((x) => x.shift === shift);
                        const color = shift === 'Matutino'
                          ? { bg: 'bg-[#420F18]/30', border: 'border-[#9E2A3E]/50', text: 'text-[#E8899A]' }
                          : { bg: 'bg-sky-950/30', border: 'border-sky-800/50', text: 'text-sky-400' };
                        return (
                          <div key={shift} className={`${color.bg} border ${color.border} rounded-2xl p-3`}>
                            <p className={`text-xs font-bold uppercase tracking-wider mb-2 ${color.text}`}>{shift}</p>
                            {s ? (
                              <div className="space-y-1.5">
                                <div>
                                  <p className="text-[10px] text-[#7d9990]">Cierres</p>
                                  <p className={`font-mono font-bold text-lg leading-tight ${color.text}`}>{s.count}</p>
                                </div>
                                <div>
                                  <p className="text-[10px] text-[#7d9990]">Total ventas</p>
                                  <p className="font-mono font-bold text-sm text-[#e6edea]">{fmtMXN(s.total)}</p>
                                </div>
                                <div>
                                  <p className="text-[10px] text-[#7d9990]">Aportes</p>
                                  <p className="font-mono font-semibold text-xs text-[#e6edea]">{fmtMXN(s.contribution)}</p>
                                </div>
                                <div className="border-t border-[#223530]/60 pt-1.5">
                                  <p className="text-[10px] text-[#7d9990]">A entregar</p>
                                  <p className={`font-mono font-bold text-sm ${color.text}`}>{fmtMXN(s.to_deliver)}</p>
                                </div>
                                <div>
                                  <p className="text-[10px] text-[#7d9990] italic">Capitán</p>
                                  <p className="font-mono text-xs text-sky-400 italic">{fmtMXN(s.captain_tip)}</p>
                                </div>
                              </div>
                            ) : (
                              <p className="text-xs text-[#7d9990] italic">Sin datos</p>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Breakdown por mesero x turno */}
                    {shiftSummaries.length > 0 && (
                      <div className="bg-[#151D1A] rounded-2xl border border-[#223530] shadow-[0_2px_8px_rgba(0,0,0,0.2)] overflow-hidden">
                        <div className="px-4 py-2.5 border-b border-[#223530]">
                          <p className="text-xs font-bold text-[#7d9990] uppercase tracking-wider">
                            Desglose por mesero y turno
                          </p>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full border-collapse text-xs">
                            <thead>
                              <tr className="border-b border-[#223530] bg-[#1c2b27]/30">
                                <th className="sticky left-0 bg-[#151D1A] px-4 py-2 text-left text-[#7d9990] font-bold min-w-[110px]">Mesero</th>
                                <th className="px-3 py-2 text-center text-[#E8899A] font-bold">Mat.</th>
                                <th className="px-3 py-2 text-center text-sky-400 font-bold">Vesp.</th>
                                <th className="px-3 py-2 text-right text-[#7d9990] font-bold">Total</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#223530]">
                              {staffSummaries.map((st) => {
                                const mat = rawSales.filter((s) => s.staff_id === st.staff_id && s.shift === 'Matutino');
                                const vesp = rawSales.filter((s) => s.staff_id === st.staff_id && s.shift === 'Vespertino');
                                const matTotal = r2(mat.reduce((a, s) => a + (Number(s.total) || 0), 0));
                                const vespTotal = r2(vesp.reduce((a, s) => a + (Number(s.total) || 0), 0));
                                return (
                                  <tr key={st.staff_id} className="hover:bg-[#1c2b27]/30">
                                    <td className="sticky left-0 bg-[#151D1A] px-4 py-2 font-semibold text-[#e6edea] truncate max-w-[110px]">{st.name.split(' ')[0]}</td>
                                    <td className="px-3 py-2 text-center text-[#E8899A]">{mat.length > 0 ? `${mat.length}×` : '—'}</td>
                                    <td className="px-3 py-2 text-center text-sky-400">{vesp.length > 0 ? `${vesp.length}×` : '—'}</td>
                                    <td className="px-3 py-2 text-right text-[#e6edea] font-semibold">{fmtMXN(matTotal + vespTotal)}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ══ PRODUCTOS ════════════════════════════════════════════════════ */}
            {tab === 'productos' && (
              <div className="space-y-3">
                {prodLoading ? (
                  <div className="text-center py-16 text-[#7d9990] text-sm">Cargando...</div>
                ) : productSummaries.length === 0 ? (
                  <div className="text-center py-12 text-[#7d9990] text-sm">Sin productos registrados en este periodo.</div>
                ) : (
                  <>
                    {/* Summary */}
                    <div className="bg-[#420F18]/30 border border-[#9E2A3E]/50 rounded-2xl p-4">
                      <p className="text-xs font-bold text-[#E8899A] uppercase tracking-wider mb-3">
                        Resumen · {productSummaries.length} productos
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-xs text-[#7d9990]">Unidades vendidas</p>
                          <p className="font-mono font-bold text-[#e6edea]">
                            {r2(productSummaries.reduce((a, p) => a + p.total_qty, 0))}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-[#7d9990]">Monto total</p>
                          <p className="font-mono font-bold text-[#E8899A]">
                            {fmtMXN(r2(productSummaries.reduce((a, p) => a + p.total_amount, 0)))}
                          </p>
                        </div>
                      </div>
                    </div>

                    {productCategories.map((cat) => {
                      const items = productSummaries.filter((p) => p.category === cat);
                      const maxQty = Math.max(...items.map((p) => p.total_qty), 0.01);
                      return (
                        <div key={cat}>
                          <p className="text-[10px] font-bold text-[#7d9990] uppercase tracking-wider px-1 mb-1.5 capitalize">
                            {cat}
                          </p>
                          <div className="bg-[#151D1A] rounded-2xl border border-[#223530] divide-y divide-[#223530] overflow-hidden">
                            {items.map((p) => (
                              <div key={p.product_name} className="px-4 py-3">
                                <div className="flex items-center gap-2 mb-1.5">
                                  <p className="flex-1 font-semibold text-sm text-[#e6edea] truncate">
                                    {p.product_name}
                                  </p>
                                  <div className="shrink-0 text-right">
                                    <p className="font-mono font-bold text-sm text-[#F5C2CB]">
                                      {p.total_qty % 1 === 0 ? p.total_qty.toFixed(0) : p.total_qty.toFixed(2)} uds.
                                    </p>
                                    <p className="text-[10px] text-[#7d9990]">{fmtMXN(p.total_amount)}</p>
                                  </div>
                                </div>
                                <div className="h-1.5 bg-[#1c2b27] rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-[#7A1D2E] rounded-full"
                                    style={{ width: `${(p.total_qty / maxQty) * 100}%` }}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            )}

            {/* ══ SANCIONES ════════════════════════════════════════════════════ */}
            {tab === 'sanciones' && (
              <div className="space-y-3">
                {sanctionLoading ? (
                  <div className="text-center py-16 text-[#7d9990] text-sm">Cargando...</div>
                ) : sanctions.length === 0 ? (
                  <div className="text-center py-12 text-[#7d9990] text-sm">Sin sanciones o bonos en este periodo.</div>
                ) : (
                  <>
                    {/* Summary */}
                    <div className="bg-[#151D1A] border border-[#223530] rounded-2xl p-4">
                      <p className="text-xs font-bold text-[#7d9990] uppercase tracking-wider mb-3">
                        Resumen · {sanctions.length} registros
                      </p>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="bg-[#0a0f0e] rounded-xl p-3 text-center">
                          <p className="font-mono font-bold text-emerald-400 text-lg leading-tight">
                            {fmtMXN(sanctionTotals.bonos)}
                          </p>
                          <p className="text-[10px] text-[#7d9990] mt-0.5">Bonos</p>
                        </div>
                        <div className="bg-[#0a0f0e] rounded-xl p-3 text-center">
                          <p className="font-mono font-bold text-rose-400 text-lg leading-tight">
                            {fmtMXN(sanctionTotals.sanciones)}
                          </p>
                          <p className="text-[10px] text-[#7d9990] mt-0.5">Sanciones</p>
                        </div>
                        <div className="bg-[#0a0f0e] rounded-xl p-3 text-center">
                          <p className={`font-mono font-bold text-lg leading-tight ${sanctionTotals.balance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {fmtMXN(sanctionTotals.balance)}
                          </p>
                          <p className="text-[10px] text-[#7d9990] mt-0.5">Balance</p>
                        </div>
                      </div>
                    </div>

                    {/* Per staff */}
                    {staffSanctionSummaries.length > 0 && (
                      <>
                        <p className="text-[10px] font-bold text-[#7d9990] uppercase tracking-wider px-1">
                          Por colaborador
                        </p>
                        {staffSanctionSummaries.map((s) => (
                          <div key={s.staff_id} className="bg-[#151D1A] rounded-2xl border border-[#223530] px-4 py-3">
                            <div className="flex items-center justify-between mb-2">
                              <p className="font-bold text-sm text-[#e6edea]">{s.name}</p>
                              <span className={`font-mono font-bold text-sm ${s.balance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {s.balance >= 0 ? '+' : ''}{fmtMXN(s.balance)}
                              </span>
                            </div>
                            <div className="flex gap-4 text-xs">
                              {s.bonos > 0 && (
                                <div>
                                  <span className="text-[#7d9990]">Bonos </span>
                                  <span className="font-semibold text-emerald-400">{fmtMXN(s.bonos)}</span>
                                </div>
                              )}
                              {s.sanciones > 0 && (
                                <div>
                                  <span className="text-[#7d9990]">Sanciones </span>
                                  <span className="font-semibold text-rose-400">{fmtMXN(s.sanciones)}</span>
                                </div>
                              )}
                              <div>
                                <span className="text-[#7d9990]">{s.count} reg.</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </>
                    )}

                    {/* Full record list */}
                    <p className="text-[10px] font-bold text-[#7d9990] uppercase tracking-wider px-1 pt-1">
                      Detalle
                    </p>
                    <div className="bg-[#151D1A] rounded-2xl border border-[#223530] divide-y divide-[#223530] overflow-hidden">
                      {sanctions.map((s) => (
                        <div key={s.id} className="px-4 py-3 flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                                s.type === 'bono'
                                  ? 'bg-emerald-900/50 text-emerald-400'
                                  : 'bg-rose-900/50 text-rose-400'
                              }`}>
                                {s.type === 'bono' ? 'BONO' : 'SANCIÓN'}
                              </span>
                              <p className="font-semibold text-sm text-[#e6edea] truncate">
                                {sanctionNames.get(s.staff_id) ?? '—'}
                              </p>
                            </div>
                            <p className="text-[10px] text-[#7d9990] mt-0.5 truncate">{s.concept}</p>
                            <p className="text-[10px] text-[#7d9990]">{s.record_date}</p>
                          </div>
                          <p className={`font-mono font-bold text-sm shrink-0 ${
                            s.type === 'bono' ? 'text-emerald-400' : 'text-rose-400'
                          }`}>
                            {s.type === 'bono' ? '+' : '-'}{fmtMXN(Number(s.amount))}
                          </p>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ══ CHECKLIST ════════════════════════════════════════════════════ */}
            {tab === 'checklist' && (
              <div className="space-y-3">
                {checklistLoading ? (
                  <div className="text-center py-16 text-[#7d9990] text-sm">Cargando...</div>
                ) : closings.length === 0 ? (
                  <div className="text-center py-12 text-[#7d9990] text-sm">Sin revisiones en este periodo.</div>
                ) : (
                  <>
                    {/* Summary card */}
                    <div className="bg-[#151D1A] border border-[#223530] rounded-2xl p-4">
                      <p className="text-xs font-bold text-[#7d9990] uppercase tracking-wider mb-3">
                        Resumen · {checklistDayRows.length} días
                      </p>
                      <div className="grid grid-cols-4 gap-2">
                        {[
                          { label: 'Total', value: checklistTotals.total, color: 'text-[#E8899A]' },
                          { label: 'Apertura', value: checklistTotals.apertura, color: 'text-emerald-400' },
                          { label: 'Cierre', value: checklistTotals.cierre, color: 'text-sky-400' },
                          { label: 'Avg %', value: `${checklistTotals.avgPct}%`, color: checklistTotals.avgPct >= 80 ? 'text-emerald-400' : 'text-amber-400' },
                        ].map((item) => (
                          <div key={item.label} className="bg-[#0a0f0e] rounded-xl p-2.5 text-center">
                            <p className={`font-mono font-bold text-lg leading-tight ${item.color}`}>{item.value}</p>
                            <p className="text-[10px] text-[#7d9990] mt-0.5">{item.label}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Per-day compliance */}
                    <p className="text-[10px] font-bold text-[#7d9990] uppercase tracking-wider px-1">
                      Cumplimiento por día
                    </p>
                    <div className="bg-[#151D1A] rounded-2xl border border-[#223530] overflow-hidden">
                      <div className="grid grid-cols-3 px-4 py-2 border-b border-[#223530] bg-[#0a0f0e]">
                        <span className="text-[10px] font-bold text-[#7d9990] uppercase">Fecha</span>
                        <span className="text-[10px] font-bold text-emerald-400 uppercase text-center">Apertura</span>
                        <span className="text-[10px] font-bold text-sky-400 uppercase text-center">Cierre</span>
                      </div>
                      {checklistDayRows.map((day, i) => {
                        const apPct = day.apertura.length > 0
                          ? Math.round(day.apertura.reduce((s, c) => s + (c.total_items > 0 ? (c.checked_items / c.total_items) * 100 : 100), 0) / day.apertura.length)
                          : null;
                        const ciPct = day.cierre.length > 0
                          ? Math.round(day.cierre.reduce((s, c) => s + (c.total_items > 0 ? (c.checked_items / c.total_items) * 100 : 100), 0) / day.cierre.length)
                          : null;
                        return (
                          <div
                            key={day.date}
                            className={`grid grid-cols-3 px-4 py-2.5 items-center ${i < checklistDayRows.length - 1 ? 'border-b border-[#223530]' : ''}`}
                          >
                            <span className="text-xs text-[#e6edea] font-mono">{day.date.slice(5)}</span>
                            <div className="text-center">
                              {apPct !== null ? (
                                <span className={`text-xs font-bold ${apPct >= 80 ? 'text-emerald-400' : 'text-amber-400'}`}>
                                  {apPct}%
                                  <span className="text-[10px] text-[#7d9990] font-normal ml-1">×{day.apertura.length}</span>
                                </span>
                              ) : (
                                <span className="text-xs text-[#4a6560]">—</span>
                              )}
                            </div>
                            <div className="text-center">
                              {ciPct !== null ? (
                                <span className={`text-xs font-bold ${ciPct >= 80 ? 'text-sky-400' : 'text-amber-400'}`}>
                                  {ciPct}%
                                  <span className="text-[10px] text-[#7d9990] font-normal ml-1">×{day.cierre.length}</span>
                                </span>
                              ) : (
                                <span className="text-xs text-[#4a6560]">—</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Per-staff */}
                    {checklistStaffRows.length > 1 && (
                      <>
                        <p className="text-[10px] font-bold text-[#7d9990] uppercase tracking-wider px-1">
                          Por colaborador
                        </p>
                        <div className="bg-[#151D1A] rounded-2xl border border-[#223530] divide-y divide-[#223530] overflow-hidden">
                          {checklistStaffRows.map((s) => (
                            <div key={s.name} className="flex items-center gap-3 px-4 py-3">
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-sm text-[#e6edea] truncate">{s.name}</p>
                                <p className="text-[10px] text-[#7d9990]">{s.count} revisión{s.count !== 1 ? 'es' : ''}</p>
                              </div>
                              <span className={`font-mono font-bold text-sm shrink-0 ${s.avgPct >= 80 ? 'text-emerald-400' : 'text-amber-400'}`}>
                                {s.avgPct}%
                              </span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}

                    {/* Detail list */}
                    <p className="text-[10px] font-bold text-[#7d9990] uppercase tracking-wider px-1">
                      Detalle
                    </p>
                    <div className="bg-[#151D1A] rounded-2xl border border-[#223530] divide-y divide-[#223530] overflow-hidden">
                      {closings.map((c) => {
                        const pct = c.total_items > 0 ? Math.round((c.checked_items / c.total_items) * 100) : 100;
                        return (
                          <div key={c.id} className="flex items-center gap-3 px-4 py-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 mb-0.5">
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                                  c.type === 'apertura'
                                    ? 'bg-emerald-900/50 text-emerald-400'
                                    : 'bg-sky-900/50 text-sky-400'
                                }`}>
                                  {c.type.toUpperCase()}
                                </span>
                                <span className="text-[10px] text-[#7d9990] capitalize">{c.area}</span>
                              </div>
                              <p className="font-semibold text-sm text-[#e6edea] truncate">{c.staff_name}</p>
                              <p className="text-[10px] text-[#7d9990]">{c.closing_date}</p>
                            </div>
                            <div className="shrink-0 text-right">
                              <p className={`font-mono font-bold text-sm ${pct >= 80 ? 'text-emerald-400' : 'text-amber-400'}`}>
                                {pct}%
                              </p>
                              <p className="text-[10px] text-[#7d9990]">{c.checked_items}/{c.total_items}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ══ HORARIOS ═════════════════════════════════════════════════════ */}
            {tab === 'horarios' && (
              <div className="space-y-3">
                {horariosLoading ? (
                  <div className="text-center py-16 text-[#7d9990] text-sm">Cargando...</div>
                ) : schedules.length === 0 ? (
                  <div className="text-center py-12 text-[#7d9990] text-sm">Sin horarios asignados en este periodo.</div>
                ) : (
                  <>
                    {/* Summary */}
                    <div className="bg-[#151D1A] border border-[#223530] rounded-2xl p-4">
                      <p className="text-xs font-bold text-[#7d9990] uppercase tracking-wider mb-3">
                        Resumen · {scheduleDays.length} días
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { label: 'Matutino', value: scheduleTotals.matutino, color: 'text-[#E8899A]' },
                          { label: 'Vespertino', value: scheduleTotals.vespertino, color: 'text-sky-400' },
                          { label: 'Descanso', value: scheduleTotals.descanso, color: 'text-[#7d9990]' },
                        ].map((item) => (
                          <div key={item.label} className="bg-[#0a0f0e] rounded-xl p-3 text-center">
                            <p className={`font-mono font-bold text-xl leading-tight ${item.color}`}>{item.value}</p>
                            <p className="text-[10px] text-[#7d9990] mt-0.5">{item.label}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Per-staff summary table */}
                    <p className="text-[10px] font-bold text-[#7d9990] uppercase tracking-wider px-1">
                      Por colaborador
                    </p>
                    <div className="bg-[#151D1A] rounded-2xl border border-[#223530] overflow-hidden">
                      <div className="grid grid-cols-5 px-4 py-2 border-b border-[#223530] bg-[#0a0f0e]">
                        <span className="col-span-2 text-[10px] font-bold text-[#7d9990] uppercase">Nombre</span>
                        <span className="text-[10px] font-bold text-[#E8899A] uppercase text-center">Mat.</span>
                        <span className="text-[10px] font-bold text-sky-400 uppercase text-center">Vesp.</span>
                        <span className="text-[10px] font-bold text-[#7d9990] uppercase text-center">Desc.</span>
                      </div>
                      {scheduleStaffSummaries.map((s, i) => (
                        <div
                          key={s.staff_id}
                          className={`grid grid-cols-5 px-4 py-2.5 items-center ${i < scheduleStaffSummaries.length - 1 ? 'border-b border-[#223530]' : ''}`}
                        >
                          <span className="col-span-2 text-sm font-semibold text-[#e6edea] truncate">{s.name.split(' ')[0]}</span>
                          <span className="text-sm font-mono font-bold text-[#E8899A] text-center">{s.matutino > 0 ? s.matutino : '—'}</span>
                          <span className="text-sm font-mono font-bold text-sky-400 text-center">{s.vespertino > 0 ? s.vespertino : '—'}</span>
                          <span className="text-sm font-mono text-[#7d9990] text-center">{s.descanso > 0 ? s.descanso : '—'}</span>
                        </div>
                      ))}
                      {/* Totals footer */}
                      <div className="grid grid-cols-5 px-4 py-2.5 border-t border-[#7A1D2E]/40 bg-[#1c2b27]">
                        <span className="col-span-2 text-[10px] font-bold text-[#7d9990] uppercase">Total</span>
                        <span className="text-sm font-mono font-bold text-[#E8899A] text-center">{scheduleTotals.matutino}</span>
                        <span className="text-sm font-mono font-bold text-sky-400 text-center">{scheduleTotals.vespertino}</span>
                        <span className="text-sm font-mono text-[#7d9990] text-center">{scheduleTotals.descanso}</span>
                      </div>
                    </div>

                    {/* Day grid — only for ranges ≤ 14 days */}
                    {scheduleDays.length <= 14 ? (
                      <>
                        <p className="text-[10px] font-bold text-[#7d9990] uppercase tracking-wider px-1">
                          Grilla semanal
                        </p>
                        <div className="bg-[#151D1A] rounded-2xl border border-[#223530] overflow-x-auto">
                          <table className="border-collapse text-xs" style={{ minWidth: `${scheduleStaffSummaries.length > 0 ? 180 + scheduleDays.length * 52 : 200}px` }}>
                            <thead>
                              <tr className="border-b border-[#223530] bg-[#0a0f0e]">
                                <th className="sticky left-0 bg-[#0a0f0e] px-3 py-2 text-left text-[#7d9990] font-bold min-w-[110px]">Colaborador</th>
                                {scheduleDays.map((d) => (
                                  <th key={d} className="px-2 py-2 text-center text-[#7d9990] font-bold whitespace-nowrap">
                                    <span className="block text-[9px] uppercase">{new Date(d + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'short' })}</span>
                                    <span>{d.slice(8)}</span>
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#223530]">
                              {scheduleStaffSummaries.map((st) => {
                                const byDay = new Map(
                                  schedules.filter((s) => s.staff_id === st.staff_id).map((s) => [s.day, s.shift]),
                                );
                                return (
                                  <tr key={st.staff_id} className="hover:bg-[#1c2b27]/30">
                                    <td className="sticky left-0 bg-[#151D1A] px-3 py-2 font-semibold text-[#e6edea] truncate max-w-[110px]">
                                      {st.name.split(' ')[0]}
                                    </td>
                                    {scheduleDays.map((d) => {
                                      const shift = byDay.get(d);
                                      return (
                                        <td key={d} className="px-1 py-2 text-center">
                                          {shift === 'Matutino' && (
                                            <span className="inline-block text-[9px] font-bold bg-[#420F18]/60 text-[#E8899A] px-1.5 py-0.5 rounded">M</span>
                                          )}
                                          {shift === 'Vespertino' && (
                                            <span className="inline-block text-[9px] font-bold bg-sky-900/50 text-sky-400 px-1.5 py-0.5 rounded">V</span>
                                          )}
                                          {shift === 'Descanso' && (
                                            <span className="inline-block text-[9px] text-[#4a6560] px-1 py-0.5 rounded">D</span>
                                          )}
                                          {!shift && <span className="text-[#2a3d38]">·</span>}
                                        </td>
                                      );
                                    })}
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </>
                    ) : (
                      <p className="text-center text-xs text-[#7d9990] py-2">
                        Selecciona un rango de hasta 14 días para ver la grilla.
                      </p>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ══ RÚBRICAS ═════════════════════════════════════════════════════ */}
            {tab === 'rubricas' && (
              <div className="space-y-3">
                {rubricasLoading ? (
                  <div className="text-center py-16 text-[#7d9990] text-sm">Cargando...</div>
                ) : evals.length === 0 ? (
                  <div className="text-center py-12 text-[#7d9990] text-sm">Sin evaluaciones en este periodo.</div>
                ) : (
                  <>
                    {/* Summary card */}
                    <div className="bg-[#151D1A] border border-[#223530] rounded-2xl p-4">
                      <p className="text-xs font-bold text-[#7d9990] uppercase tracking-wider mb-3">
                        Resumen · {evals.length} evaluación{evals.length !== 1 ? 'es' : ''}
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="bg-[#0a0f0e] rounded-xl p-3 text-center">
                          <p className="font-mono font-bold text-xl text-[#E8899A]">{evals.length}</p>
                          <p className="text-[10px] text-[#7d9990] mt-0.5">Evaluaciones</p>
                        </div>
                        <div className="bg-[#0a0f0e] rounded-xl p-3 text-center">
                          <p className={`font-mono font-bold text-xl ${evalGlobalAvg >= 4 ? 'text-emerald-400' : evalGlobalAvg >= 3 ? 'text-amber-400' : 'text-rose-400'}`}>
                            {evalGlobalAvg.toFixed(1)}
                          </p>
                          <p className="text-[10px] text-[#7d9990] mt-0.5">Promedio global</p>
                        </div>
                        <div className="bg-[#0a0f0e] rounded-xl p-3 text-center">
                          <p className="font-mono font-bold text-xl text-[#e6edea]">{evalStaffSummaries.length}</p>
                          <p className="text-[10px] text-[#7d9990] mt-0.5">Colaboradores</p>
                        </div>
                      </div>
                    </div>

                    {/* Staff ranking */}
                    <p className="text-[10px] font-bold text-[#7d9990] uppercase tracking-wider px-1">
                      Ranking por colaborador
                    </p>
                    <div className="bg-[#151D1A] rounded-2xl border border-[#223530] divide-y divide-[#223530] overflow-hidden">
                      {evalStaffSummaries.map((s, idx) => {
                        const pct = (s.avgScore / 5) * 100;
                        return (
                          <div key={s.staff_id} className="px-4 py-3">
                            <div className="flex items-center gap-3 mb-1.5">
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center font-extrabold text-xs shrink-0 ${
                                idx === 0 ? 'bg-[#7A1D2E] text-white' :
                                idx === 1 ? 'bg-[#223530] text-[#e6edea]' :
                                'bg-[#1c2b27] border border-[#223530] text-[#7d9990]'
                              }`}>{idx + 1}</div>
                              <p className="flex-1 font-bold text-sm text-[#e6edea] truncate">{s.name}</p>
                              <div className="shrink-0 text-right">
                                <p className={`font-mono font-bold text-sm ${s.avgScore >= 4 ? 'text-emerald-400' : s.avgScore >= 3 ? 'text-amber-400' : 'text-rose-400'}`}>
                                  {s.avgScore.toFixed(1)}
                                </p>
                                <p className="text-[10px] text-[#7d9990]">{s.count} eval.</p>
                              </div>
                            </div>
                            <div className="h-1.5 bg-[#1c2b27] rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${s.avgScore >= 4 ? 'bg-emerald-600' : s.avgScore >= 3 ? 'bg-amber-600' : 'bg-rose-700'}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Criterion averages */}
                    {criterionAverages.length > 0 && (
                      <>
                        <p className="text-[10px] font-bold text-[#7d9990] uppercase tracking-wider px-1">
                          Promedio por criterio
                        </p>
                        <div className="bg-[#151D1A] rounded-2xl border border-[#223530] divide-y divide-[#223530] overflow-hidden">
                          {criterionAverages.map((c) => {
                            const pct = (c.avg / 5) * 100;
                            return (
                              <div key={c.label} className="px-4 py-2.5">
                                <div className="flex items-center gap-2 mb-1">
                                  <p className="flex-1 text-sm text-[#e6edea] truncate">{c.label}</p>
                                  <p className={`font-mono font-bold text-sm shrink-0 ${c.avg >= 4 ? 'text-emerald-400' : c.avg >= 3 ? 'text-amber-400' : 'text-rose-400'}`}>
                                    {c.avg.toFixed(1)}
                                  </p>
                                </div>
                                <div className="h-1 bg-[#1c2b27] rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${c.avg >= 4 ? 'bg-emerald-600' : c.avg >= 3 ? 'bg-amber-600' : 'bg-rose-700'}`}
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    )}

                    {/* Evaluation list */}
                    <p className="text-[10px] font-bold text-[#7d9990] uppercase tracking-wider px-1">
                      Detalle
                    </p>
                    <div className="bg-[#151D1A] rounded-2xl border border-[#223530] divide-y divide-[#223530] overflow-hidden">
                      {evals.map((e) => {
                        const score = Number(e.average_score);
                        return (
                          <div key={e.id} className="flex items-center gap-3 px-4 py-3">
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-sm text-[#e6edea] truncate">{e.staff_name}</p>
                              <p className="text-[10px] text-[#7d9990]">
                                {e.eval_date} · por {e.evaluator_name}
                              </p>
                              {e.observations && (
                                <p className="text-[10px] text-[#7d9990] mt-0.5 italic truncate">{e.observations}</p>
                              )}
                            </div>
                            <div className="shrink-0 text-right">
                              <p className={`font-mono font-bold text-lg leading-tight ${score >= 4 ? 'text-emerald-400' : score >= 3 ? 'text-amber-400' : 'text-rose-400'}`}>
                                {score.toFixed(1)}
                              </p>
                              <p className="text-[10px] text-[#7d9990]">/ 5</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ══ BARRA ════════════════════════════════════════════════════════ */}
            {tab === 'barra' && (
              <div className="space-y-3">
                {barLoading ? (
                  <div className="text-center py-12 text-[#7d9990] text-sm">Cargando barra...</div>
                ) : (
                  <>
                    {/* Consumption from bar_daily_inventory */}
                    <div>
                      <p className="text-[10px] font-bold text-[#7d9990] uppercase tracking-wider px-1 mb-1.5">
                        Consumo del periodo (Inicial → Arrastre)
                      </p>
                      {barConsumedProducts.length === 0 ? (
                        <div className="bg-[#151D1A] border border-[#223530] rounded-2xl px-4 py-6 text-center text-sm text-[#7d9990]">
                          Sin pares Inicial/Arrastre completos en este periodo.
                        </div>
                      ) : (
                        <>
                          {barConsumedCategories.map((cat) => {
                            const items = barConsumedProducts.filter((p) => p.category === cat);
                            const maxBtl = Math.max(...items.map((p) => p.total_bottles), 0.01);
                            return (
                              <div key={cat} className="mb-2">
                                <p className="text-[10px] text-[#7d9990] capitalize px-1 mb-1">{cat}</p>
                                <div className="bg-[#151D1A] rounded-2xl border border-[#223530] divide-y divide-[#223530] overflow-hidden">
                                  {items.map((p) => (
                                    <div key={p.inventory_id} className="px-4 py-2.5">
                                      <div className="flex items-center gap-2 mb-1">
                                        <p className="flex-1 font-semibold text-sm text-[#e6edea] truncate">{p.product_name}</p>
                                        <span className="text-[10px] text-[#7d9990] bg-[#1c2b27] px-1.5 py-0.5 rounded shrink-0">{p.bottle_ml}ml</span>
                                        <div className="shrink-0 text-right">
                                          <p className="font-mono font-bold text-sm text-[#F5C2CB]">
                                            {p.total_bottles % 1 === 0 ? p.total_bottles.toFixed(0) : p.total_bottles.toFixed(2)} bot.
                                          </p>
                                          <p className="text-[10px] text-[#7d9990]">
                                            {p.total_liters % 1 === 0 ? p.total_liters.toFixed(0) : p.total_liters.toFixed(2)} L
                                          </p>
                                        </div>
                                      </div>
                                      <div className="h-1 bg-[#1c2b27] rounded-full overflow-hidden">
                                        <div className="h-full bg-[#7A1D2E] rounded-full" style={{ width: `${(p.total_bottles / maxBtl) * 100}%` }} />
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </>
                      )}
                    </div>

                    {/* Inventory */}
                    <div>
                      <p className="text-[10px] font-bold text-[#7d9990] uppercase tracking-wider px-1 mb-1.5">
                        Inventario actual
                      </p>
                      {barInventory.length === 0 ? (
                        <div className="bg-[#151D1A] border border-[#223530] rounded-2xl px-4 py-6 text-center text-sm text-[#7d9990]">
                          Sin productos en inventario.
                        </div>
                      ) : (
                        <div className="bg-[#151D1A] rounded-2xl border border-[#223530] shadow-[0_2px_8px_rgba(0,0,0,0.2)] overflow-hidden">
                          <table className="w-full border-collapse text-xs">
                            <thead>
                              <tr className="border-b border-[#223530] bg-[#1c2b27]/30">
                                <th className="px-4 py-2 text-left text-[#7d9990] font-bold">Producto</th>
                                <th className="px-3 py-2 text-center text-[#7d9990] font-bold">Stock</th>
                                <th className="px-3 py-2 text-center text-[#7d9990] font-bold">Min.</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#223530]">
                              {barInventory.map((item) => {
                                const isLow = item.stock < item.min_stock;
                                return (
                                  <tr key={item.id} className="hover:bg-[#1c2b27]/30">
                                    <td className="px-4 py-2.5">
                                      <p className="font-semibold text-[#e6edea] truncate max-w-[160px]">{item.product_name}</p>
                                      <p className="text-[10px] text-[#7d9990]">{item.category}</p>
                                    </td>
                                    <td className="px-3 py-2.5 text-center">
                                      <span className={`font-mono font-bold ${isLow ? 'text-amber-400' : 'text-[#e6edea]'}`}>
                                        {item.stock}
                                      </span>
                                      {isLow && (
                                        <AlertTriangle size={10} strokeWidth={2.5} className="text-amber-400 inline ml-1" />
                                      )}
                                    </td>
                                    <td className="px-3 py-2.5 text-center text-[#7d9990]">{item.min_stock}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    {/* Mermas */}
                    <div>
                      <p className="text-[10px] font-bold text-[#7d9990] uppercase tracking-wider px-1 mb-1.5">
                        Mermas del periodo
                      </p>
                      {barMermas.length === 0 ? (
                        <div className="bg-[#151D1A] border border-[#223530] rounded-2xl px-4 py-6 text-center text-sm text-[#7d9990]">
                          Sin mermas registradas en este periodo.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {barMermas.map((m) => (
                            <div key={m.id} className="bg-[#151D1A] rounded-2xl border border-[#223530] px-4 py-3 flex items-center gap-3">
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-sm text-[#e6edea] truncate">{m.product_name}</p>
                                <p className="text-[10px] text-[#7d9990] mt-0.5">{m.reason} &middot; {m.shift_date}</p>
                              </div>
                              <span className="font-mono font-bold text-rose-400 shrink-0">-{m.quantity}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
