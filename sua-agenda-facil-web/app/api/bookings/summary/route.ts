import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const DEFAULT_CONFIG = {
  fechado: false,
  diaInicio: 8 * 60,
  diaFim: 17 * 60,
  almocoInicio: 12 * 60,
  almocoFim: 13 * 60
};

function getSupabase() {
  const SUPABASE_URL = process.env.SUPABASE_URL!;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

function parseMonth(month: string | null) {
  if (!month || !/^\d{4}-\d{2}$/.test(month)) return null;
  const [y, m] = month.split("-").map(Number);
  if (m < 1 || m > 12) return null;
  return { year: y, month: m };
}

function getWeekday(day: string) {
  const [y, m, d] = day.split("-").map(Number);
  if (!y || !m || !d) return -1;
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function mapConfig(row: any, fallback = DEFAULT_CONFIG) {
  if (!row) return { ...DEFAULT_CONFIG };
  return {
    fechado: Boolean(row?.fechado),
    diaInicio: Number(row?.dia_inicio ?? fallback.diaInicio),
    diaFim: Number(row?.dia_fim ?? fallback.diaFim),
    almocoInicio: Number(row?.almoco_inicio ?? fallback.almocoInicio),
    almocoFim: Number(row?.almoco_fim ?? fallback.almocoFim)
  };
}

function getOpenSegments(cfg: ReturnType<typeof mapConfig>) {
  if (cfg.fechado) return [];
  const ini = Number(cfg.diaInicio);
  const fim = Number(cfg.diaFim);
  if (!Number.isFinite(ini) || !Number.isFinite(fim) || fim <= ini) return [];

  const almIni = Number(cfg.almocoInicio);
  const almFim = Number(cfg.almocoFim);

  if (
    Number.isFinite(almIni) &&
    Number.isFinite(almFim) &&
    almIni < almFim &&
    almIni > ini &&
    almFim < fim
  ) {
    return [
      { start: ini, end: almIni },
      { start: almFim, end: fim }
    ];
  }

  return [{ start: ini, end: fim }];
}

function ajustarInicioParaPasso(minutos: number, passo: number) {
  if (!Number.isFinite(minutos) || !Number.isFinite(passo) || passo <= 0) {
    return minutos;
  }
  const resto = minutos % passo;
  if (resto === 0) return minutos;
  return minutos + (passo - resto);
}

function intervalosConflitam(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return aStart < bEnd && aEnd > bStart;
}

function isWeekdayAllowed(day: string) {
  const [y, m, d] = day.split("-").map(Number);
  if (!y || !m || !d) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dow = dt.getUTCDay();
  return dow >= 2 && dow <= 6; // Tue-Sat
}

function hasFreeTime(cfg: ReturnType<typeof mapConfig>, bookings: any[], minSlot: number) {
  if (cfg.fechado) return false;
  const step = 30;
  const startMin = ajustarInicioParaPasso(Number(cfg.diaInicio), step);
  const endLimit = Number(cfg.diaFim);
  if (!Number.isFinite(startMin) || !Number.isFinite(endLimit)) return false;

  const normalized = (bookings || [])
    .map((b) => ({
      start: Number(b?.start_min),
      end: Number(b?.end_min)
    }))
    .filter((b) => Number.isFinite(b.start) && Number.isFinite(b.end) && b.end > b.start);

  for (let start = startMin; start + minSlot <= endLimit; start += step) {
    const end = start + minSlot;

    if (start < cfg.diaInicio || end > cfg.diaFim) continue;
    if (cfg.almocoInicio < cfg.almocoFim) {
      if (intervalosConflitam(start, end, cfg.almocoInicio, cfg.almocoFim)) continue;
    }

    let conflita = false;
    for (const ag of normalized) {
      if (intervalosConflitam(start, end, ag.start, ag.end)) {
        conflita = true;
        break;
      }
    }
    if (!conflita) return true;
  }

  return false;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const monthParam = searchParams.get("month");
    const parsed = parseMonth(monthParam);
    if (!parsed) {
      return NextResponse.json({ error: "Invalid month" }, { status: 400 });
    }

    const { year, month } = parsed;
    const start = `${year}-${String(month).padStart(2, "0")}-01`;
    const endDate = new Date(year, month, 1);
    const end = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, "0")}-01`;

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("bookings")
      .select("day, start_min, end_min, status")
      .gte("day", start)
      .lt("day", end)
      .neq("status", "canceled");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { data: settings, error: settingsError } = await supabase
      .from("day_settings")
      .select("day, fechado, dia_inicio, dia_fim, almoco_inicio, almoco_fim")
      .gte("day", start)
      .lt("day", end);

    if (settingsError) {
      return NextResponse.json({ error: settingsError.message }, { status: 500 });
    }

    const { data: weeklyClosed, error: weeklyError } = await supabase
      .from("weekly_closed")
      .select("weekday");

    if (weeklyError) {
      return NextResponse.json({ error: weeklyError.message }, { status: 500 });
    }

    const { data: services, error: servicesError } = await supabase
      .from("services")
      .select("duration_minutes, active");

    if (servicesError) {
      return NextResponse.json({ error: servicesError.message }, { status: 500 });
    }

    const { data: defaultSettings } = await supabase
      .from("default_settings")
      .select("dia_inicio, dia_fim, almoco_inicio, almoco_fim")
      .limit(1)
      .maybeSingle();

    const fallbackConfig = defaultSettings
      ? {
          fechado: false,
          diaInicio: Number(defaultSettings?.dia_inicio ?? DEFAULT_CONFIG.diaInicio),
          diaFim: Number(defaultSettings?.dia_fim ?? DEFAULT_CONFIG.diaFim),
          almocoInicio: Number(defaultSettings?.almoco_inicio ?? DEFAULT_CONFIG.almocoInicio),
          almocoFim: Number(defaultSettings?.almoco_fim ?? DEFAULT_CONFIG.almocoFim)
        }
      : { ...DEFAULT_CONFIG };

    const activeDurations = (services ?? [])
      .filter((s: any) => s?.active !== false)
      .map((s: any) => Number(s?.duration_minutes))
      .filter((n: number) => Number.isFinite(n) && n > 0);
    const minSlot = activeDurations.length ? Math.min(...activeDurations) : 30;

    const bookingsByDay: Record<string, any[]> = {};
    (data ?? []).forEach((row: any) => {
      const day = row?.day;
      if (!day) return;
      if (!bookingsByDay[day]) bookingsByDay[day] = [];
      bookingsByDay[day].push(row);
    });

    const configByDay: Record<string, any> = {};
    (settings ?? []).forEach((row: any) => {
      const day = row?.day;
      if (!day) return;
      configByDay[day] = row;
    });

    const weeklySet = new Set<number>(
      (weeklyClosed ?? [])
        .map((row: any) => Number(row?.weekday))
        .filter((d: number) => Number.isFinite(d) && d >= 0 && d <= 6)
    );

    const allDays: string[] = [];
    const cursor = new Date(Date.UTC(year, month - 1, 1));
    const endCursor = new Date(Date.UTC(endDate.getFullYear(), endDate.getMonth(), 1));
    while (cursor < endCursor) {
      const y = cursor.getUTCFullYear();
      const m = String(cursor.getUTCMonth() + 1).padStart(2, "0");
      const d = String(cursor.getUTCDate()).padStart(2, "0");
      allDays.push(`${y}-${m}-${d}`);
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    const days = allDays.map((day) => {
        const cfgRow = configByDay[day];
        const cfg = mapConfig(cfgRow, fallbackConfig);
        const bookings = bookingsByDay[day] || [];
        const count = bookings.length;

        const weekday = getWeekday(day);
        const weeklyClosedDay = weeklySet.has(weekday);

        if (cfg.fechado) {
          return { day, count, status: "closed" };
        }

        if (!cfgRow && weeklyClosedDay) {
          return { day, count, status: "closed" };
        }

        const hasSpace = hasFreeTime(cfg, bookings, minSlot);
        return { day, count, status: hasSpace ? "free" : "full" };
      });

    return NextResponse.json({ days });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Crash" }, { status: 500 });
  }
}
