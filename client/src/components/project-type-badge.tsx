import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ProjectTypeBadgeProps {
  type?: string | null;
  className?: string;
}

const typeConfig: Record<string, { label: string; color: string }> = {
  static_web: { 
    label: "Static Web", 
    color: "bg-green-500/15 text-green-600 border-green-500/20 hover:bg-green-500/25" 
  },
  node_backend: { 
    label: "Node Backend", 
    color: "bg-blue-500/15 text-blue-600 border-blue-500/20 hover:bg-blue-500/25" 
  },
  nextjs: { 
    label: "Next.js", 
    color: "bg-slate-950/10 text-slate-950 dark:bg-white/10 dark:text-white border-slate-500/20 hover:bg-slate-500/20" 
  },
  react_spa: { 
    label: "React SPA", 
    color: "bg-cyan-500/15 text-cyan-600 border-cyan-500/20 hover:bg-cyan-500/25" 
  },
  python_flask: { 
    label: "Python", 
    color: "bg-yellow-500/15 text-yellow-600 border-yellow-500/20 hover:bg-yellow-500/25" 
  },
  unknown: { 
    label: "Unknown", 
    color: "bg-gray-500/15 text-gray-600 border-gray-500/20 hover:bg-gray-500/25" 
  },
};

export function ProjectTypeBadge({ type, className }: ProjectTypeBadgeProps) {
  if (!type || type === "none") return null;

  const config = typeConfig[type] || typeConfig.unknown;

  return (
    <Badge className={cn("shadow-none border", config.color, className)}>
      {config.label}
    </Badge>
  );
}
