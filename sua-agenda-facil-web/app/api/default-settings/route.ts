import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const DEFAULT_CONFIG = {
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

function normalizeRow(row: any) {
  return {
    diaInicio: Number(row?.dia_inicio ?? DEFAULT_CONFIG.diaInicio),
    diaFim: Number(row?.dia_fim ?? DEFAULT_CONFIG.diaFim),
    almocoInicio: Number(row?.almoco_inicio ?? DEFAULT_CONFIG.almocoInicio),
    almocoFim: Number(row?.almoco_fim ?? DEFAULT_CONFIG.almocoFim)
  };
}

export async function GET() {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("default_settings")
      .select("dia_inicio, dia_fim, almoco_inicio, almoco_fim")
      .limit(1)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ config: { ...DEFAULT_CONFIG } });
    }

    return NextResponse.json({ config: normalizeRow(data) });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Crash" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    let body: any = null;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const diaInicio = Number(body?.diaInicio);
    const diaFim = Number(body?.diaFim);
    const almocoInicio = Number(body?.almocoInicio);
    const almocoFim = Number(body?.almocoFim);

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

    const supabase = getSupabase();
    const payload = {
      dia_inicio: diaInicio,
      dia_fim: diaFim,
      almoco_inicio: almocoInicio,
      almoco_fim: almocoFim
    };

    const { data: existing, error: existingError } = await supabase
      .from("default_settings")
      .select("id")
      .limit(1)
      .maybeSingle();

    if (existingError) {
      return NextResponse.json({ error: existingError.message }, { status: 500 });
    }

    let data;
    let error;
    if (existing?.id) {
      const result = await supabase
        .from("default_settings")
        .update(payload)
        .eq("id", existing.id)
        .select("dia_inicio, dia_fim, almoco_inicio, almoco_fim")
        .maybeSingle();
      data = result.data;
      error = result.error;
    } else {
      const result = await supabase
        .from("default_settings")
        .insert(payload)
        .select("dia_inicio, dia_fim, almoco_inicio, almoco_fim")
        .maybeSingle();
      data = result.data;
      error = result.error;
    }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ config: normalizeRow(data) });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Crash" }, { status: 500 });
  }
}
