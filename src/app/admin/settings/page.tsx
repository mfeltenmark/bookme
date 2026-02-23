"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, ExternalLink, Loader2, RefreshCw, Save, Unlink } from "lucide-react";
import type { AdminSettings } from "@/types";

interface CalendarOption { id: string; summary: string; primary: boolean; }

function SettingsContent() {
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [calendars, setCalendars] = useState<CalendarOption[]>([]);
  const [loadingCalendars, setLoadingCalendars] = useState(false);
  const searchParams = useSearchParams();
  const supabase = createClient();

  const successMsg = searchParams.get("success");
  const errorMsg = searchParams.get("error");

  useEffect(() => { loadSettings(); }, []);

  async function loadSettings() {
    const { data } = await supabase.from("admin_settings").select("*").single();
    if (data) { setSettings(data); if (data.google_refresh_token) loadCalendars(); }
    setLoading(false);
  }

  async function loadCalendars() {
    setLoadingCalendars(true);
    try { const res = await fetch("/api/google/calendars"); const data = await res.json(); if (data.calendars) setCalendars(data.calendars); } catch {}
    setLoadingCalendars(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    const { error } = await supabase.from("admin_settings").update({
      display_name: settings.display_name, welcome_message: settings.welcome_message, timezone: settings.timezone,
      min_notice_hours: settings.min_notice_hours, max_days_ahead: settings.max_days_ahead, profile_image_url: settings.profile_image_url, google_calendar_id: settings.google_calendar_id,
    }).eq("id", settings.id);
    setSaving(false);
    if (!error) { setSaved(true); setTimeout(() => setSaved(false), 2000); }
  }

  function handleChange(field: keyof AdminSettings, value: string | number) { if (!settings) return; setSettings({ ...settings, [field]: value }); }

  async function disconnectGoogle() {
    if (!settings) return;
    if (!confirm("Disconnect Google Calendar?")) return;
    await supabase.from("admin_settings").update({ google_access_token: null, google_refresh_token: null, google_token_expires_at: null, google_calendar_id: null }).eq("id", settings.id);
    setCalendars([]); loadSettings();
  }

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (!settings) return null;

  const isGoogleConnected = !!settings.google_refresh_token;

  return (
    <div className="space-y-8 max-w-2xl">
      <div><h1 className="text-2xl font-bold tracking-tight">Settings</h1><p className="text-muted-foreground">Manage your profile and connections</p></div>

      <Card>
        <CardHeader><CardTitle className="text-lg">Profile</CardTitle><CardDescription>How you appear on your booking page</CardDescription></CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2"><Label htmlFor="display_name">Name</Label><Input id="display_name" value={settings.display_name} onChange={(e) => handleChange("display_name", e.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="profile_image_url">Profile image (URL)</Label><Input id="profile_image_url" type="url" placeholder="https://..." value={settings.profile_image_url || ""} onChange={(e) => handleChange("profile_image_url", e.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="welcome_message">Welcome message</Label><Textarea id="welcome_message" value={settings.welcome_message || ""} onChange={(e) => handleChange("welcome_message", e.target.value)} rows={3} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label htmlFor="timezone">Timezone</Label>
                <select id="timezone" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={settings.timezone} onChange={(e) => handleChange("timezone", e.target.value)}>
                  <option value="Europe/Stockholm">Europe/Stockholm (CET)</option><option value="Europe/London">Europe/London (GMT)</option><option value="America/New_York">America/New_York (EST)</option><option value="America/Los_Angeles">America/Los_Angeles (PST)</option><option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
                </select></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label htmlFor="min_notice">Min notice (hours)</Label><Input id="min_notice" type="number" min={0} value={settings.min_notice_hours} onChange={(e) => handleChange("min_notice_hours", parseInt(e.target.value))} /></div>
              <div className="space-y-2"><Label htmlFor="max_days">Max days ahead</Label><Input id="max_days" type="number" min={1} value={settings.max_days_ahead} onChange={(e) => handleChange("max_days_ahead", parseInt(e.target.value))} /></div>
            </div>
            <Button type="submit" disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : saved ? <Check /> : <Save />}{saved ? "Saved!" : "Save"}</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Google Calendar</CardTitle><CardDescription>Sync your availability and create meetings with Google Meet</CardDescription></CardHeader>
        <CardContent>
          {successMsg === "google_connected" && <div className="mb-4 rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-800">Google Calendar connected!</div>}
          {errorMsg && <div className="mb-4 rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-800">Connection error: {errorMsg}</div>}
          {isGoogleConnected ? (
            <div className="space-y-4">
              <Badge variant="success">Connected</Badge>
              <div className="space-y-2"><Label>Select calendar</Label>
                {loadingCalendars ? <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" />Loading calendars...</div>
                : calendars.length > 0 ? <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={settings.google_calendar_id || "primary"} onChange={(e) => handleChange("google_calendar_id", e.target.value)}>
                    {calendars.map((cal) => <option key={cal.id} value={cal.id}>{cal.summary} {cal.primary ? "(Primary)" : ""}</option>)}
                  </select>
                : <div className="flex items-center gap-2"><span className="text-sm text-muted-foreground">{settings.google_calendar_id || "primary"}</span><Button variant="ghost" size="sm" onClick={loadCalendars}><RefreshCw className="h-3 w-3" /></Button></div>}
              </div>
              <Button variant="outline" onClick={disconnectGoogle}><Unlink className="h-4 w-4" />Disconnect</Button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Connect your Google Calendar to automatically check availability and create Google Meet links for bookings.</p>
              <a href="/api/google/auth" className="inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground px-4 h-10 text-sm font-medium hover:bg-primary/90"><ExternalLink className="h-4 w-4" />Connect Google Calendar</a>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function SettingsPage() {
  return <Suspense fallback={<div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}><SettingsContent /></Suspense>;
}
