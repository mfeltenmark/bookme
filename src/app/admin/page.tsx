import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, CalendarClock, Users, Clock } from "lucide-react";
import { formatDate, formatTime } from "@/lib/utils";
import type { Booking, EventType } from "@/types";

export default async function AdminDashboard() {
  const supabase = await createServerSupabaseClient();

  // Get upcoming bookings
  const { data: bookings } = await supabase
    .from("bookings")
    .select("*, event_type:event_types(*)")
    .eq("status", "confirmed")
    .gte("start_time", new Date().toISOString())
    .order("start_time", { ascending: true })
    .limit(10);

  // Get stats
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const { count: totalBookings } = await supabase
    .from("bookings")
    .select("*", { count: "exact", head: true })
    .eq("status", "confirmed")
    .gte("start_time", startOfMonth);

  const { count: todayCount } = await supabase
    .from("bookings")
    .select("*", { count: "exact", head: true })
    .eq("status", "confirmed")
    .gte("start_time", new Date(now.setHours(0, 0, 0, 0)).toISOString())
    .lte("start_time", new Date(now.setHours(23, 59, 59, 999)).toISOString());

  const { data: activeEvent } = await supabase
    .from("event_types")
    .select("*")
    .eq("is_active", true)
    .single();

  const stats = [
    { label: "Idag", value: todayCount || 0, icon: Calendar },
    { label: "Denna månad", value: totalBookings || 0, icon: Users },
    {
      label: "Aktiv evenemangstyp",
      value: activeEvent ? activeEvent.name : "Ingen",
      icon: CalendarClock,
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Överblick av dina bokningar</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardDescription className="text-sm font-medium">{stat.label}</CardDescription>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Upcoming bookings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Kommande bokningar</CardTitle>
          <CardDescription>Dina nästa möten</CardDescription>
        </CardHeader>
        <CardContent>
          {!bookings?.length ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Inga kommande bokningar
            </p>
          ) : (
            <div className="space-y-3">
              {(bookings as (Booking & { event_type: EventType })[]).map((booking) => (
                <div
                  key={booking.id}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className="h-10 w-1 rounded-full"
                      style={{ backgroundColor: booking.event_type?.color || "#5e3a8c" }}
                    />
                    <div>
                      <p className="font-medium">{booking.invitee_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {booking.event_type?.name} &middot; {booking.invitee_email}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">
                      {formatDate(new Date(booking.start_time))}
                    </p>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {formatTime(new Date(booking.start_time))} –{" "}
                      {formatTime(new Date(booking.end_time))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
