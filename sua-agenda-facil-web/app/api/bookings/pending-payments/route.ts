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

function formatDayLocal(dateObj: Date) {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, "0");
  const d = String(dateObj.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export async function GET(req: Request) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const supabase = getSupabase();
    const today = formatDayLocal(new Date());

    const { data, error } = await supabase
      .from("bookings")
      .select("id, day, start_min, end_min, client_name, client_phone, status, service_id, paid, pix_sent_at, reminder_7d_sent_at, reminder_24h_sent_at, services(name)")
      .gte("day", today)
      .eq("paid", false)
      .not("status", "in", "(canceled,rescheduled)")
      .order("day", { ascending: true })
      .order("start_min", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const bookings = (data ?? []).map((row: any) => ({
      ...row,
      service_name: row?.services?.name ?? null
    }));

    return NextResponse.json({ bookings });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Crash" }, { status: 500 });
  }
}
