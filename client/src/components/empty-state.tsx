import { FolderOpen, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  onCreateProject: () => void;
}

export function EmptyState({ onCreateProject }: EmptyStateProps) {
  return (
    <div 
      className="flex flex-col items-center justify-center py-16 px-4"
      data-testid="empty-state"
    >
      <div className="rounded-full bg-muted p-4 mb-6">
        <FolderOpen className="h-10 w-10 text-muted-foreground" />
      </div>
      <h3 className="text-xl font-semibold mb-2">No projects yet</h3>
      <p className="text-muted-foreground text-center max-w-sm mb-6">
        Get started by registering your first project. We'll help you run QA checks 
        and deploy it to production.
      </p>
      <Button onClick={onCreateProject} data-testid="button-create-first-project">
        <Plus className="h-4 w-4 mr-2" />
        Create Your First Project
      </Button>
    </div>
  );
}
