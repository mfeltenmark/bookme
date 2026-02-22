import { createServiceRoleClient } from "@/lib/supabase/server";
import { refreshAccessToken, getOAuth2Client } from "./auth";
import { google } from "googleapis";
import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

function getKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) throw new Error("ENCRYPTION_KEY not set");
  // Hash the key to ensure it's exactly 32 bytes
  return crypto.createHash("sha256").update(key).digest();
}

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  const tag = cipher.getAuthTag();
  // Format: iv:tag:encrypted
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted}`;
}

export function decrypt(data: string): string {
  const parts = data.split(":");
  if (parts.length !== 3) throw new Error("Invalid encrypted data format");
  const [ivHex, tagHex, encrypted] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(tag);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

/**
 * Get a valid Google Calendar client, auto-refreshing tokens if needed.
 * Returns null if not connected.
 */
export async function getGoogleCalendarClient() {
  const supabase = await createServiceRoleClient();

  const { data: settings } = await supabase
    .from("admin_settings")
    .select(
      "id, google_access_token, google_refresh_token, google_token_expires_at, google_calendar_id"
    )
    .single();

  if (!settings?.google_refresh_token) return null;

  let accessToken: string;
  let refreshToken: string;

  try {
    refreshToken = decrypt(settings.google_refresh_token);
  } catch {
    console.error("Failed to decrypt refresh token");
    return null;
  }

  // Check if access token is expired or missing
  const isExpired =
    !settings.google_access_token ||
    !settings.google_token_expires_at ||
    new Date(settings.google_token_expires_at) <= new Date();

  if (isExpired) {
    try {
      const credentials = await refreshAccessToken(refreshToken);
      accessToken = credentials.access_token!;

      // Save new tokens
      const updateData: Record<string, string> = {
        google_access_token: encrypt(accessToken),
      };
      if (credentials.expiry_date) {
        updateData.google_token_expires_at = new Date(
          credentials.expiry_date
        ).toISOString();
      }
      if (credentials.refresh_token) {
        updateData.google_refresh_token = encrypt(credentials.refresh_token);
      }

      await supabase
        .from("admin_settings")
        .update(updateData)
        .eq("id", settings.id);
    } catch (err) {
      console.error("Failed to refresh Google token:", err);
      return null;
    }
  } else {
    try {
      accessToken = decrypt(settings.google_access_token!);
    } catch {
      console.error("Failed to decrypt access token");
      return null;
    }
  }

  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  return {
    calendar: google.calendar({ version: "v3", auth: oauth2Client }),
    calendarId: settings.google_calendar_id || "primary",
  };
}
