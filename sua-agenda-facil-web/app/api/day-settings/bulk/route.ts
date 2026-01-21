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

function parseDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function formatDate(d: Date) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function POST(req: Request) {
  try {
    let body: any = null;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const startDay = String(body?.startDay || "").trim();
    const endDay = String(body?.endDay || "").trim();
    const fechado = Boolean(body?.fechado);

    const diaInicio = Number(body?.diaInicio ?? DEFAULT_CONFIG.diaInicio);
    const diaFim = Number(body?.diaFim ?? DEFAULT_CONFIG.diaFim);
    const almocoInicio = Number(body?.almocoInicio ?? DEFAULT_CONFIG.almocoInicio);
    const almocoFim = Number(body?.almocoFim ?? DEFAULT_CONFIG.almocoFim);

    const startDate = parseDate(startDay);
    const endDate = parseDate(endDay);
    if (!startDate || !endDate) {
      return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
    }
    if (startDate > endDate) {
      return NextResponse.json({ error: "Start after end" }, { status: 400 });
    }
    if (!Number.isFinite(diaInicio) || !Number.isFinite(diaFim)) {
      return NextResponse.json({ error: "Invalid diaInicio/diaFim" }, { status: 400 });
    }
    if (!Number.isFinite(almocoInicio) || !Number.isFinite(almocoFim)) {
      return NextResponse.json({ error: "Invalid almocoInicio/almocoFim" }, { status: 400 });
    }
    if (diaInicio >= diaFim) {
      return NextResponse.json({ error: "diaInicio must be before diaFim" }, { status: 400 });
    }
    if (almocoInicio > almocoFim) {
      return NextResponse.json({ error: "almocoInicio must be <= almocoFim" }, { status: 400 });
    }

    const days: string[] = [];
    const cur = new Date(startDate);
    while (cur <= endDate) {
      days.push(formatDate(cur));
      cur.setUTCDate(cur.getUTCDate() + 1);
      if (days.length > 366) {
        return NextResponse.json({ error: "Range too large" }, { status: 400 });
      }
    }

    const rows = days.map((day) => ({
      day,
      fechado,
      dia_inicio: diaInicio,
      dia_fim: diaFim,
      almoco_inicio: almocoInicio,
      almoco_fim: almocoFim
    }));

    const supabase = getSupabase();
    const { error } = await supabase
      .from("day_settings")
      .upsert(rows, { onConflict: "day" });

    if (error) {
      console.log("[day-settings bulk] Supabase error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, count: rows.length });
  } catch (e: any) {
    console.log("[day-settings bulk] Crash:", e);
    return NextResponse.json({ error: e?.message ?? "Crash" }, { status: 500 });
  }
}
