import { Badge } from "@/components/ui/badge";
import { CheckCircle, Loader2, AlertCircle, XCircle } from "lucide-react";

interface NormalizationBadgeProps {
  status?: string | null;
  readyForDeploy?: boolean;
}

export function NormalizationBadge({ status, readyForDeploy }: NormalizationBadgeProps) {
  if (!status || status === "none") {
    return (
      <Badge variant="outline" className="flex items-center gap-1.5">
        <AlertCircle className="h-3 w-3" />
        Not normalized
      </Badge>
    );
  }

  if (status === "running") {
    return (
      <Badge variant="secondary" className="flex items-center gap-1.5">
        <Loader2 className="h-3 w-3 animate-spin" />
        Normalizing…
      </Badge>
    );
  }

  if (status === "success" && readyForDeploy) {
    return (
      <Badge className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700">
        <CheckCircle className="h-3 w-3" />
        Ready
      </Badge>
    );
  }

  if (status === "success") {
    return (
      <Badge variant="secondary" className="flex items-center gap-1.5">
        <AlertCircle className="h-3 w-3" />
        Normalized
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
