import { Badge } from "@/components/ui/badge";

interface ProjectTypeBadgeProps {
  type?: string | null;
}

const typeConfig: Record<string, { label: string; color: string }> = {
  static_web: { label: "Static Web", color: "bg-green-600 hover:bg-green-700" },
  node_backend: { label: "Node Backend", color: "bg-blue-600 hover:bg-blue-700" },
  nextjs: { label: "Next.js", color: "bg-purple-600 hover:bg-purple-700" },
  react_spa: { label: "React SPA", color: "bg-cyan-600 hover:bg-cyan-700" },
  python_flask: { label: "Python", color: "bg-yellow-600 hover:bg-yellow-700" },
  unknown: { label: "Unknown", color: "bg-gray-600 hover:bg-gray-700" },
};

export function ProjectTypeBadge({ type }: ProjectTypeBadgeProps) {
  if (!type || type === "none") return null;

  const config = typeConfig[type] || typeConfig.unknown;

  return (
    <Badge className={config.color}>
      {config.label}
    </Badge>
  );
}
