import { addMinutes, startOfDay, addDays, format, isBefore, isAfter, parseISO } from "date-fns";
import { toZonedTime, fromZonedTime } from "date-fns-tz";
import type { AvailabilityRule, TimeSlot } from "@/types";

interface AvailabilityParams {
  rules: AvailabilityRule[];
  durationMinutes: number;
  bufferBefore: number;
  bufferAfter: number;
  timezone: string;
  minNoticeHours: number;
  maxDaysAhead: number;
  busySlots: TimeSlot[]; // From Google Calendar + existing bookings
}

/**
 * Calculate available time slots for a date range.
 * Returns slots grouped by date.
 */
export function calculateAvailability(params: AvailabilityParams): Record<string, TimeSlot[]> {
  const {
    rules,
    durationMinutes,
    bufferBefore,
    bufferAfter,
    timezone,
    minNoticeHours,
    maxDaysAhead,
    busySlots,
  } = params;

  const now = new Date();
  const earliest = addMinutes(now, minNoticeHours * 60);
  const latest = addDays(now, maxDaysAhead);

  const result: Record<string, TimeSlot[]> = {};

  // Iterate through each day in range
  for (let day = startOfDay(now); isBefore(day, latest); day = addDays(day, 1)) {
    const zonedDay = toZonedTime(day, timezone);
    // JS getDay: 0=Sun, 1=Mon, ... 6=Sat
    // Our schema: 0=Mon, 1=Tue, ... 6=Sun
    const jsDay = zonedDay.getDay();
    const ourDay = jsDay === 0 ? 6 : jsDay - 1;

    const dayRules = rules.filter((r) => r.day_of_week === ourDay);
    if (dayRules.length === 0) continue;

    const dateStr = format(zonedDay, "yyyy-MM-dd");
    const slots: TimeSlot[] = [];

    for (const rule of dayRules) {
      const [startH, startM] = rule.start_time.split(":").map(Number);
      const [endH, endM] = rule.end_time.split(":").map(Number);

      // Create start/end in the admin's timezone
      const windowStart = new Date(zonedDay);
      windowStart.setHours(startH, startM, 0, 0);

      const windowEnd = new Date(zonedDay);
      windowEnd.setHours(endH, endM, 0, 0);

      // Generate slots within this window
      let slotStart = windowStart;
      while (true) {
        const slotEnd = addMinutes(slotStart, durationMinutes);
        if (isAfter(slotEnd, windowEnd)) break;

        // Convert to UTC for comparison
        const utcStart = fromZonedTime(slotStart, timezone);
        const utcEnd = fromZonedTime(slotEnd, timezone);

        // Check minimum notice
        if (isAfter(utcStart, earliest)) {
          // Check buffers: the blocked range includes buffer before and after
          const blockedStart = addMinutes(utcStart, -bufferBefore);
          const blockedEnd = addMinutes(utcEnd, bufferAfter);

          // Check against busy slots
          const isBusy = busySlots.some((busy) => {
            const busyStart = busy.start instanceof Date ? busy.start : new Date(busy.start);
            const busyEnd = busy.end instanceof Date ? busy.end : new Date(busy.end);
            return isBefore(blockedStart, busyEnd) && isAfter(blockedEnd, busyStart);
          });

          if (!isBusy) {
            slots.push({ start: utcStart, end: utcEnd });
          }
        }

        slotStart = addMinutes(slotStart, durationMinutes); // No gap between slots
      }
    }

    if (slots.length > 0) {
      result[dateStr] = slots;
    }
  }

  return result;
}
