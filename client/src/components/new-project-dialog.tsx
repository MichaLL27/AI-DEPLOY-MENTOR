import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { insertProjectSchema, type InsertProject, sourceTypeValues } from "@shared/schema";
import { useState, useRef } from "react";
import { ChevronDown, Upload, Link as LinkIcon, Box, Settings2, Heart, Database } from "lucide-react";
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
import { cn } from "@/lib/utils";

interface NewProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type IconComponent = React.ComponentType<{ className?: string }>;

const sourceTypeLabels: Record<string, { label: string; icon: IconComponent; placeholder: string; description: string }> = {
  github: { 
    label: "GitHub", 
    icon: SiGithub, 
    placeholder: "https://github.com/username/repo",
    description: "Import directly from a GitHub repository"
  },
  replit: { 
    label: "Replit", 
    icon: SiReplit, 
    placeholder: "https://replit.com/@username/project",
    description: "Import from a Replit project URL"
  },
  lovable: {
    label: "Lovable",
    icon: Heart,
    placeholder: "https://github.com/username/lovable-project",
    description: "Import a Lovable project (via GitHub)"
  },
  base44: {
    label: "Base44",
    icon: Database,
    placeholder: "https://base44.com/project/...",
    description: "Import from Base44 platform"
  },
  zip: {  
    label: "ZIP Archive", 
    icon: FileArchive, 
    placeholder: "https://example.com/project.zip",
    description: "Upload a .zip file containing your code"
  },
  other: { 
    label: "Other URL", 
    icon: Globe, 
    placeholder: "https://example.com/source",
    description: "Import from any public Git URL"
  },
};

