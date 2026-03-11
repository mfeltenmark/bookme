# Booking Flow — Teknisk dokumentation

> Syfte: Onboarding-underlag för ny utvecklare som bygger en parallell kampanjsida ovanpå samma motor.
> Senast uppdaterad: 2026-03-11
> Scope: `bookme` (Next.js) + CRM-webhook-kontraktet mot `freelance-crm`

---

## Arkitekturöversikt

`bookme` är en Next.js 15 App Router-applikation deployad på Vercel. Den är en självständig bokningssajt för en enskild konsult (single-tenant), inte ett SaaS-system med flera användare.

```
Browser (public)
  └── /[slug]              → Booking page (Client Component)
        ├── GET /api/availability?slug=...   → hämtar slots
        └── POST /api/bookings               → skapar bokning

Admin
  └── /admin/event-types   → skapa/redigera mötestyper
  └── /admin/bookings      → se bekräftade bokningar

Supabase (PostgreSQL)
  ├── event_types          → mötestypdefinitioner
  ├── availability_rules   → tillgänglighetsregler per mötestyp
  ├── custom_questions     → formulärfält per mötestyp
  ├── bookings             → bekräftade/avbokade bokningar
  ├── booking_answers      → svar på custom questions
  └── admin_settings       → global konfiguration (tz, min notice, etc.)

Google Calendar API
  ├── FreeBusy             → hämtar upptagna tider
  └── Events.insert        → skapar kalenderinbjudan + Google Meet

Resend API                 → skickar bekräftelse-/avbokningsmail

freelance-crm (extern)
  └── POST /api/bookings/incoming   → tar emot webhook vid ny bokning
```

**Stack:** Next.js 15 · TypeScript · Tailwind CSS · shadcn/ui · Supabase JS SDK · date-fns · date-fns-tz · Zod · Resend

**Autentisering:** Admin-sidor skyddas via Supabase Auth (middleware). Public booking-sidor är öppna utan autentisering.

---

## Mötestyper — lista och definition

Mötestyper hanteras i admin-UI:t på `/admin/event-types` och lagras i Supabase-tabellen `event_types`.

### Hur en mötestyp definieras

En `EventType` har följande fält:

| Fält | Typ | Beskrivning |
|---|---|---|
| `id` | UUID | Primärnyckel |
| `name` | string | Visningsnamn, t.ex. "Strategy Session 60 min" |
| `slug` | string | URL-sökväg, t.ex. `strategy-60` → nås på `book.techchange.io/strategy-60` |
| `description` | string? | Kort beskrivning visas på bokningssidan |
| `duration_minutes` | number | Mötets längd i minuter |
| `color` | string | Hex-färg för visuell identifiering, t.ex. `#5e3a8c` |
| `is_active` | boolean | Styr om sidan är publikt åtkomlig |
| `location_type` | string | Just nu alltid `"google_meet"` |
| `buffer_before_minutes` | number | Buffert före mötet (blockerar kalender) |
| `buffer_after_minutes` | number | Buffert efter mötet (blockerar kalender) |
| `confirmation_message` | string? | Visas i bokningsbekräftelse och i mailet |

Varje `EventType` har två relaterade tabeller:

**`availability_rules`** — en rad per dag/tidsfönster:

| Fält | Typ | Beskrivning |
|---|---|---|
| `event_type_id` | UUID | FK till event_types |
| `day_of_week` | 0–6 | 0 = måndag, 6 = söndag (OBS: avviker från JS Date.getDay) |
| `start_time` | "HH:MM" | Fönstrets starttid i adminens tidszon |
| `end_time` | "HH:MM" | Fönstrets sluttid |

**`custom_questions`** — dynamiska formulärfält:

| Fält | Typ | Beskrivning |
|---|---|---|
| `event_type_id` | UUID | FK till event_types |
| `label` | string | Frågetexten |
| `field_type` | enum | `text` \| `textarea` \| `select` \| `number` |
| `placeholder` | string? | Placeholder-text |
| `options` | string[]? | Alternativ (används om field_type = select) |
| `is_required` | boolean | Om fältet är obligatoriskt |
| `sort_order` | number | Ordning i formuläret |

**Aktuella mötestyper i produktion:** Se Supabase-tabellen `event_types` för live-data. Slugs avgör URL.

---

## Hur public booking page laddar en mötestyp

Sidan `src/app/[slug]/page.tsx` är en Client Component. Vid mount kallar den:

```
GET /api/availability?slug={slug}
```

API-routen (`src/app/api/availability/route.ts`) gör följande i sekvens:

