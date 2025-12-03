import { Badge } from "@/components/ui/badge";
import { Smartphone, CheckCircle, AlertCircle, Loader2 } from "lucide-react";

interface AndroidBadgeProps {
  status?: string | null;
}

export function AndroidBadge({ status }: AndroidBadgeProps) {
  if (!status || status === "none") {
    return (
      <Badge variant="outline" className="flex items-center gap-1.5 text-muted-foreground border-muted-foreground/30">
        <Smartphone className="h-3 w-3" />
        Not generated
      </Badge>
    );
  }

  if (status === "building") {
    return (
      <Badge variant="secondary" className="flex items-center gap-1.5 bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 border-blue-500/20">
        <Loader2 className="h-3 w-3 animate-spin" />
        Building
      </Badge>
    );
  }

  if (status === "ready") {
    return (
      <Badge className="flex items-center gap-1.5 bg-green-500/15 text-green-600 hover:bg-green-500/25 border-green-500/20 shadow-none border">
        <CheckCircle className="h-3 w-3" />
        Ready
      </Badge>
    );
  }

  if (status === "failed") {
    return (
      <Badge variant="destructive" className="flex items-center gap-1.5 bg-red-500/10 text-red-600 hover:bg-red-500/20 border-red-500/20 shadow-none border">
        <AlertCircle className="h-3 w-3" />
        Failed
      </Badge>
    );
  }

  return null;
}
