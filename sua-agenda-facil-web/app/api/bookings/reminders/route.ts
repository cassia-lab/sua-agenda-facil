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

function addDays(dateObj: Date, days: number) {
  const d = new Date(dateObj);
  d.setDate(d.getDate() + days);
  return d;
}

function bookingDateTime(day: string, startMin: number) {
  const [y, m, d] = day.split("-").map(Number);
  const hh = Math.floor(startMin / 60);
  const mm = startMin % 60;
  return new Date(y, m - 1, d, hh, mm, 0, 0);
}

export async function GET(req: Request) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { searchParams } = new URL(req.url);
    const type = String(searchParams.get("type") || "").trim();
    if (type !== "7d" && type !== "24h") {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    const supabase = getSupabase();
    const now = new Date();
    const today = formatDayLocal(now);
    const maxDay = formatDayLocal(addDays(now, type === "7d" ? 9 : 2));

    let query = supabase
      .from("bookings")
      .select("id, day, start_min, end_min, client_name, client_phone, status, service_id, paid, reminder_7d_sent_at, reminder_24h_sent_at, services(name)")
      .gte("day", today)
      .lte("day", maxDay)
      .not("status", "in", "(canceled,rescheduled)")
      .order("day", { ascending: true })
      .order("start_min", { ascending: true });

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const minDay = type === "7d" ? formatDayLocal(addDays(now, 3)) : "";
    const maxDayFor7d = type === "7d" ? formatDayLocal(addDays(now, 8)) : "";
    const dayTomorrow = type === "24h" ? formatDayLocal(addDays(now, 1)) : "";

    const bookings = (data ?? []).filter((row: any) => {
      const startMin = Number(row?.start_min);
      if (!row?.day || !Number.isFinite(startMin)) return false;
      if (type === "24h") {
        if (row.day !== dayTomorrow) return false;
      } else {
        if (row.day < minDay || row.day > maxDayFor7d) return false;
      }
      if (type === "7d" && row?.reminder_7d_sent_at) return false;
      if (type === "24h" && row?.reminder_24h_sent_at) return false;
      return true;
    }).map((row: any) => ({
      ...row,
      service_name: row?.services?.name ?? null
    }));

    return NextResponse.json({ bookings });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Crash" }, { status: 500 });
  }
}
