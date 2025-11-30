import type { SourceType } from "@shared/schema";
import { SiGithub, SiReplit } from "react-icons/si";
import { FileArchive, Globe } from "lucide-react";
import { cn } from "@/lib/utils";

interface SourceIconProps {
  sourceType: SourceType;
  className?: string;
}

const iconMap: Record<SourceType, {
  icon: typeof SiGithub | typeof FileArchive;
  label: string;
}> = {
  github: { icon: SiGithub, label: "GitHub" },
  replit: { icon: SiReplit, label: "Replit" },
  zip: { icon: FileArchive, label: "ZIP Archive" },
  other: { icon: Globe, label: "Other Source" },
};

export function SourceIcon({ sourceType, className }: SourceIconProps) {
  const config = iconMap[sourceType];
  const Icon = config.icon;

  return (
    <div 
      className={cn("flex items-center gap-2", className)}
      title={config.label}
    >
      <Icon className="h-4 w-4 text-muted-foreground" />
      <span className="text-sm text-muted-foreground capitalize">{sourceType}</span>
    </div>
  );
}
