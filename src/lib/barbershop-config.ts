export type BarbershopPricingMode = "free" | "fixed" | "metered";

export type BarbershopPricingState = {
  slug: string;
  mode: BarbershopPricingMode;
  displayPrice: number;
  currency: string;
  badgeLabel: string;
  cardCta: string;
  confirmLabel: string;
  spotsUsed: number | null;
  spotsLeft: number | null;
  isFree: boolean;
};

type StaticConfig = {
  mode: BarbershopPricingMode;
  displayPrice: number;
  currency: string;
  freeLimit?: number;
  freeBadge?: string;
  fixedCardCta?: string;
  fixedConfirmLabel?: string;
  freeCardCta?: string;
  freeConfirmLabel?: string;
  paidCardCta?: string;
  paidConfirmLabel?: string;
};

export const BARBERSHOP_PRICING_DEFAULTS: Record<string, StaticConfig> = {
  "30-min-consultation": {
    mode: "free",
    displayPrice: 0,
    currency: "SEK",
    freeBadge: "Free, always.",
    fixedCardCta: "Book your free Tracy Test",
    fixedConfirmLabel: "Confirm booking",
  },
  "backlog-audit": {
    mode: "fixed",
    displayPrice: 5000,
    currency: "SEK",
    fixedCardCta: "Book Backlog Surgery / 5 000 SEK",
    fixedConfirmLabel: "Confirm booking",
  },
  "prioritization-workshop": {
    mode: "metered",
    displayPrice: 15000,
    currency: "SEK",
    freeLimit: 3,
    freeCardCta: "Claim a free workshop spot",
    freeConfirmLabel: "Confirm free spot",
    paidCardCta: "Book Chaos Clarity Workshop / 15 000 SEK",
    paidConfirmLabel: "Confirm booking / 15 000 SEK",
  },
};

export function formatPrice(amount: number, currency = "SEK") {
  return `${new Intl.NumberFormat("sv-SE").format(amount)} ${currency}`;
}

export function buildBarbershopPricingState(
  slug: string,
  overrides?: {
    displayPrice?: number | null;
    currency?: string | null;
    spotsUsed?: number | null;
  }
): BarbershopPricingState {
  const config = BARBERSHOP_PRICING_DEFAULTS[slug];

  if (!config) {
    throw new Error(`Missing barbershop pricing config for slug: ${slug}`);
  }

  const displayPrice = typeof overrides?.displayPrice === "number" ? overrides.displayPrice : config.displayPrice;
  const currency = overrides?.currency || config.currency;

  if (config.mode === "free") {
    return {
      slug,
      mode: config.mode,
      displayPrice,
      currency,
      badgeLabel: config.freeBadge || "Free",
      cardCta: config.fixedCardCta || "Book now",
      confirmLabel: config.fixedConfirmLabel || "Confirm booking",
      spotsUsed: null,
      spotsLeft: null,
      isFree: true,
    };
  }

  if (config.mode === "fixed") {
    return {
      slug,
      mode: config.mode,
      displayPrice,
      currency,
      badgeLabel: formatPrice(displayPrice, currency),
      cardCta: config.fixedCardCta || "Book now",
      confirmLabel: config.fixedConfirmLabel || "Confirm booking",
      spotsUsed: null,
      spotsLeft: null,
      isFree: false,
    };
  }

  const spotsUsed = Math.max(0, overrides?.spotsUsed ?? 0);
  const freeLimit = config.freeLimit ?? 3;
  const spotsLeft = Math.max(0, freeLimit - spotsUsed);
  const isFree = spotsUsed < freeLimit;

  return {
    slug,
    mode: config.mode,
    displayPrice,
    currency,
    badgeLabel: isFree ? `${spotsLeft} free spot${spotsLeft !== 1 ? "s" : ""} remaining` : formatPrice(displayPrice, currency),
    cardCta: isFree ? config.freeCardCta || "Claim spot" : config.paidCardCta || "Book now",
    confirmLabel: isFree ? config.freeConfirmLabel || "Confirm booking" : config.paidConfirmLabel || "Confirm booking",
    spotsUsed,
    spotsLeft,
    isFree,
  };
}
