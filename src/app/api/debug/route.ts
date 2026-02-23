import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createServiceRoleClient();

    const { data, error } = await supabase
      .from("admin_settings")
      .select("id, display_name")
      .single();

    return NextResponse.json({
      success: !error,
      data,
      error: error?.message,
      hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      keyPrefix: process.env.SUPABASE_SERVICE_ROLE_KEY?.substring(0, 10),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message });
  }
}
