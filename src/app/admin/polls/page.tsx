import { Card, CardContent } from "@/components/ui/card";
import { Vote } from "lucide-react";

export default function PollsPage() {
  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Mötesomröstningar</h1>
        <p className="text-muted-foreground">
          Skapa omröstningar för att hitta bästa tidpunkt för gruppmöten
        </p>
      </div>
      <Card>
        <CardContent className="py-12 text-center">
          <Vote className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground">Kommer i Fas 5</p>
        </CardContent>
      </Card>
    </div>
  );
}
