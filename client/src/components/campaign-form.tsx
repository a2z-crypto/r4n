import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, ArrowRight, Plus, Trash2, GripVertical, Check, Clock, Users, Mail, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import type { Campaign, InsertCampaign, NotificationTemplate, SmtpConfig, User } from "@shared/schema";

interface CampaignFormData {
  name: string;
  description: string;
  scheduleType: "one_time" | "recurring" | "manual";
  cronExpression?: string;
  scheduledAt?: string;
  smtpConfigId?: number;
  throttleLimit: number;
  throttleInterval: number;
  audience: {
    name: string;
    type: "static" | "filter" | "all_users";
    userIds?: string[];
  };
  steps: {
    name: string;
    channel: "email" | "in_app";
    templateId?: number;
    customSubject?: string;
    customContent?: string;
    delayMinutes: number;
    isActive: boolean;
  }[];
}

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  scheduleType: z.enum(["one_time", "recurring", "manual"]),
  cronExpression: z.string().optional(),
  scheduledAt: z.string().optional(),
  smtpConfigId: z.number().optional(),
  throttleLimit: z.number().min(1).default(100),
  throttleInterval: z.number().min(60).default(3600),
  audience: z.object({
    name: z.string().min(1, "Audience name is required"),
    type: z.enum(["static", "filter", "all_users"]),
    userIds: z.array(z.string()).optional(),
  }),
  steps: z.array(z.object({
    name: z.string().min(1, "Step name is required"),
    channel: z.enum(["email", "in_app"]),
    templateId: z.number().optional(),
    customSubject: z.string().optional(),
    customContent: z.string().optional(),
    delayMinutes: z.number().min(0).default(0),
    isActive: z.boolean().default(true),
  })).min(1, "At least one step is required"),
});

interface CampaignFormProps {
  initialData?: Campaign;
  initialAudience?: {
    name: string;
    type: string;
  };
  initialSteps?: {
    name: string;
    channel: string;
    templateId?: number | null;
    customSubject?: string | null;
    customContent?: string | null;
    delayMinutes?: number | null;
    isActive: boolean;
    stepOrder: number;
  }[];
  onSubmit: (data: InsertCampaign, audience: CampaignFormData["audience"], steps: CampaignFormData["steps"]) => void;
  isSubmitting: boolean;
}

const WIZARD_STEPS = [
  { id: "basics", label: "Basics", icon: Settings },
  { id: "audience", label: "Audience", icon: Users },
  { id: "steps", label: "Steps", icon: Mail },
  { id: "review", label: "Review", icon: Check },
];

