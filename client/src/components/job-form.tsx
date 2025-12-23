import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Globe, Webhook, Code, AlertCircle, Key, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CronExpressionEditor } from "@/components/cron-expression-editor";
import { insertJobSchema, type InsertJob, type Job, httpMethods, authTypes } from "@shared/schema";

const formSchema = insertJobSchema.extend({
  name: z.string().min(1, "Job name is required").max(100, "Name too long"),
  cronExpression: z.string().min(1, "Cron expression is required"),
});

type FormData = z.infer<typeof formSchema>;

interface JobFormProps {
  initialData?: Job;
  onSubmit: (data: InsertJob) => void;
  isSubmitting: boolean;
}

const defaultHttpConfig = {
  type: "http_request" as const,
  url: "",
  method: "GET" as const,
  headers: {},
  body: "",
  auth: { type: "none" as const },
};

const defaultWebhookConfig = {
  type: "webhook" as const,
  url: "",
  payload: "",
};

const defaultScriptConfig = {
  type: "script" as const,
  code: "// Your JavaScript code here\nconsole.log('Hello, r4n!');",
  language: "javascript" as const,
};

export function JobForm({ initialData, onSubmit, isSubmitting }: JobFormProps) {
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: initialData ? {
      name: initialData.name,
      description: initialData.description || "",
      cronExpression: initialData.cronExpression,
      status: initialData.status,
      action: initialData.action,
      dependsOn: initialData.dependsOn || null,
      notifyOnFailure: initialData.notifyOnFailure || false,
      notificationWebhook: initialData.notificationWebhook || null,
    } : {
      name: "",
      description: "",
      cronExpression: "0 * * * *",
      status: "active",
      action: defaultHttpConfig,
      dependsOn: null,
      notifyOnFailure: false,
      notificationWebhook: null,
    },
  });

  const actionType = form.watch("action.type");
  const notifyOnFailure = form.watch("notifyOnFailure");

  const handleActionTypeChange = (type: string) => {
    switch (type) {
      case "http_request":
        form.setValue("action", defaultHttpConfig);
        break;
      case "webhook":
        form.setValue("action", defaultWebhookConfig);
        break;
      case "script":
        form.setValue("action", defaultScriptConfig);
        break;
    }
  };

  const handleSubmit = (data: FormData) => {
    onSubmit(data);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Job Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="My Scheduled Task"
                      {...field}
                      data-testid="input-job-name"
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
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="What does this job do?"
                      className="resize-none"
                      {...field}
                      data-testid="input-job-description"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Active</FormLabel>
                    <FormDescription>
                      Enable or disable this job
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value === "active"}
                      onCheckedChange={(checked) => field.onChange(checked ? "active" : "paused")}
                      data-testid="switch-job-status"
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Schedule</CardTitle>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="cronExpression"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <CronExpressionEditor
                      value={field.value}
                      onChange={field.onChange}
                      error={form.formState.errors.cronExpression?.message}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Action</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs value={actionType} onValueChange={handleActionTypeChange}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="http_request" className="gap-2" data-testid="tab-http-request">
                  <Globe className="h-4 w-4" />
                  HTTP Request
                </TabsTrigger>
                <TabsTrigger value="webhook" className="gap-2" data-testid="tab-webhook">
                  <Webhook className="h-4 w-4" />
                  Webhook
                </TabsTrigger>
                <TabsTrigger value="script" className="gap-2" data-testid="tab-script">
                  <Code className="h-4 w-4" />
                  Script
                </TabsTrigger>
              </TabsList>

              <TabsContent value="http_request" className="space-y-4 mt-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <FormField
                    control={form.control}
                    name="action.method"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Method</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-http-method">
                              <SelectValue placeholder="Method" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {httpMethods.map((method) => (
                              <SelectItem key={method} value={method}>
                                {method}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="md:col-span-3">
                    <FormField
                      control={form.control}
                      name="action.url"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>URL</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="https://api.example.com/endpoint"
                              {...field}
                              data-testid="input-http-url"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <FormField
                  control={form.control}
                  name="action.body"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Request Body (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder='{"key": "value"}'
                          className="font-mono text-sm resize-none min-h-24"
                          {...field}
                          data-testid="input-http-body"
                        />
                      </FormControl>
                      <FormDescription>JSON body for POST/PUT/PATCH requests</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="border rounded-lg p-4 space-y-4">
                  <div className="flex items-center gap-2">
                    <Lock className="h-4 w-4 text-muted-foreground" />
                    <Label className="text-base font-medium">Authentication</Label>
                  </div>

                  <FormField
                    control={form.control}
                    name="action.auth.type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Auth Type</FormLabel>
                        <Select 
                          onValueChange={(value) => {
                            if (value === "none") {
                              form.setValue("action.auth", { type: "none" });
                            } else if (value === "basic") {
                              form.setValue("action.auth", { type: "basic", username: "", password: "" });
                            } else if (value === "bearer") {
                              form.setValue("action.auth", { type: "bearer", token: "" });
                            } else if (value === "api_key") {
                              form.setValue("action.auth", { type: "api_key", key: "X-API-Key", value: "", addTo: "header" });
                            } else if (value === "oauth2_client_credentials") {
                              form.setValue("action.auth", { type: "oauth2_client_credentials", clientId: "", clientSecret: "", tokenUrl: "", scope: "" });
                            }
                          }} 
                          value={field.value || "none"}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-auth-type">
                              <SelectValue placeholder="Select authentication type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">No Authentication</SelectItem>
                            <SelectItem value="basic">Basic Auth</SelectItem>
                            <SelectItem value="bearer">Bearer Token</SelectItem>
                            <SelectItem value="api_key">API Key</SelectItem>
                            <SelectItem value="oauth2_client_credentials">OAuth2 Client Credentials</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {form.watch("action.auth.type") === "basic" && (
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="action.auth.username"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Username</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Username"
                                {...field}
                                data-testid="input-auth-username"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="action.auth.password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Password</FormLabel>
                            <FormControl>
                              <Input
                                type="password"
                                placeholder="Password"
                                {...field}
                                data-testid="input-auth-password"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}

                  {form.watch("action.auth.type") === "bearer" && (
                    <FormField
                      control={form.control}
                      name="action.auth.token"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Bearer Token</FormLabel>
                          <FormControl>
                            <Input
                              type="password"
                              placeholder="Enter your bearer token"
                              {...field}
                              data-testid="input-auth-token"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {form.watch("action.auth.type") === "api_key" && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="action.auth.key"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Key Name</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="X-API-Key"
                                  {...field}
                                  data-testid="input-auth-key-name"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="action.auth.value"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Key Value</FormLabel>
                              <FormControl>
                                <Input
                                  type="password"
                                  placeholder="Your API key"
                                  {...field}
                                  data-testid="input-auth-key-value"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <FormField
                        control={form.control}
                        name="action.auth.addTo"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Add To</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value || "header"}>
                              <FormControl>
                                <SelectTrigger data-testid="select-auth-addto">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="header">Header</SelectItem>
                                <SelectItem value="query">Query Parameter</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}

                  {form.watch("action.auth.type") === "oauth2_client_credentials" && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="action.auth.clientId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Client ID</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="Your client ID"
                                  {...field}
                                  data-testid="input-auth-client-id"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="action.auth.clientSecret"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Client Secret</FormLabel>
                              <FormControl>
                                <Input
                                  type="password"
                                  placeholder="Your client secret"
                                  {...field}
                                  data-testid="input-auth-client-secret"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <FormField
                        control={form.control}
                        name="action.auth.tokenUrl"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Token URL</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="https://auth.example.com/oauth/token"
                                {...field}
                                data-testid="input-auth-token-url"
                              />
                            </FormControl>
                            <FormDescription>The OAuth2 token endpoint URL</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="action.auth.scope"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Scope (Optional)</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="read write"
                                {...field}
                                data-testid="input-auth-scope"
                              />
                            </FormControl>
                            <FormDescription>Space-separated list of scopes</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="webhook" className="space-y-4 mt-4">
                <FormField
                  control={form.control}
                  name="action.url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Webhook URL</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="https://hooks.example.com/webhook"
                          {...field}
                          data-testid="input-webhook-url"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="action.payload"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payload (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder='{"message": "Hello from r4n!"}'
                          className="font-mono text-sm resize-none min-h-24"
                          {...field}
                          data-testid="input-webhook-payload"
                        />
                      </FormControl>
                      <FormDescription>JSON payload to send with the webhook</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>

              <TabsContent value="script" className="space-y-4 mt-4">
                <FormField
                  control={form.control}
                  name="action.code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>JavaScript Code</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="console.log('Hello, world!');"
                          className="font-mono text-sm resize-none min-h-40"
                          {...field}
                          data-testid="input-script-code"
                        />
                      </FormControl>
                      <FormDescription>
                        Write JavaScript code to execute on schedule
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Notifications
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="notifyOnFailure"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Notify on Failure</FormLabel>
                    <FormDescription>
                      Send a webhook notification when this job fails
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      data-testid="switch-notify-failure"
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            {notifyOnFailure && (
              <FormField
                control={form.control}
                name="notificationWebhook"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notification Webhook URL</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="https://hooks.slack.com/services/..."
                        value={field.value || ""}
                        onChange={field.onChange}
                        data-testid="input-notification-webhook"
                      />
                    </FormControl>
                    <FormDescription>
                      Slack, Discord, or custom webhook URL
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
          <Button
            type="submit"
            disabled={isSubmitting}
            data-testid="button-submit-job"
          >
            {isSubmitting ? "Saving..." : initialData ? "Update Job" : "Create Job"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
