import { FolderOpen, Plus, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface EmptyStateProps {
  onCreateProject: () => void;
}

export function EmptyState({ onCreateProject }: EmptyStateProps) {
  return (
    <Card className="border-dashed border-2 bg-muted/5 shadow-none max-w-2xl mx-auto mt-8">
      <CardContent className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <div className="relative mb-6 group">
          <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full group-hover:bg-primary/30 transition-all duration-500"></div>
          <div className="relative rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 p-6 border border-primary/10 shadow-sm">
            <Rocket className="h-12 w-12 text-primary" />
          </div>
        </div>
        
        <h3 className="text-2xl font-bold tracking-tight mb-3">No projects yet</h3>
        <p className="text-muted-foreground max-w-md mb-8 leading-relaxed">
          Get started by registering your first project. We'll help you analyze, fix, test, and deploy your application to production automatically.
        </p>
        
        <Button 
          onClick={onCreateProject} 
          size="lg" 
          className="shadow-md hover:shadow-lg transition-all bg-primary hover:bg-primary/90"
          data-testid="button-create-first-project"
        >
          <Plus className="h-5 w-5 mr-2" />
          Create Your First Project
        </Button>
      </CardContent>
    </Card>
  );
}
