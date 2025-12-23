import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Plus, Mail, Bell, Smartphone, MessageSquare, Pencil, Trash2, Eye, Copy, Send, RefreshCw, Monitor, Upload, X, ImageIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import type { DbNotificationTemplate, DbSmtpConfig, EmailTemplate } from "@shared/schema";

const channelIcons = {
  email: Mail,
  in_app: Bell,
  push: Smartphone,
  sms: MessageSquare,
};

const channelLabels = {
  email: "Email",
  in_app: "In-App",
  push: "Push",
  sms: "SMS",
};

const statusColors = {
  draft: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20",
  active: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
  archived: "bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20",
};

interface TemplateForm {
  name: string;
  description: string;
  channel: "email" | "in_app" | "push" | "sms";
  subject: string;
  content: string;
  status: "draft" | "active" | "archived";
  imageUrl: string;
  iconUrl: string;
}

const defaultForm: TemplateForm = {
  name: "",
  description: "",
  channel: "email",
  subject: "",
  content: "",
  status: "draft",
  imageUrl: "",
  iconUrl: "",
};

export default function NotificationTemplates() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<TemplateForm>(defaultForm);
  const [previewVariables, setPreviewVariables] = useState<string>('{"name": "John Doe", "company": "Acme Inc"}');
  const [previewResult, setPreviewResult] = useState<{ subject?: string; content: string } | null>(null);
  const [testEmailTo, setTestEmailTo] = useState("");
  const [selectedSmtpId, setSelectedSmtpId] = useState<string>("");

  const { data: templates = [], isLoading } = useQuery<DbNotificationTemplate[]>({
    queryKey: ["/api/notification-templates"],
  });

  const { data: smtpConfigs = [] } = useQuery<DbSmtpConfig[]>({
    queryKey: ["/api/settings/smtp"],
  });

  const { data: emailTemplates = [] } = useQuery<EmailTemplate[]>({
    queryKey: ["/api/email-templates"],
  });

  const [selectedEmailTemplateId, setSelectedEmailTemplateId] = useState<string>("");

  const createMutation = useMutation({
    mutationFn: (data: TemplateForm) => apiRequest("POST", "/api/notification-templates", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notification-templates"] });
      toast({ title: "Template created successfully" });
      closeDialog();
    },
    onError: (error: Error) => {
      toast({ title: error.message || "Failed to create template", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: TemplateForm }) =>
      apiRequest("PATCH", `/api/notification-templates/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notification-templates"] });
      toast({ title: "Template updated successfully" });
      closeDialog();
    },
    onError: (error: Error) => {
      toast({ title: error.message || "Failed to update template", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/notification-templates/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notification-templates"] });
      toast({ title: "Template deleted successfully" });
    },
    onError: (error: Error) => {
      toast({ title: error.message || "Failed to delete template", variant: "destructive" });
    },
  });

  const previewMutation = useMutation({
    mutationFn: async (data: { content: string; subject?: string; variables: Record<string, unknown> }) => {
      const response = await apiRequest("POST", "/api/notification-templates/preview", data);
      return response.json();
    },
    onSuccess: (result: { subject?: string; content: string }) => {
      setPreviewResult(result);
    },
    onError: (error: Error) => {
      toast({ title: error.message || "Failed to preview template", variant: "destructive" });
    },
  });

  const sendTestMutation = useMutation({
    mutationFn: async (data: { smtpConfigId: number; to: string; subject: string; content: string }) => {
      const response = await apiRequest("POST", "/api/notification-templates/send-test", data);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Test email sent successfully" });
    },
    onError: (error: Error) => {
      toast({ title: error.message || "Failed to send test email", variant: "destructive" });
    },
  });

  const seedMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/notification-templates/seed", {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notification-templates"] });
      toast({ title: "Example templates created successfully" });
    },
    onError: (error: Error) => {
      toast({ title: error.message || "Failed to seed templates", variant: "destructive" });
    },
  });

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingId(null);
    setForm(defaultForm);
    setPreviewResult(null);
    setSelectedEmailTemplateId("");
  };

  const openCreateDialog = () => {
    setForm(defaultForm);
    setEditingId(null);
    setPreviewResult(null);
    setSelectedEmailTemplateId("");
    setIsDialogOpen(true);
  };

  const openEditDialog = (template: DbNotificationTemplate) => {
    setForm({
      name: template.name,
      description: template.description || "",
      channel: template.channel as TemplateForm["channel"],
      subject: template.subject || "",
      content: template.content,
      status: template.status as TemplateForm["status"],
      imageUrl: template.imageUrl || "",
      iconUrl: template.iconUrl || "",
    });
    setEditingId(template.id);
    setPreviewResult(null);
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const handlePreview = () => {
    try {
      const variables = JSON.parse(previewVariables);
      previewMutation.mutate({
        content: form.content,
        subject: form.subject || undefined,
        variables,
      });
    } catch {
      toast({ title: "Invalid JSON for variables", variant: "destructive" });
    }
  };

  const handleSendTest = () => {
    if (!testEmailTo || !selectedSmtpId) {
      toast({ title: "Please enter recipient email and select SMTP config", variant: "destructive" });
      return;
    }
    if (!previewResult) {
      toast({ title: "Please render preview first", variant: "destructive" });
      return;
    }
    sendTestMutation.mutate({
      smtpConfigId: parseInt(selectedSmtpId),
      to: testEmailTo,
      subject: previewResult.subject || form.subject || "Test Email",
      content: previewResult.content,
    });
  };

  const duplicateTemplate = (template: DbNotificationTemplate) => {
    setForm({
      name: `${template.name} (Copy)`,
      description: template.description || "",
      channel: template.channel as TemplateForm["channel"],
      subject: template.subject || "",
      content: template.content,
      status: "draft",
      imageUrl: template.imageUrl || "",
      iconUrl: template.iconUrl || "",
    });
    setEditingId(null);
    setPreviewResult(null);
    setIsDialogOpen(true);
  };

  // Set default SMTP config when configs load
  useEffect(() => {
    if (smtpConfigs.length > 0 && !selectedSmtpId) {
      const defaultConfig = smtpConfigs.find(c => c.isDefault) || smtpConfigs[0];
      setSelectedSmtpId(defaultConfig.id.toString());
    }
  }, [smtpConfigs, selectedSmtpId]);

  // Auto-preview when content changes (debounced)
  const parsedVariables = useMemo(() => {
    try {
      return JSON.parse(previewVariables);
    } catch {
      return {};
    }
  }, [previewVariables]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Notification Templates</h1>
          <p className="text-muted-foreground">
            Manage email and in-app notification templates with dynamic variables
          </p>
        </div>
        <Button onClick={openCreateDialog} data-testid="button-create-template">
          <Plus className="mr-2 h-4 w-4" />
          New Template
        </Button>
      </div>

      {templates.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Mail className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No templates yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Create your first notification template or load example templates to get started.
            </p>
            <div className="flex gap-2 flex-wrap">
              <Button onClick={openCreateDialog}>
                <Plus className="mr-2 h-4 w-4" />
                Create Template
              </Button>
              <Button 
                variant="outline" 
                onClick={() => seedMutation.mutate()} 
                disabled={seedMutation.isPending}
                data-testid="button-seed-templates"
              >
                {seedMutation.isPending ? "Loading..." : "Load Examples"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => {
            const IconComponent = channelIcons[template.channel as keyof typeof channelIcons] || Mail;
            return (
              <Card key={template.id} className="overflow-visible" data-testid={`template-${template.id}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="rounded-md bg-muted p-2">
                      <IconComponent className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex items-center gap-1">
                      <Badge variant="outline" className={statusColors[template.status as keyof typeof statusColors]}>
                        {template.status}
                      </Badge>
                      <Badge variant="secondary">
                        {channelLabels[template.channel as keyof typeof channelLabels]}
                      </Badge>
                    </div>
                  </div>
                  <CardTitle className="text-base mt-3">{template.name}</CardTitle>
                  {template.description && (
                    <CardDescription className="text-sm line-clamp-2">
                      {template.description}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className="pt-0">
                  {template.subject && (
                    <p className="text-xs text-muted-foreground mb-3 truncate">
                      Subject: {template.subject}
                    </p>
                  )}
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditDialog(template)}
                      data-testid={`button-edit-${template.id}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => duplicateTemplate(template)}
                      data-testid={`button-duplicate-${template.id}`}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteMutation.mutate(template.id)}
                      data-testid={`button-delete-${template.id}`}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Template" : "Create Template"}</DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-hidden min-h-0">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
              {/* Left side - Form */}
              <div className="space-y-4 overflow-y-auto pr-2 max-h-[calc(90vh-180px)]">
                <div className="grid gap-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Welcome Email"
                    data-testid="input-template-name"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Send when new user signs up"
                    data-testid="input-template-description"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="channel">Channel</Label>
                    <Select value={form.channel} onValueChange={(v) => setForm({ ...form, channel: v as TemplateForm["channel"] })}>
                      <SelectTrigger data-testid="select-channel">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="in_app">In-App</SelectItem>
                        <SelectItem value="push">Push Notification</SelectItem>
                        <SelectItem value="sms">SMS</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="status">Status</Label>
                    <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as TemplateForm["status"] })}>
                      <SelectTrigger data-testid="select-status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="archived">Archived</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {(form.channel === "email") && (
                  <>
                    <div className="grid gap-2">
                      <Label htmlFor="subject">Subject</Label>
                      <Input
                        id="subject"
                        value={form.subject}
                        onChange={(e) => setForm({ ...form, subject: e.target.value })}
                        placeholder="Welcome to our platform, {{name}}!"
                        data-testid="input-template-subject"
                      />
                    </div>
                    {emailTemplates.length > 0 && (
                      <div className="grid gap-2">
                        <Label>Use Dynamic Template</Label>
                        <Select
                          value={selectedEmailTemplateId}
                          onValueChange={(value) => {
                            setSelectedEmailTemplateId(value);
                            if (value && value !== "none") {
                              const template = emailTemplates.find(t => t.id.toString() === value);
                              if (template) {
                                setForm({
                                  ...form,
                                  subject: template.subject || form.subject,
                                  content: template.htmlContent || form.content,
                                });
                                setPreviewResult(null);
                                if (template.testData) {
                                  setPreviewVariables(JSON.stringify(template.testData, null, 2));
                                }
                                toast({ title: "Template loaded", description: `"${template.name}" content applied` });
                              }
                            }
                          }}
                        >
                          <SelectTrigger data-testid="select-email-template">
                            <SelectValue placeholder="Select a template (optional)" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Custom content</SelectItem>
                            {emailTemplates.filter(t => t.status === "active").map((template) => (
                              <SelectItem key={template.id} value={template.id.toString()}>
                                {template.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          Select a reusable dynamic template or write custom content below
                        </p>
                      </div>
                    )}
                  </>
                )}
                <div className="grid gap-2">
                  <Label htmlFor="content">Content (supports Handlebars syntax)</Label>
                  <Textarea
                    id="content"
                    value={form.content}
                    onChange={(e) => setForm({ ...form, content: e.target.value })}
                    placeholder="Hello {{name}}, welcome to our platform!"
                    rows={5}
                    className="font-mono text-sm"
                    data-testid="input-template-content"
                  />
                  <p className="text-xs text-muted-foreground">
                    Use {"{{variableName}}"} for dynamic content. Example: {"{{user.name}}"}, {"{{date}}"}
                  </p>
                </div>

                {/* Image & Icon Upload Section */}
                <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                  <AssetUploader
                    label="Header Image"
                    value={form.imageUrl}
                    onChange={(url) => setForm({ ...form, imageUrl: url })}
                    placeholder="Upload header image"
                    testId="upload-template-image"
                  />
                  <AssetUploader
                    label="Icon"
                    value={form.iconUrl}
                    onChange={(url) => setForm({ ...form, iconUrl: url })}
                    placeholder="Upload icon"
                    testId="upload-template-icon"
                  />
                </div>
              </div>

              {/* Right side - Preview & Test */}
              <div className="border-l pl-6 space-y-4 overflow-y-auto">
                <Tabs defaultValue="preview" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="preview" data-testid="tab-preview">
                      <Eye className="h-4 w-4 mr-2" />
                      Preview
                    </TabsTrigger>
                    <TabsTrigger value="test" data-testid="tab-test" disabled={form.channel !== "email"}>
                      <Send className="h-4 w-4 mr-2" />
                      Send Test
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="preview" className="space-y-4 mt-4">
                    <div className="grid gap-2">
                      <Label>Test Variables (JSON)</Label>
                      <Textarea
                        value={previewVariables}
                        onChange={(e) => setPreviewVariables(e.target.value)}
                        placeholder='{"name": "John", "company": "Acme Inc"}'
                        rows={3}
                        className="font-mono text-sm"
                        data-testid="input-preview-variables"
                      />
                    </div>
                    <Button 
                      onClick={handlePreview} 
                      disabled={previewMutation.isPending || !form.content}
                      className="w-full"
                      data-testid="button-render-preview"
                    >
                      <RefreshCw className={`h-4 w-4 mr-2 ${previewMutation.isPending ? 'animate-spin' : ''}`} />
                      Render Preview
                    </Button>
                    
                    <Separator />
                    
                    <PreviewPanel 
                      channel={form.channel}
                      subject={previewResult?.subject || form.subject}
                      content={previewResult?.content}
                      imageUrl={form.imageUrl}
                      iconUrl={form.iconUrl}
                    />
                  </TabsContent>

                  <TabsContent value="test" className="space-y-4 mt-4">
                    {smtpConfigs.length === 0 ? (
                      <div className="text-center py-8">
                        <Mail className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                        <p className="text-sm text-muted-foreground mb-2">
                          No SMTP configurations found
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Configure an SMTP server in Settings to send test emails
                        </p>
                      </div>
                    ) : (
                      <>
                        <div className="grid gap-2">
                          <Label>SMTP Configuration</Label>
                          <Select value={selectedSmtpId} onValueChange={setSelectedSmtpId}>
                            <SelectTrigger data-testid="select-smtp-config">
                              <SelectValue placeholder="Select SMTP config" />
                            </SelectTrigger>
                            <SelectContent>
                              {smtpConfigs.map((config) => (
                                <SelectItem key={config.id} value={config.id.toString()}>
                                  {config.name} {config.isDefault && "(Default)"}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div className="grid gap-2">
                          <Label>Recipient Email</Label>
                          <Input
                            type="email"
                            value={testEmailTo}
                            onChange={(e) => setTestEmailTo(e.target.value)}
                            placeholder="test@example.com"
                            data-testid="input-test-email-to"
                          />
                        </div>

                        {!previewResult && (
                          <div className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
                            Please render a preview first before sending a test email.
                          </div>
                        )}

                        <Button
                          onClick={handleSendTest}
                          disabled={sendTestMutation.isPending || !previewResult || !testEmailTo || !selectedSmtpId}
                          className="w-full"
                          data-testid="button-send-test-email"
                        >
                          <Send className={`h-4 w-4 mr-2 ${sendTestMutation.isPending ? 'animate-spin' : ''}`} />
                          {sendTestMutation.isPending ? "Sending..." : "Send Test Email"}
                        </Button>

                        <Separator />

                        <div className="text-xs text-muted-foreground space-y-1">
                          <p>The test email will be sent using:</p>
                          <ul className="list-disc list-inside pl-2">
                            <li>The rendered preview content (with variables applied)</li>
                            <li>The selected SMTP configuration</li>
                          </ul>
                        </div>
                      </>
                    )}
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          </div>

          <DialogFooter className="mt-4 pt-4 border-t">
            <Button variant="outline" onClick={closeDialog}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!form.name || !form.content || createMutation.isPending || updateMutation.isPending}
              data-testid="button-save-template"
            >
              {editingId ? "Save Changes" : "Create Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PreviewPanel({ 
  channel, 
  subject, 
  content,
  imageUrl,
  iconUrl,
}: { 
  channel: string; 
  subject?: string; 
  content?: string;
  imageUrl?: string;
  iconUrl?: string;
}) {
  const [viewMode, setViewMode] = useState<"desktop" | "mobile">("desktop");

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">Preview</span>
        <div className="flex items-center gap-1 bg-muted rounded-md p-1">
          <Button
            size="sm"
            variant={viewMode === "desktop" ? "secondary" : "ghost"}
            className="h-7 px-2"
            onClick={() => setViewMode("desktop")}
            data-testid="button-preview-desktop"
          >
            <Monitor className="w-4 h-4 mr-1" />
            Desktop
          </Button>
          <Button
            size="sm"
            variant={viewMode === "mobile" ? "secondary" : "ghost"}
            className="h-7 px-2"
            onClick={() => setViewMode("mobile")}
            data-testid="button-preview-mobile"
          >
            <Smartphone className="w-4 h-4 mr-1" />
            Mobile
          </Button>
        </div>
      </div>

      {viewMode === "desktop" ? (
        <div className="rounded-md border bg-card">
          <div className="border-b px-4 py-2 bg-muted/50">
            <span className="text-xs font-medium text-muted-foreground">
              {channel === "email" ? "Email" : channel === "push" ? "Push Notification" : channel === "sms" ? "SMS" : "In-App"} Preview
            </span>
          </div>
          <div className="p-4 space-y-3">
            {imageUrl && (
              <div>
                <span className="text-xs font-medium text-muted-foreground">Header Image:</span>
                <div className="mt-2 border rounded-md overflow-hidden bg-muted/50">
                  <img 
                    src={imageUrl} 
                    alt="Header" 
                    className="w-full h-32 object-cover"
                    onError={(e) => (e.target as HTMLImageElement).style.display = 'none'}
                  />
                </div>
              </div>
            )}
            {channel === "email" && (
              <div className="flex items-center gap-2">
                {iconUrl && (
                  <img 
                    src={iconUrl} 
                    alt="Icon" 
                    className="w-6 h-6 object-cover rounded"
                    onError={(e) => (e.target as HTMLImageElement).style.display = 'none'}
                  />
                )}
                <div className="flex-1">
                  <span className="text-xs font-medium text-muted-foreground">Subject:</span>
                  <p className="font-medium text-sm mt-1">{subject || "(No subject)"}</p>
                </div>
              </div>
            )}
            <div className="flex-1 flex flex-col min-h-0">
              <span className="text-xs font-medium text-muted-foreground">Content:</span>
              <div className="mt-2 border rounded-md bg-white overflow-hidden">
                {content ? (
                  channel === "email" ? (
                    <iframe
                      srcDoc={content}
                      className="w-full h-[350px] border-0"
                      title="Email Preview"
                      sandbox="allow-same-origin"
                    />
                  ) : (
                    <div className="p-4">
                      <div
                        className="prose prose-sm dark:prose-invert max-w-none"
                        dangerouslySetInnerHTML={{ __html: content }}
                      />
                    </div>
                  )
                ) : (
                  <div className="p-4">
                    <p className="text-muted-foreground text-sm italic">
                      Click "Render Preview" to see how your template will look
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex justify-center py-4">
          <div className="relative">
            <div className="w-[280px] h-[560px] bg-foreground/10 rounded-[36px] p-2 shadow-lg">
              <div className="w-full h-full bg-background rounded-[28px] overflow-hidden flex flex-col">
                <div className="h-6 bg-muted flex items-center justify-center">
                  <div className="w-16 h-4 bg-foreground/20 rounded-full" />
                </div>
                
                {channel === "email" ? (
                  <div className="flex-1 flex flex-col overflow-hidden">
                    {imageUrl && (
                      <div className="bg-muted/30">
                        <img 
                          src={imageUrl} 
                          alt="Header" 
                          className="w-full h-20 object-cover"
                          onError={(e) => (e.target as HTMLImageElement).style.display = 'none'}
                        />
                      </div>
                    )}
                    <div className="bg-muted/50 px-3 py-2 border-b">
                      <div className="flex items-center gap-2 mb-1">
                        {iconUrl ? (
                          <img 
                            src={iconUrl} 
                            alt="Icon" 
                            className="w-8 h-8 rounded-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                            <Mail className="w-4 h-4 text-primary" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">Your Company</p>
                          <p className="text-[10px] text-muted-foreground truncate">noreply@company.com</p>
                        </div>
                      </div>
                      <p className="text-xs font-medium truncate mt-1">{subject || "(No subject)"}</p>
                    </div>
                    <div className="flex-1 overflow-auto p-3">
                      {content ? (
                        <div
                          className="prose prose-xs dark:prose-invert max-w-none text-xs"
                          dangerouslySetInnerHTML={{ __html: content }}
                        />
                      ) : (
                        <p className="text-muted-foreground text-xs italic text-center mt-8">
                          No preview available
                        </p>
                      )}
                    </div>
                  </div>
                ) : channel === "push" ? (
                  <div className="flex-1 p-3">
                    <div className="bg-muted rounded-xl p-3 shadow-sm">
                      <div className="flex items-start gap-2">
                        {iconUrl ? (
                          <img 
                            src={iconUrl} 
                            alt="Icon" 
                            className="w-8 h-8 rounded-lg object-cover flex-shrink-0"
                            onError={(e) => (e.target as HTMLImageElement).style.display = 'none'}
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                            <Bell className="w-4 h-4 text-primary" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold">Your App</p>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                            {content ? content.replace(/<[^>]*>/g, '').slice(0, 100) : "Notification content..."}
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-1">now</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : channel === "sms" ? (
                  <div className="flex-1 p-3 flex flex-col justify-end">
                    <div className="bg-primary/10 rounded-2xl rounded-bl-sm p-3 max-w-[85%]">
                      <p className="text-xs">
                        {content ? content.replace(/<[^>]*>/g, '').slice(0, 160) : "SMS message content..."}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-1 text-right">now</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 p-3">
                    <div className="bg-muted rounded-lg p-3 border">
                      <div className="flex items-center gap-2 mb-2">
                        <Bell className="w-4 h-4 text-primary" />
                        <span className="text-xs font-medium">Notification</span>
                      </div>
                      <p className="text-xs">
                        {content ? content.replace(/<[^>]*>/g, '').slice(0, 150) : "In-app notification content..."}
                      </p>
                    </div>
                  </div>
                )}
                
                <div className="h-4 bg-muted flex items-center justify-center">
                  <div className="w-24 h-1 bg-foreground/20 rounded-full" />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AssetUploader({
  label,
  value,
  onChange,
  placeholder,
  testId,
}: {
  label: string;
  value: string;
  onChange: (url: string) => void;
  placeholder: string;
  testId: string;
}) {
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();
  
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      toast({ title: "Please select an image file", variant: "destructive" });
      return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Image must be less than 5MB", variant: "destructive" });
      return;
    }
    
    setIsUploading(true);
    try {
      const response = await fetch("/api/uploads/request-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: file.name,
          size: file.size,
          contentType: file.type,
        }),
      });
      
      if (!response.ok) throw new Error("Failed to get upload URL");
      
      const { uploadURL, objectPath } = await response.json();
      
      await fetch(uploadURL, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      
      onChange(objectPath);
      toast({ title: "Image uploaded successfully" });
    } catch (error) {
      toast({ title: "Failed to upload image", variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };
  
  return (
    <div className="space-y-2">
      <Label className="text-xs">{label}</Label>
      {value ? (
        <div className="relative group">
          <div className="border rounded-md p-2 bg-muted/50">
            <div className="flex items-center gap-2">
              <img 
                src={value} 
                alt={label}
                className="h-10 w-10 object-cover rounded"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "";
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs truncate text-muted-foreground">{value}</p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => onChange("")}
                data-testid={`${testId}-remove`}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="relative">
          <Input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            disabled={isUploading}
            className="hidden"
            id={testId}
            data-testid={testId}
          />
          <label
            htmlFor={testId}
            className="flex items-center gap-2 border-2 border-dashed rounded-md p-3 cursor-pointer hover:bg-muted/50 transition-colors"
          >
            {isUploading ? (
              <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              <Upload className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="text-xs text-muted-foreground">
              {isUploading ? "Uploading..." : placeholder}
            </span>
          </label>
        </div>
      )}
    </div>
  );
}