export function CampaignForm({ initialData, initialAudience, initialSteps, onSubmit, isSubmitting }: CampaignFormProps) {
  const [currentStep, setCurrentStep] = useState(0);

  const { data: templates = [] } = useQuery<NotificationTemplate[]>({
    queryKey: ["/api/notification-templates"],
  });

  const { data: smtpConfigs = [] } = useQuery<SmtpConfig[]>({
    queryKey: ["/api/settings/smtp"],
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const defaultSteps = initialSteps?.length 
    ? initialSteps.sort((a, b) => a.stepOrder - b.stepOrder).map(s => ({
        name: s.name,
        channel: (s.channel as "email" | "in_app") || "email",
        templateId: s.templateId || undefined,
        customSubject: s.customSubject || "",
        customContent: s.customContent || "",
        delayMinutes: s.delayMinutes || 0,
        isActive: s.isActive,
      }))
    : [{
        name: "Initial Email",
        channel: "email" as const,
        templateId: undefined,
        customSubject: "",
        customContent: "",
        delayMinutes: 0,
        isActive: true,
      }];

  const defaultAudience = initialAudience 
    ? {
        name: initialAudience.name,
        type: (initialAudience.type as "static" | "filter" | "all_users") || "all_users",
        userIds: [],
      }
    : {
        name: "Primary Audience",
        type: "all_users" as const,
        userIds: [],
      };

  const form = useForm<CampaignFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: initialData?.name || "",
      description: initialData?.description || "",
      scheduleType: (initialData?.scheduleType as "one_time" | "recurring" | "manual") || "one_time",
      cronExpression: initialData?.cronExpression || "",
      scheduledAt: initialData?.scheduledAt ? new Date(initialData.scheduledAt).toISOString().slice(0, 16) : "",
      smtpConfigId: initialData?.smtpConfigId || undefined,
      throttleLimit: initialData?.throttleLimit || 100,
      throttleInterval: initialData?.throttleInterval || 3600,
      audience: defaultAudience,
      steps: defaultSteps,
    },
  });

  const watchedSteps = form.watch("steps");
  const watchedScheduleType = form.watch("scheduleType");
  const watchedAudienceType = form.watch("audience.type");

  const handleNext = () => {
    if (currentStep < WIZARD_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleFormSubmit = form.handleSubmit((data) => {
    const campaignData: InsertCampaign = {
      name: data.name,
      description: data.description,
      scheduleType: data.scheduleType,
      cronExpression: data.scheduleType === "recurring" ? data.cronExpression : undefined,
      scheduledAt: data.scheduleType === "one_time" && data.scheduledAt ? new Date(data.scheduledAt) : undefined,
      smtpConfigId: data.smtpConfigId,
      throttleLimit: data.throttleLimit,
      throttleInterval: data.throttleInterval,
    };
    onSubmit(campaignData, data.audience, data.steps);
  });

  const addStep = () => {
    const steps = form.getValues("steps");
    form.setValue("steps", [
      ...steps,
      {
        name: `Step ${steps.length + 1}`,
        channel: "email",
        templateId: undefined,
        customSubject: "",
        customContent: "",
        delayMinutes: 60,
        isActive: true,
      },
    ]);
  };

  const removeStep = (index: number) => {
    const steps = form.getValues("steps");
    if (steps.length > 1) {
      form.setValue("steps", steps.filter((_, i) => i !== index));
    }
  };

  const renderBasicsStep = () => (
    <Card>
      <CardHeader>
        <CardTitle>Campaign Details</CardTitle>
        <CardDescription>Configure the basic settings for your campaign</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="name">Campaign Name</Label>
          <Input
            id="name"
            placeholder="e.g., Welcome Series, Monthly Newsletter"
            {...form.register("name")}
            data-testid="input-campaign-name"
          />
          {form.formState.errors.name && (
            <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            placeholder="Describe the purpose and goals of this campaign..."
            {...form.register("description")}
            data-testid="input-campaign-description"
          />
        </div>

        <Separator />

        <div className="space-y-2">
          <Label htmlFor="scheduleType">Schedule Type</Label>
          <Controller
            name="scheduleType"
            control={form.control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger data-testid="select-schedule-type">
                  <SelectValue placeholder="Select schedule type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="one_time">One-time: Send once at a scheduled time</SelectItem>
                  <SelectItem value="recurring">Recurring: Send on a schedule (cron)</SelectItem>
                  <SelectItem value="manual">Manual: Trigger manually when needed</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </div>

        {watchedScheduleType === "one_time" && (
          <div className="space-y-2">
            <Label htmlFor="scheduledAt">Scheduled Date/Time</Label>
            <Input
              id="scheduledAt"
              type="datetime-local"
              {...form.register("scheduledAt")}
              data-testid="input-scheduled-at"
            />
          </div>
        )}

        {watchedScheduleType === "recurring" && (
          <div className="space-y-2">
            <Label htmlFor="cronExpression">Cron Expression</Label>
            <Input
              id="cronExpression"
              placeholder="e.g., 0 9 * * 1 (Every Monday at 9 AM)"
              {...form.register("cronExpression")}
              data-testid="input-cron-expression"
            />
            <p className="text-sm text-muted-foreground">
              Format: minute hour day month weekday
            </p>
          </div>
        )}

        <Separator />

        <div className="space-y-2">
          <Label htmlFor="smtpConfigId">Email Configuration</Label>
          <Controller
            name="smtpConfigId"
            control={form.control}
            render={({ field }) => (
              <Select 
                value={field.value?.toString() || ""} 
                onValueChange={(v) => field.onChange(v ? parseInt(v) : undefined)}
              >
                <SelectTrigger data-testid="select-smtp-config">
                  <SelectValue placeholder="Select SMTP configuration" />
                </SelectTrigger>
                <SelectContent>
                  {smtpConfigs.filter(c => c.isActive).map((config) => (
                    <SelectItem key={config.id} value={config.id.toString()}>
                      {config.fromEmail}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="throttleLimit">Throttle Limit</Label>
            <Input
              id="throttleLimit"
              type="number"
              {...form.register("throttleLimit", { valueAsNumber: true })}
              data-testid="input-throttle-limit"
            />
            <p className="text-xs text-muted-foreground">Max emails per interval</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="throttleInterval">Throttle Interval (seconds)</Label>
            <Input
              id="throttleInterval"
              type="number"
              {...form.register("throttleInterval", { valueAsNumber: true })}
              data-testid="input-throttle-interval"
            />
            <p className="text-xs text-muted-foreground">Time window for throttling</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const renderAudienceStep = () => (
    <Card>
      <CardHeader>
        <CardTitle>Target Audience</CardTitle>
        <CardDescription>Define who will receive this campaign</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="audienceName">Audience Name</Label>
          <Input
            id="audienceName"
            placeholder="e.g., All Active Users, Premium Members"
            {...form.register("audience.name")}
            data-testid="input-audience-name"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="audienceType">Audience Type</Label>
          <Controller
            name="audience.type"
            control={form.control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger data-testid="select-audience-type">
                  <SelectValue placeholder="Select audience type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all_users">All Users: Send to all registered users</SelectItem>
                  <SelectItem value="static">Static List: Select specific users</SelectItem>
                  <SelectItem value="filter">Filter: Define criteria (coming soon)</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </div>

        {watchedAudienceType === "static" && (
          <div className="space-y-2">
            <Label>Select Users</Label>
            <div className="border rounded-md max-h-64 overflow-auto">
              {users.map((user) => (
                <div 
                  key={user.id} 
                  className="flex items-center gap-3 p-3 border-b last:border-b-0 hover-elevate"
                >
                  <Controller
                    name="audience.userIds"
                    control={form.control}
                    render={({ field }) => (
                      <Switch
                        checked={field.value?.includes(user.id) || false}
                        onCheckedChange={(checked) => {
                          const current = field.value || [];
                          if (checked) {
                            field.onChange([...current, user.id]);
                          } else {
                            field.onChange(current.filter(id => id !== user.id));
                          }
                        }}
                        data-testid={`switch-user-${user.id}`}
                      />
                    )}
                  />
                  <div>
                    <p className="font-medium">{user.firstName} {user.lastName}</p>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {watchedAudienceType === "all_users" && (
          <div className="bg-muted/50 rounded-md p-4 flex items-center gap-3">
            <Users className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="font-medium">All Registered Users</p>
              <p className="text-sm text-muted-foreground">
                This campaign will be sent to all {users.length} registered users
              </p>
            </div>
          </div>
        )}

        {watchedAudienceType === "filter" && (
          <div className="bg-muted/50 rounded-md p-4 text-center">
            <p className="text-muted-foreground">Filter-based audiences coming soon</p>
          </div>
        )}
      </CardContent>
    </Card>
  );

  const renderStepsStep = () => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle>Campaign Steps</CardTitle>
          <CardDescription>Define the sequence of messages in your campaign</CardDescription>
        </div>
        <Button type="button" variant="outline" onClick={addStep} data-testid="button-add-step">
          <Plus className="h-4 w-4 mr-2" />
          Add Step
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {watchedSteps.map((step, index) => (
          <Card key={index} className="border-l-4 border-l-primary">
            <CardHeader className="flex flex-row items-center justify-between gap-4 py-3">
              <div className="flex items-center gap-3">
                <GripVertical className="h-4 w-4 text-muted-foreground" />
                <Badge variant="outline">Step {index + 1}</Badge>
                <Input
                  className="w-48"
                  placeholder="Step name"
                  {...form.register(`steps.${index}.name`)}
                  data-testid={`input-step-name-${index}`}
                />
              </div>
              <div className="flex items-center gap-2">
                <Controller
                  name={`steps.${index}.isActive`}
                  control={form.control}
                  render={({ field }) => (
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      data-testid={`switch-step-active-${index}`}
                    />
                  )}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeStep(index)}
                  disabled={watchedSteps.length <= 1}
                  data-testid={`button-remove-step-${index}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Channel</Label>
                  <Controller
                    name={`steps.${index}.channel`}
                    control={form.control}
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger data-testid={`select-step-channel-${index}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="email">Email</SelectItem>
                          <SelectItem value="in_app">In-App Notification</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Delay (minutes)</Label>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <Input
                      type="number"
                      min={0}
                      {...form.register(`steps.${index}.delayMinutes`, { valueAsNumber: true })}
                      data-testid={`input-step-delay-${index}`}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {index === 0 ? "Delay after campaign start" : "Delay after previous step"}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Notification Template</Label>
                <Controller
                  name={`steps.${index}.templateId`}
                  control={form.control}
                  render={({ field }) => (
                    <Select 
                      value={field.value?.toString() || "custom"} 
                      onValueChange={(v) => field.onChange(v === "custom" ? undefined : parseInt(v))}
                    >
                      <SelectTrigger data-testid={`select-step-template-${index}`}>
                        <SelectValue placeholder="Select a template or use custom content" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="custom">Use custom content</SelectItem>
                        {templates.filter(t => t.status === "active").map((template) => (
                          <SelectItem key={template.id} value={template.id.toString()}>
                            {template.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              {!watchedSteps[index]?.templateId && (
                <>
                  <div className="space-y-2">
                    <Label>Custom Subject</Label>
                    <Input
                      placeholder="Email subject line"
                      {...form.register(`steps.${index}.customSubject`)}
                      data-testid={`input-step-subject-${index}`}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Custom Content</Label>
                    <Textarea
                      placeholder="Message content (supports variables like {{firstName}})"
                      className="min-h-24"
                      {...form.register(`steps.${index}.customContent`)}
                      data-testid={`input-step-content-${index}`}
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </CardContent>
    </Card>
  );

  const renderReviewStep = () => {
    const values = form.getValues();
    return (
      <Card>
        <CardHeader>
          <CardTitle>Review Campaign</CardTitle>
          <CardDescription>Review your campaign settings before creating</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="bg-muted/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Campaign Name</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-medium">{values.name || "Not set"}</p>
              </CardContent>
            </Card>
            <Card className="bg-muted/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Schedule Type</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-medium capitalize">{values.scheduleType.replace("_", " ")}</p>
              </CardContent>
            </Card>
          </div>

          <Separator />

          <div>
            <h4 className="font-medium mb-2">Target Audience</h4>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="capitalize">{values.audience.type.replace("_", " ")}</Badge>
              <span className="text-muted-foreground">{values.audience.name}</span>
              {values.audience.type === "static" && values.audience.userIds && (
                <span className="text-sm text-muted-foreground">
                  ({values.audience.userIds.length} users selected)
                </span>
              )}
            </div>
          </div>

          <Separator />

          <div>
            <h4 className="font-medium mb-2">Campaign Steps ({values.steps.length})</h4>
            <div className="space-y-2">
              {values.steps.map((step, index) => (
                <div key={index} className="flex items-center gap-3 p-3 bg-muted/30 rounded-md">
                  <Badge variant="secondary">{index + 1}</Badge>
                  <div className="flex-1">
                    <p className="font-medium">{step.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {step.channel} {step.delayMinutes > 0 && `- ${step.delayMinutes} min delay`}
                    </p>
                  </div>
                  {!step.isActive && <Badge variant="secondary">Disabled</Badge>}
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <form onSubmit={handleFormSubmit} className="space-y-6">
      <div className="flex items-center justify-between mb-8">
        {WIZARD_STEPS.map((step, index) => (
          <div 
            key={step.id}
            className={`flex items-center gap-2 ${index <= currentStep ? "text-foreground" : "text-muted-foreground"}`}
          >
            <div 
              className={`flex items-center justify-center w-8 h-8 rounded-full border-2 ${
                index < currentStep 
                  ? "bg-primary border-primary text-primary-foreground" 
                  : index === currentStep 
                    ? "border-primary text-primary" 
                    : "border-muted"
              }`}
            >
              {index < currentStep ? <Check className="h-4 w-4" /> : <step.icon className="h-4 w-4" />}
            </div>
            <span className="hidden sm:inline font-medium">{step.label}</span>
            {index < WIZARD_STEPS.length - 1 && (
              <div className={`w-8 h-0.5 ${index < currentStep ? "bg-primary" : "bg-muted"}`} />
            )}
          </div>
        ))}
      </div>

      {currentStep === 0 && renderBasicsStep()}
      {currentStep === 1 && renderAudienceStep()}
      {currentStep === 2 && renderStepsStep()}
      {currentStep === 3 && renderReviewStep()}

      <div className="flex justify-between pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={handleBack}
          disabled={currentStep === 0}
          data-testid="button-back"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        {currentStep < WIZARD_STEPS.length - 1 ? (
          <Button type="button" onClick={handleNext} data-testid="button-next">
            Next
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        ) : (
          <Button type="submit" disabled={isSubmitting} data-testid="button-submit">
            {isSubmitting ? "Creating..." : initialData ? "Update Campaign" : "Create Campaign"}
          </Button>
        )}
      </div>
    </form>
  );
}
