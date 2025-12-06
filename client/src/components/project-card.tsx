import { useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import type { Project } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "./status-badge";
import { SourceIcon } from "./source-icon";
import { 
  PlayCircle, 
  Rocket, 
  ExternalLink, 
  ChevronRight,
  Loader2,
  Clock,
  CheckCircle,
  GitBranch
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface ProjectCardProps {
  project: Project;
}

export function ProjectCard({ project }: ProjectCardProps) {
  const { toast } = useToast();



  const deployMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/projects/${project.id}/deploy`);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", project.id] });
      toast({
        title: "Deployment successful",
        description: `Your project is now live at ${data.deployedUrl}`,
      });
    },
    onError: (error: Error) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({
        title: "Deployment failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const canRunQa = false;
  const canDeploy = project.status === "qa_passed" || project.autoFixStatus === "success" || project.readyForDeploy === "true";
  const isDeployed = project.status === "deployed";
  const isRunningQa = project.status === "qa_running";
  const isDeploying = project.status === "deploying" || deployMutation.isPending;

  return (
    <Card 
      className="group overflow-hidden hover:shadow-md transition-all duration-300 border-muted/60 hover:border-primary/20 bg-card/50 backdrop-blur-sm"
      data-testid={`card-project-${project.id}`}
    >
      <CardContent className="p-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5">
          <div className="flex items-start sm:items-center gap-4 min-w-0 flex-1">
            <div className={cn(
              "shrink-0 h-12 w-12 rounded-xl flex items-center justify-center shadow-sm transition-colors",
              "bg-gradient-to-br from-primary/10 to-primary/5 group-hover:from-primary/20 group-hover:to-primary/10"
            )}>
              <span className="text-xl font-bold text-primary">
                {project.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <Link href={`/projects/${project.id}`}>
                  <h3 
                    className="font-semibold text-lg truncate hover:text-primary transition-colors cursor-pointer"
                    data-testid={`text-project-name-${project.id}`}
                  >
                    {project.name}
                  </h3>
                </Link>
                {(project as any).autoReadyMessage && (
                  <Badge variant="secondary" className="h-5 px-1.5 bg-green-500/10 text-green-600 hover:bg-green-500/20 border-green-500/20">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Auto-fixed
                  </Badge>
                )}
              </div>
              
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <SourceIcon sourceType={project.sourceType} />
                <span className="w-px h-3 bg-border" />
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  {formatDistanceToNow(new Date(project.createdAt), { addSuffix: true })}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap pt-2 sm:pt-0 border-t sm:border-t-0 mt-2 sm:mt-0">
            <StatusBadge status={project.status} />

            <div className="flex items-center gap-2 ml-auto sm:ml-0">
              {canDeploy && (
                <Button
                  size="sm"
                  onClick={() => deployMutation.mutate()}
                  disabled={isDeploying}
                  className="h-8 text-xs font-medium bg-primary hover:bg-primary/90"
                  data-testid={`button-deploy-${project.id}`}
                >
                  {isDeploying ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <Rocket className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  Deploy
                </Button>
              )}

              {isDeployed && project.deployedUrl && (
                <Button
                  size="sm"
                  variant="outline"
                  asChild
                  className="h-8 text-xs font-medium"
                  data-testid={`button-view-live-${project.id}`}
                >
                  <a 
                    href={project.deployedUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                    View Live
                  </a>
                </Button>
              )}

              <Link href={`/projects/${project.id}`}>
                <Button 
                  size="icon" 
                  variant="ghost"
                  className="h-8 w-8 text-muted-foreground hover:text-primary"
                  data-testid={`button-view-details-${project.id}`}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
        
        {/* Progress indicator line at bottom */}
        <div className="h-1 w-full bg-muted/30">
          <div 
            className={cn(
              "h-full transition-all duration-500",
              project.status === 'deployed' ? "w-full bg-green-500" :
              project.status === 'qa_passed' ? "w-2/3 bg-blue-500" :
              project.status === 'qa_failed' ? "w-1/3 bg-red-500" :
              "w-0"
            )} 
          />
        </div>
      </CardContent>
    </Card>
  );
}
