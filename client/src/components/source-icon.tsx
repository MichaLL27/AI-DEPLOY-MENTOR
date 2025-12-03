import type { SourceType } from "@shared/schema";
import { SiGithub, SiReplit } from "react-icons/si";
import { FileArchive, Globe, Heart, Database } from "lucide-react";
import { cn } from "@/lib/utils";

interface SourceIconProps {
  sourceType: SourceType;
  className?: string;
  showLabel?: boolean;
}

const iconMap: Record<SourceType, {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  colorClass: string;
}> = {
  github: { 
    icon: SiGithub, 
    label: "GitHub",
    colorClass: "text-slate-950 dark:text-white"
  },
  replit: { 
    icon: SiReplit, 
    label: "Replit",
    colorClass: "text-orange-500"
  },
  lovable: {
    icon: Heart,
    label: "Lovable",
    colorClass: "text-pink-500"
  },
  base44: {
    icon: Database,
    label: "Base44",
    colorClass: "text-indigo-500"
  },
  zip: {  
    icon: FileArchive, 
    label: "ZIP Archive",
    colorClass: "text-yellow-600 dark:text-yellow-500"
  },
  other: { 
    icon: Globe, 
    label: "Other Source",
    colorClass: "text-blue-500"
  },
};

export function SourceIcon({ sourceType, className, showLabel = true }: SourceIconProps) {
  const config = iconMap[sourceType] || iconMap.other;
  const Icon = config.icon;

  return (
    <div 
      className={cn("flex items-center gap-2", className)}
      title={config.label}
    >
      <Icon className={cn("h-4 w-4", config.colorClass)} />
      {showLabel && (
        <span className="text-sm text-muted-foreground font-medium">
          {config.label}
        </span>
      )}
    </div>
  );
}
