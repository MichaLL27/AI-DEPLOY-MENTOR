import { Badge } from "@/components/ui/badge";
import { CheckCircle, Loader2, AlertCircle, XCircle } from "lucide-react";

interface NormalizationBadgeProps {
  status?: string | null;
  readyForDeploy?: boolean;
}

export function NormalizationBadge({ status, readyForDeploy }: NormalizationBadgeProps) {
  if (!status || status === "none") {
    return (
      <Badge variant="outline" className="flex items-center gap-1.5 text-muted-foreground border-muted-foreground/30">
        <AlertCircle className="h-3 w-3" />
        Not normalized
      </Badge>
    );
  }

  if (status === "running") {
    return (
      <Badge variant="secondary" className="flex items-center gap-1.5 bg-purple-500/10 text-purple-600 hover:bg-purple-500/20 border-purple-500/20">
        <Loader2 className="h-3 w-3 animate-spin" />
        Normalizing
      </Badge>
    );
  }

  if (status === "success" && readyForDeploy) {
    return (
      <Badge className="flex items-center gap-1.5 bg-green-500/15 text-green-600 hover:bg-green-500/25 border-green-500/20 shadow-none border">
        <CheckCircle className="h-3 w-3" />
        Ready
      </Badge>
    );
  }

  if (status === "success") {
    return (
      <Badge variant="secondary" className="flex items-center gap-1.5 bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/20 border-yellow-500/20">
        <AlertCircle className="h-3 w-3" />
        Normalized
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
