"use client";

import Image from "next/image";
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
    summary: "A fast diagnostic call for when work feels messy, overloaded, or hard to prioritize.",
    bullets: ["Quick situation read", "Main bottleneck identified", "Clear next step"],
  },
  {
    name: "Backlog Surgery",
    subtitle: "60 min deep cut",
    slug: "backlog-audit",
    duration: "60 min",
    summary: "A working session for teams with a backlog that has grown noisy, stale, or hard to trust.",
    bullets: ["Backlog cleaned up", "Priorities made clearer", "What to drop, keep, or do next"],
  },
  {
    name: "Chaos → Clarity Workshop",
    subtitle: "2.5h full treatment",
    slug: "prioritization-workshop",
    duration: "2.5h",
    summary: "A deeper workshop for leaders who need alignment, decision clarity, and a better way to prioritize together.",
    bullets: ["Shared direction", "Clear decision rules", "A practical way forward"],
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
  }

  function handleTreatmentSelectAndScroll(treatment: Treatment) {
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
    <main className="min-h-screen overflow-x-hidden bg-[#07090d] text-[#f3efe7]">
      <div className="absolute inset-x-0 top-0 h-[38rem] bg-[radial-gradient(circle_at_top,_rgba(90,199,191,0.18),_transparent_38%),radial-gradient(circle_at_20%_20%,_rgba(81,49,122,0.26),_transparent_32%),linear-gradient(180deg,_rgba(255,255,255,0.03),_transparent_55%)]" />
      <div className="absolute inset-x-0 top-[26rem] h-[30rem] bg-[linear-gradient(180deg,_rgba(10,17,24,0),_rgba(10,17,24,0.72)_35%,_rgba(7,9,13,1))]" />

      <section className="relative mx-auto max-w-7xl px-6 pb-20 pt-8 sm:px-8 lg:px-12 lg:pb-32 lg:pt-12">
        <div className="mb-14 flex items-center justify-between border-b border-white/10 pb-5 text-[11px] uppercase tracking-[0.32em] text-[#8dbeb8]">
          <span>Priority Barbershop</span>
          <span className="hidden sm:inline">Editorial Booking Room</span>
        </div>

        <div className="grid gap-8 lg:grid-cols-[0.94fr_1.06fr] lg:items-stretch lg:gap-10">
          <div className="max-w-4xl">
            <p className="mb-4 text-xs uppercase tracking-[0.35em] text-[#8dbeb8]">Trim the noise. Keep the signal.</p>
            <h1 className="max-w-4xl font-serif text-5xl leading-[0.96] tracking-[-0.04em] text-[#f7f0e4] sm:text-6xl lg:text-[5.75rem]">
              Priority
              <br />
              Barbershop
            </h1>
            <p className="mt-8 max-w-2xl text-lg leading-8 text-[#cfd5d2] sm:text-[1.2rem]">
              A premium booking page for leaders who need sharper priorities, cleaner backlogs, and calmer delivery.
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Button
                className="h-12 rounded-full border border-[#8dbeb8]/60 bg-[linear-gradient(135deg,#8dbeb8,#c6ece8)] px-6 text-sm font-medium text-[#071014] shadow-[0_10px_40px_rgba(86,183,175,0.24)] hover:brightness-105"
                onClick={() => handleTreatmentSelectAndScroll(TREATMENTS[0])}
              >
                Book a treatment
                <ArrowRight className="h-4 w-4" />
              </Button>
              <a
                href="#treatments"
                className="inline-flex h-12 items-center rounded-full border border-white/12 bg-white/[0.02] px-6 text-sm text-[#f3efe7] transition hover:border-[#8dbeb8]/35 hover:bg-white/[0.05]"
              >
                View treatments
              </a>
            </div>
            <p className="mt-8 max-w-xl text-sm leading-7 text-white/55">
              Choose a treatment, see live availability, and book the session without leaving the page.
            </p>

            <div className="relative mt-10 overflow-hidden rounded-[1.9rem] border border-white/10 bg-black shadow-[0_24px_80px_rgba(0,0,0,0.3)] lg:hidden">
              <div className="relative aspect-[4/5] w-full">
                <Image
                  src="/mikaelf/armar_kors_3_HERO.png"
                  alt="Portrait of the founder in a dark editorial barbershop setting"
                  fill
                  className="object-cover object-[54%_18%]"
                  sizes="100vw"
                  priority
                />
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(4,6,9,0.04),rgba(4,6,9,0.18)_44%,rgba(4,6,9,0.36)),radial-gradient(circle_at_20%_24%,rgba(94,58,140,0.18),transparent_28%)]" />
              </div>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-rows-[1fr_auto]">
            <Card className="relative overflow-hidden rounded-[2.2rem] border-white/10 bg-[linear-gradient(180deg,#121821,#0d1218)] shadow-[0_24px_100px_rgba(0,0,0,0.42)] backdrop-blur lg:min-h-[29rem]">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_26%,rgba(94,58,140,0.4),transparent_22%),radial-gradient(circle_at_58%_18%,rgba(141,190,184,0.16),transparent_24%),linear-gradient(135deg,rgba(255,255,255,0.03),transparent_38%)]" />
              <div className="absolute inset-y-4 right-4 hidden w-[60%] overflow-hidden rounded-[2rem] border border-white/10 bg-black lg:block">
                <Image
                  src="/mikaelf/armar_kors_3_HERO.png"
                  alt="Portrait of the founder in a dark editorial barbershop setting"
                  fill
                  className="object-cover object-[54%_24%]"
                  sizes="(min-width: 1024px) 40vw, 100vw"
                  priority
                />
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(4,6,9,0.08),rgba(4,6,9,0.2)_42%,rgba(4,6,9,0.48)),radial-gradient(circle_at_18%_24%,rgba(94,58,140,0.22),transparent_28%)]" />
                <div className="absolute inset-0 ring-1 ring-inset ring-white/8" />
              </div>
              <div className="absolute inset-y-6 left-6 hidden w-[22%] rounded-[1.8rem] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.015))] lg:block" />
              <CardContent className="relative p-6 sm:p-7 lg:flex lg:h-full lg:max-w-[28%] lg:items-end lg:p-8">
                <div className="max-w-xs lg:max-w-none">
                  <p className="text-[11px] uppercase tracking-[0.28em] text-[#d2b4f3]">Editorial booking room</p>
                  <div className="mt-4 space-y-3 text-sm leading-6 text-[#ece4d8]">
                    <p>Clarity over urgency</p>
                    <p>Fewer priorities, better decisions</p>
                    <p className="text-white/55">Human-led, not template-led</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="rounded-[1.7rem] border border-white/8 bg-[linear-gradient(180deg,#131922,#0c1016)] px-5 py-4 text-sm text-[#e9e1d5] shadow-[0_12px_36px_rgba(0,0,0,0.16)]">
              <p className="text-[11px] uppercase tracking-[0.24em] text-[#b9afa1]">Positioning</p>
              <p className="mt-3 leading-7 text-[#e9e1d5]">An editorial booking route for leaders who need a sharper decision line.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="relative border-y border-white/8 bg-[linear-gradient(180deg,rgba(14,24,31,0.72),rgba(9,13,18,0.72))]">
        <div className="mx-auto grid max-w-7xl gap-4 px-6 py-6 text-xs uppercase tracking-[0.22em] text-[#dce3df] sm:px-8 lg:grid-cols-3 lg:px-12">
          <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-5 py-5">Backlog too large to trust</div>
          <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-5 py-5">Priorities changing faster than decisions</div>
          <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-5 py-5">Too many inputs, not enough editorial judgement</div>
        </div>
      </section>

      <section id="treatments" className="relative mx-auto max-w-7xl px-6 py-20 sm:px-8 lg:px-12 lg:py-32">
        <div className="mb-12 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-[#8dbeb8]">Treatments</p>
            <h2 className="mt-3 max-w-3xl font-serif text-4xl tracking-[-0.03em] text-[#f7f0e4] sm:text-5xl">Choose the cut that fits the mess.</h2>
          </div>
          <p className="max-w-xl text-base leading-7 text-[#c8c1b6]">
            Each treatment maps directly to an existing hidden event type and uses live availability from the current backend.
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-3 lg:gap-6">
          {TREATMENTS.map((treatment) => {
            const isSelected = selectedTreatment?.slug === treatment.slug;

            return (
              <Card
                key={treatment.slug}
                role="button"
                tabIndex={0}
                aria-pressed={isSelected}
                aria-label={`Select ${treatment.name}`}
                onClick={() => {
                  if (!isSelected) {
                    handleTreatmentSelect(treatment);
                  }
                }}
                onKeyDown={(event) => {
                  if (!isSelected && (event.key === "Enter" || event.key === " ")) {
                    event.preventDefault();
                    handleTreatmentSelect(treatment);
                  }
                }}
                className={cn(
                  "group relative overflow-hidden rounded-[2rem] border border-white/20 bg-[linear-gradient(180deg,#202835,#171d27)] text-[#f3efe7] shadow-[0_36px_110px_rgba(0,0,0,0.5)] transition duration-300 hover:-translate-y-1 hover:border-[#8dbeb8]/38 hover:shadow-[0_44px_120px_rgba(0,0,0,0.56)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8dbeb8]/45 focus-visible:ring-offset-0",
                  isSelected && "border-[#b38ae0] bg-[linear-gradient(180deg,#241d31,#181d29)] shadow-[0_0_0_1px_rgba(179,138,224,0.34),0_0_40px_rgba(94,58,140,0.22),0_40px_120px_rgba(30,20,45,0.58)]"
                )}
              >
                <div
                  className={cn(
                    "pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/26 to-transparent transition duration-200",
                    isSelected && "via-[#c8a7ee]"
                  )}
                />
                <div
                  className={cn(
                    "pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.12),transparent_42%)] opacity-80 transition duration-200",
                    isSelected && "bg-[radial-gradient(circle_at_top,rgba(94,58,140,0.36),transparent_44%)] opacity-100"
                  )}
                />
                <div
                  className={cn(
                    "pointer-events-none absolute inset-x-4 inset-y-4 rounded-[1.6rem] border border-white/10 transition duration-200",
                    isSelected && "border-[#8f68bb]/40"
                  )}
                />
                <div
                  className={cn(
                    "pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-[linear-gradient(180deg,transparent,rgba(0,0,0,0.22))]",
                    isSelected && "bg-[linear-gradient(180deg,transparent,rgba(94,58,140,0.18))]"
                  )}
                />
                <CardContent className="flex h-full flex-col p-8">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className={cn("text-[11px] uppercase tracking-[0.3em] text-[#8dbeb8] transition duration-200", isSelected && "text-[#d2b4f3]")}>{treatment.subtitle}</p>
                      <h3 className={cn("mt-4 text-[1.9rem] font-semibold tracking-[-0.03em] text-[#f7f0e4] transition duration-200", isSelected && "text-[#fcf8ff]")}>{treatment.name}</h3>
                    </div>
                    <span className={cn("rounded-full border border-white/12 bg-black/20 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-white/70 transition duration-200", isSelected && "border-[#8f68bb]/40 bg-[#5e3a8c]/18 text-[#e6d7fb]")}>
                      {treatment.duration}
                    </span>
                  </div>

                  <p className={cn("mt-6 text-base leading-7 text-[#d1cbc3] transition duration-200", isSelected && "text-[#e2dceb]")}>{treatment.summary}</p>

                  <div className={cn("mt-7 rounded-[1.4rem] border border-white/10 bg-black/24 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition duration-200", isSelected && "border-[#8f68bb]/28 bg-[linear-gradient(180deg,rgba(94,58,140,0.16),rgba(0,0,0,0.2))]")}>
                    <div className="space-y-3 text-sm text-[#ebe3d7]">
                    {treatment.bullets.map((bullet) => (
                      <div key={bullet} className="flex items-center gap-3">
                        <div className={cn("h-1.5 w-1.5 rounded-full bg-[#8dbeb8] transition duration-200", isSelected && "bg-[#c8a7ee] shadow-[0_0_14px_rgba(200,167,238,0.85)]")} />
                        <span>{bullet}</span>
                      </div>
                    ))}
                    </div>
                  </div>

                  <Button
                    onClick={(event) => {
                      event.stopPropagation();
                      handleTreatmentSelectAndScroll(treatment);
                    }}
                    className={cn(
                      "mt-10 h-11 rounded-full border px-5 text-sm transition duration-200",
                      isSelected
                        ? "border-[#c8a7ee] bg-[linear-gradient(135deg,#5e3a8c,#8c66b9_55%,#c6ece8)] text-[#071014] shadow-[0_14px_38px_rgba(94,58,140,0.34)] hover:brightness-105"
                        : "border-white/22 bg-white/[0.12] text-[#fffaf3] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] hover:border-[#8dbeb8]/36 hover:bg-white/[0.16]"
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

      <section className="relative mx-auto grid max-w-7xl gap-8 px-6 py-2 sm:px-8 lg:grid-cols-[1.02fr_0.98fr] lg:px-12 lg:py-8">
        <Card className="relative overflow-hidden rounded-[2.1rem] border-white/10 bg-[linear-gradient(180deg,#0f141a,#0a0d12)] text-[#f3efe7] shadow-[0_18px_60px_rgba(0,0,0,0.26)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(141,190,184,0.12),transparent_24%),radial-gradient(circle_at_85%_15%,rgba(94,58,140,0.22),transparent_26%)]" />
          <div className="absolute inset-y-6 right-6 hidden w-[38%] overflow-hidden rounded-[1.7rem] border border-white/10 bg-black lg:block">
            <Image
              src="/mikaelf/armar_i_sidan_1.png"
              alt="Founder portrait for the expert section"
              fill
              className="object-cover object-[52%_24%]"
              sizes="(min-width: 1024px) 26vw, 100vw"
            />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(4,6,9,0.08),rgba(4,6,9,0.18)_42%,rgba(4,6,9,0.42)),radial-gradient(circle_at_20%_18%,rgba(94,58,140,0.16),transparent_26%)]" />
            <div className="absolute inset-0 ring-1 ring-inset ring-white/8" />
          </div>
          <CardContent className="relative p-8 sm:p-9 lg:max-w-[58%]">
            <p className="text-xs uppercase tracking-[0.3em] text-[#8dbeb8]">The Expert</p>
            <h2 className="mt-4 font-serif text-4xl tracking-[-0.03em] text-[#f7f0e4]">Meet the founder behind the cut.</h2>
            <div className="mt-6 flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full border border-[#8dbeb8]/25 bg-[#8dbeb8]/8 shadow-[0_0_40px_rgba(86,183,175,0.14)]">
                <UserRound className="h-6 w-6 text-[#8dbeb8]" />
              </div>
              <div>
                <p className="text-2xl font-semibold tracking-[-0.02em]">Mikael</p>
                <p className="text-xs uppercase tracking-[0.24em] text-white/45">Strategic editor for product priorities</p>
              </div>
            </div>
            <p className="mt-6 text-base leading-7 text-[#c8c1b6]">
              The work is less about adding process and more about removing interference. The goal is a cleaner decision surface and a backlog you can actually trust.
            </p>
            <p className="mt-5 text-sm leading-7 text-white/58">
              This is the person and perspective behind the offering, not a generic booking surface.
            </p>
            <div className="relative mt-7 overflow-hidden rounded-[1.6rem] border border-white/10 bg-black lg:hidden">
              <div className="relative aspect-[4/5] w-full">
                <Image
                  src="/mikaelf/armar_i_sidan_1.png"
                  alt="Founder portrait for the expert section"
                  fill
                  className="object-cover object-[50%_20%]"
                  sizes="100vw"
                />
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(4,6,9,0.04),rgba(4,6,9,0.18)_44%,rgba(4,6,9,0.34)),radial-gradient(circle_at_20%_18%,rgba(94,58,140,0.12),transparent_26%)]" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[2rem] border-white/10 bg-[linear-gradient(180deg,#121820,#0c1016)] text-[#f8f3ea] shadow-[0_18px_60px_rgba(0,0,0,0.22)]">
          <CardContent className="p-8 sm:p-9">
            <div className="mb-8 flex items-end justify-between gap-4 border-b border-white/8 pb-6">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-[#99d0ca]">How It Works</p>
                <h3 className="mt-3 font-serif text-3xl tracking-[-0.03em] text-[#fff9f1]">Three moves. One cleaner decision line.</h3>
              </div>
            </div>
            <div className="grid gap-6 sm:grid-cols-3 sm:gap-4">
              <div className="relative pr-3 sm:pr-6">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[#8f68bb]/38 bg-[#5e3a8c]/20 text-[11px] font-medium uppercase tracking-[0.18em] text-[#e7d7fb]">01</div>
                  <Scissors className="h-5 w-5 text-[#9cd7d1]" />
                </div>
                <p className="text-sm uppercase tracking-[0.24em] text-[#d7c7ee]">Diagnose</p>
                <p className="mt-3 text-sm leading-7 text-[#f7efe4]">See where the real bottleneck is.</p>
                <div className="absolute right-0 top-0 hidden h-full w-px bg-gradient-to-b from-transparent via-white/10 to-transparent sm:block" />
              </div>
              <div className="relative pr-3 sm:pr-6">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[#8f68bb]/38 bg-[#5e3a8c]/20 text-[11px] font-medium uppercase tracking-[0.18em] text-[#e7d7fb]">02</div>
                  <Calendar className="h-5 w-5 text-[#9cd7d1]" />
                </div>
                <p className="text-sm uppercase tracking-[0.24em] text-[#d7c7ee]">Cut</p>
                <p className="mt-3 text-sm leading-7 text-[#f7efe4]">Remove noise and false urgency.</p>
                <div className="absolute right-0 top-0 hidden h-full w-px bg-gradient-to-b from-transparent via-white/10 to-transparent sm:block" />
              </div>
              <div>
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[#8f68bb]/38 bg-[#5e3a8c]/20 text-[11px] font-medium uppercase tracking-[0.18em] text-[#e7d7fb]">03</div>
                  <Clock3 className="h-5 w-5 text-[#9cd7d1]" />
                </div>
                <p className="text-sm uppercase tracking-[0.24em] text-[#d7c7ee]">Reset</p>
                <p className="mt-3 text-sm leading-7 text-[#f7efe4]">Leave with a clearer next move.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section ref={bookingRef} className="relative mx-auto max-w-7xl px-6 py-20 sm:px-8 lg:px-12 lg:py-32">
        <div className="mb-12 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-[#8dbeb8]">Booking</p>
            <h2 className="mt-3 font-serif text-4xl tracking-[-0.03em] text-[#f7f0e4] sm:text-5xl">Book inline. No detours.</h2>
          </div>
          <p className="max-w-2xl text-base leading-7 text-[#c8c1b6]">
            Select a treatment to load live availability from the mapped event type, then choose a date, a time, and complete the booking here.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[0.72fr_1.28fr] lg:gap-7">
          <Card className="rounded-[2rem] border-white/10 bg-[linear-gradient(180deg,#10161c,#0b0f14)] text-[#f3efe7] shadow-[0_24px_70px_rgba(0,0,0,0.28)]">
            <CardContent className="p-8">
              <p className="text-[11px] uppercase tracking-[0.28em] text-[#8dbeb8]">Selected treatment</p>
              {selectedTreatment ? (
                <div className="mt-5 rounded-[1.85rem] border border-[#8dbeb8]/18 bg-[linear-gradient(180deg,rgba(94,58,140,0.18),rgba(141,190,184,0.08)_34%,rgba(255,255,255,0.03))] p-6 shadow-[0_22px_60px_rgba(34,40,66,0.22)]">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.26em] text-[#d7c7ee]">Now booking</p>
                      <h3 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-[#fbf7ff]">{selectedTreatment.name}</h3>
                      <p className="mt-2 text-xs uppercase tracking-[0.24em] text-[#b8ddd8]">{selectedTreatment.subtitle}</p>
                    </div>
                    <div className="rounded-full border border-[#8dbeb8]/20 bg-black/20 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-[#d7c7ee]">
                      Active
                    </div>
                  </div>
                  <p className="mt-5 text-base leading-7 text-[#d8d3df]">{selectedTreatment.summary}</p>
                </div>
              ) : (
                <p className="mt-4 text-base leading-7 text-[#c8c1b6]">Choose one of the treatments above to load the booking interface.</p>
              )}

              {availabilityData?.eventType && (
                <div className="mt-7 rounded-[1.75rem] border border-[#8dbeb8]/20 bg-[linear-gradient(180deg,rgba(141,190,184,0.1),rgba(94,58,140,0.08),rgba(255,255,255,0.03))] p-5 text-sm text-[#d7cec0]">
                  <p className="text-[11px] uppercase tracking-[0.24em] text-[#8dbeb8]">Live configuration</p>
                  <p className="mt-3 font-medium text-[#f3efe7]">{availabilityData.eventType.name}</p>
                  <div className="mt-3 space-y-1 text-[#c6cfcc]">
                    <p>Live duration: {availabilityData.eventType.duration_minutes} min</p>
                    <p>Timezone: {availabilityData.timezone}</p>
                  </div>
                </div>
              )}

              {bookingResult && selectedSlot && (
                <div className="mt-7 rounded-[1.75rem] border border-[#8dbeb8]/28 bg-[linear-gradient(180deg,rgba(90,199,191,0.16),rgba(90,199,191,0.08))] p-5 shadow-[0_18px_50px_rgba(37,104,112,0.2)]">
                  <div className="flex items-center gap-3 text-[#d3fbf7]">
                    <Check className="h-5 w-5" />
                    <p className="font-medium">Booking confirmed</p>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-[#e8fffb]/90">
                    {format(selectedSlot.start, "EEEE, MMMM d")} at {formatTime(selectedSlot.start, timezone)} is locked in. A confirmation is on its way to {email}.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-[2rem] border-white/10 bg-[linear-gradient(180deg,#121820,#0f1217)] text-[#f3efe7] shadow-[0_24px_80px_rgba(0,0,0,0.3)]">
            <CardContent className="p-8">
              {!selectedTreatment && (
                <div className="rounded-[1.9rem] border border-dashed border-white/10 bg-white/[0.02] px-6 py-16 text-center">
                  <p className="text-lg font-medium">Choose a treatment to begin.</p>
                  <p className="mt-3 text-sm text-[#c8c1b6]">Availability will load here from the existing backend as soon as you select one.</p>
                </div>
              )}

              {selectedTreatment && loadingAvailability && (
                <div className="flex min-h-[18rem] items-center justify-center rounded-[1.9rem] border border-white/10 bg-white/[0.02]">
                  <div className="flex items-center gap-3 text-[#d7cec0]">
                    <Loader2 className="h-5 w-5 animate-spin text-[#8dbeb8]" />
                    <span>Loading live availability</span>
                  </div>
                </div>
              )}

              {selectedTreatment && availabilityError && !loadingAvailability && (
                <div className="rounded-[1.9rem] border border-red-400/25 bg-red-400/10 px-6 py-8">
                  <p className="font-medium text-red-100">Availability could not be loaded.</p>
                  <p className="mt-2 text-sm text-red-100/80">{availabilityError}</p>
                </div>
              )}

              {selectedTreatment && availabilityData && !loadingAvailability && (
                <div className="space-y-8">
                  <div className="grid gap-8 xl:grid-cols-[0.95fr_1.05fr]">
                    <div className="rounded-[1.75rem] border border-white/8 bg-black/20 p-5 sm:p-6">
                      <div className="mb-5 flex items-center justify-between">
                        <p className="text-[11px] uppercase tracking-[0.24em] text-white/45">1. Pick a date</p>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="rounded-full text-[#f3efe7] hover:bg-white/[0.07] hover:text-[#bfeae5]"
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
                            className="rounded-full text-[#f3efe7] hover:bg-white/[0.07] hover:text-[#bfeae5]"
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
                                "h-12 rounded-2xl border text-sm transition duration-200",
                                isAvailable && !isPast
                                  ? "cursor-pointer border-white/10 bg-white/[0.04] text-[#f3efe7] hover:border-[#8dbeb8]/55 hover:bg-[#8dbeb8]/12"
                                  : "cursor-default border-transparent bg-transparent text-white/20",
                                isSameDay(day, new Date()) && "border-white/20",
                                isSelected && "border-[#8dbeb8] bg-[linear-gradient(135deg,#8dbeb8,#c6ece8)] text-[#071014] shadow-[0_12px_30px_rgba(86,183,175,0.22)] hover:brightness-105"
                              )}
                            >
                              {format(day, "d")}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="rounded-[1.75rem] border border-white/8 bg-black/20 p-5 sm:p-6">
                      <p className="mb-5 text-[11px] uppercase tracking-[0.24em] text-white/45">2. Pick a time</p>
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
                                    "rounded-2xl border px-4 py-3 text-sm transition duration-200",
                                    isSelected
                                      ? "border-[#8dbeb8] bg-[linear-gradient(135deg,#8dbeb8,#c6ece8)] text-[#071014] shadow-[0_12px_30px_rgba(86,183,175,0.18)]"
                                      : "border-white/10 bg-white/[0.04] text-[#f3efe7] hover:border-[#8dbeb8]/50 hover:bg-white/[0.08]"
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

                  <div className="rounded-[1.9rem] border border-white/8 bg-black/20 p-6 sm:p-7">
                    <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.24em] text-white/45">3. Complete booking</p>
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
                          className="border-white/10 bg-white/[0.04] text-[#f3efe7] placeholder:text-white/30 focus-visible:ring-[#8dbeb8]/60"
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
                          className="border-white/10 bg-white/[0.04] text-[#f3efe7] placeholder:text-white/30 focus-visible:ring-[#8dbeb8]/60"
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
                              className="border-white/10 bg-white/[0.04] text-[#f3efe7] placeholder:text-white/30 focus-visible:ring-[#8dbeb8]/60"
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
                              className="border-white/10 bg-white/[0.04] text-[#f3efe7] placeholder:text-white/30 focus-visible:ring-[#8dbeb8]/60"
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
                          className="border-white/10 bg-white/[0.04] text-[#f3efe7] placeholder:text-white/30 focus-visible:ring-[#8dbeb8]/60"
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
                          className="h-11 rounded-full border border-[#8dbeb8]/60 bg-[linear-gradient(135deg,#8dbeb8,#c6ece8)] px-6 text-[#071014] shadow-[0_12px_35px_rgba(86,183,175,0.2)] hover:brightness-105"
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
