import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Project } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { ProjectList } from "@/components/project-list";
import { NewProjectDialog } from "@/components/new-project-dialog";
import { ThemeToggle } from "@/components/theme-toggle";
import { Plus, Rocket, FolderKanban, CheckCircle2, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Dashboard() {
  const [dialogOpen, setDialogOpen] = useState(false);
  
  const { data: projects } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const projectCount = projects?.length ?? 0;
  const deployedCount = projects?.filter(p => p.status === "deployed").length ?? 0;
  const activeCount = projects?.filter(p => p.status !== "deployed" && p.status !== "deploy_failed").length ?? 0;

  return (
    <div className="min-h-screen bg-background selection:bg-primary/10">
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
        <div className="container max-w-7xl mx-auto flex h-16 items-center justify-between px-4 gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 shadow-lg shadow-primary/20 flex items-center justify-center">
              <Rocket className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-bold text-lg tracking-tight leading-none">AI Deploy Mentor</h1>
              <p className="text-xs text-muted-foreground font-medium mt-1">
                Production-ready deployments
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Button 
              onClick={() => setDialogOpen(true)} 
              data-testid="button-new-project"
              className="shadow-md hover:shadow-lg transition-all bg-primary hover:bg-primary/90"
            >
              <Plus className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">New Project</span>
              <span className="sm:hidden">New</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="container max-w-7xl mx-auto py-8 px-4 space-y-8">
        {projectCount > 0 && (
          <div className="grid gap-4 md:grid-cols-3">
            <div className="p-6 rounded-2xl bg-card border shadow-sm relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="flex items-center justify-between relative">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Projects</p>
                  <h3 className="text-3xl font-bold mt-2">{projectCount}</h3>
                </div>
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <FolderKanban className="h-6 w-6" />
                </div>
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-card border shadow-sm relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="flex items-center justify-between relative">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Live Deployments</p>
                  <h3 className="text-3xl font-bold mt-2 text-green-600">{deployedCount}</h3>
                </div>
                <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center text-green-600">
                  <Rocket className="h-6 w-6" />
                </div>
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-card border shadow-sm relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="flex items-center justify-between relative">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Active Pipelines</p>
                  <h3 className="text-3xl font-bold mt-2 text-blue-600">{activeCount}</h3>
                </div>
                <div className="h-12 w-12 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-600">
                  <LayoutDashboard className="h-6 w-6" />
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {projectCount > 0 && (
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold tracking-tight">Recent Projects</h2>
            </div>
          )}
          
          <ProjectList onCreateProject={() => setDialogOpen(true)} />
        </div>
      </main>

      <NewProjectDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
