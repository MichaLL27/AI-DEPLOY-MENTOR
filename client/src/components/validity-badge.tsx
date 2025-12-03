import { Badge } from "@/components/ui/badge";
import { CheckCircle, AlertCircle, XCircle } from "lucide-react";

interface ValidityBadgeProps {
  validity?: string | null;
}

export function ValidityBadge({ validity }: ValidityBadgeProps) {
  if (!validity) return null;

  if (validity === "valid") {
    return (
      <Badge className="bg-green-500/15 text-green-600 hover:bg-green-500/25 border-green-500/20 shadow-none border flex items-center gap-1.5">
        <CheckCircle className="h-3 w-3" />
        Ready
      </Badge>
    );
  }

  if (validity === "warning") {
    return (
      <Badge variant="secondary" className="bg-yellow-500/15 text-yellow-600 hover:bg-yellow-500/25 border-yellow-500/20 shadow-none border flex items-center gap-1.5">
        <AlertCircle className="h-3 w-3" />
        Review
      </Badge>
    );
  }

  if (validity === "invalid") {
    return (
      <Badge variant="destructive" className="bg-red-500/10 text-red-600 hover:bg-red-500/20 border-red-500/20 shadow-none border flex items-center gap-1.5">
        <XCircle className="h-3 w-3" />
        Cannot Deploy
      </Badge>
    );
  }

  return null;
}
