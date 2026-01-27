import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function isAdmin(req: Request) {
  const token = req.headers.get("x-admin-token") || "";
  const expected = process.env.ADMIN_TOKEN || "";
  return Boolean(token) && token === expected;
}

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

async function fetchDefaultConfig(supabase: ReturnType<typeof getSupabase>) {
  const { data, error } = await supabase
    .from("default_settings")
    .select("dia_inicio, dia_fim, almoco_inicio, almoco_fim")
    .limit(1)
    .maybeSingle();

  if (error) return { ...DEFAULT_CONFIG };
  if (!data) return { ...DEFAULT_CONFIG };

  return {
    fechado: false,
    diaInicio: Number(data?.dia_inicio ?? DEFAULT_CONFIG.diaInicio),
    diaFim: Number(data?.dia_fim ?? DEFAULT_CONFIG.diaFim),
    almocoInicio: Number(data?.almoco_inicio ?? DEFAULT_CONFIG.almocoInicio),
    almocoFim: Number(data?.almoco_fim ?? DEFAULT_CONFIG.almocoFim)
  };
}

function parseDayParam(req: Request) {
  const { searchParams } = new URL(req.url);
  const day = searchParams.get("date")?.trim() || "";
  if (!day) return { error: null, day: "" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    return { error: "Invalid date", day: "" };
  }
  return { day, error: null };
}

function parseBody(body: any) {
  const day = typeof body?.day === "string" ? body.day.trim() : "";
  const fechado = Boolean(body?.fechado);
  const diaInicio = Number(body?.diaInicio);
  const diaFim = Number(body?.diaFim);
  const almocoInicio = Number(body?.almocoInicio);
  const almocoFim = Number(body?.almocoFim);

  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    return { error: "Invalid day" };
  }
  if (!Number.isFinite(diaInicio) || !Number.isFinite(diaFim)) {
    return { error: "Invalid diaInicio/diaFim" };
  }
  if (!Number.isFinite(almocoInicio) || !Number.isFinite(almocoFim)) {
    return { error: "Invalid almocoInicio/almocoFim" };
  }
  if (diaInicio >= diaFim) {
    return { error: "diaInicio must be before diaFim" };
  }
  if (almocoInicio > almocoFim) {
    return { error: "almocoInicio must be <= almocoFim" };
  }

  return {
    data: {
      day,
      fechado,
      dia_inicio: diaInicio,
      dia_fim: diaFim,
      almoco_inicio: almocoInicio,
      almoco_fim: almocoFim
    }
  };
}

function mapRow(row: any) {
  return {
    fechado: Boolean(row?.fechado),
    diaInicio: Number(row?.dia_inicio ?? DEFAULT_CONFIG.diaInicio),
    diaFim: Number(row?.dia_fim ?? DEFAULT_CONFIG.diaFim),
    almocoInicio: Number(row?.almoco_inicio ?? DEFAULT_CONFIG.almocoInicio),
    almocoFim: Number(row?.almoco_fim ?? DEFAULT_CONFIG.almocoFim)
  };
}

function mapRowWithDay(row: any) {
  return {
    day: row?.day ?? null,
    ...mapRow(row)
  };
}

export async function GET(req: Request) {
  try {
    const { day, error } = parseDayParam(req);
    if (error) return NextResponse.json({ error }, { status: 400 });

    const supabase = getSupabase();

    if (!day) {
      const { searchParams } = new URL(req.url);
      const limit = Math.min(
        Number(searchParams.get("limit") || 200),
        500
      );

      const { data, error: listError } = await supabase
        .from("day_settings")
        .select("day, fechado, dia_inicio, dia_fim, almoco_inicio, almoco_fim")
        .order("day", { ascending: false })
        .limit(limit);

      if (listError) {
        console.log("[day-settings API] Supabase error:", listError);
        return NextResponse.json({ error: listError.message }, { status: 500 });
      }

      const configs = (data ?? []).map(mapRowWithDay);
      return NextResponse.json({ configs });
    }

    const { data, error: dbError } = await supabase
      .from("day_settings")
      .select("day, fechado, dia_inicio, dia_fim, almoco_inicio, almoco_fim")
      .eq("day", day)
      .maybeSingle();

    if (dbError) {
      console.log("[day-settings API] Supabase error:", dbError);
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    if (!data) {
      const defaults = await fetchDefaultConfig(supabase);
      return NextResponse.json({ config: defaults, meta: { exists: false } });
    }

    return NextResponse.json({ config: mapRow(data), meta: { exists: true } });
  } catch (e: any) {
    console.log("[day-settings API] Crash:", e);
    return NextResponse.json({ error: e?.message ?? "Crash" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    let body: any = null;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const parsed = parseBody(body);
    if (parsed.error || !parsed.data) {
      return NextResponse.json({ error: parsed.error || "Invalid payload" }, { status: 400 });
    }
    const payload = parsed.data;

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("day_settings")
      .upsert(parsed.data, { onConflict: "day" })
      .select("day, fechado, dia_inicio, dia_fim, almoco_inicio, almoco_fim")
      .single();

    if (error) {
      console.log("[day-settings API] Supabase error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ config: mapRow(data) }, { status: 200 });
  } catch (e: any) {
    console.log("[day-settings API] Crash:", e);
    return NextResponse.json({ error: e?.message ?? "Crash" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    let body: any = null;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const parsed = parseBody(body);
    if (parsed.error || !parsed.data) {
      return NextResponse.json({ error: parsed.error || "Invalid payload" }, { status: 400 });
    }
    const payload = parsed.data;

    const supabase = getSupabase();
    const { data: resultData, error } = await supabase
      .from("day_settings")
      .update(payload)
      .eq("day", payload.day)
      .select("day, fechado, dia_inicio, dia_fim, almoco_inicio, almoco_fim")
      .maybeSingle();

    if (error) {
      console.log("[day-settings API] Supabase error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!resultData) {
      return NextResponse.json({ error: "Config not found" }, { status: 404 });
    }

    return NextResponse.json({ config: mapRow(resultData) });
  } catch (e: any) {
    console.log("[day-settings API] Crash:", e);
    return NextResponse.json({ error: e?.message ?? "Crash" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { day, error } = parseDayParam(req);
    if (error) return NextResponse.json({ error }, { status: 400 });

    const supabase = getSupabase();
    const { error: dbError } = await supabase
      .from("day_settings")
      .delete()
      .eq("day", day);

    if (dbError) {
      console.log("[day-settings API] Supabase error:", dbError);
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.log("[day-settings API] Crash:", e);
    return NextResponse.json({ error: e?.message ?? "Crash" }, { status: 500 });
  }
}
