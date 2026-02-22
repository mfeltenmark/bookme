"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, ExternalLink, Loader2, Trash2, Video } from "lucide-react";
import { formatDate, formatTime } from "@/lib/utils";
import type { Booking, EventType } from "@/types";

type BookingWithEvent = Booking & { event_type: EventType };

export default function BookingsPage() {
  const [bookings, setBookings] = useState<BookingWithEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"upcoming" | "past" | "cancelled">("upcoming");
  const supabase = createClient();

  const loadBookings = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("bookings")
      .select("*, event_type:event_types(*)")
      .order("start_time", { ascending: filter === "upcoming" });

    const now = new Date().toISOString();

    if (filter === "upcoming") {
      query = query.eq("status", "confirmed").gte("start_time", now);
    } else if (filter === "past") {
      query = query.eq("status", "confirmed").lt("start_time", now);
    } else {
      query = query.eq("status", "cancelled");
    }

    const { data } = await query.limit(50);
    setBookings((data as BookingWithEvent[]) || []);
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  async function cancelBooking(id: string) {
    if (!confirm("Vill du avboka detta möte?")) return;
    await supabase
      .from("bookings")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
      .eq("id", id);
    // TODO: Also delete Google Calendar event and send cancellation email
    loadBookings();
  }

  const statusColor: Record<string, "success" | "destructive" | "secondary"> = {
    confirmed: "success",
    cancelled: "destructive",
    rescheduled: "secondary",
  };

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Bokningar</h1>
        <p className="text-muted-foreground">Alla inkommande och historiska bokningar</p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(["upcoming", "past", "cancelled"] as const).map((f) => (
          <Button
            key={f}
            variant={filter === f ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(f)}
          >
            {f === "upcoming" ? "Kommande" : f === "past" ? "Tidigare" : "Avbokade"}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : bookings.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Inga bokningar att visa</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {bookings.map((booking) => (
            <Card key={booking.id}>
              <CardContent className="py-4 px-6">
                <div className="flex items-start justify-between">
                  <div className="flex gap-4">
                    <div
                      className="h-full w-1.5 rounded-full self-stretch"
                      style={{ backgroundColor: booking.event_type?.color || "#5e3a8c" }}
                    />
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{booking.invitee_name}</span>
                        <Badge variant={statusColor[booking.status]}>
                          {booking.status === "confirmed"
                            ? "Bekräftad"
                            : booking.status === "cancelled"
                            ? "Avbokad"
                            : "Ombokad"}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{booking.invitee_email}</p>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>{formatDate(new Date(booking.start_time))}</span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatTime(new Date(booking.start_time))} –{" "}
                          {formatTime(new Date(booking.end_time))}
                        </span>
                      </div>
                      {booking.invitee_notes && (
                        <p className="text-sm mt-1 bg-muted/50 rounded px-2 py-1">
                          {booking.invitee_notes}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {booking.google_meet_link && (
                      <a href={booking.google_meet_link} target="_blank" rel="noopener"
                        className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-3 h-9 text-sm hover:bg-accent hover:text-accent-foreground">
                        <Video className="h-3 w-3" />
                        Meet
                      </a>
                    )}
                    {booking.status === "confirmed" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        onClick={() => cancelBooking(booking.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
