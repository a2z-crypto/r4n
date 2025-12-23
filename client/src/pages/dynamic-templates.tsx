import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Plus, Search, MoreVertical, Pencil, Copy, Trash2, 
  FileCode, ChevronRight, X
} from "lucide-react";
import type { EmailTemplate } from "@shared/schema";
import { format } from "date-fns";

export default function DynamicTemplatesPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<EmailTemplate | null>(null);

  const { data: templates = [], isLoading } = useQuery<EmailTemplate[]>({
    queryKey: ["/api/email-templates"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/email-templates/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Template deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/email-templates"] });
      setDeleteDialogOpen(false);
      setTemplateToDelete(null);
    },
    onError: (error: Error) => {
      toast({ 
        title: "Failed to delete template", 
        description: error.message, 
        variant: "destructive" 
      });
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: async (template: EmailTemplate) => {
      return apiRequest("POST", "/api/email-templates", {
        name: `${template.name} (Copy)`,
        description: template.description,
        subject: template.subject,
        htmlContent: template.htmlContent,
        plainTextContent: template.plainTextContent,
        testData: template.testData,
        variables: template.variables,
        status: "draft",
      });
    },
    onSuccess: () => {
      toast({ title: "Template duplicated" });
      queryClient.invalidateQueries({ queryKey: ["/api/email-templates"] });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Failed to duplicate template", 
        description: error.message, 
        variant: "destructive" 
      });
    },
  });

  const filteredTemplates = templates.filter(template =>
    template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (template.description?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleCreateTemplate = () => {
    setLocation("/dynamic-templates/new");
  };

  const handleEditTemplate = (id: number) => {
    setLocation(`/dynamic-templates/${id}`);
  };

  const handleDeleteTemplate = (template: EmailTemplate) => {
    setTemplateToDelete(template);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (templateToDelete) {
      deleteMutation.mutate(templateToDelete.id);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge variant="default">Active</Badge>;
      case "archived":
        return <Badge variant="secondary">Archived</Badge>;
      default:
        return <Badge variant="outline">Draft</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 p-6 flex items-center justify-center">
        <div className="text-muted-foreground">Loading templates...</div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 space-y-6 overflow-auto">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">
            Dynamic Templates
          </h1>
          <p className="text-muted-foreground">
            Create and manage reusable email templates with dynamic content
          </p>
        </div>
        <Button onClick={handleCreateTemplate} data-testid="button-create-template">
          <Plus className="w-4 h-4 mr-2" />
          Create a Dynamic Template
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="text-sm font-medium text-muted-foreground">Filter</div>
          </div>
          <div className="flex items-center gap-2 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Template Name or Version"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search-templates"
              />
            </div>
            {searchQuery && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setSearchQuery("")}
                data-testid="button-clear-filter"
              >
                Clear
              </Button>
            )}
          </div>

          {filteredTemplates.length === 0 ? (
            <div className="text-center py-12">
              <FileCode className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No templates found</h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery 
                  ? "Try adjusting your search query" 
                  : "Get started by creating your first dynamic template"}
              </p>
              {!searchQuery && (
                <Button onClick={handleCreateTemplate} data-testid="button-create-first-template">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Template
                </Button>
              )}
            </div>
          ) : (
            <div className="border rounded-md">
              <div className="grid grid-cols-[1fr_auto_auto] gap-4 p-4 border-b bg-muted/50">
                <div className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                  Template
                </div>
                <div className="text-sm font-medium text-muted-foreground uppercase tracking-wide w-48">
                  Last Edited
                </div>
                <div className="w-8"></div>
              </div>

              {filteredTemplates.map((template) => (
                <div 
                  key={template.id}
                  className="grid grid-cols-[1fr_auto_auto] gap-4 p-4 border-b last:border-b-0 hover-elevate cursor-pointer group"
                  onClick={() => handleEditTemplate(template.id)}
                  data-testid={`row-template-${template.id}`}
                >
                  <div className="flex items-center gap-3">
                    <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                    <div>
                      <div className="font-medium flex items-center gap-2">
                        {template.name}
                        {getStatusBadge(template.status)}
                      </div>
                      {template.description && (
                        <div className="text-sm text-muted-foreground mt-1">
                          {template.description}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground w-48 flex items-center">
                    {format(new Date(template.updatedAt), "MMM d, yyyy h:mm a")}
                  </div>
                  <div className="w-8 flex items-center">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          data-testid={`button-menu-template-${template.id}`}
                        >
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditTemplate(template.id);
                          }}
                          data-testid={`menu-item-edit-${template.id}`}
                        >
                          <Pencil className="w-4 h-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={(e) => {
                            e.stopPropagation();
                            duplicateMutation.mutate(template);
                          }}
                          data-testid={`menu-item-duplicate-${template.id}`}
                        >
                          <Copy className="w-4 h-4 mr-2" />
                          Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteTemplate(template);
                          }}
                          className="text-destructive focus:text-destructive"
                          data-testid={`menu-item-delete-${template.id}`}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Template</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{templateToDelete?.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              data-testid="button-cancel-delete"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
