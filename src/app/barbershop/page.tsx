"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { cn, formatTime } from "@/lib/utils";
import type { CustomQuestion } from "@/types";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  getDay,
  isBefore,
  isSameDay,
  startOfDay,
  startOfMonth,
  subMonths,
} from "date-fns";
import {
  ArrowRight,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Loader2,
  Scissors,
  Sparkles,
  UserRound,
} from "lucide-react";

type Treatment = {
  name: string;
  subtitle: string;
  slug: string;
  duration: string;
  summary: string;
  bullets: string[];
};

type EventTypeInfo = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  duration_minutes: number;
  color: string;
  location_type: string;
  confirmation_message: string | null;
};

type AvailabilityResponse = {
  eventType: EventTypeInfo;
  customQuestions: CustomQuestion[];
  timezone: string;
  availability: Record<string, { start: string; end: string }[]>;
  error?: string;
};

const TREATMENTS: Treatment[] = [
  {
    name: "The Tracy Test",
    subtitle: "30 min clarity cut",
    slug: "30-min-consultation",
    duration: "30 min",
    summary: "A sharp diagnostic session for teams that feel busy, blocked, or vaguely overcommitted.",
    bullets: ["Fast intake", "Top constraint identified", "One immediate next move"],
  },
  {
    name: "Backlog Surgery",
    subtitle: "60 min deep cut",
    slug: "backlog-audit",
    duration: "60 min",
    summary: "A hands-on prioritization session to remove drag, expose noise, and restore decision quality.",
    bullets: ["Backlog triage", "Priority logic reset", "Cleaner delivery lane"],
  },
  {
    name: "Chaos → Clarity Workshop",
    subtitle: "2.5h full treatment",
    slug: "prioritization-workshop",
    duration: "2.5h",
    summary: "A deeper editorial workshop for leaders who need alignment, order, and a usable prioritization system.",
    bullets: ["Stakeholder alignment", "Decision criteria", "Operating cadence"],
  },
];

