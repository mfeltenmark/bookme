"use client";

import { useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, Check, Loader2, XCircle } from "lucide-react";

function CancelContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const bookingId = params.id as string;
  const token = searchParams.get("token");

  const [status, setStatus] = useState<"confirm" | "cancelling" | "done" | "error">("confirm");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleCancel() {
    if (!token) {
      setErrorMsg("Invalid cancellation link");
      setStatus("error");
      return;
    }

    setStatus("cancelling");

    try {
      const res = await fetch(`/api/bookings/${bookingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel", cancellation_token: token }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || "Could not cancel booking");
        setStatus("error");
        return;
      }

      setStatus("done");
    } catch {
      setErrorMsg("Network error. Please try again.");
      setStatus("error");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-primary/5 to-background px-4">
      <Card className="max-w-sm w-full">
        <CardContent className="py-8 text-center">
          {status === "confirm" && (
            <>
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
                <XCircle className="h-7 w-7 text-destructive" />
              </div>
              <h1 className="text-xl font-bold mb-2">Cancel meeting</h1>
              <p className="text-sm text-muted-foreground mb-6">
                Are you sure you want to cancel this meeting? Both you and the host will be notified.
              </p>
              <div className="flex gap-3 justify-center">
                <Button variant="destructive" onClick={handleCancel}>
                  Yes, cancel
                </Button>
                <Button variant="outline" onClick={() => window.history.back()}>
                  No, keep it
                </Button>
              </div>
            </>
          )}

          {status === "cancelling" && (
            <>
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Cancelling...</p>
            </>
          )}

          {status === "done" && (
            <>
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
                <Check className="h-7 w-7 text-green-600" />
              </div>
              <h1 className="text-xl font-bold mb-2">Meeting cancelled</h1>
              <p className="text-sm text-muted-foreground mb-4">
                Your meeting has been cancelled. A confirmation will be sent to your email.
              </p>
              <Button variant="outline" onClick={() => (window.location.href = "/")}>
                <Calendar className="h-4 w-4" />
                Book a new time
              </Button>
            </>
          )}

          {status === "error" && (
            <>
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
                <XCircle className="h-7 w-7 text-destructive" />
              </div>
              <h1 className="text-xl font-bold mb-2">Something went wrong</h1>
              <p className="text-sm text-destructive mb-4">{errorMsg}</p>
              <Button variant="outline" onClick={() => setStatus("confirm")}>
                Try again
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function CancelPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <CancelContent />
    </Suspense>
  );
}