1. Hämtar `event_types` inklusive `availability_rules(*)` och `custom_questions(*)` via Supabase, filtrerat på `slug` och `is_active = true`.
2. Hämtar `admin_settings` (tidszon, `min_notice_hours`, `max_days_ahead`).
3. Hämtar befintliga bekräftade bokningar (`status = confirmed`, framåt i tid) som busy slots.
4. Hämtar Google Calendar busy slots via FreeBusy API för perioden `now → now + max_days_ahead`.
5. Slår ihop de två busy-källorna och anropar `calculateAvailability()`.
6. Returnerar:

```json
{
  "eventType": {
    "id": "uuid",
    "name": "Strategy Session 60 min",
    "slug": "strategy-60",
    "description": "...",
    "duration_minutes": 60,
    "color": "#5e3a8c",
    "location_type": "google_meet",
    "confirmation_message": "..."
  },
  "customQuestions": [
    {
      "id": "uuid",
      "event_type_id": "uuid",
      "label": "Company name",
      "field_type": "text",
      "placeholder": "Acme Corp",
      "options": null,
      "is_required": true,
      "sort_order": 0,
      "created_at": "..."
    }
  ],
  "timezone": "Europe/Stockholm",
  "availability": {
    "2026-03-12": [
      { "start": "2026-03-12T09:00:00.000Z", "end": "2026-03-12T10:00:00.000Z" },
      { "start": "2026-03-12T10:00:00.000Z", "end": "2026-03-12T11:00:00.000Z" }
    ],
    "2026-03-13": [...]
  }
}
```

Tiderna i `availability` är alltid UTC ISO 8601-strängar.

---

## Hur availability beräknas

Logiken sitter i `src/lib/availability.ts`, funktionen `calculateAvailability()`.

**Algoritm:**

1. Iterera varje dag från idag till `now + max_days_ahead`.
2. För varje dag: konvertera till adminens tidszon via `date-fns-tz` och identifiera veckodagen (schema: 0 = måndag).
3. Hitta alla `availability_rules` som matchar den veckodagen.
4. För varje regel: generera mötesfönster i steg om `duration_minutes` från `start_time` till `end_time`.
5. För varje potentiellt slot:
   - Hoppa över om starttiden är inom `min_notice_hours` framåt.
   - Beräkna det blockerade intervallet: `[slot_start − buffer_before, slot_end + buffer_after]`.
   - Kontrollera om det blockerade intervallet överlappar med något av busy slots.
   - Om ingen överlapp: lägg till i resultatet.

```typescript
// Från src/lib/availability.ts — kärnan i conflict-check
const blockedStart = addMinutes(utcStart, -bufferBefore);
const blockedEnd   = addMinutes(utcEnd, bufferAfter);

const isBusy = busySlots.some((busy) => {
  return isBefore(blockedStart, busyEnd) && isAfter(blockedEnd, busyStart);
});
```

**Viktigt för en parallell sida:** Availability-endpointen är stateless och slug-baserad. En parallell sida kan anropa samma endpoint. Konfliktkontroll vid bokning sker även i POST-endpointen, så race conditions är skyddade.

---

## Hur en bokning skapas

### Request

```
POST /api/bookings
Content-Type: application/json
```

```json
{
  "event_type_id": "uuid",
  "invitee_name": "Anna Svensson",
  "invitee_email": "anna@example.com",
  "invitee_notes": "Vill diskutera plattformsstrategi",
  "start_time": "2026-03-12T09:00:00.000Z",
  "end_time": "2026-03-12T10:00:00.000Z",
  "answers": [
    {
      "question_id": "uuid",
      "question_label": "Company name",
      "answer": "Acme AB"
    }
  ]
}
```

`invitee_notes` och `answers` är valfria. `answers` filtreras bort om tomma.

### Serversekvens

1. Validera payload med Zod (typer, UUID-format, ISO datetime).
2. Hämta event type, verifiera `is_active = true`.
3. Kontrollera konflikter mot befintliga `confirmed`-bokningar (overlap-query).
4. Skapa Google Calendar-event med Meet-länk (om Google är konfigurerat).
5. Sätt in bokning i Supabase `bookings`-tabellen med `status = confirmed`.
6. Skicka webhook till CRM (se nedan).
7. Spara `booking_answers` i Supabase.
8. Skicka bekräftelsemail via Resend.

### Response (200 OK)

```json
{
  "booking": {
    "id": "uuid",
    "start_time": "2026-03-12T09:00:00.000Z",
    "end_time": "2026-03-12T10:00:00.000Z",
    "google_meet_link": "https://meet.google.com/xxx-yyyy-zzz",
    "cancellation_token": "random-token"
  },
  "message": "Booking confirmed!"
}
```