export default function PriorityBarbershopPage() {
  const bookingRef = useRef<HTMLElement | null>(null);

  const [selectedTreatment, setSelectedTreatment] = useState<Treatment | null>(null);
  const [availabilityData, setAvailabilityData] = useState<AvailabilityResponse | null>(null);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<{ start: Date; end: Date } | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [bookingResult, setBookingResult] = useState<{ id: string; google_meet_link?: string } | null>(null);

  useEffect(() => {
    if (!selectedTreatment) {
      return;
    }

    const controller = new AbortController();

    setLoadingAvailability(true);
    setAvailabilityError(null);
    setAvailabilityData(null);
    setSelectedDate(null);
    setSelectedSlot(null);
    setSubmitError(null);
    setBookingResult(null);

    fetch(`/api/availability?slug=${selectedTreatment.slug}`, { signal: controller.signal })
      .then(async (response) => {
        const result: AvailabilityResponse = await response.json();
        if (!response.ok || result.error) {
          throw new Error(result.error || "Could not load availability");
        }

        const initialAnswers: Record<string, string> = {};
        (result.customQuestions || []).forEach((question) => {
          initialAnswers[question.id] = "";
        });

        setAnswers(initialAnswers);
        setAvailabilityData(result);
      })
      .catch((error: Error) => {
        if (error.name !== "AbortError") {
          setAvailabilityError(error.message || "Could not load availability");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoadingAvailability(false);
        }
      });

    return () => controller.abort();
  }, [selectedTreatment]);

  function handleTreatmentSelect(treatment: Treatment) {
    setSelectedTreatment(treatment);
    setCurrentMonth(new Date());
    bookingRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleDateSelect(date: string) {
    setSelectedDate(date);
    setSelectedSlot(null);
    setSubmitError(null);
    setBookingResult(null);
  }

  function updateAnswer(questionId: string, value: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  }

  function isFormValid() {
    if (!name.trim() || !email.trim() || !selectedSlot || !availabilityData) {
      return false;
    }

    for (const question of availabilityData.customQuestions) {
      if (question.is_required && !answers[question.id]?.trim()) {
        return false;
      }
    }

    return true;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!availabilityData || !selectedSlot) {
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    const answersList = availabilityData.customQuestions
      .filter((question) => answers[question.id]?.trim())
      .map((question) => ({
        question_id: question.id,
        question_label: question.label,
        answer: answers[question.id].trim(),
      }));

    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_type_id: availabilityData.eventType.id,
          invitee_name: name.trim(),
          invitee_email: email.trim(),
          invitee_notes: notes.trim() || undefined,
          start_time: selectedSlot.start.toISOString(),
          answers: answersList,
          source: "bookme",
          variant: "priority-barbershop",
          campaign: null,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Could not complete booking");
      }

      setBookingResult(result.booking);
      setSubmitError(null);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Could not complete booking");
    } finally {
      setSubmitting(false);
    }
  }

  const timezone = availabilityData?.timezone || "Europe/Stockholm";
  const availability = availabilityData?.availability || {};
  const selectedSlots = selectedDate ? availability[selectedDate] || [] : [];
  const availableDates = new Set(Object.keys(availability));
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startOffset = (getDay(monthStart) + 6) % 7;

  return (
    <main className="min-h-screen bg-[#0a0a0b] text-[#f3efe7]">
      <div className="absolute inset-x-0 top-0 h-[32rem] bg-[radial-gradient(circle_at_top,_rgba(180,141,79,0.24),_transparent_48%),linear-gradient(180deg,_rgba(255,255,255,0.04),_transparent_55%)]" />

      <section className="relative mx-auto max-w-7xl px-6 pb-16 pt-8 sm:px-8 lg:px-12 lg:pb-24 lg:pt-12">
        <div className="mb-12 flex items-center justify-between border-b border-white/10 pb-5 text-sm uppercase tracking-[0.32em] text-[#c5b28b]">
          <span>Priority Barbershop</span>
          <span>Editorial Booking Room</span>
        </div>

        <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
          <div className="max-w-3xl">
            <p className="mb-4 text-sm uppercase tracking-[0.35em] text-[#c5b28b]">Trim the noise. Keep the signal.</p>
            <h1 className="font-serif text-5xl leading-none tracking-tight text-[#f7f0e4] sm:text-6xl lg:text-7xl">
              Priority
              <br />
              Barbershop
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-[#c8c1b6]">
              A premium booking page for leaders who need sharper priorities, cleaner backlogs, and calmer delivery.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button
                className="h-12 rounded-full border border-[#c5b28b] bg-[#c5b28b] px-6 text-sm font-medium text-black hover:bg-[#d2bf98]"
                onClick={() => handleTreatmentSelect(TREATMENTS[0])}
              >
                Book a treatment
                <ArrowRight className="h-4 w-4" />
              </Button>
              <a
                href="#treatments"
                className="inline-flex h-12 items-center rounded-full border border-white/15 px-6 text-sm text-[#f3efe7] transition hover:border-white/30 hover:bg-white/5"
              >
                View treatments
              </a>
            </div>
          </div>

          <Card className="border-white/10 bg-white/5 shadow-[0_24px_100px_rgba(0,0,0,0.35)] backdrop-blur">
            <CardContent className="p-7">
              <div className="mb-6 flex items-center gap-3 text-sm text-[#c5b28b]">
                <Sparkles className="h-4 w-4" />
                <span>For founders, product leads, and overloaded teams</span>
              </div>
              <div className="space-y-5">
                <div>
                  <p className="text-sm uppercase tracking-[0.22em] text-white/45">What this is</p>
                  <p className="mt-2 text-base leading-7 text-[#e5ddd0]">
                    A faster route into the existing BookMe engine, styled for a premium consultation offering.
                  </p>
                </div>
                <div>
                  <p className="text-sm uppercase tracking-[0.22em] text-white/45">What happens</p>
                  <p className="mt-2 text-base leading-7 text-[#e5ddd0]">
                    Pick a treatment, choose a live slot from the current backend, and book without leaving the page.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="relative border-y border-white/10 bg-white/[0.03]">
        <div className="mx-auto grid max-w-7xl gap-6 px-6 py-6 text-sm uppercase tracking-[0.2em] text-[#d7cec0] sm:px-8 lg:grid-cols-3 lg:px-12">
          <p>Backlog too large to trust</p>
          <p>Priorities changing faster than decisions</p>
          <p>Too many inputs, not enough editorial judgement</p>
        </div>
      </section>

      <section id="treatments" className="relative mx-auto max-w-7xl px-6 py-16 sm:px-8 lg:px-12 lg:py-24">
        <div className="mb-10 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-[#c5b28b]">Treatments</p>
            <h2 className="mt-3 font-serif text-4xl tracking-tight text-[#f7f0e4]">Choose the cut that fits the mess.</h2>
          </div>
          <p className="max-w-xl text-base leading-7 text-[#c8c1b6]">
            Each treatment maps directly to an existing hidden event type and uses live availability from the current backend.
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          {TREATMENTS.map((treatment) => {
            const isSelected = selectedTreatment?.slug === treatment.slug;

            return (
              <Card
                key={treatment.slug}
                className={cn(
                  "border-white/10 bg-[#121214] text-[#f3efe7] transition",
                  isSelected && "border-[#c5b28b] bg-[#171513] shadow-[0_0_0_1px_rgba(197,178,139,0.28)]"
                )}
              >
                <CardContent className="flex h-full flex-col p-7">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm uppercase tracking-[0.28em] text-[#c5b28b]">{treatment.subtitle}</p>
                      <h3 className="mt-3 text-2xl font-semibold tracking-tight">{treatment.name}</h3>
                    </div>
                    <span className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-white/60">
                      {treatment.duration}
                    </span>
                  </div>

                  <p className="mt-5 text-base leading-7 text-[#c8c1b6]">{treatment.summary}</p>

                  <div className="mt-6 space-y-3 text-sm text-[#ebe3d7]">
                    {treatment.bullets.map((bullet) => (
                      <div key={bullet} className="flex items-center gap-3">
                        <div className="h-1.5 w-1.5 rounded-full bg-[#c5b28b]" />
                        <span>{bullet}</span>
                      </div>
                    ))}
                  </div>

                  <Button
                    onClick={() => handleTreatmentSelect(treatment)}
                    className={cn(
                      "mt-8 h-11 rounded-full border px-5",
                      isSelected
                        ? "border-[#c5b28b] bg-[#c5b28b] text-black hover:bg-[#d2bf98]"
                        : "border-white/15 bg-transparent text-[#f3efe7] hover:bg-white/[0.07]"
                    )}
                  >
                    {isSelected ? "Selected" : "Choose treatment"}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="relative mx-auto grid max-w-7xl gap-8 px-6 py-4 sm:px-8 lg:grid-cols-[0.95fr_1.05fr] lg:px-12 lg:py-10">
        <Card className="border-white/10 bg-[#111214] text-[#f3efe7]">
          <CardContent className="p-8">
            <p className="text-sm uppercase tracking-[0.3em] text-[#c5b28b]">The Expert</p>
            <div className="mt-6 flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/5">
                <UserRound className="h-6 w-6 text-[#c5b28b]" />
              </div>
              <div>
                <p className="text-xl font-semibold">Tracy</p>
                <p className="text-sm uppercase tracking-[0.2em] text-white/45">Strategic editor for product priorities</p>
              </div>
            </div>
            <p className="mt-6 text-base leading-7 text-[#c8c1b6]">
              The work is less about adding process and more about removing interference. The goal is a cleaner decision surface and a backlog you can actually trust.
            </p>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-white/[0.03] text-[#f3efe7]">
          <CardContent className="grid gap-6 p-8 sm:grid-cols-3">
            <div>
              <Scissors className="h-5 w-5 text-[#c5b28b]" />
              <p className="mt-4 text-sm uppercase tracking-[0.22em] text-white/45">1. Diagnose</p>
              <p className="mt-2 text-sm leading-7 text-[#d7cec0]">Identify the actual bottleneck instead of treating symptoms.</p>
            </div>
            <div>
              <Calendar className="h-5 w-5 text-[#c5b28b]" />
              <p className="mt-4 text-sm uppercase tracking-[0.22em] text-white/45">2. Cut</p>
              <p className="mt-2 text-sm leading-7 text-[#d7cec0]">Remove stale work, noisy requests, and false urgency.</p>
            </div>
            <div>
              <Clock3 className="h-5 w-5 text-[#c5b28b]" />
              <p className="mt-4 text-sm uppercase tracking-[0.22em] text-white/45">3. Reset</p>
              <p className="mt-2 text-sm leading-7 text-[#d7cec0]">Leave with a clearer operating line and an actionable next move.</p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section ref={bookingRef} className="relative mx-auto max-w-7xl px-6 py-16 sm:px-8 lg:px-12 lg:py-24">
        <div className="mb-10 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-[#c5b28b]">Booking</p>
            <h2 className="mt-3 font-serif text-4xl tracking-tight text-[#f7f0e4]">Book inline. No detours.</h2>
          </div>
          <p className="max-w-2xl text-base leading-7 text-[#c8c1b6]">
            Select a treatment to load live availability from the mapped event type, then choose a date, a time, and complete the booking here.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[0.72fr_1.28fr]">
          <Card className="border-white/10 bg-[#111214] text-[#f3efe7]">
            <CardContent className="p-7">
              <p className="text-sm uppercase tracking-[0.28em] text-[#c5b28b]">Selected treatment</p>
              {selectedTreatment ? (
                <>
                  <h3 className="mt-4 text-3xl font-semibold tracking-tight">{selectedTreatment.name}</h3>
                  <p className="mt-2 text-sm uppercase tracking-[0.24em] text-white/45">{selectedTreatment.subtitle}</p>
                  <p className="mt-6 text-base leading-7 text-[#c8c1b6]">{selectedTreatment.summary}</p>
                </>
              ) : (
                <p className="mt-4 text-base leading-7 text-[#c8c1b6]">Choose one of the treatments above to load the booking interface.</p>
              )}

              {availabilityData?.eventType && (
                <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-[#d7cec0]">
                  <p className="font-medium text-[#f3efe7]">{availabilityData.eventType.name}</p>
                  <p className="mt-1">Live duration: {availabilityData.eventType.duration_minutes} min</p>
                  <p className="mt-1">Timezone: {availabilityData.timezone}</p>
                </div>
              )}

              {bookingResult && selectedSlot && (
                <div className="mt-6 rounded-2xl border border-emerald-400/25 bg-emerald-400/10 p-4">
                  <div className="flex items-center gap-3 text-emerald-200">
                    <Check className="h-5 w-5" />
                    <p className="font-medium">Booking confirmed</p>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-emerald-50/90">
                    {format(selectedSlot.start, "EEEE, MMMM d")} at {formatTime(selectedSlot.start, timezone)} is locked in. A confirmation is on its way to {email}.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-[#141517] text-[#f3efe7]">
            <CardContent className="p-7">
              {!selectedTreatment && (
                <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-14 text-center">
                  <p className="text-lg font-medium">Choose a treatment to begin.</p>
                  <p className="mt-3 text-sm text-[#c8c1b6]">Availability will load here from the existing backend as soon as you select one.</p>
                </div>
              )}

              {selectedTreatment && loadingAvailability && (
                <div className="flex min-h-[18rem] items-center justify-center rounded-3xl border border-white/10 bg-white/[0.02]">
                  <div className="flex items-center gap-3 text-[#d7cec0]">
                    <Loader2 className="h-5 w-5 animate-spin text-[#c5b28b]" />
                    <span>Loading live availability</span>
                  </div>
                </div>
              )}

              {selectedTreatment && availabilityError && !loadingAvailability && (
                <div className="rounded-3xl border border-red-400/25 bg-red-400/10 px-6 py-8">
                  <p className="font-medium text-red-100">Availability could not be loaded.</p>
                  <p className="mt-2 text-sm text-red-100/80">{availabilityError}</p>
                </div>
              )}

              {selectedTreatment && availabilityData && !loadingAvailability && (
                <div className="space-y-8">
                  <div className="grid gap-8 xl:grid-cols-[0.95fr_1.05fr]">
                    <div>
                      <div className="mb-5 flex items-center justify-between">
                        <p className="text-sm uppercase tracking-[0.24em] text-white/45">1. Pick a date</p>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="rounded-full text-[#f3efe7] hover:bg-white/[0.07]"
                            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          <span className="text-sm uppercase tracking-[0.18em] text-[#d7cec0]">
                            {format(currentMonth, "MMMM yyyy")}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="rounded-full text-[#f3efe7] hover:bg-white/[0.07]"
                            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="mb-2 grid grid-cols-7 gap-2 text-center text-xs uppercase tracking-[0.18em] text-white/35">
                        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
                          <div key={day} className="py-2">
                            {day}
                          </div>
                        ))}
                      </div>

                      <div className="grid grid-cols-7 gap-2">
                        {Array.from({ length: startOffset }).map((_, index) => (
                          <div key={`offset-${index}`} />
                        ))}

                        {daysInMonth.map((day) => {
                          const dateString = format(day, "yyyy-MM-dd");
                          const isAvailable = availableDates.has(dateString);
                          const isPast = isBefore(day, startOfDay(new Date()));
                          const isSelected = selectedDate === dateString;

                          return (
                            <button
                              key={dateString}
                              type="button"
                              disabled={!isAvailable || isPast}
                              onClick={() => handleDateSelect(dateString)}
                              className={cn(
                                "h-12 rounded-2xl border text-sm transition",
                                isAvailable && !isPast
                                  ? "cursor-pointer border-white/10 bg-white/[0.04] text-[#f3efe7] hover:border-[#c5b28b]/60 hover:bg-[#c5b28b]/10"
                                  : "cursor-default border-transparent bg-transparent text-white/20",
                                isSameDay(day, new Date()) && "border-white/20",
                                isSelected && "border-[#c5b28b] bg-[#c5b28b] text-black hover:bg-[#c5b28b]"
                              )}
                            >
                              {format(day, "d")}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <p className="mb-5 text-sm uppercase tracking-[0.24em] text-white/45">2. Pick a time</p>
                      {selectedDate ? (
                        selectedSlots.length > 0 ? (
                          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                            {selectedSlots.map((slot) => {
                              const isSelected =
                                selectedSlot?.start.toISOString() === new Date(slot.start).toISOString();

                              return (
                                <button
                                  key={slot.start}
                                  type="button"
                                  onClick={() => {
                                    setSelectedSlot({ start: new Date(slot.start), end: new Date(slot.end) });
                                    setBookingResult(null);
                                    setSubmitError(null);
                                  }}
                                  className={cn(
                                    "rounded-2xl border px-4 py-3 text-sm transition",
                                    isSelected
                                      ? "border-[#c5b28b] bg-[#c5b28b] text-black"
                                      : "border-white/10 bg-white/[0.04] text-[#f3efe7] hover:border-[#c5b28b]/60 hover:bg-white/[0.08]"
                                  )}
                                >
                                  {formatTime(new Date(slot.start), timezone)}
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-8 text-sm text-[#c8c1b6]">
                            No open slots on this date.
                          </div>
                        )
                      ) : (
                        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-8 text-sm text-[#c8c1b6]">
                          Pick a date first to reveal time slots.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="border-t border-white/10 pt-8">
                    <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                      <div>
                        <p className="text-sm uppercase tracking-[0.24em] text-white/45">3. Complete booking</p>
                        {selectedSlot ? (
                          <p className="mt-2 text-sm text-[#d7cec0]">
                            {format(selectedSlot.start, "EEEE, MMMM d")} at {formatTime(selectedSlot.start, timezone)}
                          </p>
                        ) : (
                          <p className="mt-2 text-sm text-[#c8c1b6]">Select a time before submitting the form.</p>
                        )}
                      </div>
                    </div>

                    <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
                      <div className="space-y-2">
                        <Label htmlFor="priority-name" className="text-[#f3efe7]">
                          Name
                        </Label>
                        <Input
                          id="priority-name"
                          value={name}
                          onChange={(event) => setName(event.target.value)}
                          placeholder="Jane Smith"
                          className="border-white/10 bg-white/[0.04] text-[#f3efe7] placeholder:text-white/30"
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="priority-email" className="text-[#f3efe7]">
                          Email
                        </Label>
                        <Input
                          id="priority-email"
                          type="email"
                          value={email}
                          onChange={(event) => setEmail(event.target.value)}
                          placeholder="jane@example.com"
                          className="border-white/10 bg-white/[0.04] text-[#f3efe7] placeholder:text-white/30"
                          required
                        />
                      </div>

                      {availabilityData.customQuestions.map((question) => (
                        <div key={question.id} className="space-y-2 md:col-span-2">
                          <Label htmlFor={`question-${question.id}`} className="text-[#f3efe7]">
                            {question.label}
                            {question.is_required ? " *" : ""}
                          </Label>

                          {question.field_type === "textarea" ? (
                            <Textarea
                              id={`question-${question.id}`}
                              value={answers[question.id] || ""}
                              onChange={(event) => updateAnswer(question.id, event.target.value)}
                              placeholder={question.placeholder || ""}
                              rows={4}
                              className="border-white/10 bg-white/[0.04] text-[#f3efe7] placeholder:text-white/30"
                              required={question.is_required}
                            />
                          ) : question.field_type === "select" && question.options ? (
                            <select
                              id={`question-${question.id}`}
                              value={answers[question.id] || ""}
                              onChange={(event) => updateAnswer(question.id, event.target.value)}
                              className="flex h-10 w-full rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-[#f3efe7] focus:outline-none"
                              required={question.is_required}
                            >
                              <option value="">{question.placeholder || "Select an option"}</option>
                              {question.options.map((option) => (
                                <option key={option} value={option}>
                                  {option}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <Input
                              id={`question-${question.id}`}
                              type={question.field_type === "number" ? "number" : "text"}
                              value={answers[question.id] || ""}
                              onChange={(event) => updateAnswer(question.id, event.target.value)}
                              placeholder={question.placeholder || ""}
                              className="border-white/10 bg-white/[0.04] text-[#f3efe7] placeholder:text-white/30"
                              required={question.is_required}
                            />
                          )}
                        </div>
                      ))}

                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="priority-notes" className="text-[#f3efe7]">
                          Brief context
                        </Label>
                        <Textarea
                          id="priority-notes"
                          value={notes}
                          onChange={(event) => setNotes(event.target.value)}
                          placeholder="What would you like to sharpen?"
                          rows={4}
                          className="border-white/10 bg-white/[0.04] text-[#f3efe7] placeholder:text-white/30"
                        />
                      </div>

                      {submitError && (
                        <div className="md:col-span-2 rounded-2xl border border-red-400/25 bg-red-400/10 px-4 py-3 text-sm text-red-100">
                          {submitError}
                        </div>
                      )}

                      <div className="md:col-span-2 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-xs uppercase tracking-[0.2em] text-white/35">
                          Submission uses `/api/bookings` with source `bookme` and variant `priority-barbershop`
                        </p>
                        <Button
                          type="submit"
                          disabled={!isFormValid() || submitting}
                          className="h-11 rounded-full bg-[#c5b28b] px-6 text-black hover:bg-[#d2bf98]"
                        >
                          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                          Confirm booking
                        </Button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}
