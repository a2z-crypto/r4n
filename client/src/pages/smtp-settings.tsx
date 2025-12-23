import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, Mail, CheckCircle2, XCircle, Send, RefreshCw, Eye, EyeOff, Server, Plus, Pencil, Trash2, Star } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const smtpFormSchema = z.object({
  name: z.string().min(1, "Configuration name is required"),
  host: z.string().min(1, "SMTP host is required"),
  port: z.coerce.number().min(1).max(65535, "Port must be between 1 and 65535"),
  secure: z.boolean().default(true),
  username: z.string().min(1, "Username is required"),
  password: z.string(),
  fromEmail: z.string().email("Valid email is required"),
  fromName: z.string().min(1, "From name is required"),
});

type SmtpFormValues = z.infer<typeof smtpFormSchema>;

interface SmtpConfig {
  id: number;
  name: string;
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
  fromEmail: string;
  fromName: string;
  isActive: boolean;
  isDefault: boolean;
  lastTestAt: string | null;
  lastTestResult: boolean | null;
}

function SmtpConfigForm({ 
  config, 
  onClose,
  isNew 
}: { 
  config?: SmtpConfig; 
  onClose: () => void;
  isNew: boolean;
}) {
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<SmtpFormValues>({
    resolver: zodResolver(smtpFormSchema),
    defaultValues: {
      name: config?.name || "",
      host: config?.host || "",
      port: config?.port || 587,
      secure: config?.secure ?? false, // Default false for port 587 (STARTTLS)
      username: config?.username || "",
      password: "",
      fromEmail: config?.fromEmail || "",
      fromName: config?.fromName || "",
    },
  });

  // Auto-update secure based on port for common configurations
  const watchedPort = form.watch("port");
  const handlePortChange = (port: number) => {
    if (port === 465) {
      form.setValue("secure", true);
    } else if (port === 587) {
      form.setValue("secure", false);
    }
  };

  const createMutation = useMutation({
    mutationFn: async (data: SmtpFormValues) => {
      return apiRequest("POST", "/api/settings/smtp", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/smtp"] });
      toast({ title: "Configuration created", description: "SMTP configuration has been created successfully." });
      onClose();
    },
    onError: (error: Error) => {
      toast({ title: "Error creating configuration", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: SmtpFormValues) => {
      // Only include password if user entered a new one
      const { password, ...rest } = data;
      const payload = password && password.trim() !== "" ? data : rest;
      return apiRequest("PATCH", `/api/settings/smtp/${config?.id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/smtp"] });
      toast({ title: "Configuration updated", description: "SMTP configuration has been updated successfully." });
      onClose();
    },
    onError: (error: Error) => {
      toast({ title: "Error updating configuration", description: error.message, variant: "destructive" });
    },
  });

  const onSubmit = (data: SmtpFormValues) => {
    if (isNew) {
      createMutation.mutate(data);
    } else {
      updateMutation.mutate(data);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Configuration Name</FormLabel>
              <FormControl>
                <Input placeholder="e.g., Alerts, Marketing, Transactional" data-testid="input-smtp-name" {...field} />
              </FormControl>
              <FormDescription>A descriptive name for this SMTP configuration</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="host"
            render={({ field }) => (
              <FormItem>
                <FormLabel>SMTP Host</FormLabel>
                <FormControl>
                  <Input placeholder="smtp.example.com" data-testid="input-smtp-host" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="port"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Port</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    placeholder="587" 
                    data-testid="input-smtp-port" 
                    {...field}
                    onChange={(e) => {
                      field.onChange(e);
                      handlePortChange(parseInt(e.target.value) || 587);
                    }}
                  />
                </FormControl>
                <FormDescription className="text-xs">Common: 587 (STARTTLS) or 465 (SSL)</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="secure"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <FormLabel className="text-sm">Use SSL/TLS</FormLabel>
                <FormDescription className="text-xs">
                  Port 465: Enable (SSL). Port 587: Disable (uses STARTTLS).
                </FormDescription>
              </div>
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-smtp-secure" />
              </FormControl>
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="username"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Username</FormLabel>
                <FormControl>
                  <Input placeholder="your-email@example.com" data-testid="input-smtp-username" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder={config ? "Leave empty to keep current" : "Your SMTP password"}
                      data-testid="input-smtp-password"
                      {...field}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowPassword(!showPassword)}
                      data-testid="button-toggle-password"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </FormControl>
                {config && <FormDescription>Leave empty to keep current password</FormDescription>}
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="fromEmail"
            render={({ field }) => (
              <FormItem>
                <FormLabel>From Email</FormLabel>
                <FormControl>
                  <Input placeholder="notifications@example.com" data-testid="input-smtp-from-email" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="fromName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>From Name</FormLabel>
                <FormControl>
                  <Input placeholder="r4n Notifications" data-testid="input-smtp-from-name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={isPending} data-testid="button-save-smtp">
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isNew ? "Create" : "Save Changes"}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}

function SmtpConfigCard({ config }: { config: SmtpConfig }) {
  const { toast } = useToast();
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [showTestEmailDialog, setShowTestEmailDialog] = useState(false);

  const setDefaultMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/settings/smtp/${config.id}/set-default`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/smtp"] });
      toast({ title: "Default updated", description: `"${config.name}" is now the default SMTP configuration.` });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", `/api/settings/smtp/${config.id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/smtp"] });
      toast({ title: "Configuration deleted", description: `"${config.name}" has been deleted.` });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const testConnectionMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/settings/smtp/${config.id}/test`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/smtp"] });
      toast({ title: "Connection successful", description: "SMTP server connection verified." });
    },
    onError: (error: Error) => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/smtp"] });
      toast({ title: "Connection failed", description: error.message, variant: "destructive" });
    },
  });

  const sendTestEmailMutation = useMutation({
    mutationFn: async (email: string) => {
      return apiRequest("POST", `/api/settings/smtp/${config.id}/send-test`, { email });
    },
    onSuccess: () => {
      toast({ title: "Test email sent", description: `Test email sent successfully.` });
      setShowTestEmailDialog(false);
      setTestEmail("");
    },
    onError: (error: Error) => {
      toast({ title: "Failed to send test email", description: error.message, variant: "destructive" });
    },
  });

  return (
    <>
      <Card className={config.isDefault ? "border-primary/50" : undefined}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Mail className="h-4 w-4 shrink-0" />
                <span className="truncate">{config.name}</span>
                {config.isDefault && (
                  <Badge variant="default" className="shrink-0 gap-1">
                    <Star className="h-3 w-3" />
                    Default
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="mt-1 truncate">
                {config.host}:{config.port}
              </CardDescription>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {config.lastTestResult === true ? (
                <Badge variant="default" className="gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  OK
                </Badge>
              ) : config.lastTestResult === false ? (
                <Badge variant="destructive" className="gap-1">
                  <XCircle className="h-3 w-3" />
                  Failed
                </Badge>
              ) : (
                <Badge variant="secondary" className="gap-1">
                  <Server className="h-3 w-3" />
                  Untested
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="text-sm text-muted-foreground space-y-1">
            <p>From: {config.fromName} &lt;{config.fromEmail}&gt;</p>
            <p>User: {config.username}</p>
            {config.lastTestAt && (
              <p>Last tested: {formatDistanceToNow(new Date(config.lastTestAt), { addSuffix: true })}</p>
            )}
          </div>

          <div className="flex flex-wrap gap-2 mt-4">
            <Button
              size="sm"
              variant="outline"
              onClick={() => testConnectionMutation.mutate()}
              disabled={testConnectionMutation.isPending}
              data-testid={`button-test-${config.id}`}
            >
              {testConnectionMutation.isPending ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="mr-1 h-3 w-3" />
              )}
              Test
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowTestEmailDialog(true)}
              data-testid={`button-send-test-${config.id}`}
            >
              <Send className="mr-1 h-3 w-3" />
              Send Test
            </Button>

            <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
              <DialogTrigger asChild>
                <Button size="sm" variant="ghost" data-testid={`button-edit-${config.id}`}>
                  <Pencil className="mr-1 h-3 w-3" />
                  Edit
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-xl">
                <DialogHeader>
                  <DialogTitle>Edit SMTP Configuration</DialogTitle>
                  <DialogDescription>Update the settings for "{config.name}"</DialogDescription>
                </DialogHeader>
                <SmtpConfigForm config={config} onClose={() => setShowEditDialog(false)} isNew={false} />
              </DialogContent>
            </Dialog>

            {!config.isDefault && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setDefaultMutation.mutate()}
                disabled={setDefaultMutation.isPending}
                data-testid={`button-set-default-${config.id}`}
              >
                {setDefaultMutation.isPending ? (
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                ) : (
                  <Star className="mr-1 h-3 w-3" />
                )}
                Set Default
              </Button>
            )}

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="ghost" className="text-destructive" data-testid={`button-delete-${config.id}`}>
                  <Trash2 className="mr-1 h-3 w-3" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete SMTP Configuration</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete "{config.name}"? This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => deleteMutation.mutate()} data-testid={`button-confirm-delete-${config.id}`}>
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showTestEmailDialog} onOpenChange={setShowTestEmailDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Test Email</DialogTitle>
            <DialogDescription>Send a test email using "{config.name}" configuration</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              type="email"
              placeholder="recipient@example.com"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              data-testid={`input-test-email-${config.id}`}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTestEmailDialog(false)}>Cancel</Button>
            <Button
              onClick={() => sendTestEmailMutation.mutate(testEmail)}
              disabled={!testEmail || sendTestEmailMutation.isPending}
              data-testid={`button-confirm-send-test-${config.id}`}
            >
              {sendTestEmailMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function SmtpSettings() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const { data: smtpConfigs, isLoading } = useQuery<SmtpConfig[]>({
    queryKey: ["/api/settings/smtp"],
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">SMTP Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure email servers for sending notifications. Use different configurations for alerts, marketing, etc.
          </p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-smtp">
              <Plus className="mr-2 h-4 w-4" />
              Add Configuration
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>Add SMTP Configuration</DialogTitle>
              <DialogDescription>Create a new SMTP configuration for email delivery</DialogDescription>
            </DialogHeader>
            <SmtpConfigForm onClose={() => setShowCreateDialog(false)} isNew={true} />
          </DialogContent>
        </Dialog>
      </div>

      {!smtpConfigs || smtpConfigs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Mail className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No SMTP configurations</h3>
            <p className="text-sm text-muted-foreground text-center max-w-sm mb-4">
              Add your first SMTP configuration to start sending email notifications.
            </p>
            <Button onClick={() => setShowCreateDialog(true)} data-testid="button-add-first-smtp">
              <Plus className="mr-2 h-4 w-4" />
              Add Configuration
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {smtpConfigs.map((config) => (
            <SmtpConfigCard key={config.id} config={config} />
          ))}
        </div>
      )}
    </div>
  );
}
