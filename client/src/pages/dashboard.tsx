import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Project } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { ProjectList } from "@/components/project-list";
import { NewProjectDialog } from "@/components/new-project-dialog";
import { ThemeToggle } from "@/components/theme-toggle";
import { Plus, Rocket, FolderKanban } from "lucide-react";

export default function Dashboard() {
  const [dialogOpen, setDialogOpen] = useState(false);
  
  const { data: projects } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const projectCount = projects?.length ?? 0;
  const deployedCount = projects?.filter(p => p.status === "deployed").length ?? 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container max-w-7xl mx-auto flex h-16 items-center justify-between px-4 gap-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center">
              <Rocket className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-semibold tracking-tight">AI Deploy Mentor</h1>
              <p className="text-xs text-muted-foreground hidden sm:block">
                Transform projects into production
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button onClick={() => setDialogOpen(true)} data-testid="button-new-project">
              <Plus className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">New Project</span>
              <span className="sm:hidden">New</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="container max-w-7xl mx-auto py-8 px-4">
        {projectCount > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Your Projects</h2>
              <p className="text-muted-foreground mt-1">
                Manage and deploy your applications
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm">
                <FolderKanban className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">
                  {projectCount} project{projectCount !== 1 ? "s" : ""}
                </span>
              </div>
              {deployedCount > 0 && (
                <div className="flex items-center gap-2 text-sm">
                  <Rocket className="h-4 w-4 text-chart-2" />
                  <span className="text-chart-2 font-medium">
                    {deployedCount} deployed
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        <ProjectList onCreateProject={() => setDialogOpen(true)} />
      </main>

      <NewProjectDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
