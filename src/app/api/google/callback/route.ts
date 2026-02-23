import { NextRequest, NextResponse } from "next/server";
import { exchangeCode } from "@/lib/google/auth";
import { encrypt } from "@/lib/google/tokens";
import { createServiceRoleClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const error = request.nextUrl.searchParams.get("error");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  if (error) {
    console.error("Google OAuth error:", error);
    return NextResponse.redirect(
      `${appUrl}/admin/settings?error=google_denied`
    );
  }

  if (!code) {
    return NextResponse.redirect(
      `${appUrl}/admin/settings?error=no_code`
    );
  }

  try {
    const tokens = await exchangeCode(code);

    if (!tokens.access_token || !tokens.refresh_token) {
      console.error("Missing tokens from Google:", {
        hasAccess: !!tokens.access_token,
        hasRefresh: !!tokens.refresh_token,
      });
      return NextResponse.redirect(
        `${appUrl}/admin/settings?error=missing_tokens`
      );
    }

    const supabase = await createServiceRoleClient();

    // Encrypt tokens before saving
    const encryptedAccess = encrypt(tokens.access_token);
    const encryptedRefresh = encrypt(tokens.refresh_token);

    // First get the admin settings row ID
    const { data: settings } = await supabase
      .from("admin_settings")
      .select("id")
      .single();

    if (!settings) {
      console.error("No admin_settings row found");
      return NextResponse.redirect(
        `${appUrl}/admin/settings?error=no_settings`
      );
    }

    const { error: dbError, data: updated } = await supabase
      .from("admin_settings")
      .update({
        google_access_token: encryptedAccess,
        google_refresh_token: encryptedRefresh,
        google_token_expires_at: tokens.expiry_date
          ? new Date(tokens.expiry_date).toISOString()
          : null,
        google_calendar_id: "primary",
      })
      .eq("id", settings.id)
      .select();

    console.log("Token save result:", { dbError, updatedRows: updated?.length });

    if (dbError) {
      console.error("Failed to save Google tokens:", dbError);
      return NextResponse.redirect(
        `${appUrl}/admin/settings?error=save_failed`
      );
    }

    return NextResponse.redirect(
      `${appUrl}/admin/settings?success=google_connected`
    );
  } catch (err) {
    console.error("Google OAuth exchange error:", err);
    return NextResponse.redirect(
      `${appUrl}/admin/settings?error=exchange_failed`
    );
  }
}
