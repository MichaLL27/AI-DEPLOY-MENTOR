import { Badge } from "@/components/ui/badge";
import { CheckCircle, AlertCircle, XCircle } from "lucide-react";

interface ValidityBadgeProps {
  validity?: string | null;
}

export function ValidityBadge({ validity }: ValidityBadgeProps) {
  if (!validity) return null;

  if (validity === "valid") {
    return (
      <Badge className="bg-green-600 hover:bg-green-700 flex items-center gap-1.5">
        <CheckCircle className="h-3 w-3" />
        Ready
      </Badge>
    );
  }

  if (validity === "warning") {
    return (
      <Badge variant="secondary" className="flex items-center gap-1.5">
        <AlertCircle className="h-3 w-3" />
        Review
      </Badge>
    );
  }

  if (validity === "invalid") {
    return (
      <Badge variant="destructive" className="flex items-center gap-1.5">
        <XCircle className="h-3 w-3" />
        Cannot Deploy
      </Badge>
    );
  }

  return null;
}
