import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  const SUPABASE_URL = process.env.SUPABASE_URL!;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

function getWeekday(day: string) {
  const [y, m, d] = day.split("-").map(Number);
  if (!y || !m || !d) return -1;
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const day = searchParams.get("date"); // continua vindo ?date=YYYY-MM-DD

    if (!day) {
      return NextResponse.json({ error: "Missing date" }, { status: 400 });
    }

    const supabase = getSupabase();

    const { data, error } = await supabase
      .from("bookings")
      .select("id, day, start_min, end_min, client_name, client_phone, status, service_id, paid, rescheduled_from, services(name)")
      .eq("day", day)
      .not("status", "in", "(canceled,rescheduled)")
      .order("start_min", { ascending: true });

    if (error) {
      console.log("[bookings API] Supabase error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const bookings = (data ?? []).map((row: any) => ({
      ...row,
      service_name: row?.services?.name ?? null,
      paid: Boolean(row?.paid),
      rescheduled_from: row?.rescheduled_from ?? null
    }));

    return NextResponse.json({ bookings });
  } catch (e: any) {
    console.log("[bookings API] Crash:", e);
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

    const action = String(body?.action || "").trim();
    const id = Number(body?.id);

    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const supabase = getSupabase();

    if (action === "toggle_paid") {
      const paid = Boolean(body?.paid);
      const { data, error } = await supabase
        .from("bookings")
        .update({ paid })
        .eq("id", id)
        .select("id, day, start_min, end_min, client_name, client_phone, status, service_id, paid, rescheduled_from")
        .maybeSingle();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      if (!data) {
        return NextResponse.json({ error: "Booking not found" }, { status: 404 });
      }
      return NextResponse.json({ booking: data });
    }

    if (action === "reschedule") {
      const rawDay = typeof body?.day === "string" ? body.day.trim() : "";
      const day = rawDay.includes("T") ? rawDay.split("T")[0] : rawDay;
      const start = Number(body?.start_min ?? body?.start);
      const end = Number(body?.end_min ?? body?.end);

      if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) {
        return NextResponse.json({ error: "Invalid day" }, { status: 400 });
      }
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
        return NextResponse.json({ error: "Invalid time range" }, { status: 400 });
      }

      const { data: original, error: originalError } = await supabase
        .from("bookings")
        .select("id, day, start_min, end_min, client_name, client_phone, status, service_id, paid")
        .eq("id", id)
        .maybeSingle();

      if (originalError) {
        return NextResponse.json({ error: originalError.message }, { status: 500 });
      }
      if (!original) {
        return NextResponse.json({ error: "Booking not found" }, { status: 404 });
      }

      const { data: dayCfg, error: cfgError } = await supabase
        .from("day_settings")
        .select("day, fechado")
        .eq("day", day)
        .maybeSingle();

      if (cfgError) {
        return NextResponse.json({ error: cfgError.message }, { status: 500 });
      }
      if (dayCfg?.fechado) {
        return NextResponse.json({ error: "Day closed" }, { status: 409 });
      }

      if (!dayCfg) {
        const weekday = getWeekday(day);
        if (weekday >= 0) {
          const { data: weeklyClosed, error: weeklyError } = await supabase
            .from("weekly_closed")
            .select("weekday")
            .eq("weekday", weekday)
            .limit(1);

          if (weeklyError) {
            return NextResponse.json({ error: weeklyError.message }, { status: 500 });
          }

          if (weeklyClosed && weeklyClosed.length > 0) {
            return NextResponse.json({ error: "Day closed" }, { status: 409 });
          }
        }
      }

      const { data: conflicts, error: conflictError } = await supabase
        .from("bookings")
        .select("id, start_min, end_min, status")
        .eq("day", day)
        .not("status", "in", "(canceled,rescheduled)")
        .neq("id", id)
        .lt("start_min", end)
        .gt("end_min", start)
        .limit(1);

      if (conflictError) {
        return NextResponse.json({ error: conflictError.message }, { status: 500 });
      }
      if (conflicts && conflicts.length > 0) {
        return NextResponse.json({ error: "Slot not available" }, { status: 409 });
      }

      const newPayload: any = {
        day,
        start_min: start,
        end_min: end,
        client_name: original.client_name,
        client_phone: original.client_phone,
        service_id: original.service_id ?? null,
        status: "pending",
        paid: Boolean(original.paid),
        rescheduled_from: original.id
      };

      const { data: created, error: insertError } = await supabase
        .from("bookings")
        .insert(newPayload)
        .select("*")
        .single();

      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }

      const { error: updateError } = await supabase
        .from("bookings")
        .update({ status: "rescheduled" })
        .eq("id", original.id);

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      return NextResponse.json({ booking: created }, { status: 201 });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (e: any) {
    console.log("[bookings API] Crash:", e);
    return NextResponse.json({ error: e?.message ?? "Crash" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const day = searchParams.get("date");
    const all = searchParams.get("all") === "1";

    if (!all && !day && !id) {
      return NextResponse.json({ error: "Missing id or date" }, { status: 400 });
    }
    if (day && !/^\d{4}-\d{2}-\d{2}$/.test(day)) {
      return NextResponse.json({ error: "Invalid date" }, { status: 400 });
    }

    const supabase = getSupabase();
    let query = supabase.from("bookings").delete();
    if (id) {
      query = query.eq("id", id);
    } else {
      query = all ? query.neq("id", 0) : query.eq("day", day);
    }

    const { error } = await query;
    if (error) {
      console.log("[bookings API] Supabase error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.log("[bookings API] Crash:", e);
    return NextResponse.json({ error: e?.message ?? "Crash" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    let body: any = null;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const rawDay = typeof body?.day === "string" ? body.day.trim() : "";
    const day = rawDay.includes("T") ? rawDay.split("T")[0] : rawDay;
    const start = Number(body?.start_min ?? body?.start);
    const end = Number(body?.end_min ?? body?.end);
    const nome = String(
      body?.client_name ?? body?.nome ?? body?.name ?? ""
    ).trim();
    const telefone = String(
      body?.client_phone ?? body?.telefone ?? body?.phone ?? ""
    ).trim();
    const servico = String(
      body?.service_name ?? body?.servico ?? body?.service ?? ""
    ).trim();
    const serviceId = body?.service_id ?? null;

    if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) {
      return NextResponse.json({ error: "Invalid day" }, { status: 400 });
    }
    const nomeSafe = nome || "Cliente";
    const telefoneSafe = telefone || "0000000000000";
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      return NextResponse.json({ error: "Invalid time range" }, { status: 400 });
    }

    const supabase = getSupabase();
    // regra de dia fechado (config diaria ou descanso semanal)
    const { data: dayCfg, error: cfgError } = await supabase
      .from("day_settings")
      .select("day, fechado")
      .eq("day", day)
      .maybeSingle();

    if (cfgError) {
      return NextResponse.json({ error: cfgError.message }, { status: 500 });
    }

    if (dayCfg?.fechado) {
      return NextResponse.json({ error: "Day closed" }, { status: 409 });
    }

    if (!dayCfg) {
      const weekday = getWeekday(day);
      if (weekday >= 0) {
        const { data: weeklyClosed, error: weeklyError } = await supabase
          .from("weekly_closed")
          .select("weekday")
          .eq("weekday", weekday)
          .limit(1);

        if (weeklyError) {
          return NextResponse.json({ error: weeklyError.message }, { status: 500 });
        }

        if (weeklyClosed && weeklyClosed.length > 0) {
          return NextResponse.json({ error: "Day closed" }, { status: 409 });
        }
      }
    }

    const { data: conflicts, error: conflictError } = await supabase
      .from("bookings")
      .select("id, start_min, end_min, status")
      .eq("day", day)
      .not("status", "in", "(canceled,rescheduled)")
      .lt("start_min", end)
      .gt("end_min", start)
      .limit(1);

    if (conflictError) {
      return NextResponse.json({ error: conflictError.message }, { status: 500 });
    }

    if (conflicts && conflicts.length > 0) {
      return NextResponse.json({ error: "Slot not available" }, { status: 409 });
    }

    const basePayload: any = { day, start_min: start, end_min: end };
    if (serviceId != null) basePayload.service_id = serviceId;

    if (!telefone) {
      return NextResponse.json({ error: "Missing client_phone" }, { status: 400 });
    }

    const payloads: any[] = [
      {
        ...basePayload,
        client_name: nomeSafe,
        client_phone: telefoneSafe
      },
      {
        ...basePayload,
        client_name: nomeSafe
      }
    ];

    let lastError: any = null;

    for (const payload of payloads) {
      const result = await supabase
        .from("bookings")
        .insert(payload)
        .select("*")
        .single();

      if (!result.error) {
        return NextResponse.json({ booking: result.data }, { status: 201 });
      }

      lastError = result.error;
      if (!/column/i.test(result.error.message || "")) {
        break;
      }
    }

    return NextResponse.json(
      { error: lastError?.message || "Insert failed" },
      { status: 500 }
    );
  } catch (e: any) {
    console.log("[bookings API] Crash:", e);
    return NextResponse.json({ error: e?.message ?? "Crash" }, { status: 500 });
  }
}

