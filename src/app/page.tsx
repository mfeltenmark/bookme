import { createServiceRoleClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Calendar, Clock, Video } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { AdminSettings, EventType } from "@/types";

export const revalidate = 60;

export default async function PublicProfilePage() {
  const supabase = await createServiceRoleClient();

  const { data: settings } = await supabase
    .from("admin_settings")
    .select("*")
    .single();

  const { data: activeEvents } = await supabase
    .from("event_types")
    .select("*")
    .eq("is_active", true);

  const profile = settings as AdminSettings | null;
  const events = (activeEvents as EventType[]) || [];

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background">
      <div className="mx-auto max-w-lg px-4 py-16">
        <div className="text-center mb-10">
          {profile?.profile_image_url ? (
            <img
              src={profile.profile_image_url}
              alt={profile.display_name}
              className="mx-auto h-24 w-24 rounded-full object-cover border-4 border-background shadow-lg mb-4"
            />
          ) : (
            <div className="mx-auto h-24 w-24 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Calendar className="h-10 w-10 text-primary" />
            </div>
          )}
          <h1 className="text-2xl font-bold">{profile?.display_name || "BookMe"}</h1>
          {profile?.welcome_message && (
            <p className="text-muted-foreground mt-2 max-w-sm mx-auto">
              {profile.welcome_message}
            </p>
          )}
        </div>

        {events.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground">
                No available meetings right now.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {events.map((event) => (
              <Link key={event.id} href={`/${event.slug}`}>
                <Card className="transition-all hover:shadow-md hover:border-primary/30 cursor-pointer group">
                  <CardContent className="py-5 px-6">
                    <div className="flex items-center gap-4">
                      <div
                        className="h-12 w-1.5 rounded-full"
                        style={{ backgroundColor: event.color }}
                      />
                      <div className="flex-1">
                        <h2 className="font-semibold text-lg group-hover:text-primary transition-colors">
                          {event.name}
                        </h2>
                        {event.description && (
                          <p className="text-sm text-muted-foreground mt-0.5">
                            {event.description}
                          </p>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {event.duration_minutes} min
                          </span>
                          {event.location_type === "google_meet" && (
                            <span className="flex items-center gap-1">
                              <Video className="h-3.5 w-3.5" />
                              Google Meet
                            </span>
                          )}
                        </div>
                      </div>
                      <Button variant="outline" size="sm" className="shrink-0">
                        Book
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground mt-12">
          Powered by Tech &amp; Change
        </p>
      </div>
    </div>
  );
}
