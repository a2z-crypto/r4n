import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Handlebars from "handlebars";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
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
  ArrowLeft,
  Monitor,
  Smartphone,
  FileText,
  Code,
  Eye,
  Save,
  Loader2,
  Variable,
} from "lucide-react";
import type { EmailTemplate } from "@shared/schema";

interface VariableInfo {
  name: string;
  type: 'scalar' | 'array';
  children?: string[];
}

function extractTemplateVariables(template: string): VariableInfo[] {
  const variables: VariableInfo[] = [];
  const seenVars = new Set<string>();
  
  // Match {{#each arrayName}} ... {{/each}} blocks
  const eachBlockRegex = /\{\{#each\s+(\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g;
  let match;
  
  while ((match = eachBlockRegex.exec(template)) !== null) {
    const arrayName = match[1];
    const blockContent = match[2];
    
    // Extract child variables within the each block
    const childVarRegex = /\{\{(\w+)\}\}/g;
    const children: string[] = [];
    let childMatch;
    
    while ((childMatch = childVarRegex.exec(blockContent)) !== null) {
      if (!children.includes(childMatch[1])) {
        children.push(childMatch[1]);
      }
    }
    
    if (!seenVars.has(arrayName)) {
      variables.push({ name: arrayName, type: 'array', children });
      seenVars.add(arrayName);
    }
  }
  
  // Match simple {{variable}} (excluding helpers like #each, /each, #if, /if)
  const simpleVarRegex = /\{\{(?!#|\/|else)(\w+)\}\}/g;
  
  // Remove the each blocks to avoid re-capturing nested vars as top-level
  const templateWithoutBlocks = template.replace(eachBlockRegex, '');
  
  while ((match = simpleVarRegex.exec(templateWithoutBlocks)) !== null) {
    const varName = match[1];
    if (!seenVars.has(varName)) {
      variables.push({ name: varName, type: 'scalar' });
      seenVars.add(varName);
    }
  }
  
  return variables;
}

function generateSampleData(variables: VariableInfo[]): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  
  variables.forEach((variable) => {
    if (variable.type === 'array' && variable.children) {
      // Generate sample array with 2 items
      const sampleItem: Record<string, string> = {};
      variable.children.forEach((child) => {
        sampleItem[child] = `Sample ${child.replace(/_/g, ' ')}`;
      });
      data[variable.name] = [
        { ...sampleItem },
        { ...Object.fromEntries(Object.entries(sampleItem).map(([k, v]) => [k, `${v} 2`])) },
      ];
    } else {
      data[variable.name] = `Sample ${variable.name.replace(/_/g, ' ')}`;
    }
  });
  
  return data;
}

const templateFormSchema = z.object({
  name: z.string().min(1, "Template name is required"),
  description: z.string().optional(),
  subject: z.string().min(1, "Subject is required"),
  status: z.enum(["draft", "active", "archived"]),
});

type TemplateFormData = z.infer<typeof templateFormSchema>;

const DEFAULT_HTML_TEMPLATE = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{subject}}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      margin: 0;
      padding: 0;
      background-color: #f5f5f5;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #ffffff;
    }
    .header {
      text-align: center;
      padding: 20px 0;
      border-bottom: 1px solid #eee;
    }
    .content {
      padding: 30px 0;
    }
    .footer {
      text-align: center;
      padding: 20px 0;
      color: #666;
      font-size: 12px;
      border-top: 1px solid #eee;
    }
    .button {
      display: inline-block;
      padding: 12px 24px;
      background-color: #007bff;
      color: #ffffff;
      text-decoration: none;
      border-radius: 4px;
      font-weight: 500;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>{{title}}</h1>
    </div>
    <div class="content">
      <p>Hello {{name}},</p>
      <p>{{message}}</p>
      <p style="text-align: center; margin-top: 30px;">
        <a href="{{action_url}}" class="button">{{action_text}}</a>
      </p>
    </div>
    <div class="footer">
      <p>{{company_name}}</p>
      <p>{{footer_text}}</p>
    </div>
  </div>
</body>
</html>`;

const DEFAULT_TEST_DATA = {
  subject: "Welcome to Our Service",
  title: "Welcome!",
  name: "John Doe",
  message: "Thank you for signing up. We're excited to have you on board.",
  action_url: "https://example.com/get-started",
  action_text: "Get Started",
  company_name: "Your Company",
  footer_text: "You received this email because you signed up for our service.",
};

export default function EmailTemplateEditorPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/dynamic-templates/:id");
  const isNew = params?.id === "new";
  const templateId = isNew ? null : params?.id ? parseInt(params.id) : null;

  const [htmlContent, setHtmlContent] = useState(DEFAULT_HTML_TEMPLATE);
  const [plainTextContent, setPlainTextContent] = useState("");
  const [testData, setTestData] = useState<Record<string, unknown>>(DEFAULT_TEST_DATA);
  const [testDataJson, setTestDataJson] = useState(JSON.stringify(DEFAULT_TEST_DATA, null, 2));
  const [activePreviewTab, setActivePreviewTab] = useState("desktop");
  const [activeEditorTab, setActiveEditorTab] = useState("html");
  const [testDataDialogOpen, setTestDataDialogOpen] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const form = useForm<TemplateFormData>({
    resolver: zodResolver(templateFormSchema),
    defaultValues: {
      name: "",
      description: "",
      subject: "",
      status: "draft",
    },
  });

  const { data: template, isLoading } = useQuery<EmailTemplate>({
    queryKey: ["/api/email-templates", templateId],
    enabled: !!templateId,
  });

  useEffect(() => {
    if (template) {
      form.reset({
        name: template.name,
        description: template.description || "",
        subject: template.subject || "",
        status: template.status as "draft" | "active" | "archived",
      });
      setHtmlContent(template.htmlContent || DEFAULT_HTML_TEMPLATE);
      setPlainTextContent(template.plainTextContent || "");
      if (template.testData) {
        try {
          const parsed = typeof template.testData === 'string' 
            ? JSON.parse(template.testData) 
            : template.testData;
          setTestData(parsed);
          setTestDataJson(JSON.stringify(parsed, null, 2));
        } catch (e) {
          console.error("Failed to parse test data:", e);
        }
      }
    }
  }, [template, form]);

  const createMutation = useMutation({
    mutationFn: async (data: Partial<EmailTemplate>) => {
      return apiRequest("POST", "/api/email-templates", data);
    },
    onSuccess: (result: any) => {
      toast({ title: "Template created successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/email-templates"] });
      setHasUnsavedChanges(false);
      if (result?.id) {
        setLocation(`/dynamic-templates/${result.id}`);
      } else {
        setLocation("/dynamic-templates");
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create template",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<EmailTemplate>) => {
      return apiRequest("PATCH", `/api/email-templates/${templateId}`, data);
    },
    onSuccess: () => {
      toast({ title: "Template saved successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/email-templates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/email-templates", templateId] });
      setHasUnsavedChanges(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to save template",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Extract variables from both HTML and plain text content
  const extractedVariables = useMemo(() => {
    const htmlVars = extractTemplateVariables(htmlContent);
    const textVars = extractTemplateVariables(plainTextContent);
    
    // Merge variables, avoiding duplicates
    const seen = new Set<string>();
    const merged: VariableInfo[] = [];
    
    [...htmlVars, ...textVars].forEach((v) => {
      if (!seen.has(v.name)) {
        seen.add(v.name);
        merged.push(v);
      }
    });
    
    return merged;
  }, [htmlContent, plainTextContent]);

  // Flat list of variable names for display
  const extractVariables = useMemo(() => {
    return extractedVariables.map(v => v.name);
  }, [extractedVariables]);

  // Auto-generate test data when variables change
  useEffect(() => {
    if (extractedVariables.length > 0) {
      setTestData((prev) => {
        const newData = generateSampleData(extractedVariables);
        // Preserve existing values where they exist
        Object.keys(newData).forEach((key) => {
          if (prev[key] !== undefined) {
            newData[key] = prev[key];
          }
        });
        return newData;
      });
    }
  }, [extractedVariables]);

  // Keep testDataJson in sync with testData
  useEffect(() => {
    setTestDataJson(JSON.stringify(testData, null, 2));
  }, [testData]);

  const renderedHtml = useMemo(() => {
    try {
      const template = Handlebars.compile(htmlContent);
      return template(testData);
    } catch (e) {
      console.error("Template rendering error:", e);
      return htmlContent;
    }
  }, [htmlContent, testData]);

  const handleSave = (formData: TemplateFormData) => {
    const payload = {
      ...formData,
      htmlContent,
      plainTextContent,
      testData: JSON.stringify(testData),
      variables: extractVariables,
    };

    if (isNew) {
      createMutation.mutate(payload);
    } else {
      updateMutation.mutate(payload);
    }
  };

  const handleTestDataSave = () => {
    try {
      const parsed = JSON.parse(testDataJson);
      setTestData(parsed);
      setTestDataDialogOpen(false);
      toast({ title: "Test data updated" });
    } catch (e) {
      toast({
        title: "Invalid JSON",
        description: "Please enter valid JSON data",
        variant: "destructive",
      });
    }
  };

  const handleBack = () => {
    if (hasUnsavedChanges) {
      if (confirm("You have unsaved changes. Are you sure you want to leave?")) {
        setLocation("/dynamic-templates");
      }
    } else {
      setLocation("/dynamic-templates");
    }
  };

  const handleContentChange = (content: string, type: 'html' | 'plainText') => {
    setHasUnsavedChanges(true);
    if (type === 'html') {
      setHtmlContent(content);
    } else {
      setPlainTextContent(content);
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  if (!isNew && isLoading) {
    return (
      <div className="flex-1 p-6 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between gap-4 p-4 border-b bg-background">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleBack}
            data-testid="button-back"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold" data-testid="text-editor-title">
              {isNew ? "Create Template" : form.watch("name") || "Edit Template"}
            </h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {!isNew && template && (
                <Badge variant="outline">v{template.version}</Badge>
              )}
              {hasUnsavedChanges && (
                <Badge variant="secondary">Unsaved changes</Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setTestDataDialogOpen(true)}
            data-testid="button-test-data"
          >
            <Variable className="w-4 h-4 mr-2" />
            Test Data
          </Button>
          <Button
            onClick={form.handleSubmit(handleSave)}
            disabled={isSaving}
            data-testid="button-save"
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            {isSaving ? "Saving..." : "Save Template"}
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-80 border-r p-4 overflow-auto bg-muted/30">
          <Form {...form}>
            <form className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Template Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., Welcome Email"
                        {...field}
                        onChange={(e) => {
                          field.onChange(e);
                          setHasUnsavedChanges(true);
                        }}
                        data-testid="input-template-name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Brief description of this template"
                        rows={2}
                        {...field}
                        onChange={(e) => {
                          field.onChange(e);
                          setHasUnsavedChanges(true);
                        }}
                        data-testid="input-template-description"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="subject"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Subject</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., Welcome to {{company_name}}"
                        {...field}
                        onChange={(e) => {
                          field.onChange(e);
                          setHasUnsavedChanges(true);
                        }}
                        data-testid="input-template-subject"
                      />
                    </FormControl>
                    <FormDescription>
                      Use {"{{variable}}"} for dynamic content
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={(value) => {
                        field.onChange(value);
                        setHasUnsavedChanges(true);
                      }}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-status">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="archived">Archived</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="pt-4 border-t">
                <Label className="text-sm font-medium">Variables ({extractVariables.length})</Label>
                <div className="flex flex-wrap gap-1 mt-2">
                  {extractVariables.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No variables detected. Use {"{{variable}}"} syntax in your HTML.
                    </p>
                  ) : (
                    extractVariables.map((variable) => (
                      <Badge key={variable} variant="secondary" className="font-mono text-xs">
                        {variable}
                      </Badge>
                    ))
                  )}
                </div>
              </div>
            </form>
          </Form>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          <Tabs 
            value={activeEditorTab} 
            onValueChange={setActiveEditorTab}
            className="flex-1 flex flex-col"
          >
            <div className="flex items-center justify-between px-4 py-2 border-b">
              <TabsList>
                <TabsTrigger value="html" data-testid="tab-html">
                  <Code className="w-4 h-4 mr-2" />
                  HTML
                </TabsTrigger>
                <TabsTrigger value="plaintext" data-testid="tab-plaintext">
                  <FileText className="w-4 h-4 mr-2" />
                  Plain Text
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="html" className="flex-1 m-0 overflow-hidden">
              <Textarea
                value={htmlContent}
                onChange={(e) => handleContentChange(e.target.value, 'html')}
                className="h-full w-full resize-none rounded-none border-0 font-mono text-sm focus-visible:ring-0"
                placeholder="Enter your HTML email template here..."
                data-testid="textarea-html-content"
              />
            </TabsContent>

            <TabsContent value="plaintext" className="flex-1 m-0 overflow-hidden">
              <Textarea
                value={plainTextContent}
                onChange={(e) => handleContentChange(e.target.value, 'plainText')}
                className="h-full w-full resize-none rounded-none border-0 font-mono text-sm focus-visible:ring-0"
                placeholder="Enter plain text version of your email..."
                data-testid="textarea-plaintext-content"
              />
            </TabsContent>
          </Tabs>
        </div>

        <div className="w-[500px] border-l flex flex-col overflow-hidden bg-muted/30">
          <div className="flex items-center justify-between px-4 py-2 border-b">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4" />
              <span className="font-medium text-sm">Preview</span>
            </div>
            <Tabs value={activePreviewTab} onValueChange={setActivePreviewTab}>
              <TabsList className="h-8">
                <TabsTrigger value="desktop" className="h-7 px-2" data-testid="preview-desktop">
                  <Monitor className="w-4 h-4" />
                </TabsTrigger>
                <TabsTrigger value="mobile" className="h-7 px-2" data-testid="preview-mobile">
                  <Smartphone className="w-4 h-4" />
                </TabsTrigger>
                <TabsTrigger value="text" className="h-7 px-2" data-testid="preview-text">
                  <FileText className="w-4 h-4" />
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="flex-1 overflow-auto p-4">
            {activePreviewTab === "text" ? (
              <div className="whitespace-pre-wrap font-mono text-sm bg-background rounded-md p-4 border">
                {plainTextContent || "No plain text content yet."}
              </div>
            ) : (
              <div
                className={`bg-white rounded-md shadow-sm border overflow-hidden mx-auto ${
                  activePreviewTab === "mobile" ? "w-[320px]" : "w-full"
                }`}
              >
                <iframe
                  srcDoc={renderedHtml}
                  className="w-full h-[600px] border-0"
                  title="Email Preview"
                  sandbox="allow-same-origin"
                  data-testid="iframe-preview"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      <Dialog open={testDataDialogOpen} onOpenChange={setTestDataDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Test Data</DialogTitle>
            <DialogDescription>
              Define test values for your template variables. This data is used for previewing your email.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3">
            <div className="text-sm text-muted-foreground">
              {extractVariables.length} variable{extractVariables.length !== 1 ? 's' : ''} detected in template (auto-populated)
            </div>
            <Textarea
              value={testDataJson}
              onChange={(e) => setTestDataJson(e.target.value)}
              className="font-mono text-sm min-h-[300px]"
              placeholder='{"variable": "value"}'
              data-testid="textarea-test-data"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setTestDataDialogOpen(false)}
              data-testid="button-cancel-test-data"
            >
              Cancel
            </Button>
            <Button
              onClick={handleTestDataSave}
              data-testid="button-save-test-data"
            >
              Apply Test Data
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
