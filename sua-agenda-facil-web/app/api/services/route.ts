import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function isAdmin(req: Request) {
  const token = req.headers.get("x-admin-token") || "";
  const expected = process.env.ADMIN_TOKEN || "";
  return Boolean(token) && token === expected;
}

function getSupabase() {
  const SUPABASE_URL = process.env.SUPABASE_URL!;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

function parseId(value: any) {
  if (!value) return null;
  return String(value).trim();
}

export async function GET(req: Request) {
  const supabase = getSupabase();
  const { searchParams } = new URL(req.url);
  const all = searchParams.get("all") === "1";

  let query = supabase
    .from("services")
    .select("id, name, duration_minutes, price_cents, active")
    .order("name", { ascending: true });

  if (!all) {
    query = query.eq("active", true);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ services: data ?? [] });
}

export async function POST(req: Request) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await req.json();
    const name = String(body?.name || "").trim();
    const durationMinutes = Number(body?.duration_minutes);
    const priceCents = Number(body?.price_cents ?? 0);
    const active = body?.active !== false;

    if (!name) {
      return NextResponse.json({ error: "Missing name" }, { status: 400 });
    }
    if (!Number.isFinite(durationMinutes) || durationMinutes < 10) {
      return NextResponse.json({ error: "Invalid duration" }, { status: 400 });
    }
    if (!Number.isFinite(priceCents) || priceCents < 0) {
      return NextResponse.json({ error: "Invalid price" }, { status: 400 });
    }

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("services")
      .insert({
        name,
        duration_minutes: durationMinutes,
        price_cents: Math.round(priceCents),
        active
      })
      .select("id, name, duration_minutes, price_cents, active")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ service: data }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Crash" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await req.json();
    const id = parseId(body?.id);
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const patch: any = {};
    if (typeof body?.name === "string") patch.name = body.name.trim();
    if (body?.duration_minutes != null) {
      patch.duration_minutes = Number(body.duration_minutes);
    }
    if (body?.price_cents != null) {
      patch.price_cents = Math.round(Number(body.price_cents));
    }
    if (body?.active != null) patch.active = Boolean(body.active);

    if (
      patch.duration_minutes != null &&
      (!Number.isFinite(patch.duration_minutes) || patch.duration_minutes < 10)
    ) {
      return NextResponse.json({ error: "Invalid duration" }, { status: 400 });
    }
    if (
      patch.price_cents != null &&
      (!Number.isFinite(patch.price_cents) || patch.price_cents < 0)
    ) {
      return NextResponse.json({ error: "Invalid price" }, { status: 400 });
    }

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("services")
      .update(patch)
      .eq("id", id)
      .select("id, name, duration_minutes, price_cents, active")
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: "Service not found" }, { status: 404 });
    }

    return NextResponse.json({ service: data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Crash" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { searchParams } = new URL(req.url);
    let id = parseId(searchParams.get("id"));
    if (!id) {
      const body = await req.json().catch(() => ({}));
      id = parseId(body?.id);
    }

    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const supabase = getSupabase();
    const { error } = await supabase.from("services").delete().eq("id", id);
    if (error) {
      const msg = error.message || "";
      if (/foreign key/i.test(msg)) {
        const { data: updated, error: updateError } = await supabase
          .from("services")
          .update({ active: false })
          .eq("id", id)
          .select("id")
          .maybeSingle();

        if (updateError) {
          return NextResponse.json({ error: updateError.message }, { status: 500 });
        }
        if (!updated) {
          return NextResponse.json({ error: "Service not found" }, { status: 404 });
        }

        return NextResponse.json({ ok: true, deactivated: true });
      }

      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Crash" }, { status: 500 });
  }
}