### Avbokning

```
PATCH /api/bookings/{id}
Content-Type: application/json

{ "action": "cancel", "cancellation_token": "..." }
```

Uppdaterar `status = cancelled`, raderar Google Calendar-event, skickar avbokningsmail.

---

## Vilka fält skickas till CRM

Webhook: `POST {CRM_WEBHOOK_URL}/api/bookings/incoming`
Auth-header: `X-Webhook-Secret: {CRM_WEBHOOK_SECRET}`

```json
{
  "bookingId":     "uuid",
  "eventType":     "strategy-60",
  "name":          "Anna Svensson",
  "email":         "anna@example.com",
  "phone":         undefined,
  "company":       undefined,
  "scheduledDate": "2026-03-12T09:00:00.000Z",
  "duration":      60,
  "meetingUrl":    "https://meet.google.com/xxx-yyyy-zzz",
  "notes":         "Vill diskutera plattformsstrategi",
  "source":        "bookme",
  "createdAt":     "2026-03-11T14:32:00.000Z"
}
```

`eventType` är `event_type.slug` om den finns, annars `event_type.name`. `phone` och `company` är alltid `undefined` i nuläget (fälten reserverade men inte implementerade i formuläret).

Webhooken är **non-blocking** — ett misslyckat CRM-anrop avbryter inte bokningsflödet. Felet loggas men bokningen bekräftas ändå.

---

## source, variant och tags

**source** — `"bookme"` är hårdkodat i `api/bookings/route.ts`. Det är det enda metadata-fält som skickas konsistent idag.

```typescript
// src/app/api/bookings/route.ts rad 117
source: 'bookme',
```

**variant** — finns inte i nuläget. Inget sådant fält i payload-schemat.

**tags** — finns inte i nuläget. Inget sådant fält i payload-schemat.

### Vad en parallell kampanjsida behöver göra

Om den parallella sidan ska kunna spåras separat i CRM behöver `source` eller ett nytt fält (t.ex. `variant` eller `campaign`) läggas till i CRM-webhook-payloaden. Det kräver:

1. Ett sätt att skicka med kampanjinfo via booking-requesten (t.ex. ett nytt valfritt fält `source` eller `campaign` i `POST /api/bookings`).
2. Att `crm-sync.ts` vidarebefordrar det fältet till CRM.
3. Att `freelance-crm` hanterar fältet på mottagarsidan.

Alternativt kan det parallella bokningsflödet särskiljas helt genom att använda ett dedikerat `event_type`-slug med ett unikt namn, och filtrera på `eventType` i CRM.

---

## Miljövariabler (relevanta för booking flow)

| Variabel | Syfte |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase-projektets URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon-nyckel för client-side |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role för server-side API-routes |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth för kalenderintegration |
| `ENCRYPTION_KEY` | Kryptering av lagrade Google-tokens |
| `RESEND_API_KEY` | Skicka mail via Resend |
| `EMAIL_FROM` | Avsändaradress för mail |
| `NEXT_PUBLIC_APP_URL` | Basadress (används för cancel-/rebook-URL:er) |
| `CRM_WEBHOOK_URL` | Bas-URL till freelance-crm-instansen |
| `CRM_WEBHOOK_SECRET` | Autentisering för webhook (X-Webhook-Secret header) |

Om `CRM_WEBHOOK_URL` eller `CRM_WEBHOOK_SECRET` saknas loggas en varning och CRM-synken hoppas över tyst.

---

## Filöversikt — booking flow

```
src/
├── app/
│   ├── [slug]/page.tsx              # Public booking page (Client Component)
│   ├── api/
│   │   ├── availability/route.ts    # GET ?slug= → returnerar slots + eventType
│   │   └── bookings/
│   │       ├── route.ts             # POST → skapar bokning
│   │       └── [id]/route.ts        # PATCH { action: cancel } → avbokar
│   └── booking/[id]/cancel/page.tsx # Avbokningssida (via cancel-länk i mail)
├── lib/
│   ├── availability.ts              # calculateAvailability() — slot-algoritmen
│   ├── google/
│   │   ├── calendar.ts              # getGoogleBusySlots, createCalendarEvent
│   │   └── tokens.ts                # OAuth token-hantering
│   ├── email/                       # Resend-integration + templates
│   └── webhooks/
│       └── crm-sync.ts              # sendBookingToCRM() — webhook till CRM
└── types/index.ts                   # EventType, Booking, AvailabilityRule, etc.
```
