import { Badge } from "@/components/ui/badge";
import { 
  CheckCircle, 
  AlertCircle, 
  Loader2, 
  Clock, 
  XCircle, 
  Rocket,
  PlayCircle,
  AlertTriangle
} from "lucide-react";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: string;
  className?: string;
}

const statusConfig: Record<string, { label: string; icon: any; color: string }> = {
  registered: { 
    label: "Registered", 
    icon: Clock, 
    color: "bg-slate-500/15 text-slate-600 border-slate-500/20 hover:bg-slate-500/25" 
  },
  analyzing: { 
    label: "Analyzing", 
    icon: Loader2, 
    color: "bg-blue-500/15 text-blue-600 border-blue-500/20 hover:bg-blue-500/25" 
  },
  analysis_failed: { 
    label: "Analysis Failed", 
    icon: XCircle, 
    color: "bg-red-500/15 text-red-600 border-red-500/20 hover:bg-red-500/25" 
  },
  fixing: { 
    label: "Auto-Fixing", 
    icon: Loader2, 
    color: "bg-purple-500/15 text-purple-600 border-purple-500/20 hover:bg-purple-500/25" 
  },
  fix_failed: { 
    label: "Fix Failed", 
    icon: AlertTriangle, 
    color: "bg-orange-500/15 text-orange-600 border-orange-500/20 hover:bg-orange-500/25" 
  },
  qa_running: { 
    label: "Running QA", 
    icon: Loader2, 
    color: "bg-indigo-500/15 text-indigo-600 border-indigo-500/20 hover:bg-indigo-500/25" 
  },
  qa_passed: { 
    label: "QA Passed", 
    icon: CheckCircle, 
    color: "bg-emerald-500/15 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/25" 
  },
  qa_failed: { 
    label: "QA Failed", 
    icon: XCircle, 
    color: "bg-red-500/15 text-red-600 border-red-500/20 hover:bg-red-500/25" 
  },
  deploying: { 
    label: "Deploying", 
    icon: Loader2, 
    color: "bg-blue-500/15 text-blue-600 border-blue-500/20 hover:bg-blue-500/25" 
  },
  deployed: { 
    label: "Deployed", 
    icon: Rocket, 
    color: "bg-green-500/15 text-green-600 border-green-500/20 hover:bg-green-500/25" 
  },
  deploy_failed: { 
    label: "Deploy Failed", 
    icon: XCircle, 
    color: "bg-red-500/15 text-red-600 border-red-500/20 hover:bg-red-500/25" 
  },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] || { 
    label: status, 
    icon: Clock, 
    color: "bg-gray-500/15 text-gray-600 border-gray-500/20 hover:bg-gray-500/25" 
  };
  
  const Icon = config.icon;
  const isSpinning = status.includes("running") || status === "analyzing" || status === "fixing" || status === "deploying";

  return (
    <Badge 
      variant="outline" 
      className={cn(
        "flex items-center gap-1.5 shadow-none border transition-colors",
        config.color,
        className
      )}
      data-testid={`badge-status-${status}`}
    >
      <Icon className={cn("h-3.5 w-3.5", isSpinning && "animate-spin")} />
      {config.label}
    </Badge>
  );
}
