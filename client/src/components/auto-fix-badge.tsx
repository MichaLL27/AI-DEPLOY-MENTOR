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
      <Badge variant="secondary" className="flex items-center gap-1.5 bg-purple-500/10 text-purple-600 hover:bg-purple-500/20 border-purple-500/20">
        <Loader2 className="h-3 w-3 animate-spin" />
        Fixing
      </Badge>
    );
  }

  if (status === "success") {
    return (
      <Badge className="flex items-center gap-1.5 bg-green-500/15 text-green-600 hover:bg-green-500/25 border-green-500/20 shadow-none border">
        <CheckCircle className="h-3 w-3" />
        Fixed
      </Badge>
    );
  }

  if (status === "failed") {
    return (
      <Badge variant="destructive" className="flex items-center gap-1.5 bg-red-500/10 text-red-600 hover:bg-red-500/20 border-red-500/20 shadow-none border">
        <XCircle className="h-3 w-3" />
        Failed
      </Badge>
    );
  }

  return null;
}
