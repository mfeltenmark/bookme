import { NextResponse } from "next/server";
import { listCalendars } from "@/lib/google/calendar";

export async function GET() {
  const calendars = await listCalendars();

  if (calendars.length === 0) {
    return NextResponse.json(
      { error: "Kunde inte hämta kalendrar. Är Google Calendar ansluten?" },
      { status: 400 }
    );
  }

  return NextResponse.json({ calendars });
}
