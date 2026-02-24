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
import { CalendarClock, GripVertical, Loader2, Plus, Save, Trash2, X } from "lucide-react";
import { slugify } from "@/lib/utils";
import type { EventType, AvailabilityRule, CustomQuestion, DayOfWeek } from "@/types";

const DAYS: { value: DayOfWeek; label: string }[] = [
  { value: 0, label: "Mon" }, { value: 1, label: "Tue" }, { value: 2, label: "Wed" },
  { value: 3, label: "Thu" }, { value: 4, label: "Fri" }, { value: 5, label: "Sat" }, { value: 6, label: "Sun" },
];

const FIELD_TYPES = [
  { value: "text", label: "Short text" },
  { value: "textarea", label: "Long text" },
  { value: "select", label: "Dropdown" },
  { value: "number", label: "Number" },
];

interface EventTypeWithRules extends EventType { availability_rules?: AvailabilityRule[]; custom_questions?: CustomQuestion[]; }

interface QuestionDraft {
  id?: string;
  label: string;
  field_type: "text" | "textarea" | "select" | "number";
  placeholder: string;
  options: string;
  is_required: boolean;
  sort_order: number;
}

export default function EventTypesPage() {
  const [eventTypes, setEventTypes] = useState<EventTypeWithRules[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<EventTypeWithRules | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rules, setRules] = useState<Partial<AvailabilityRule>[]>([]);
  const [questions, setQuestions] = useState<QuestionDraft[]>([]);
  const supabase = createClient();

  const loadEventTypes = useCallback(async () => {
    const { data } = await supabase.from("event_types").select("*, availability_rules(*), custom_questions(*)").order("created_at", { ascending: false });
    if (data) setEventTypes(data);
    setLoading(false);
  }, []);

  useEffect(() => { loadEventTypes(); }, [loadEventTypes]);

  function startCreate() {
    setEditing({ name: "", slug: "", description: "", duration_minutes: 30, color: "#5e3a8c", is_active: false, location_type: "google_meet", buffer_before_minutes: 0, buffer_after_minutes: 15, confirmation_message: "" } as EventTypeWithRules);
    setIsNew(true);
    setRules([0, 1, 2, 3, 4].map((day) => ({ day_of_week: day, start_time: "09:00", end_time: "17:00" })));
    setQuestions([]);
  }

  function startEdit(et: EventTypeWithRules) {
    setEditing(et);
    setIsNew(false);
    setRules(et.availability_rules || []);
    setQuestions(
      (et.custom_questions || [])
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((q) => ({
          id: q.id,
          label: q.label,
          field_type: q.field_type,
          placeholder: q.placeholder || "",
          options: q.options ? q.options.join(", ") : "",
          is_required: q.is_required,
          sort_order: q.sort_order,
        }))
    );
  }

  function cancelEdit() { setEditing(null); setIsNew(false); setRules([]); setQuestions([]); }

  // Question helpers
  function addQuestion() {
    setQuestions([...questions, { label: "", field_type: "text", placeholder: "", options: "", is_required: false, sort_order: questions.length }]);
  }
  function removeQuestion(i: number) { setQuestions(questions.filter((_, idx) => idx !== i)); }
  function updateQuestion(i: number, field: string, value: string | boolean) {
    const u = [...questions]; u[i] = { ...u[i], [field]: value }; setQuestions(u);
  }

  async function handleSave() {
    if (!editing) return;
    setSaving(true);
    const payload = {
      name: editing.name, slug: editing.slug || slugify(editing.name), description: editing.description,
      duration_minutes: editing.duration_minutes, color: editing.color, is_active: editing.is_active,
      location_type: editing.location_type, buffer_before_minutes: editing.buffer_before_minutes,
      buffer_after_minutes: editing.buffer_after_minutes, confirmation_message: editing.confirmation_message || null,
    };
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

    // Save availability rules
    await supabase.from("availability_rules").delete().eq("event_type_id", eventTypeId);
    if (rules.length > 0) {
      await supabase.from("availability_rules").insert(rules.map((r) => ({ event_type_id: eventTypeId, day_of_week: r.day_of_week!, start_time: r.start_time!, end_time: r.end_time! })));
    }

    // Save custom questions
    await supabase.from("custom_questions").delete().eq("event_type_id", eventTypeId);
    if (questions.length > 0) {
      const questionRows = questions.map((q, i) => ({
        event_type_id: eventTypeId,
        label: q.label,
        field_type: q.field_type,
        placeholder: q.placeholder || null,
        options: q.field_type === "select" && q.options ? q.options.split(",").map((o) => o.trim()).filter(Boolean) : null,
        is_required: q.is_required,
        sort_order: i,
      }));
      await supabase.from("custom_questions").insert(questionRows);
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
            {/* Basic info */}
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

            {/* Availability */}
            <div className="space-y-3">
              <div className="flex items-center justify-between"><Label className="text-base">Availability</Label><Button variant="outline" size="sm" onClick={addRule}><Plus className="h-3 w-3" />Add time</Button></div>
              {rules.length === 0 && <p className="text-sm text-muted-foreground">No times configured.</p>}
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

            {/* Custom questions */}
            <div className="space-y-3">
              <div className="flex items-center justify-between"><Label className="text-base">Custom Questions</Label><Button variant="outline" size="sm" onClick={addQuestion}><Plus className="h-3 w-3" />Add question</Button></div>
              {questions.length === 0 && <p className="text-sm text-muted-foreground">No custom questions. The booking form will show name, email, and message fields.</p>}
              {questions.map((q, i) => (
                <div key={i} className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 grid gap-3 md:grid-cols-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Label</Label>
                        <Input value={q.label} onChange={(e) => updateQuestion(i, "label", e.target.value)} placeholder="e.g. Company name" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Type</Label>
                        <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={q.field_type} onChange={(e) => updateQuestion(i, "field_type", e.target.value)}>
                          {FIELD_TYPES.map((ft) => <option key={ft.value} value={ft.value}>{ft.label}</option>)}
                        </select>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="shrink-0 mt-5" onClick={() => removeQuestion(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Placeholder</Label>
                      <Input value={q.placeholder} onChange={(e) => updateQuestion(i, "placeholder", e.target.value)} placeholder="e.g. Acme Corp" />
                    </div>
                    {q.field_type === "select" && (
                      <div className="space-y-1">
                        <Label className="text-xs">Options (comma-separated)</Label>
                        <Input value={q.options} onChange={(e) => updateQuestion(i, "options", e.target.value)} placeholder="Option 1, Option 2, Option 3" />
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={q.is_required} onCheckedChange={(v) => updateQuestion(i, "is_required", v)} />
                    <span className="text-sm text-muted-foreground">Required</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Confirmation message */}
            <div className="space-y-2">
              <Label className="text-base">Confirmation Message</Label>
              <p className="text-xs text-muted-foreground">Shown after booking and included in the confirmation email. Leave empty for default.</p>
              <Textarea
                value={editing.confirmation_message || ""}
                onChange={(e) => setEditing({ ...editing, confirmation_message: e.target.value })}
                placeholder={"🎉 Workshop booked!\n\nYou'll receive:\n✓ Calendar invite within 5 minutes\n✓ Preparation instructions 1 week before\n\nPlease prepare 3-5 actual initiatives from your backlog.\n\nSee you soon!\n/Mikael"}
                rows={6}
              />
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
          <Card><CardContent className="py-12 text-center"><CalendarClock className="mx-auto h-10 w-10 text-muted-foreground mb-3" /><p className="text-muted-foreground">No event types created yet.</p></CardContent></Card>
        )}
        {eventTypes.map((et) => (
          <Card key={et.id} className={et.is_active ? "border-primary/40" : ""}>
            <CardContent className="flex items-center justify-between py-4 px-6">
              <div className="flex items-center gap-4">
                <div className="h-10 w-1.5 rounded-full" style={{ backgroundColor: et.color }} />
                <div>
                  <div className="flex items-center gap-2"><span className="font-medium">{et.name}</span>{et.is_active && <Badge variant="success">Active</Badge>}</div>
                  <p className="text-sm text-muted-foreground">
                    {et.duration_minutes} min &middot; /{et.slug}
                    {et.availability_rules?.length ? ` · ${et.availability_rules.length} time rules` : ""}
                    {et.custom_questions?.length ? ` · ${et.custom_questions.length} questions` : ""}
                  </p>
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
