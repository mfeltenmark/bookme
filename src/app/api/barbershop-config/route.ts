import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import {
  BARBERSHOP_PRICING_DEFAULTS,
  buildBarbershopPricingState,
} from "@/lib/barbershop-config";

type EventTypeRow = {
  id: string;
  slug: string;
  display_price?: number | null;
  base_price?: number | null;
  currency?: string | null;
};

export async function GET() {
  try {
    const supabase = await createServiceRoleClient();
    const slugs = Object.keys(BARBERSHOP_PRICING_DEFAULTS);

    const { data: eventTypes, error } = await supabase
      .from("event_types")
      .select("*")
      .in("slug", slugs)
      .eq("is_active", true);

    if (error) {
      return NextResponse.json({ error: "Could not load barbershop config" }, { status: 500 });
    }

    const bySlug = new Map((eventTypes || []).map((eventType) => [eventType.slug, eventType as EventTypeRow]));
    const workshop = bySlug.get("prioritization-workshop");

    let workshopSpotsUsed = 0;

    if (workshop?.id) {
      const { count } = await supabase
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("event_type_id", workshop.id)
        .eq("status", "confirmed");

      workshopSpotsUsed = count ?? 0;
    }

    const treatments = Object.fromEntries(
      slugs.map((slug) => {
        const eventType = bySlug.get(slug);
        const pricing = buildBarbershopPricingState(slug, {
          displayPrice:
            typeof eventType?.display_price === "number"
              ? eventType.display_price
              : typeof eventType?.base_price === "number"
                ? eventType.base_price
                : null,
          currency: eventType?.currency ?? null,
          spotsUsed: slug === "prioritization-workshop" ? workshopSpotsUsed : null,
        });

        return [slug, pricing];
      })
    );

    return NextResponse.json({ treatments });
  } catch (error) {
    console.error("Failed to load barbershop config:", error);
    return NextResponse.json({ error: "Could not load barbershop config" }, { status: 500 });
  }
}
