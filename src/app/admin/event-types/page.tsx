"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { CalendarClock, Loader2, Plus, Save, Trash2, X } from "lucide-react";
import { slugify } from "@/lib/utils";
import type { EventType, AvailabilityRule, DayOfWeek } from "@/types";

const DAYS: { value: DayOfWeek; label: string }[] = [
  { value: 0, label: "Mon" }, { value: 1, label: "Tue" }, { value: 2, label: "Wed" },
  { value: 3, label: "Thu" }, { value: 4, label: "Fri" }, { value: 5, label: "Sat" }, { value: 6, label: "Sun" },
];

interface EventTypeWithRules extends EventType { availability_rules?: AvailabilityRule[]; }

export default function EventTypesPage() {
  const [eventTypes, setEventTypes] = useState<EventTypeWithRules[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<EventTypeWithRules | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rules, setRules] = useState<Partial<AvailabilityRule>[]>([]);
  const supabase = createClient();

  const loadEventTypes = useCallback(async () => {
    const { data } = await supabase.from("event_types").select("*, availability_rules(*)").order("created_at", { ascending: false });
    if (data) setEventTypes(data);
    setLoading(false);
  }, []);

  useEffect(() => { loadEventTypes(); }, [loadEventTypes]);

  function startCreate() {
    setEditing({ name: "", slug: "", description: "", duration_minutes: 30, color: "#5e3a8c", is_active: false, location_type: "google_meet", buffer_before_minutes: 0, buffer_after_minutes: 15 } as EventTypeWithRules);
    setIsNew(true);
    setRules([0, 1, 2, 3, 4].map((day) => ({ day_of_week: day, start_time: "09:00", end_time: "17:00" })));
  }

  function startEdit(et: EventTypeWithRules) { setEditing(et); setIsNew(false); setRules(et.availability_rules || []); }
  function cancelEdit() { setEditing(null); setIsNew(false); setRules([]); }

  async function handleSave() {
    if (!editing) return;
    setSaving(true);
    const payload = { name: editing.name, slug: editing.slug || slugify(editing.name), description: editing.description, duration_minutes: editing.duration_minutes, color: editing.color, is_active: editing.is_active, location_type: editing.location_type, buffer_before_minutes: editing.buffer_before_minutes, buffer_after_minutes: editing.buffer_after_minutes };
    let eventTypeId: string;
    if (isNew) {
      const { data, error } = await supabase.from("event_types").insert(payload).select().single();
      if (error) { alert(error.message); setSaving(false); return; }
      eventTypeId = data.id;
    } else {
      const { error } = await supabase.from("event_types").update(payload).eq("id", editing.id);
      if (error) { alert(error.message); setSaving(false); return; }
      eventTypeId = editing.id;
    }
    await supabase.from("availability_rules").delete().eq("event_type_id", eventTypeId);
    if (rules.length > 0) {
      await supabase.from("availability_rules").insert(rules.map((r) => ({ event_type_id: eventTypeId, day_of_week: r.day_of_week!, start_time: r.start_time!, end_time: r.end_time! })));
    }
    setSaving(false); cancelEdit(); loadEventTypes();
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure? This will permanently delete this event type.")) return;
    await supabase.from("event_types").delete().eq("id", id);
    loadEventTypes();
  }

  async function toggleActive(et: EventType) {
    if (!et.is_active) await supabase.from("event_types").update({ is_active: false }).neq("id", et.id);
    await supabase.from("event_types").update({ is_active: !et.is_active }).eq("id", et.id);
    loadEventTypes();
  }

  function addRule() { setRules([...rules, { day_of_week: 0, start_time: "09:00", end_time: "17:00" }]); }
  function removeRule(i: number) { setRules(rules.filter((_, idx) => idx !== i)); }
  function updateRule(i: number, field: string, value: string | number) { const u = [...rules]; u[i] = { ...u[i], [field]: value }; setRules(u); }

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-8 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Event Types</h1>
          <p className="text-muted-foreground">Manage the meeting types visitors can book</p>
        </div>
        {!editing && <Button onClick={startCreate}><Plus className="h-4 w-4" />New event type</Button>}
      </div>

      {editing && (
        <Card className="border-primary/30">
          <CardHeader><CardTitle className="text-lg">{isNew ? "New event type" : `Edit: ${editing.name}`}</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2"><Label>Name</Label><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value, slug: isNew ? slugify(e.target.value) : editing.slug })} placeholder="30 min consultation" /></div>
              <div className="space-y-2"><Label>Slug (URL)</Label><Input value={editing.slug} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} placeholder="30-min-consultation" /></div>
            </div>
            <div className="space-y-2"><Label>Description</Label><Textarea value={editing.description || ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} placeholder="Describe what this meeting is about..." rows={2} /></div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2"><Label>Duration (min)</Label><Input type="number" min={5} step={5} value={editing.duration_minutes} onChange={(e) => setEditing({ ...editing, duration_minutes: parseInt(e.target.value) })} /></div>
              <div className="space-y-2"><Label>Buffer before (min)</Label><Input type="number" min={0} step={5} value={editing.buffer_before_minutes} onChange={(e) => setEditing({ ...editing, buffer_before_minutes: parseInt(e.target.value) })} /></div>
              <div className="space-y-2"><Label>Buffer after (min)</Label><Input type="number" min={0} step={5} value={editing.buffer_after_minutes} onChange={(e) => setEditing({ ...editing, buffer_after_minutes: parseInt(e.target.value) })} /></div>
            </div>
            <div className="space-y-2"><Label>Color</Label><div className="flex items-center gap-3"><input type="color" value={editing.color} onChange={(e) => setEditing({ ...editing, color: e.target.value })} className="h-10 w-14 rounded-md border cursor-pointer" /><Input value={editing.color} onChange={(e) => setEditing({ ...editing, color: e.target.value })} className="w-32" /></div></div>
            <div className="space-y-3">
              <div className="flex items-center justify-between"><Label className="text-base">Availability</Label><Button variant="outline" size="sm" onClick={addRule}><Plus className="h-3 w-3" />Add time</Button></div>
              {rules.length === 0 && <p className="text-sm text-muted-foreground">No times configured. Add availability to make this event type bookable.</p>}
              {rules.map((rule, i) => (
                <div key={i} className="flex items-center gap-3">
                  <select className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm" value={rule.day_of_week} onChange={(e) => updateRule(i, "day_of_week", parseInt(e.target.value))}>
                    {DAYS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                  </select>
                  <Input type="time" value={rule.start_time || "09:00"} onChange={(e) => updateRule(i, "start_time", e.target.value)} className="w-32" />
                  <span className="text-muted-foreground">–</span>
                  <Input type="time" value={rule.end_time || "17:00"} onChange={(e) => updateRule(i, "end_time", e.target.value)} className="w-32" />
                  <Button variant="ghost" size="icon" onClick={() => removeRule(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              ))}
            </div>
            <div className="flex gap-3 pt-2">
              <Button onClick={handleSave} disabled={saving || !editing.name}>{saving ? <Loader2 className="animate-spin" /> : <Save />}{isNew ? "Create" : "Save"}</Button>
              <Button variant="outline" onClick={cancelEdit}><X />Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {eventTypes.length === 0 && !editing && (
          <Card><CardContent className="py-12 text-center"><CalendarClock className="mx-auto h-10 w-10 text-muted-foreground mb-3" /><p className="text-muted-foreground">No event types created yet. Create your first one!</p></CardContent></Card>
        )}
        {eventTypes.map((et) => (
          <Card key={et.id} className={et.is_active ? "border-primary/40" : ""}>
            <CardContent className="flex items-center justify-between py-4 px-6">
              <div className="flex items-center gap-4">
                <div className="h-10 w-1.5 rounded-full" style={{ backgroundColor: et.color }} />
                <div>
                  <div className="flex items-center gap-2"><span className="font-medium">{et.name}</span>{et.is_active && <Badge variant="success">Active</Badge>}</div>
                  <p className="text-sm text-muted-foreground">{et.duration_minutes} min &middot; /{et.slug}{et.availability_rules?.length ? ` · ${et.availability_rules.length} time rules` : ""}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2"><span className="text-xs text-muted-foreground">Active</span><Switch checked={et.is_active} onCheckedChange={() => toggleActive(et)} /></div>
                <Button variant="outline" size="sm" onClick={() => startEdit(et)}>Edit</Button>
                <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(et.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
