"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
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
import { ArrowRight, CheckCircle2, ChevronLeft, ChevronRight, Loader2, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn, formatTime } from "@/lib/utils";
import type { CustomQuestion } from "@/types";

type TreatmentConfig = {
  title: string;
  subtitle: string;
  slug: string;
  description: string;
  bullets: string[];
  cta: string;
  durationLabel: string;
  priceLabel: string;
  secondaryPriceLabel?: string;
  supportCue: string;
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

type ActiveTreatment = TreatmentConfig & {
  eventType: EventTypeInfo;
};

type AvailabilityResponse = {
  eventType: EventTypeInfo;
  customQuestions: CustomQuestion[];
  timezone: string;
  availability: Record<string, { start: string; end: string }[]>;
  error?: string;
};

type BookingResponse = {
  booking: {
    id: string;
    start_time: string;
    end_time: string;
    google_meet_link?: string | null;
  };
  error?: string;
};

const TREATMENT_CONFIG: TreatmentConfig[] = [
  {
    title: "Clarity Cut",
    subtitle: "30 min clarity call",
    slug: "30-min-consultation",
    description:
      "A focused first conversation to understand where you're stuck, what's been tried, and what kind of prioritization help would make the biggest difference.",
    bullets: ["Understand the situation", "Clarify where you're stuck", "Find the right next step"],
    cta: "Book Clarity Cut",
    durationLabel: "30 min",
    priceLabel: "Free",
    supportCue: "Good first step",
  },
  {
    title: "Priority Reset",
    subtitle: "60 min deep cut",
    slug: "backlog-audit",
    description:
      "A focused session to step back, reconnect current initiatives to business goals and strategic direction, and challenge what is truly worth prioritising now.",
    bullets: ["Reconnect initiatives to real goals", "Expose false urgency", "Create sharper focus"],
    cta: "Book Priority Reset",
    durationLabel: "60 min",
    priceLabel: "5,000 SEK",
    supportCue: "Focused intervention",
  },
  {
    title: "Chaos -> Clarity Workshop",
    subtitle: "2.5h full treatment",
    slug: "prioritization-workshop",
    description:
      "A working session to build prioritization logic leadership can actually trust, using your real constraints, trade-offs, and business goals.",
    bullets: ["Build a decision model", "Align on shared criteria", "Create roadmap clarity"],
    cta: "Book the Workshop",
    durationLabel: "2.5h",
    priceLabel: "First 3 free",
    secondaryPriceLabel: "Then 15,000 SEK",
    supportCue: "Launch offer",
  },
];

const PROBLEM_STRIP = [
  "Too many priorities",
  "No shared decision logic",
  "Teams busy, outcomes blurry",
  "Roadmaps full, progress thin",
];

const HOW_IT_WORKS = [
  "Choose your treatment",
  "Pick a time",
  "Share your chaos",
  "Leave with sharper priorities",
];

export default function BarbershopPageClient({ campaign }: { campaign: string | null }) {
  const treatmentsRef = useRef<HTMLElement | null>(null);
  const bookingRef = useRef<HTMLElement | null>(null);
  const howItWorksRef = useRef<HTMLElement | null>(null);

  const [activeTreatments, setActiveTreatments] = useState<ActiveTreatment[]>([]);
  const [treatmentsLoading, setTreatmentsLoading] = useState(true);
  const [treatmentsError, setTreatmentsError] = useState<string | null>(null);
  const [selectedTreatment, setSelectedTreatment] = useState<ActiveTreatment | null>(null);
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
  const [bookingResult, setBookingResult] = useState<BookingResponse["booking"] | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function loadActiveTreatments() {
      setTreatmentsLoading(true);
      setTreatmentsError(null);

      try {
        const response = await fetch("/api/event-types?all=true");

        if (!response.ok) {
          throw new Error("Could not load active event types.");
        }

        const eventTypes: EventTypeInfo[] = await response.json();
        const mappedSlugs = new Set(TREATMENT_CONFIG.map((treatment) => treatment.slug));
        const activeMappedEventTypes = eventTypes.filter((eventType) => mappedSlugs.has(eventType.slug));
        const eventTypeBySlug = new Map(activeMappedEventTypes.map((eventType) => [eventType.slug, eventType]));

        const responses = TREATMENT_CONFIG.map((treatment) => {
          const eventType = eventTypeBySlug.get(treatment.slug);
          return eventType ? { ...treatment, eventType } : null;
        });

        if (isCancelled) {
          return;
        }

        const visibleTreatments = responses.filter((item): item is ActiveTreatment => item !== null);
        setActiveTreatments(visibleTreatments);
        setSelectedTreatment((current) => {
          if (current) {
            const stillActive = visibleTreatments.find((item) => item.slug === current.slug);
            if (stillActive) {
              return stillActive;
            }
          }

          return visibleTreatments[0] ?? null;
        });
      } catch (error) {
        if (!isCancelled) {
          setTreatmentsError(error instanceof Error ? error.message : "Could not load available treatments.");
          setActiveTreatments([]);
          setSelectedTreatment(null);
        }
      } finally {
        if (!isCancelled) {
          setTreatmentsLoading(false);
        }
      }
    }

    void loadActiveTreatments();

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedTreatment) {
      setAvailabilityData(null);
      setAvailabilityError(null);
      setLoadingAvailability(false);
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
    setCurrentMonth(new Date());

    fetch(`/api/availability?slug=${selectedTreatment.slug}`, { signal: controller.signal })
      .then(async (response) => {
        const result: AvailabilityResponse = await response.json();

        if (!response.ok || result.error) {
          throw new Error(result.error || "Could not load availability.");
        }

        const initialAnswers: Record<string, string> = {};
        for (const question of result.customQuestions || []) {
          initialAnswers[question.id] = "";
        }

        setAnswers(initialAnswers);
        setAvailabilityData(result);
      })
      .catch((error: Error) => {
        if (error.name !== "AbortError") {
          setAvailabilityError(error.message || "Could not load availability.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoadingAvailability(false);
        }
      });

    return () => controller.abort();
  }, [selectedTreatment]);

  const timezone = availabilityData?.timezone || "Europe/Stockholm";
  const availability = availabilityData?.availability || {};
  const selectedSlots = selectedDate ? availability[selectedDate] || [] : [];
  const availableDates = new Set(Object.keys(availability));
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startOffset = (getDay(monthStart) + 6) % 7;

  function handleTreatmentSelectAndScroll(treatment: ActiveTreatment) {
    setSelectedTreatment(treatment);
    bookingRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleDateSelect(date: string) {
    setSelectedDate(date);
    setSelectedSlot(null);
    setSubmitError(null);
    setBookingResult(null);
  }

  function updateAnswer(questionId: string, value: string) {
    setAnswers((previous) => ({ ...previous, [questionId]: value }));
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
          campaign: campaign ?? null,
        }),
      });

      const result: BookingResponse = await response.json();

      if (!response.ok || result.error) {
        throw new Error(result.error || "Could not complete booking.");
      }

      setBookingResult(result.booking);
      setSubmitError(null);
      bookingRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Could not complete booking.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#071018] text-[#f5f1e8]">
      <div className="absolute inset-x-0 top-0 h-[34rem] bg-[radial-gradient(circle_at_top,rgba(82,196,191,0.16),transparent_42%),radial-gradient(circle_at_80%_12%,rgba(82,112,196,0.12),transparent_25%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent_60%)]" />
      <div className="absolute inset-x-0 top-[18rem] h-[52rem] bg-[linear-gradient(180deg,rgba(7,16,24,0),rgba(7,16,24,0.68)_35%,rgba(7,16,24,1))]" />

      <section className="relative mx-auto max-w-7xl px-6 pb-20 pt-8 sm:px-8 lg:px-12 lg:pb-28 lg:pt-12">
        <a
          href="https://techchange.io/"
          className="mb-6 inline-flex items-center border border-white/10 bg-[#0c141b]/88 px-3.5 py-2 text-sm font-medium tracking-[0.02em] text-[#d9e2df] transition-colors hover:border-[#7cd0c7]/30 hover:bg-[#111b23] hover:text-[#f5f1e8] sm:mb-8"
        >
          ← Back to Tech &amp; Change
        </a>

        <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="max-w-3xl">
            <p className="text-[11px] uppercase tracking-[0.34em] text-[#8acfc7]">TECH &amp; CHANGE presents</p>
            <h1 className="mt-5 font-serif text-[2.7rem] leading-[0.92] tracking-[-0.05em] text-[#fbf7f0] sm:text-[4rem] lg:text-[5.4rem]">
              Welcome to the Priority Barbershop
            </h1>
            <div className="mt-7 max-w-2xl space-y-4 text-[1.05rem] leading-[1.48] text-[#dde5e3] sm:text-[1.2rem]">
              <p className="text-[1.2rem] font-medium leading-[1.35] text-[#f5f1e8] sm:text-[1.45rem]">
                Trim the noise. Keep the signal.
              </p>
              <p>Choose the session that fits the kind of mess you are in, then book directly on this page.</p>
            </div>

            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <Button
                className="h-12 min-h-[44px] rounded-full border border-[#7cd0c7]/60 bg-[linear-gradient(135deg,#73cbc3,#c5efea)] px-6 text-base font-medium text-[#071018] shadow-[0_16px_44px_rgba(76,195,187,0.24)] hover:brightness-105"
                onClick={() => {
                  treatmentsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
              >
                Choose your treatment
                <ArrowRight className="h-4 w-4" />
              </Button>

              <Button
                variant="outline"
                className="h-12 min-h-[44px] rounded-full border-white/12 bg-white/[0.04] px-6 text-base text-[#f5f1e8] hover:border-[#7cd0c7]/45 hover:bg-white/[0.08]"
                onClick={() => {
                  howItWorksRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
              >
                See how it works
              </Button>
            </div>
          </div>

          <Card className="relative overflow-hidden rounded-[2rem] border-white/10 bg-[linear-gradient(180deg,#111a23,#0a1016)] shadow-[0_24px_90px_rgba(0,0,0,0.42)]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(124,208,199,0.13),transparent_25%),radial-gradient(circle_at_80%_14%,rgba(79,96,180,0.18),transparent_28%)]" />
            <CardContent className="relative p-4 sm:p-5">
              <div className="relative aspect-[4/5] overflow-hidden rounded-[1.7rem] border border-white/10 bg-black">
                <Image
                  src="/mikaelf/armar_kors_3_HERO.png"
                  alt="Portrait of Mikael Feltenmark"
                  fill
                  className="object-cover object-[54%_22%]"
                  sizes="(min-width: 1024px) 38vw, 100vw"
                  priority
                />
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,10,0.05),rgba(2,6,10,0.2)_42%,rgba(2,6,10,0.5)),radial-gradient(circle_at_22%_18%,rgba(124,208,199,0.12),transparent_26%)]" />
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="relative mx-auto max-w-7xl px-6 py-4 sm:px-8 lg:px-12">
        <p className="mb-4 text-base font-medium leading-6 text-[#aeb4bc]">Typical situations</p>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {PROBLEM_STRIP.map((item) => (
            <div
              key={item}
              className="rounded-[1.4rem] border border-[#666666]/32 bg-[linear-gradient(180deg,rgba(102,102,102,0.12),rgba(255,255,255,0.03))] px-5 py-4 text-base uppercase tracking-[0.12em] text-[#e3e5ec] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
            >
              {item}
            </div>
          ))}
        </div>
      </section>

      <section ref={treatmentsRef} className="relative mx-auto max-w-7xl px-6 py-20 sm:px-8 lg:px-12 lg:py-28">
        <div className="mb-12 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.32em] text-[#8acfc7]">Treatments</p>
            <h2 className="mt-4 font-serif text-[1.85rem] tracking-[-0.04em] text-[#fbf7f0] sm:text-[2.3rem]">
              Choose the treatment that fits the kind of mess you are in.
            </h2>
          </div>
          <p className="max-w-2xl text-base leading-[1.48] text-[#c6d1cf]">
            Choose the format that fits the kind of prioritization mess you are in right now.
          </p>
        </div>

        {treatmentsLoading ? (
          <div className="flex min-h-[14rem] items-center justify-center rounded-[2rem] border border-white/10 bg-white/[0.03]">
            <div className="flex items-center gap-3 text-[#dbe6e3]">
              <Loader2 className="h-5 w-5 animate-spin text-[#8acfc7]" />
              <span>Loading available treatments</span>
            </div>
          </div>
        ) : treatmentsError ? (
          <div className="rounded-[2rem] border border-red-400/20 bg-red-400/10 px-6 py-8 text-red-100">
            <p className="font-medium">Treatments could not be loaded.</p>
            <p className="mt-2 text-base leading-7 text-red-100/80">{treatmentsError}</p>
          </div>
        ) : activeTreatments.length === 0 ? (
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] px-6 py-10 text-center">
            <p className="text-lg font-medium text-[#f5f1e8]">No treatments are currently available.</p>
            <p className="mt-3 text-base leading-8 text-[#c6d1cf]">
              The page is respecting the current active event types in Bookme, so inactive treatments are hidden
              automatically.
            </p>
          </div>
        ) : (
          <div className={cn("grid gap-6", activeTreatments.length === 1 ? "max-w-3xl" : activeTreatments.length === 2 ? "lg:grid-cols-2" : "lg:grid-cols-3")}>
            {activeTreatments.map((treatment) => {
              const isSelected = selectedTreatment?.slug === treatment.slug;

              return (
                <Card
                  key={treatment.slug}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isSelected}
                  onClick={() => setSelectedTreatment(treatment)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedTreatment(treatment);
                    }
                  }}
                  className={cn(
                    "group relative overflow-hidden rounded-[2rem] border bg-[linear-gradient(180deg,#141d27,#0c1218)] text-[#f5f1e8] shadow-[0_26px_80px_rgba(0,0,0,0.34)] transition duration-300 hover:-translate-y-1 hover:border-[#8acfc7]/34 hover:shadow-[0_36px_90px_rgba(0,0,0,0.4)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8acfc7]/50",
                    isSelected
                      ? "border-[#8f68bb] bg-[linear-gradient(180deg,#241d31,#181d29)] shadow-[0_0_0_1px_rgba(179,138,224,0.34),0_0_40px_rgba(94,58,140,0.22),0_40px_120px_rgba(30,20,45,0.58)]"
                      : "border-white/10"
                  )}
                >
                  <div
                    className={cn(
                      "absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_38%)]",
                      isSelected && "bg-[radial-gradient(circle_at_top,rgba(94,58,140,0.4),transparent_44%)]"
                    )}
                  />
                  <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
                  <CardContent className="relative flex h-full flex-col p-7 sm:p-8">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-base font-medium leading-6 text-[#bbddd9]">{treatment.subtitle}</p>
                        <h3 className="mt-3 text-[1.45rem] font-semibold tracking-[-0.03em] text-[#fbf7f0]">
                          {treatment.title}
                        </h3>
                      </div>
                      {isSelected ? (
                        <div className="rounded-full border border-[#c8a7ee]/45 bg-[#5e3a8c]/24 px-3 py-1 text-base leading-6 text-[#f7efff]">
                          Selected
                        </div>
                      ) : null}
                    </div>

                    <div className="mt-5 grid gap-2.5">
                      <div className="flex flex-wrap gap-3 text-base leading-6">
                        <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-[#f5f1e8]">
                          {treatment.durationLabel}
                        </span>
                        <span
                          className={cn(
                            "rounded-full border px-3 py-1.5 font-medium",
                            treatment.slug === "30-min-consultation"
                              ? "border-[#8acfc7]/34 bg-[#8acfc7]/12 text-[#dcfbf7]"
                              : "border-[#8f68bb]/40 bg-[#5e3a8c]/24 text-[#f0e3ff]"
                          )}
                        >
                          {treatment.priceLabel}
                        </span>
                        <span className="rounded-full border border-[#666666]/40 bg-[#666666]/10 px-3 py-1.5 text-[#dedede]">
                          {treatment.supportCue}
                        </span>
                      </div>
                      {treatment.secondaryPriceLabel ? (
                        <div className="rounded-[1rem] border border-[#8f68bb]/40 bg-[linear-gradient(135deg,rgba(94,58,140,0.24),rgba(0,0,0,0.2))] px-4 py-3 text-base font-medium leading-7 text-[#f3e8ff]">
                          3 FREE SPOTS REMAINING
                          <span className="ml-2 text-[#d9cdee]">{treatment.secondaryPriceLabel}</span>
                        </div>
                      ) : null}
                    </div>

                    <p className={cn("mt-5 text-base leading-[1.48] text-[#cfd7d8]", isSelected && "text-[#e7e0ef]")}>{treatment.description}</p>

                    <div
                      className={cn(
                        "mt-6 rounded-[1.45rem] border p-5",
                        isSelected
                          ? "border-[#8f68bb]/40 bg-[linear-gradient(180deg,rgba(94,58,140,0.18),rgba(0,0,0,0.28))]"
                          : "border-white/10 bg-black/20"
                      )}
                    >
                      <div className={cn("space-y-2.5 text-base leading-[1.42] text-[#edf4f2]", isSelected && "text-[#f6efff]")}>
                        {treatment.bullets.map((bullet) => (
                          <div key={bullet} className="flex items-start gap-3">
                            <div className={cn("mt-2 h-2 w-2 rounded-full bg-[#8acfc7]", isSelected && "bg-[#caaeff] shadow-[0_0_14px_rgba(202,174,255,0.8)]")} />
                            <span>{bullet}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <Button
                      className={cn(
                        "mt-8 h-12 min-h-[44px] w-full rounded-full border px-5 text-base transition duration-200",
                        isSelected
                          ? "border-[#8acfc7]/60 bg-[linear-gradient(135deg,#73cbc3,#c5efea)] text-[#071018] shadow-[0_14px_36px_rgba(76,195,187,0.2)] hover:brightness-105"
                          : "border-white/14 bg-white/[0.06] text-[#f5f1e8] hover:border-[#8acfc7]/45 hover:bg-white/[0.1]"
                      )}
                      onClick={(event) => {
                        event.stopPropagation();
                        handleTreatmentSelectAndScroll(treatment);
                      }}
                    >
                      {treatment.cta}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <section className="relative mx-auto max-w-7xl px-6 py-8 sm:px-8 lg:px-12 lg:py-12">
        <Card className="relative overflow-hidden rounded-[2rem] border-white/10 bg-[linear-gradient(180deg,#10171f,#0a1016)] text-[#f5f1e8] shadow-[0_24px_80px_rgba(0,0,0,0.3)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(138,207,199,0.09),transparent_22%),radial-gradient(circle_at_12%_18%,rgba(91,110,194,0.14),transparent_26%)]" />
          <div className="absolute inset-y-6 right-6 hidden w-[34%] overflow-hidden rounded-[1.7rem] border border-white/10 bg-black lg:block">
            <Image
              src="/mikaelf/armar_i_sidan_1.png"
              alt="Portrait of Mikael Feltenmark"
              fill
              className="object-cover object-[52%_24%]"
              sizes="(min-width: 1024px) 24vw, 100vw"
            />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,10,0.06),rgba(2,6,10,0.2)_40%,rgba(2,6,10,0.5))]" />
          </div>
          <CardContent className="relative p-8 sm:p-10 lg:max-w-[60%]">
            <p className="text-xs uppercase tracking-[0.32em] text-[#8acfc7]">Expert</p>
            <h2 className="mt-4 font-serif text-[1.85rem] tracking-[-0.04em] text-[#fbf7f0] sm:text-[2.3rem]">
              Meet your Chief Priority Officer
            </h2>
            <div className="mt-6 max-w-3xl space-y-5 text-base leading-[1.48] text-[#d7e0dd] sm:text-[1.05rem]">
              <p className="text-[1.15rem] font-semibold text-[#fbf7f0]">Mikael Feltenmark</p>
              <p>
                For more than 30 years, I have worked where business goals, technology reality, and difficult
                trade-offs collide. I step in when everything feels important, teams are overloaded, and leaders need
                a clearer way to decide what actually matters now.
              </p>
              <p>
                The method is always the same: find what drives the most value, remove what does not, and leave the team
                with fewer priorities they can actually trust.
              </p>
              <p className="text-[#fbf7f0]">This is not a generic booking page. It is a direct path into that work.</p>
            </div>

            <div className="relative mt-8 overflow-hidden rounded-[1.5rem] border border-white/10 bg-black lg:hidden">
              <div className="relative aspect-[4/5] w-full">
                <Image
                  src="/mikaelf/armar_i_sidan_1.png"
                  alt="Portrait of Mikael Feltenmark"
                  fill
                  className="object-cover object-[50%_20%]"
                  sizes="100vw"
                />
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,10,0.04),rgba(2,6,10,0.2)_40%,rgba(2,6,10,0.42))]" />
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section ref={howItWorksRef} className="relative mx-auto max-w-7xl px-6 py-20 sm:px-8 lg:px-12 lg:py-28">
        <div className="mb-10">
          <p className="text-xs uppercase tracking-[0.32em] text-[#8acfc7]">How it works</p>
          <h2 className="mt-4 font-serif text-[1.85rem] tracking-[-0.04em] text-[#fbf7f0] sm:text-[2.3rem]">
            A simple path from problem to booked session.
          </h2>
        </div>

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {HOW_IT_WORKS.map((step, index) => (
            <Card key={step} className="rounded-[1.7rem] border-white/10 bg-[linear-gradient(180deg,#111922,#0c1218)] text-[#f5f1e8]">
              <CardContent className="p-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#8acfc7]/30 bg-[#8acfc7]/10 text-[11px] uppercase tracking-[0.22em] text-[#dff7f4]">
                  {String(index + 1).padStart(2, "0")}
                </div>
                <p className="mt-5 text-[1rem] font-medium tracking-[-0.02em]">{step}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section ref={bookingRef} className="relative mx-auto max-w-7xl px-6 pb-24 sm:px-8 lg:px-12 lg:pb-32">
        <div className="mb-12 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.32em] text-[#8acfc7]">Booking</p>
            <h2 className="mt-4 font-serif text-[1.85rem] tracking-[-0.04em] text-[#fbf7f0] sm:text-[2.3rem]">
              Book your session on this page.
            </h2>
          </div>
          <p className="max-w-2xl text-base leading-[1.48] text-[#c6d1cf]">
            Choose a treatment to see live availability and book directly on this page.
          </p>
        </div>

        <div className="grid gap-7 xl:grid-cols-[0.78fr_1.22fr]">
          <Card className="rounded-[2rem] border-white/10 bg-[linear-gradient(180deg,#111922,#0a1016)] text-[#f5f1e8] shadow-[0_22px_70px_rgba(0,0,0,0.28)]">
            <CardContent className="p-8">
              <p className="text-[11px] uppercase tracking-[0.26em] text-[#8acfc7]">Selected treatment</p>

              {selectedTreatment ? (
                <div className="mt-5 rounded-[1.7rem] border border-[#8acfc7]/18 bg-[linear-gradient(180deg,rgba(94,58,140,0.18),rgba(138,207,199,0.1),rgba(255,255,255,0.03))] p-6">
                  <p className="text-base font-medium leading-6 text-[#c8ece8]">{selectedTreatment.subtitle}</p>
                  <h3 className="mt-3 text-[1.55rem] font-semibold tracking-[-0.03em] text-[#fbf7f0]">{selectedTreatment.title}</h3>
                  <div className="mt-4 flex flex-wrap gap-3 text-base leading-6">
                    <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-[#f5f1e8]">
                      {selectedTreatment.durationLabel}
                    </span>
                    <span className="rounded-full border border-[#5e3a8c]/34 bg-[#5e3a8c]/14 px-3 py-1.5 text-[#eadfff]">
                      {selectedTreatment.priceLabel}
                    </span>
                    {selectedTreatment.secondaryPriceLabel ? (
                      <span className="rounded-full border border-[#8acfc7]/22 bg-[#8acfc7]/10 px-3 py-1.5 text-[#dff7f4]">
                        {selectedTreatment.secondaryPriceLabel}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-3 text-base leading-[1.46] text-[#d5dfdc]">{selectedTreatment.description}</p>
                </div>
              ) : (
                <div className="mt-5 rounded-[1.7rem] border border-dashed border-white/10 bg-white/[0.03] px-5 py-8 text-base leading-7 text-[#c6d1cf]">
                  Choose a treatment above to start booking.
                </div>
              )}

              {bookingResult && selectedSlot ? (
                <div className="mt-6 rounded-[1.7rem] border border-[#8acfc7]/28 bg-[linear-gradient(180deg,rgba(138,207,199,0.16),rgba(138,207,199,0.08))] p-5">
                  <div className="flex items-center gap-3 text-[#e2fffb]">
                    <CheckCircle2 className="h-5 w-5" />
                    <p className="font-medium">Booking completed</p>
                  </div>
                  <p className="mt-3 text-base leading-7 text-[#ebfffc]/88">
                    Your booking request has been completed for {format(selectedSlot.start, "EEEE, MMMM d")} at{" "}
                    {formatTime(selectedSlot.start, timezone)}. A confirmation will be sent to {email}.
                  </p>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="rounded-[2rem] border-white/10 bg-[linear-gradient(180deg,#131c25,#0c1218)] text-[#f5f1e8] shadow-[0_24px_80px_rgba(0,0,0,0.3)]">
            <CardContent className="p-8">
              {treatmentsLoading ? (
                <div className="flex min-h-[18rem] items-center justify-center rounded-[1.8rem] border border-white/10 bg-white/[0.03]">
                  <div className="flex items-center gap-3 text-[#dbe6e3]">
                    <Loader2 className="h-5 w-5 animate-spin text-[#8acfc7]" />
                    <span>Preparing booking</span>
                  </div>
                </div>
              ) : !selectedTreatment ? (
                <div className="rounded-[1.8rem] border border-dashed border-white/10 bg-white/[0.03] px-6 py-14 text-center">
                  <p className="text-lg font-medium text-[#f5f1e8]">No active treatment selected.</p>
                  <p className="mt-3 text-base leading-8 text-[#c6d1cf]">
                    This section will activate automatically when there is at least one active mapped event type.
                  </p>
                </div>
              ) : loadingAvailability ? (
                <div className="flex min-h-[18rem] items-center justify-center rounded-[1.8rem] border border-white/10 bg-white/[0.03]">
                  <div className="flex items-center gap-3 text-[#dbe6e3]">
                    <Loader2 className="h-5 w-5 animate-spin text-[#8acfc7]" />
                    <span>Loading live availability</span>
                  </div>
                </div>
              ) : availabilityError ? (
                <div className="rounded-[1.8rem] border border-red-400/20 bg-red-400/10 px-6 py-8 text-red-100">
                  <p className="font-medium">Availability could not be loaded.</p>
                  <p className="mt-2 text-base leading-7 text-red-100/80">{availabilityError}</p>
                </div>
              ) : availabilityData ? (
                <div className="space-y-8">
                  {bookingResult && selectedSlot ? (
                    <div className="rounded-[1.9rem] border border-[#8acfc7]/24 bg-[linear-gradient(180deg,rgba(16,39,40,0.72),rgba(11,20,26,0.96))] p-6 sm:p-8">
                      <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
                        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-[#8acfc7]/35 bg-[linear-gradient(180deg,rgba(138,207,199,0.18),rgba(138,207,199,0.08))]">
                          <CheckCircle2 className="h-8 w-8 text-[#dff7f4]" />
                        </div>
                        <h3 className="text-[1.8rem] font-semibold tracking-[-0.03em] text-[#fbf7f0]">Booking confirmed</h3>
                        <p className="mt-3 max-w-xl text-base leading-7 text-[#d6e6e2]">
                          Your booking has been confirmed. A confirmation has been sent to {email}.
                        </p>

                        <div className="mt-6 w-full rounded-[1.4rem] border border-white/10 bg-white/[0.04] p-5 text-left">
                          <p className="text-lg font-semibold text-[#fbf7f0]">{availabilityData.eventType.name}</p>
                          <p className="mt-2 text-base leading-7 text-[#cdd7d4]">
                            {format(selectedSlot.start, "EEEE, MMMM d, yyyy")}
                          </p>
                          <p className="text-base leading-7 text-[#cdd7d4]">
                            {formatTime(selectedSlot.start, timezone)} - {formatTime(selectedSlot.end, timezone)}
                          </p>
                          {bookingResult.google_meet_link ? (
                            <a
                              href={bookingResult.google_meet_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-3 inline-flex items-center gap-2 text-base font-medium text-[#8acfc7] hover:text-[#dff7f4]"
                            >
                              <Video className="h-4 w-4" />
                              Open Google Meet
                            </a>
                          ) : null}
                        </div>

                        {availabilityData.eventType.confirmation_message ? (
                          <div className="mt-6 w-full rounded-[1.4rem] border border-[#8acfc7]/18 bg-[linear-gradient(180deg,rgba(138,207,199,0.12),rgba(255,255,255,0.03))] p-5 text-left">
                            {availabilityData.eventType.confirmation_message.split("\n").map((line, index) => (
                              <p key={`${availabilityData.eventType.id}-confirmation-${index}`} className="text-base leading-7 text-[#e5f4f1]">
                                {line}
                              </p>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="grid gap-8 xl:grid-cols-[0.98fr_1.02fr]">
                        <div className="rounded-[1.7rem] border border-white/8 bg-black/20 p-5 sm:p-6">
                          <div className="mb-5 flex items-center justify-between gap-4">
                            <p className="text-base font-medium leading-6 text-[#dfe6e5]">1. Pick a date</p>
                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="rounded-full text-[#f5f1e8] hover:bg-white/[0.07] hover:text-[#c8ece8]"
                                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                              >
                                <ChevronLeft className="h-4 w-4" />
                              </Button>
                              <span className="text-base uppercase tracking-[0.16em] text-[#d5dfdc]">{format(currentMonth, "MMMM yyyy")}</span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="rounded-full text-[#f5f1e8] hover:bg-white/[0.07] hover:text-[#c8ece8]"
                                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                              >
                                <ChevronRight className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>

                          <div className="mb-2 grid grid-cols-7 gap-2 text-center text-base uppercase tracking-[0.08em] text-white/45">
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
                                    "h-12 rounded-2xl border text-base transition duration-200",
                                    isAvailable && !isPast
                                      ? "cursor-pointer border-white/10 bg-white/[0.04] text-[#f5f1e8] hover:border-[#8acfc7]/55 hover:bg-[#8acfc7]/12"
                                      : "cursor-default border-transparent bg-transparent text-white/20",
                                    isSameDay(day, new Date()) && "border-white/20",
                                    isSelected && "border-[#8acfc7] bg-[linear-gradient(135deg,#73cbc3,#c5efea)] text-[#071018] shadow-[0_12px_30px_rgba(76,195,187,0.22)]"
                                  )}
                                >
                                  {format(day, "d")}
                                </button>
                              );
                            })}
                          </div>

                          {Object.keys(availability).length === 0 ? (
                            <div className="mt-5 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-4 text-base leading-7 text-[#c6d1cf]">
                              No open dates are available right now.
                            </div>
                          ) : null}
                        </div>

                        <div className="rounded-[1.7rem] border border-white/8 bg-black/20 p-5 sm:p-6">
                          <p className="mb-5 text-base font-medium leading-6 text-[#dfe6e5]">2. Pick a time</p>
                          {selectedDate ? (
                            selectedSlots.length > 0 ? (
                              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                                {selectedSlots.map((slot) => {
                                  const start = new Date(slot.start);
                                  const end = new Date(slot.end);
                                  const isSelected = selectedSlot?.start.toISOString() === start.toISOString();

                                  return (
                                    <button
                                      key={slot.start}
                                      type="button"
                                      onClick={() => {
                                        setSelectedSlot({ start, end });
                                        setBookingResult(null);
                                        setSubmitError(null);
                                      }}
                                      className={cn(
                                        "rounded-2xl border px-4 py-3 text-base transition duration-200",
                                        isSelected
                                          ? "border-[#8acfc7] bg-[linear-gradient(135deg,#73cbc3,#c5efea)] text-[#071018] shadow-[0_12px_30px_rgba(76,195,187,0.18)]"
                                          : "border-white/10 bg-white/[0.04] text-[#f5f1e8] hover:border-[#8acfc7]/50 hover:bg-white/[0.08]"
                                      )}
                                    >
                                      {formatTime(start, timezone)}
                                    </button>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-8 text-base leading-8 text-[#c6d1cf]">
                                No open slots on this date.
                              </div>
                            )
                          ) : (
                            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-8 text-base leading-8 text-[#c6d1cf]">
                              Pick a date to reveal available times.
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="rounded-[1.8rem] border border-white/8 bg-black/20 p-6 sm:p-7">
                        <div className="mb-6">
                          <p className="text-base font-medium leading-6 text-[#dfe6e5]">3. Complete booking</p>
                          {selectedSlot ? (
                            <p className="mt-2 text-base leading-8 text-[#d5dfdc]">
                              {format(selectedSlot.start, "EEEE, MMMM d")} at {formatTime(selectedSlot.start, timezone)}
                            </p>
                          ) : (
                            <p className="mt-2 text-base leading-8 text-[#c6d1cf]">Select a time before submitting the form.</p>
                          )}
                        </div>

                        <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
                          <div className="space-y-2">
                            <Label htmlFor="barbershop-name" className="text-[#f5f1e8]">
                              Name
                            </Label>
                            <Input
                              id="barbershop-name"
                              value={name}
                              onChange={(event) => setName(event.target.value)}
                              placeholder="Jane Smith"
                              className="border-white/10 bg-white/[0.04] text-[#f5f1e8] placeholder:text-white/30 focus-visible:ring-[#8acfc7]/60"
                              required
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="barbershop-email" className="text-[#f5f1e8]">
                              Email
                            </Label>
                            <Input
                              id="barbershop-email"
                              type="email"
                              value={email}
                              onChange={(event) => setEmail(event.target.value)}
                              placeholder="jane@example.com"
                              className="border-white/10 bg-white/[0.04] text-[#f5f1e8] placeholder:text-white/30 focus-visible:ring-[#8acfc7]/60"
                              required
                            />
                          </div>

                          {availabilityData.customQuestions.map((question) => (
                            <div key={question.id} className="space-y-2 md:col-span-2">
                              <Label htmlFor={`question-${question.id}`} className="text-[#f5f1e8]">
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
                                  className="border-white/10 bg-white/[0.04] text-[#f5f1e8] placeholder:text-white/30 focus-visible:ring-[#8acfc7]/60"
                                  required={question.is_required}
                                />
                              ) : question.field_type === "select" && question.options ? (
                                <select
                                  id={`question-${question.id}`}
                                  value={answers[question.id] || ""}
                                  onChange={(event) => updateAnswer(question.id, event.target.value)}
                                  className="flex h-10 w-full rounded-md border border-white/10 bg-[#0d141b] px-3 py-2 text-base text-[#f5f1e8] focus:outline-none"
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
                                  className="border-white/10 bg-white/[0.04] text-[#f5f1e8] placeholder:text-white/30 focus-visible:ring-[#8acfc7]/60"
                                  required={question.is_required}
                                />
                              )}
                            </div>
                          ))}

                          <div className="space-y-2 md:col-span-2">
                            <Label htmlFor="barbershop-notes" className="text-[#f5f1e8]">
                              Share your chaos
                            </Label>
                            <Textarea
                              id="barbershop-notes"
                              value={notes}
                              onChange={(event) => setNotes(event.target.value)}
                              placeholder="Give a short sense of the backlog, pressure, or decision tension you want to work through."
                              rows={4}
                              className="border-white/10 bg-white/[0.04] text-[#f5f1e8] placeholder:text-white/30 focus-visible:ring-[#8acfc7]/60"
                            />
                          </div>

                          {submitError ? (
                            <div className="md:col-span-2 rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-base leading-7 text-red-100">
                              {submitError}
                            </div>
                          ) : null}

                          <div className="md:col-span-2 flex justify-end">
                            <Button
                              type="submit"
                              disabled={!isFormValid() || submitting}
                              className="h-12 min-h-[44px] w-full rounded-full border border-[#7cd0c7]/60 bg-[linear-gradient(135deg,#73cbc3,#c5efea)] px-6 text-base font-medium text-[#071018] shadow-[0_14px_36px_rgba(76,195,187,0.2)] hover:brightness-105 sm:w-auto"
                            >
                              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                              Confirm booking
                            </Button>
                          </div>
                        </form>
                      </div>
                    </>
                  )}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}