export function NewProjectDialog({ open, onOpenChange }: NewProjectDialogProps) {
  const { toast } = useToast();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [useZipUpload, setUseZipUpload] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<InsertProject>({
    resolver: zodResolver(insertProjectSchema),
    defaultValues: {
      name: "",
      sourceType: "github",
      sourceValue: "",
      renderServiceId: "",
      renderDashboardUrl: "",
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

  const zipUploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      if (form.getValues("name")) {
        formData.append("name", form.getValues("name"));
      }

      const response = await fetch("/api/projects/upload-zip", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({
        title: "ZIP uploaded and analyzed",
        description: "Your project has been created and analyzed successfully.",
      });
      form.reset();
      setSelectedFile(null);
      setUseZipUpload(false);
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to upload ZIP",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertProject) => {
    createMutation.mutate(data);
  };

  const handleRegister = async () => {
    if (useZipUpload) {
      const isNameValid = await form.trigger("name");
      if (isNameValid && selectedFile) {
        zipUploadMutation.mutate(selectedFile);
      } else if (!selectedFile) {
        toast({
          title: "File required",
          description: "Please select a ZIP file to upload.",
          variant: "destructive",
        });
      }
    } else {
      form.handleSubmit(onSubmit)();
    }
  };

  const selectedSourceType = form.watch("sourceType");
  const sourceConfig = sourceTypeLabels[selectedSourceType];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg overflow-hidden p-0 gap-0">
        <DialogHeader className="p-6 pb-4 bg-muted/10 border-b">
          <DialogTitle className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Box className="h-6 w-6 text-primary" />
            New Project
          </DialogTitle>
          <DialogDescription>
            Import your code to start the automated deployment pipeline.
          </DialogDescription>
        </DialogHeader>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-3 p-1 bg-muted/50 rounded-lg">
            <Button
              type="button"
              variant={!useZipUpload ? "default" : "ghost"}
              onClick={() => setUseZipUpload(false)}
              className={cn("flex-1 shadow-sm", !useZipUpload ? "bg-white text-primary hover:bg-white/90 dark:bg-slate-950 dark:text-primary" : "hover:bg-transparent")}
              data-testid="button-source-mode"
            >
              <LinkIcon className="h-4 w-4 mr-2" />
              Import from URL
            </Button>
            <Button
              type="button"
              variant={useZipUpload ? "default" : "ghost"}
              onClick={() => setUseZipUpload(true)}
              className={cn("flex-1 shadow-sm", useZipUpload ? "bg-white text-primary hover:bg-white/90 dark:bg-slate-950 dark:text-primary" : "hover:bg-transparent")}
              data-testid="button-zip-mode"
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload ZIP
            </Button>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold uppercase text-muted-foreground">Project Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={useZipUpload ? "My ZIP Project" : "My Awesome App"}
                        data-testid="input-project-name"
                        className="bg-muted/30"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {useZipUpload ? (
                <FormItem>
                  <FormLabel className="text-xs font-semibold uppercase text-muted-foreground">ZIP File</FormLabel>
                  <FormControl>
                    <div 
                      className={cn(
                        "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all",
                        selectedFile ? "border-primary/50 bg-primary/5" : "border-muted-foreground/20 hover:border-primary/30 hover:bg-muted/30"
                      )}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".zip"
                        onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                        className="hidden"
                        data-testid="input-zip-file"
                      />
                      
                      {selectedFile ? (
                        <div className="flex flex-col items-center gap-2">
                          <FileArchive className="h-10 w-10 text-primary" />
                          <p className="font-medium text-foreground">{selectedFile.name}</p>
                          <p className="text-xs text-muted-foreground">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                          <Button variant="ghost" size="sm" className="mt-2 h-8 text-xs">Change File</Button>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2">
                          <Upload className="h-10 w-10 text-muted-foreground/50" />
                          <p className="font-medium text-muted-foreground">Click to upload ZIP</p>
                          <p className="text-xs text-muted-foreground/70">Max file size: 50MB</p>
                        </div>
                      )}
                    </div>
                  </FormControl>
                  {!selectedFile && <FormMessage>Please select a ZIP file</FormMessage>}
                </FormItem>
              ) : (
                <>
                  <FormField
                    control={form.control}
                    name="sourceType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-semibold uppercase text-muted-foreground">Source Type</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-source-type" className="bg-muted/30">
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
                                    <span>{config.label}</span>
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
                        <FormLabel className="text-xs font-semibold uppercase text-muted-foreground">Repository URL</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              placeholder={sourceConfig.placeholder}
                              data-testid="input-source-value"
                              className="bg-muted/30 pl-9"
                              {...field}
                            />
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                              <LinkIcon className="h-4 w-4" />
                            </div>
                          </div>
                        </FormControl>
                        <FormDescription className="text-xs">
                          {sourceConfig.description}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex items-center gap-2 text-xs font-medium hover:text-primary text-muted-foreground transition-colors"
                  data-testid="button-toggle-advanced"
                >
                  <Settings2 className="h-3.5 w-3.5" />
                  Advanced Configuration
                  <ChevronDown 
                    className={`h-3 w-3 transition-transform ${showAdvanced ? "rotate-180" : ""}`}
                  />
                </button>
                
                {showAdvanced && (
                  <div className="space-y-4 mt-4 p-4 bg-muted/30 rounded-lg border border-muted/50 animate-in slide-in-from-top-2 fade-in duration-200">
                    <FormField
                      control={form.control}
                      name="renderServiceId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Render Service ID</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="srv-xxxxx"
                              data-testid="input-render-service-id"
                              className="h-8 text-sm bg-background"
                              {...field}
                              value={field.value || ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="renderDashboardUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Render Dashboard URL</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="https://dashboard.render.com/d/srv-xxxxx"
                              data-testid="input-render-dashboard-url"
                              className="h-8 text-sm bg-background"
                              {...field}
                              value={field.value || ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => onOpenChange(false)}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleRegister}
                  disabled={useZipUpload ? (zipUploadMutation.isPending || !selectedFile) : createMutation.isPending}
                  className="bg-primary hover:bg-primary/90 shadow-sm"
                  data-testid="button-register-project"
                >
                  {(createMutation.isPending || zipUploadMutation.isPending) && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {useZipUpload ? "Upload & Create" : "Create Project"}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
