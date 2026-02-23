"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowLeft, Check, ChevronLeft, ChevronRight, Clock, Globe, Loader2, Video,
} from "lucide-react";
import { cn, formatTime } from "@/lib/utils";
import {
  format, addMonths, subMonths, startOfMonth, endOfMonth,
  eachDayOfInterval, getDay, isSameDay, isBefore, startOfDay,
} from "date-fns";

interface EventTypeInfo {
  id: string; name: string; slug: string; description: string | null;
  duration_minutes: number; color: string; location_type: string;
}

interface AvailabilityData {
  eventType: EventTypeInfo;
  timezone: string;
  availability: Record<string, { start: string; end: string }[]>;
}

type Step = "date" | "time" | "form" | "confirmed";

export default function BookingPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [data, setData] = useState<AvailabilityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<{ start: Date; end: Date } | null>(null);
  const [step, setStep] = useState<Step>("date");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [bookingResult, setBookingResult] = useState<{ id: string; google_meet_link?: string } | null>(null);

  useEffect(() => {
    fetch(`/api/availability?slug=${slug}`)
      .then((r) => r.json())
      .then((d) => { if (d.error) setError(d.error); else setData(d); })
      .catch(() => setError("Could not load availability"))
      .finally(() => setLoading(false));
  }, [slug]);

  function goBack() {
    if (step === "time") { setStep("date"); setSelectedDate(null); }
    else if (step === "form") { setStep("time"); setSelectedSlot(null); }
    else router.push("/");
  }

  function handleDateSelect(dateStr: string) {
    setSelectedDate(dateStr);
    setSelectedSlot(null);
    setStep("time");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedSlot || !data) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_type_id: data.eventType.id,
          invitee_name: name,
          invitee_email: email,
          invitee_notes: notes || undefined,
          start_time: selectedSlot.start.toISOString(),
          end_time: selectedSlot.end.toISOString(),
        }),
      });
      const result = await res.json();
      if (!res.ok) { setError(result.error || "Something went wrong"); return; }
      setBookingResult(result.booking);
      setStep("confirmed");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if ((error && !data) || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <Card className="max-w-sm w-full">
          <CardContent className="py-8 text-center">
            <p className="text-destructive">{error || "Event type not found"}</p>
            <Button variant="outline" className="mt-4" onClick={() => router.push("/")}>Back</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { eventType, timezone, availability } = data;
  const availableDates = new Set(Object.keys(availability));
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startOffset = (getDay(monthStart) + 6) % 7;

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background">
      <div className="mx-auto max-w-2xl px-4 py-8 md:py-16">
        {/* Header */}
        <div className="mb-8">
          {step !== "confirmed" && (
            <button onClick={goBack} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
              <ArrowLeft className="h-4 w-4" />
              {step === "date" ? "Back" : step === "time" ? "Pick another date" : "Pick another time"}
            </button>
          )}
          <div className="flex items-center gap-3">
            <div className="h-12 w-1.5 rounded-full" style={{ backgroundColor: eventType.color }} />
            <div>
              <h1 className="text-xl font-bold">{eventType.name}</h1>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{eventType.duration_minutes} min</span>
                {eventType.location_type === "google_meet" && (
                  <span className="flex items-center gap-1"><Video className="h-3.5 w-3.5" />Google Meet</span>
                )}
                <span className="flex items-center gap-1"><Globe className="h-3.5 w-3.5" />{timezone}</span>
              </div>
            </div>
          </div>
          {eventType.description && <p className="text-sm text-muted-foreground mt-3">{eventType.description}</p>}
        </div>

        {/* Confirmed */}
        {step === "confirmed" && selectedSlot && (
          <Card>
            <CardContent className="py-10 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                <Check className="h-8 w-8 text-green-600" />
              </div>
              <h2 className="text-xl font-bold mb-2">Booking confirmed!</h2>
              <p className="text-muted-foreground mb-4">A confirmation has been sent to {email}</p>
              <div className="bg-muted/50 rounded-lg p-4 inline-block text-left">
                <p className="font-medium">{eventType.name}</p>
                <p className="text-sm text-muted-foreground">{format(selectedSlot.start, "EEEE, MMMM d, yyyy")}</p>
                <p className="text-sm text-muted-foreground">{formatTime(selectedSlot.start, timezone)} – {formatTime(selectedSlot.end, timezone)}</p>
                {bookingResult?.google_meet_link && (
                  <a href={bookingResult.google_meet_link} target="_blank" rel="noopener" className="text-sm text-primary hover:underline mt-2 inline-flex items-center gap-1">
                    <Video className="h-3 w-3" />Open Google Meet
                  </a>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Form */}
        {step === "form" && selectedSlot && (
          <Card>
            <CardContent className="py-6">
              <div className="bg-muted/50 rounded-lg p-3 mb-6">
                <p className="text-sm font-medium">{format(selectedSlot.start, "EEEE, MMMM d")}</p>
                <p className="text-sm text-muted-foreground">{formatTime(selectedSlot.start, timezone)} – {formatTime(selectedSlot.end, timezone)}</p>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Your name *</Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Smith" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@example.com" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Message (optional)</Label>
                  <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Let me know what you'd like to discuss..." rows={3} />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting && <Loader2 className="animate-spin" />}
                  Confirm booking
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Time slots */}
        {step === "time" && selectedDate && (
          <Card>
            <CardContent className="py-6">
              <h2 className="font-semibold mb-4">
                {format(new Date(selectedDate + "T12:00:00"), "EEEE, MMMM d")}
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {(availability[selectedDate] || []).map((slot, i) => (
                  <Button
                    key={i}
                    variant="outline"
                    className="h-12 hover:border-primary hover:text-primary"
                    onClick={() => { setSelectedSlot({ start: new Date(slot.start), end: new Date(slot.end) }); setStep("form"); }}
                  >
                    {formatTime(new Date(slot.start), timezone)}
                  </Button>
                ))}
              </div>
              {(!availability[selectedDate] || availability[selectedDate].length === 0) && (
                <p className="text-center text-muted-foreground py-4">No available times on this date</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Calendar */}
        {step === "date" && (
          <Card>
            <CardContent className="py-6">
              <div className="flex items-center justify-between mb-6">
                <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <h2 className="font-semibold capitalize">{format(currentMonth, "MMMM yyyy")}</h2>
                <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid grid-cols-7 gap-1 mb-2">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                  <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: startOffset }).map((_, i) => <div key={`e-${i}`} />)}
                {daysInMonth.map((day) => {
                  const dateStr = format(day, "yyyy-MM-dd");
                  const isAvailable = availableDates.has(dateStr);
                  const isPast = isBefore(day, startOfDay(new Date()));
                  const isToday = isSameDay(day, new Date());
                  return (
                    <button
                      key={dateStr}
                      disabled={!isAvailable || isPast}
                      onClick={() => handleDateSelect(dateStr)}
                      className={cn(
                        "h-10 rounded-md text-sm transition-colors",
                        isAvailable && !isPast
                          ? "font-medium hover:bg-primary hover:text-primary-foreground cursor-pointer bg-primary/10 text-primary"
                          : "text-muted-foreground/40 cursor-default",
                        isToday && "ring-1 ring-primary/30"
                      )}
                    >
                      {format(day, "d")}
                    </button>
                  );
                })}
              </div>
              {Object.keys(availability).length === 0 && (
                <p className="text-center text-muted-foreground py-6">No available times right now.</p>
              )}
            </CardContent>
          </Card>
        )}

        <p className="text-center text-xs text-muted-foreground mt-8">Powered by Tech &amp; Change</p>
      </div>
    </div>
  );
}
