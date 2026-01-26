import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  const SUPABASE_URL = process.env.SUPABASE_URL!;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

function normalizePhone(raw: string) {
  const digits = (raw || "").replace(/\D/g, "");
  if (!digits) return [];

  const candidates = new Set<string>();
  candidates.add(digits);
  if (digits.startsWith("55") && digits.length > 2) {
    candidates.add(digits.slice(2));
  } else if (digits.length === 10 || digits.length === 11) {
    candidates.add(`55${digits}`);
  }
  return Array.from(candidates);
}

function getWeekday(day: string) {
  const [y, m, d] = day.split("-").map(Number);
  if (!y || !m || !d) return -1;
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function formatDayLocal(dateObj: Date) {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, "0");
  const d = String(dateObj.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function dateFromDayMin(day: string, minutes: number) {
  const [y, m, d] = day.split("-").map(Number);
  const hh = Math.floor(minutes / 60);
  const mm = minutes % 60;
  return new Date(y, m - 1, d, hh, mm, 0, 0);
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const phoneParam = searchParams.get("phone") || "";
    const phones = normalizePhone(phoneParam);
    if (!phones.length) {
      return NextResponse.json({ error: "Missing phone" }, { status: 400 });
    }

    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);

    const supabase = getSupabase();
    const { data: weeklyClosed, error: weeklyError } = await supabase
      .from("weekly_closed")
      .select("weekday");
    if (weeklyError) {
      return NextResponse.json({ error: weeklyError.message }, { status: 500 });
    }
    const weeklySet = new Set<number>(
      (weeklyClosed ?? [])
        .map((row: any) => Number(row?.weekday))
        .filter((d: number) => Number.isFinite(d) && d >= 0 && d <= 6)
    );

    const { data: defaultSettings, error: defaultError } = await supabase
      .from("default_settings")
      .select("dia_fim")
      .limit(1)
      .maybeSingle();
    if (defaultError) {
      return NextResponse.json({ error: defaultError.message }, { status: 500 });
    }
    const defaultEndMin = Number(defaultSettings?.dia_fim ?? 17 * 60);

    let query = supabase
      .from("bookings")
      .select("id, day, start_min, end_min, client_name, client_phone, status, service_id, paid, rescheduled_from, services(name)")
      .gte("day", todayStr)
      .not("status", "in", "(canceled,rescheduled)")
      .order("day", { ascending: true })
      .order("start_min", { ascending: true });

    if (phones.length === 1) {
      query = query.eq("client_phone", phones[0]);
    } else {
      const orCond = phones.map((p) => `client_phone.eq.${p}`).join(",");
      query = query.or(orCond);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const bookings = [];
    for (const row of (data ?? [])) {
      const origStartMin = Number(row?.start_min);
      let canReschedule = true;

      if (!Number.isFinite(origStartMin)) {
        canReschedule = false;
      } else {
        const origStart = dateFromDayMin(String(row?.day), origStartMin);
        let cutoff = new Date(origStart.getTime() - 24 * 60 * 60 * 1000);
        let cutoffDay = formatDayLocal(cutoff);

        const { data: daySettingCutoff, error: cutoffError } = await supabase
          .from("day_settings")
          .select("day")
          .eq("day", cutoffDay)
          .maybeSingle();
        if (cutoffError) {
          return NextResponse.json({ error: cutoffError.message }, { status: 500 });
        }

        if (daySettingCutoff || weeklySet.has(getWeekday(cutoffDay))) {
          let cursor = new Date(cutoff);
          let found = false;
          for (let i = 0; i < 60; i++) {
            cursor.setDate(cursor.getDate() - 1);
            const dayStr = formatDayLocal(cursor);

            const { data: daySettingPrev, error: prevError } = await supabase
              .from("day_settings")
              .select("day")
              .eq("day", dayStr)
              .maybeSingle();
            if (prevError) {
              return NextResponse.json({ error: prevError.message }, { status: 500 });
            }

            if (!daySettingPrev && !weeklySet.has(getWeekday(dayStr))) {
              cutoff = dateFromDayMin(dayStr, Number.isFinite(defaultEndMin) ? defaultEndMin : 17 * 60);
              found = true;
              break;
            }
          }
          if (!found) {
            canReschedule = false;
          }
        }

        if (Date.now() > cutoff.getTime()) {
          canReschedule = false;
        }
      }

bookings.push({
  ...row,
  service_name: row?.services?.[0]?.name ?? null,
  paid: Boolean(row?.paid),
  rescheduled_from: row?.rescheduled_from ?? null,
  can_reschedule: canReschedule,
});

    }

    return NextResponse.json({ bookings });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Crash" }, { status: 500 });
  }
}
