import { Badge } from "@/components/ui/badge";
import { CheckCircle, Loader2, AlertCircle, XCircle } from "lucide-react";

interface AutoFixBadgeProps {
  status?: string | null;
}

export function AutoFixBadge({ status }: AutoFixBadgeProps) {
  if (!status || status === "none") {
    return null;
  }

  if (status === "running") {
    return (
      <Badge variant="secondary" className="flex items-center gap-1.5">
        <Loader2 className="h-3 w-3 animate-spin" />
        Fixing…
      </Badge>
    );
  }

  if (status === "success") {
    return (
      <Badge className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700">
        <CheckCircle className="h-3 w-3" />
        Fixed
      </Badge>
    );
  }

  if (status === "failed") {
    return (
      <Badge variant="destructive" className="flex items-center gap-1.5">
        <XCircle className="h-3 w-3" />
        Failed
      </Badge>
    );
  }

  return null;
}
