import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const day = searchParams.get("date"); // continua vindo ?date=YYYY-MM-DD

    if (!day) {
      return NextResponse.json({ error: "Missing date" }, { status: 400 });
    }

    const SUPABASE_URL = process.env.SUPABASE_URL!;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data, error } = await supabase
      .from("bookings")
      .select("*")
      .eq("day", day)
      .order("start_min", { ascending: true });

    if (error) {
      console.log("[bookings API] Supabase error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ bookings: data ?? [] });
  } catch (e: any) {
    console.log("[bookings API] Crash:", e);
    return NextResponse.json({ error: e?.message ?? "Crash" }, { status: 500 });
  }
}
