import { Badge } from "@/components/ui/badge";
import type { ProjectStatus } from "@shared/schema";
import { 
  CheckCircle2, 
  Clock, 
  Loader2, 
  XCircle, 
  Rocket, 
  AlertTriangle,
  CircleDot
} from "lucide-react";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: ProjectStatus;
  className?: string;
}

const statusConfig: Record<ProjectStatus, {
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline";
  icon: typeof CheckCircle2;
  className: string;
  animate?: boolean;
}> = {
  registered: {
    label: "Registered",
    variant: "secondary",
    icon: CircleDot,
    className: "bg-secondary text-secondary-foreground",
  },
  qa_running: {
    label: "QA Running",
    variant: "outline",
    icon: Loader2,
    className: "bg-chart-4/10 text-chart-4 border-chart-4/30 dark:bg-chart-4/20",
    animate: true,
  },
  qa_passed: {
    label: "QA Passed",
    variant: "outline",
    icon: CheckCircle2,
    className: "bg-chart-2/10 text-chart-2 border-chart-2/30 dark:bg-chart-2/20",
  },
  qa_failed: {
    label: "QA Failed",
    variant: "destructive",
    icon: XCircle,
    className: "bg-destructive/10 text-destructive border-destructive/30 dark:bg-destructive/20",
  },
  deploying: {
    label: "Deploying",
    variant: "outline",
    icon: Rocket,
    className: "bg-primary/10 text-primary border-primary/30 dark:bg-primary/20",
    animate: true,
  },
  deployed: {
    label: "Deployed",
    variant: "outline",
    icon: CheckCircle2,
    className: "bg-chart-2/10 text-chart-2 border-chart-2/30 dark:bg-chart-2/20",
  },
  deploy_failed: {
    label: "Deploy Failed",
    variant: "destructive",
    icon: AlertTriangle,
    className: "bg-destructive/10 text-destructive border-destructive/30 dark:bg-destructive/20",
  },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1.5 px-2.5 py-1 text-xs font-medium uppercase tracking-wide border",
        config.className,
        className
      )}
      data-testid={`badge-status-${status}`}
    >
      <Icon 
        className={cn(
          "h-3.5 w-3.5",
          config.animate && "animate-spin"
        )} 
      />
      {config.label}
    </Badge>
  );
}
