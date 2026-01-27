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

function normalizeDays(days: any) {
  if (!Array.isArray(days)) return [];
  return days
    .map((d) => Number(d))
    .filter((d) => Number.isFinite(d) && d >= 0 && d <= 6);
}

export async function GET() {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("weekly_closed")
      .select("weekday");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const days = (data ?? [])
      .map((row: any) => Number(row?.weekday))
      .filter((d) => Number.isFinite(d) && d >= 0 && d <= 6)
      .sort((a, b) => a - b);

    return NextResponse.json({ days });
  } catch (e: any) {
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

    const days = normalizeDays(body?.days);
    const supabase = getSupabase();

    const { error: delError } = await supabase
      .from("weekly_closed")
      .delete()
      .neq("weekday", -1);

    if (delError) {
      return NextResponse.json({ error: delError.message }, { status: 500 });
    }

    if (days.length) {
      const payload = days.map((weekday) => ({ weekday }));
      const { error: insError } = await supabase
        .from("weekly_closed")
        .insert(payload);

      if (insError) {
        return NextResponse.json({ error: insError.message }, { status: 500 });
      }
    }

    return NextResponse.json({ days });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Crash" }, { status: 500 });
  }
}
