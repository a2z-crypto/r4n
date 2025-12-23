import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Search, Activity, Database, BarChart2, FileText, Trash2, Heart, Calendar, 
  MessageCircle, Loader2, BookTemplate, Plus, Sparkles, Clock, Play
} from "lucide-react";
import cronstrue from "cronstrue";
import type { DbJobTemplate } from "@shared/schema";

const iconMap: Record<string, any> = {
  activity: Activity,
  database: Database,
  "bar-chart-2": BarChart2,
  "file-text": FileText,
  "trash-2": Trash2,
  heart: Heart,
  calendar: Calendar,
  "message-circle": MessageCircle,
};

const categoryLabels: Record<string, string> = {
  monitoring: "Monitoring",
  backup: "Backup",
  reporting: "Reporting",
  maintenance: "Maintenance",
  notifications: "Notifications",
  general: "General",
};

export default function JobTemplates() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [useDialogOpen, setUseDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<DbJobTemplate | null>(null);
  const [jobName, setJobName] = useState("");

  const { data: templates = [], isLoading } = useQuery<DbJobTemplate[]>({
    queryKey: ["/api/job-templates"],
  });

  const seedMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/job-templates/seed");
    },
    onSuccess: () => {
      toast({ title: "Templates seeded", description: "Built-in templates have been added." });
      queryClient.invalidateQueries({ queryKey: ["/api/job-templates"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const useMutation2 = useMutation({
    mutationFn: async ({ templateId, name }: { templateId: number; name: string }) => {
      return apiRequest("POST", `/api/job-templates/${templateId}/use`, { name: name || undefined });
    },
    onSuccess: () => {
      toast({ title: "Job created", description: "A new job has been created from the template." });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/job-templates"] });
      setUseDialogOpen(false);
      navigate("/jobs");
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const categories = Array.from(new Set(templates.map(t => t.category)));

  const filteredTemplates = templates.filter(template => {
    const matchesSearch = 
      template.name.toLowerCase().includes(search.toLowerCase()) ||
      template.description?.toLowerCase().includes(search.toLowerCase()) ||
      template.tags?.some(tag => tag.toLowerCase().includes(search.toLowerCase()));
    const matchesCategory = activeTab === "all" || template.category === activeTab;
    return matchesSearch && matchesCategory;
  });

  const handleUseTemplate = (template: DbJobTemplate) => {
    setSelectedTemplate(template);
    setJobName(template.name);
    setUseDialogOpen(true);
  };

  const confirmUseTemplate = () => {
    if (selectedTemplate) {
      useMutation2.mutate({ templateId: selectedTemplate.id, name: jobName });
    }
  };

  const getIcon = (iconName: string | null) => {
    const Icon = iconMap[iconName || "activity"] || Activity;
    return <Icon className="h-5 w-5" />;
  };

  const getCronDescription = (expression: string) => {
    try {
      return cronstrue.toString(expression, { verbose: false });
    } catch {
      return expression;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Job Templates</h1>
            <p className="text-muted-foreground">Start quickly with pre-built automation patterns</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-full" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Job Templates</h1>
          <p className="text-muted-foreground">Start quickly with pre-built automation patterns</p>
        </div>
        <div className="flex items-center gap-2">
          {templates.length === 0 && (
            <Button 
              onClick={() => seedMutation.mutate()}
              disabled={seedMutation.isPending}
              variant="outline"
              className="gap-2"
              data-testid="button-seed-templates"
            >
              {seedMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Load Built-in Templates
            </Button>
          )}
          <Link href="/jobs/new">
            <Button className="gap-2" data-testid="button-create-job">
              <Plus className="h-4 w-4" />
              Create Custom Job
            </Button>
          </Link>
        </div>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 min-w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
            data-testid="input-search-templates"
          />
        </div>
      </div>

      {templates.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BookTemplate className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">No Templates Yet</h3>
            <p className="text-muted-foreground text-center max-w-md mt-2">
              Load the built-in templates to get started with common automation patterns, 
              or create your own custom job.
            </p>
            <Button 
              onClick={() => seedMutation.mutate()}
              disabled={seedMutation.isPending}
              className="mt-4 gap-2"
              data-testid="button-seed-templates-empty"
            >
              {seedMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Load Built-in Templates
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="all" data-testid="tab-all">All</TabsTrigger>
            {categories.map(category => (
              <TabsTrigger key={category} value={category} data-testid={`tab-${category}`}>
                {categoryLabels[category] || category}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value={activeTab} className="mt-4">
            {filteredTemplates.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No templates match your search.
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredTemplates.map(template => (
                  <Card key={template.id} className="flex flex-col">
                    <CardHeader className="flex flex-row items-start gap-4 space-y-0 pb-2">
                      <div className="p-2 rounded-md bg-primary/10 text-primary">
                        {getIcon(template.icon)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base truncate" data-testid={`template-name-${template.id}`}>
                          {template.name}
                        </CardTitle>
                        <CardDescription className="line-clamp-2 mt-1">
                          {template.description}
                        </CardDescription>
                      </div>
                      {template.isBuiltIn && (
                        <Badge variant="secondary" className="shrink-0">Built-in</Badge>
                      )}
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col justify-between gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="h-4 w-4" />
                          <span className="truncate">{getCronDescription(template.cronExpression)}</span>
                        </div>
                        {template.tags && template.tags.length > 0 && (
                          <div className="flex items-center gap-1 flex-wrap">
                            {template.tags.slice(0, 3).map(tag => (
                              <Badge key={tag} variant="outline" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-muted-foreground">
                          Used {template.usageCount} times
                        </span>
                        <Button 
                          size="sm" 
                          onClick={() => handleUseTemplate(template)}
                          className="gap-1"
                          data-testid={`button-use-template-${template.id}`}
                        >
                          <Play className="h-3 w-3" />
                          Use Template
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}

      <Dialog open={useDialogOpen} onOpenChange={setUseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Job from Template</DialogTitle>
            <DialogDescription>
              This will create a new active job using the "{selectedTemplate?.name}" template.
              You can customize the name below.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium" htmlFor="job-name">Job Name</label>
              <Input
                id="job-name"
                value={jobName}
                onChange={(e) => setJobName(e.target.value)}
                placeholder="Enter job name..."
                className="mt-1"
                data-testid="input-job-name"
              />
            </div>
            {selectedTemplate && (
              <div className="p-3 rounded-md bg-muted text-sm space-y-1">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>{getCronDescription(selectedTemplate.cronExpression)}</span>
                </div>
                <div className="text-muted-foreground text-xs">
                  Cron: {selectedTemplate.cronExpression}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUseDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={confirmUseTemplate}
              disabled={useMutation2.isPending || !jobName.trim()}
              data-testid="button-confirm-use-template"
            >
              {useMutation2.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              Create Job
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
