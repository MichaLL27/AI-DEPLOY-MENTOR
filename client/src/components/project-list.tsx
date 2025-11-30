import { useQuery } from "@tanstack/react-query";
import type { Project } from "@shared/schema";
import { ProjectCard } from "./project-card";
import { EmptyState } from "./empty-state";
import { ProjectTableSkeleton } from "./project-skeleton";

interface ProjectListProps {
  onCreateProject: () => void;
}

export function ProjectList({ onCreateProject }: ProjectListProps) {
  const { data: projects, isLoading, error } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  if (isLoading) {
    return <ProjectTableSkeleton />;
  }

  if (error) {
    return (
      <div 
        className="text-center py-12 text-destructive"
        data-testid="error-state"
      >
        <p className="font-medium">Failed to load projects</p>
        <p className="text-sm text-muted-foreground mt-1">
          {error instanceof Error ? error.message : "An error occurred"}
        </p>
      </div>
    );
  }

  if (!projects || projects.length === 0) {
    return <EmptyState onCreateProject={onCreateProject} />;
  }

  return (
    <div className="space-y-3" data-testid="project-list">
      {projects.map((project) => (
        <ProjectCard key={project.id} project={project} />
      ))}
    </div>
  );
}
