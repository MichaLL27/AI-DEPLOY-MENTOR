import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { insertProjectSchema, type InsertProject, sourceTypeValues } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SiGithub, SiReplit } from "react-icons/si";
import { FileArchive, Globe, Loader2 } from "lucide-react";

interface NewProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const sourceTypeLabels: Record<string, { label: string; icon: typeof SiGithub; placeholder: string }> = {
  github: { 
    label: "GitHub", 
    icon: SiGithub, 
    placeholder: "https://github.com/username/repo" 
  },
  replit: { 
    label: "Replit", 
    icon: SiReplit, 
    placeholder: "https://replit.com/@username/project" 
  },
  zip: { 
    label: "ZIP Archive", 
    icon: FileArchive, 
    placeholder: "https://example.com/project.zip" 
  },
  other: { 
    label: "Other", 
    icon: Globe, 
    placeholder: "https://example.com/source" 
  },
};

export function NewProjectDialog({ open, onOpenChange }: NewProjectDialogProps) {
  const { toast } = useToast();

  const form = useForm<InsertProject>({
    resolver: zodResolver(insertProjectSchema),
    defaultValues: {
      name: "",
      sourceType: "github",
      sourceValue: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertProject) => {
      const response = await apiRequest("POST", "/api/projects", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({
        title: "Project created",
        description: "Your project has been registered successfully.",
      });
      form.reset();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create project",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertProject) => {
    createMutation.mutate(data);
  };

  const selectedSourceType = form.watch("sourceType");
  const sourceConfig = sourceTypeLabels[selectedSourceType];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold tracking-tight">
            Register New Project
          </DialogTitle>
          <DialogDescription>
            Add your project source and we'll help you run QA checks and deploy it.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Project Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="My Awesome App"
                      data-testid="input-project-name"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    A descriptive name for your project.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="sourceType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Source Type</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="select-source-type">
                        <SelectValue placeholder="Select source type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {sourceTypeValues.map((type) => {
                        const config = sourceTypeLabels[type];
                        const Icon = config.icon;
                        return (
                          <SelectItem 
                            key={type} 
                            value={type}
                            data-testid={`option-source-${type}`}
                          >
                            <div className="flex items-center gap-2">
                              <Icon className="h-4 w-4" />
                              {config.label}
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="sourceValue"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Source URL</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={sourceConfig.placeholder}
                      data-testid="input-source-value"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    The URL or path to your project source code.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending}
                data-testid="button-register-project"
              >
                {createMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Register Project
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
