import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2, ArrowDown, Play, GripVertical, Globe, Webhook, Code, GitBranch, Link, Clock, Zap, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
import { CronExpressionEditor } from "@/components/cron-expression-editor";
import { httpMethods, authTypes, type JobActionConfig } from "@shared/schema";

const stepActionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("http_request"),
    url: z.string().url(),
    method: z.enum(httpMethods),
    headers: z.record(z.string()).optional(),
    body: z.string().optional(),
    auth: z.object({
      type: z.enum(authTypes),
      username: z.string().optional(),
      password: z.string().optional(),
      token: z.string().optional(),
      key: z.string().optional(),
      value: z.string().optional(),
      addTo: z.enum(["header", "query"]).optional(),
      clientId: z.string().optional(),
      clientSecret: z.string().optional(),
      tokenUrl: z.string().optional(),
      scope: z.string().optional(),
    }).optional(),
  }),
  z.object({
    type: z.literal("webhook"),
    url: z.string().url(),
    payload: z.string().optional(),
  }),
  z.object({
    type: z.literal("script"),
    code: z.string(),
    language: z.literal("javascript"),
  }),
]);

// Condition types
export type ConditionOperator = "equals" | "not_equals" | "contains" | "not_contains" | "greater_than" | "less_than" | "is_empty" | "is_not_empty";

export interface WorkflowCondition {
  field: string;
  operator: ConditionOperator;
  value?: string | number | boolean;
}

export type TriggerType = "manual" | "cron" | "webhook";
export type StepType = "action" | "condition";

export interface WorkflowStep {
  id: string;
  name: string;
  stepType: StepType;
  action?: JobActionConfig | null;
  inputMapping?: Record<string, string>;
  outputVariable?: string;
  condition?: WorkflowCondition | null;
  onTrueStep?: number | null;
  onFalseStep?: number | null;
}

interface WorkflowBuilderProps {
  initialSteps?: WorkflowStep[];
  initialName?: string;
  initialDescription?: string;
  initialCronExpression?: string;
  initialTriggerType?: TriggerType;
  webhookToken?: string | null;
  webhookUrl?: string | null;
  workflowId?: number;
  onSave: (data: { 
    name: string; 
    description: string; 
    cronExpression: string | null;
    triggerType: TriggerType;
    steps: Omit<WorkflowStep, "id">[] 
  }) => void;
  onCancel: () => void;
  onGenerateWebhook?: () => void;
  onRevokeWebhook?: () => void;
  isSaving: boolean;
}

export function WorkflowBuilder({
  initialSteps = [],
  initialName = "",
  initialDescription = "",
  initialCronExpression = "",
  initialTriggerType = "manual",
  webhookToken,
  webhookUrl,
  workflowId,
  onSave,
  onCancel,
  onGenerateWebhook,
  onRevokeWebhook,
  isSaving,
}: WorkflowBuilderProps) {
  const [steps, setSteps] = useState<WorkflowStep[]>(
    initialSteps.length > 0 ? initialSteps.map(s => ({ ...s, stepType: s.stepType || "action" })) : []
  );
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [cronExpression, setCronExpression] = useState(initialCronExpression);
  const [triggerType, setTriggerType] = useState<TriggerType>(initialTriggerType);
  const [editingStep, setEditingStep] = useState<string | null>(null);
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  const addStep = (type: StepType = "action") => {
    const newStep: WorkflowStep = {
      id: `step-${Date.now()}`,
      name: type === "condition" ? `Condition ${steps.length + 1}` : `Step ${steps.length + 1}`,
      stepType: type,
      action: type === "action" ? {
        type: "http_request",
        url: "",
        method: "GET",
        headers: {},
        body: "",
      } : null,
      condition: type === "condition" ? {
        field: "",
        operator: "equals",
        value: "",
      } : null,
      outputVariable: `step${steps.length + 1}Result`,
    };
    setSteps([...steps, newStep]);
    setEditingStep(newStep.id);
  };

  const getFullWebhookUrl = () => {
    if (!webhookUrl) return "";
    if (typeof window !== "undefined") {
      return window.location.origin + webhookUrl;
    }
    return webhookUrl;
  };

  const copyWebhookUrl = async () => {
    const fullUrl = getFullWebhookUrl();
    if (!fullUrl) return;
    
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(fullUrl);
        setCopiedWebhook(true);
        setTimeout(() => setCopiedWebhook(false), 2000);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = fullUrl;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
        setCopiedWebhook(true);
        setTimeout(() => setCopiedWebhook(false), 2000);
      }
    } catch {
      console.error("Failed to copy to clipboard");
    }
  };

  const removeStep = (id: string) => {
    setSteps(steps.filter((s) => s.id !== id));
    if (editingStep === id) {
      setEditingStep(null);
    }
  };

  const updateStep = (id: string, updates: Partial<WorkflowStep>) => {
    setSteps(steps.map((s) => (s.id === id ? { ...s, ...updates } : s)));
  };

  const validateSteps = (): string | null => {
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      if (step.stepType === "condition") {
        if (!step.condition?.field?.trim()) {
          return `Step ${i + 1} (${step.name}): Condition field is required`;
        }
        if (!step.condition?.operator) {
          return `Step ${i + 1} (${step.name}): Condition operator is required`;
        }
        const needsValue = !["is_empty", "is_not_empty"].includes(step.condition.operator);
        if (needsValue && (step.condition.value === undefined || step.condition.value === "")) {
          return `Step ${i + 1} (${step.name}): Condition value is required for "${step.condition.operator}" operator`;
        }
      } else {
        if (!step.action) {
          return `Step ${i + 1} (${step.name}): Action configuration is required`;
        }
        if (step.action.type === "http_request" && !step.action.url?.trim()) {
          return `Step ${i + 1} (${step.name}): URL is required for HTTP requests`;
        }
        if (step.action.type === "webhook" && !step.action.url?.trim()) {
          return `Step ${i + 1} (${step.name}): URL is required for webhooks`;
        }
      }
    }
    return null;
  };

  const handleSave = () => {
    const validationError = validateSteps();
    if (validationError) {
      alert(validationError);
      return;
    }
    
    onSave({
      name,
      description,
      cronExpression: triggerType === "cron" ? cronExpression : null,
      triggerType,
      steps: steps.map((s, index) => ({
        name: s.name,
        stepType: s.stepType,
        action: s.action,
        inputMapping: s.inputMapping,
        outputVariable: s.outputVariable,
        condition: s.condition,
        onTrueStep: s.onTrueStep,
        onFalseStep: s.onFalseStep,
        stepOrder: index,
      })),
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Workflow Details</CardTitle>
          <CardDescription>Configure the basic settings for your workflow</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="workflow-name">Workflow Name</Label>
              <Input
                id="workflow-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My API Workflow"
                data-testid="input-workflow-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="workflow-description">Description</Label>
              <Input
                id="workflow-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Fetch users and process them"
                data-testid="input-workflow-description"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Trigger Type</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={triggerType === "manual" ? "default" : "outline"}
                onClick={() => setTriggerType("manual")}
                className="flex-1"
                data-testid="button-trigger-manual"
              >
                <Play className="h-4 w-4 mr-2" />
                Manual
              </Button>
              <Button
                type="button"
                variant={triggerType === "cron" ? "default" : "outline"}
                onClick={() => setTriggerType("cron")}
                className="flex-1"
                data-testid="button-trigger-cron"
              >
                <Clock className="h-4 w-4 mr-2" />
                Scheduled
              </Button>
              <Button
                type="button"
                variant={triggerType === "webhook" ? "default" : "outline"}
                onClick={() => setTriggerType("webhook")}
                className="flex-1"
                data-testid="button-trigger-webhook"
              >
                <Zap className="h-4 w-4 mr-2" />
                Webhook
              </Button>
            </div>
          </div>

          {triggerType === "cron" && (
            <div className="space-y-2">
              <Label>Schedule</Label>
              <CronExpressionEditor
                value={cronExpression}
                onChange={setCronExpression}
              />
            </div>
          )}

          {triggerType === "webhook" && (
            <div className="space-y-2">
              <Label>Webhook URL</Label>
              {webhookToken ? (
                <div className="flex gap-2">
                  <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-muted rounded-md font-mono text-sm overflow-hidden">
                    <Link className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                    <span className="truncate">{getFullWebhookUrl()}</span>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={copyWebhookUrl}
                    data-testid="button-copy-webhook"
                  >
                    {copiedWebhook ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                  {onRevokeWebhook && (
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={onRevokeWebhook}
                      data-testid="button-revoke-webhook"
                    >
                      Revoke
                    </Button>
                  )}
                </div>
              ) : (
                <div className="flex gap-2">
                  <p className="flex-1 text-sm text-muted-foreground py-2">
                    {workflowId ? "Generate a webhook URL to trigger this workflow from external services." : "Save the workflow first, then you can generate a webhook URL."}
                  </p>
                  {onGenerateWebhook && workflowId && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={onGenerateWebhook}
                      data-testid="button-generate-webhook"
                    >
                      <Zap className="h-4 w-4 mr-2" />
                      Generate URL
                    </Button>
                  )}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Send a POST request to this URL with a JSON body to trigger the workflow. The payload will be available as context variables.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle>Workflow Steps</CardTitle>
            <CardDescription>
              Define the steps that will be executed in sequence. Use {`{{variableName}}`} to reference data from previous steps.
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => addStep("action")} data-testid="button-add-step">
              <Plus className="h-4 w-4 mr-2" />
              Add Action
            </Button>
            <Button variant="outline" onClick={() => addStep("condition")} data-testid="button-add-condition">
              <GitBranch className="h-4 w-4 mr-2" />
              Add Condition
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {steps.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>No steps defined yet.</p>
              <p className="text-sm">Click "Add Step" to create your first workflow step.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {steps.map((step, index) => (
                <div key={step.id}>
                  <StepCard
                    step={step}
                    stepNumber={index + 1}
                    isEditing={editingStep === step.id}
                    onEdit={() => setEditingStep(editingStep === step.id ? null : step.id)}
                    onUpdate={(updates) => updateStep(step.id, updates)}
                    onRemove={() => removeStep(step.id)}
                    previousSteps={steps.slice(0, index)}
                  />
                  {index < steps.length - 1 && (
                    <div className="flex justify-center py-2">
                      <ArrowDown className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-4">
        <Button variant="outline" onClick={onCancel} data-testid="button-cancel-workflow">
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          disabled={!name || steps.length === 0 || isSaving}
          data-testid="button-save-workflow"
        >
          {isSaving ? "Saving..." : "Save Workflow"}
        </Button>
      </div>
    </div>
  );
}

interface StepCardProps {
  step: WorkflowStep;
  stepNumber: number;
  isEditing: boolean;
  onEdit: () => void;
  onUpdate: (updates: Partial<WorkflowStep>) => void;
  onRemove: () => void;
  previousSteps: WorkflowStep[];
}

function StepCard({ step, stepNumber, isEditing, onEdit, onUpdate, onRemove, previousSteps }: StepCardProps) {
  const getStepIcon = () => {
    if (step.stepType === "condition") {
      return <GitBranch className="h-4 w-4" />;
    }
    if (!step.action) return <Globe className="h-4 w-4" />;
    switch (step.action.type) {
      case "http_request":
        return <Globe className="h-4 w-4" />;
      case "webhook":
        return <Webhook className="h-4 w-4" />;
      case "script":
        return <Code className="h-4 w-4" />;
    }
  };

  const getStepDescription = () => {
    if (step.stepType === "condition") {
      const cond = step.condition;
      if (!cond) return "No condition set";
      return `If ${cond.field} ${cond.operator.replace("_", " ")} ${cond.value ?? ""}`;
    }
    if (!step.action) return "No action set";
    switch (step.action.type) {
      case "http_request":
        return `${step.action.method} ${step.action.url || "No URL set"}`;
      case "webhook":
        return step.action.url || "No URL set";
      case "script":
        return "JavaScript code";
    }
  };

  const getStepTypeLabel = () => {
    if (step.stepType === "condition") return "condition";
    return step.action?.type?.replace("_", " ") || "action";
  };

  return (
    <Card className={`${isEditing ? "border-primary" : ""} ${step.stepType === "condition" ? "border-l-4 border-l-amber-500" : ""}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`flex items-center justify-center h-8 w-8 rounded-full text-sm font-medium ${step.stepType === "condition" ? "bg-amber-500/10 text-amber-600" : "bg-primary/10 text-primary"}`}>
              {stepNumber}
            </div>
            <div className="flex items-center gap-2">
              {getStepIcon()}
              <span className="font-medium">{step.name}</span>
            </div>
            <Badge variant={step.stepType === "condition" ? "outline" : "secondary"} className="text-xs">
              {getStepTypeLabel()}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onEdit} data-testid={`button-edit-step-${stepNumber}`}>
              {isEditing ? "Collapse" : "Edit"}
            </Button>
            <Button variant="ghost" size="icon" onClick={onRemove} data-testid={`button-remove-step-${stepNumber}`}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {!isEditing && (
          <p className="text-sm text-muted-foreground ml-11 truncate">
            {getStepDescription()}
          </p>
        )}
      </CardHeader>

      {isEditing && (
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Step Name</Label>
              <Input
                value={step.name}
                onChange={(e) => onUpdate({ name: e.target.value })}
                placeholder="Step name"
                data-testid={`input-step-name-${stepNumber}`}
              />
            </div>
            <div className="space-y-2">
              <Label>Output Variable</Label>
              <Input
                value={step.outputVariable || ""}
                onChange={(e) => onUpdate({ outputVariable: e.target.value })}
                placeholder="e.g., usersData"
                data-testid={`input-step-output-${stepNumber}`}
              />
              <p className="text-xs text-muted-foreground">
                {step.stepType === "condition" 
                  ? "Stores true/false result of this condition"
                  : `Access in later steps as {{${step.outputVariable || "variableName"}}}`}
              </p>
            </div>
          </div>

          {step.stepType === "condition" ? (
            <ConditionEditor
              condition={step.condition || { field: "", operator: "equals", value: "" }}
              onUpdate={(condition) => onUpdate({ condition })}
              onTrueStep={step.onTrueStep}
              onFalseStep={step.onFalseStep}
              onUpdateBranching={(onTrueStep, onFalseStep) => onUpdate({ onTrueStep, onFalseStep })}
              stepNumber={stepNumber}
              previousSteps={previousSteps}
            />
          ) : (
            <>
              <div className="space-y-2">
                <Label>Action Type</Label>
                <Select
                  value={step.action?.type || "http_request"}
                  onValueChange={(value: "http_request" | "webhook" | "script") => {
                    if (value === "http_request") {
                      onUpdate({
                        action: { type: "http_request", url: "", method: "GET", headers: {}, body: "" },
                      });
                    } else if (value === "webhook") {
                      onUpdate({
                        action: { type: "webhook", url: "", payload: "" },
                      });
                    } else {
                      onUpdate({
                        action: { type: "script", code: "", language: "javascript" },
                      });
                    }
                  }}
                >
                  <SelectTrigger data-testid={`select-step-type-${stepNumber}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="http_request">HTTP Request</SelectItem>
                    <SelectItem value="webhook">Webhook</SelectItem>
                    <SelectItem value="script">JavaScript Script</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {step.action?.type === "http_request" && (
                <HttpRequestEditor
                  action={step.action}
                  onUpdate={(action) => onUpdate({ action })}
                  stepNumber={stepNumber}
                />
              )}

              {step.action?.type === "webhook" && (
                <WebhookEditor
                  action={step.action}
                  onUpdate={(action) => onUpdate({ action })}
                  stepNumber={stepNumber}
                />
              )}

              {step.action?.type === "script" && (
                <ScriptEditor
                  action={step.action}
                  onUpdate={(action) => onUpdate({ action })}
                  stepNumber={stepNumber}
                />
              )}
            </>
          )}

          {previousSteps.length > 0 && (
            <div className="rounded-lg bg-muted p-3">
              <Label className="text-sm font-medium">Available Variables</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                <Badge variant="outline">{`{{_lastResult}}`}</Badge>
                {previousSteps.map((ps) =>
                  ps.outputVariable ? (
                    <Badge key={ps.id} variant="outline">
                      {`{{${ps.outputVariable}}}`}
                    </Badge>
                  ) : null
                )}
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

// Condition editor component
interface ConditionEditorProps {
  condition: WorkflowCondition;
  onUpdate: (condition: WorkflowCondition) => void;
  onTrueStep?: number | null;
  onFalseStep?: number | null;
  onUpdateBranching: (onTrueStep: number | null, onFalseStep: number | null) => void;
  stepNumber: number;
  previousSteps: WorkflowStep[];
}

const conditionOperators: { value: ConditionOperator; label: string }[] = [
  { value: "equals", label: "equals" },
  { value: "not_equals", label: "does not equal" },
  { value: "contains", label: "contains" },
  { value: "not_contains", label: "does not contain" },
  { value: "greater_than", label: "is greater than" },
  { value: "less_than", label: "is less than" },
  { value: "is_empty", label: "is empty" },
  { value: "is_not_empty", label: "is not empty" },
];

function ConditionEditor({ 
  condition, 
  onUpdate, 
  onTrueStep, 
  onFalseStep, 
  onUpdateBranching, 
  stepNumber,
  previousSteps 
}: ConditionEditorProps) {
  const needsValue = !["is_empty", "is_not_empty"].includes(condition.operator);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 space-y-4">
        <div className="flex items-center gap-2 text-amber-600">
          <GitBranch className="h-4 w-4" />
          <Label className="font-medium">Condition Logic</Label>
        </div>
        
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-2">
            <Label className="text-xs">Field to Check</Label>
            <Input
              value={condition.field}
              onChange={(e) => onUpdate({ ...condition, field: e.target.value })}
              placeholder="_lastResult.status"
              data-testid={`input-condition-field-${stepNumber}`}
            />
            <p className="text-xs text-muted-foreground">Use dot notation for nested values</p>
          </div>
          
          <div className="space-y-2">
            <Label className="text-xs">Operator</Label>
            <Select
              value={condition.operator}
              onValueChange={(value: ConditionOperator) => onUpdate({ ...condition, operator: value })}
            >
              <SelectTrigger data-testid={`select-condition-operator-${stepNumber}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {conditionOperators.map((op) => (
                  <SelectItem key={op.value} value={op.value}>
                    {op.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {needsValue && (
            <div className="space-y-2">
              <Label className="text-xs">Value</Label>
              <Input
                value={String(condition.value ?? "")}
                onChange={(e) => onUpdate({ ...condition, value: e.target.value })}
                placeholder="200"
                data-testid={`input-condition-value-${stepNumber}`}
              />
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-sm flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            If True, go to step:
          </Label>
          <Input
            type="number"
            min={1}
            value={onTrueStep ?? ""}
            onChange={(e) => onUpdateBranching(
              e.target.value ? parseInt(e.target.value) : null, 
              onFalseStep ?? null
            )}
            placeholder="Next step (leave empty to continue)"
            data-testid={`input-condition-true-${stepNumber}`}
          />
          <p className="text-xs text-muted-foreground">Leave empty to continue to next step</p>
        </div>
        
        <div className="space-y-2">
          <Label className="text-sm flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            If False, go to step:
          </Label>
          <Input
            type="number"
            min={1}
            value={onFalseStep ?? ""}
            onChange={(e) => onUpdateBranching(
              onTrueStep ?? null,
              e.target.value ? parseInt(e.target.value) : null
            )}
            placeholder="Skip to step (leave empty to continue)"
            data-testid={`input-condition-false-${stepNumber}`}
          />
          <p className="text-xs text-muted-foreground">Leave empty to continue to next step</p>
        </div>
      </div>

      {previousSteps.length > 0 && (
        <div className="rounded-lg bg-muted p-3">
          <Label className="text-sm font-medium">Available Fields</Label>
          <div className="flex flex-wrap gap-2 mt-2 text-xs">
            <Badge variant="outline">_lastResult</Badge>
            <Badge variant="outline">_webhookPayload</Badge>
            {previousSteps.map((ps) =>
              ps.outputVariable ? (
                <Badge key={ps.id} variant="outline">
                  {ps.outputVariable}
                </Badge>
              ) : null
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface HttpRequestEditorProps {
  action: Extract<JobActionConfig, { type: "http_request" }>;
  onUpdate: (action: Extract<JobActionConfig, { type: "http_request" }>) => void;
  stepNumber: number;
}

function HttpRequestEditor({ action, onUpdate, stepNumber }: HttpRequestEditorProps) {
  const authType = action.auth?.type || "none";

  const handleAuthTypeChange = (value: string) => {
    if (value === "none") {
      onUpdate({ ...action, auth: { type: "none" } });
    } else if (value === "basic") {
      onUpdate({ ...action, auth: { type: "basic", username: "", password: "" } });
    } else if (value === "bearer") {
      onUpdate({ ...action, auth: { type: "bearer", token: "" } });
    } else if (value === "api_key") {
      onUpdate({ ...action, auth: { type: "api_key", key: "X-API-Key", value: "", addTo: "header" } });
    } else if (value === "oauth2_client_credentials") {
      onUpdate({ ...action, auth: { type: "oauth2_client_credentials", clientId: "", clientSecret: "", tokenUrl: "", scope: "" } });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <div className="w-32">
          <Label>Method</Label>
          <Select
            value={action.method}
            onValueChange={(value: typeof httpMethods[number]) =>
              onUpdate({ ...action, method: value })
            }
          >
            <SelectTrigger data-testid={`select-step-method-${stepNumber}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {httpMethods.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1">
          <Label>URL</Label>
          <Input
            value={action.url}
            onChange={(e) => onUpdate({ ...action, url: e.target.value })}
            placeholder="https://api.example.com/users?offset={{offset}}&limit=100"
            data-testid={`input-step-url-${stepNumber}`}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Request Body (Optional)</Label>
        <Textarea
          value={action.body || ""}
          onChange={(e) => onUpdate({ ...action, body: e.target.value })}
          placeholder='{"userId": "{{_lastResult.id}}"}'
          className="font-mono text-sm min-h-20"
          data-testid={`input-step-body-${stepNumber}`}
        />
        <p className="text-xs text-muted-foreground">
          Use {`{{variableName}}`} to insert data from previous steps. Supports nested paths like {`{{users.0.id}}`}
        </p>
      </div>

      <div className="space-y-4 rounded-lg border p-4">
        <Label className="text-base font-medium">Authentication</Label>
        <div className="space-y-2">
          <Label>Auth Type</Label>
          <Select value={authType} onValueChange={handleAuthTypeChange}>
            <SelectTrigger data-testid={`select-step-auth-type-${stepNumber}`}>
              <SelectValue placeholder="Select authentication type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No Authentication</SelectItem>
              <SelectItem value="basic">Basic Auth</SelectItem>
              <SelectItem value="bearer">Bearer Token</SelectItem>
              <SelectItem value="api_key">API Key</SelectItem>
              <SelectItem value="oauth2_client_credentials">OAuth2 Client Credentials</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {authType === "basic" && action.auth?.type === "basic" && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Username</Label>
              <Input
                value={action.auth.username || ""}
                onChange={(e) => onUpdate({ ...action, auth: { ...action.auth, type: "basic", username: e.target.value, password: action.auth?.type === "basic" ? action.auth.password : "" } })}
                placeholder="Username"
                data-testid={`input-step-auth-username-${stepNumber}`}
              />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input
                type="password"
                value={action.auth.password || ""}
                onChange={(e) => onUpdate({ ...action, auth: { ...action.auth, type: "basic", username: action.auth?.type === "basic" ? action.auth.username : "", password: e.target.value } })}
                placeholder="Password"
                data-testid={`input-step-auth-password-${stepNumber}`}
              />
            </div>
          </div>
        )}

        {authType === "bearer" && action.auth?.type === "bearer" && (
          <div className="space-y-2">
            <Label>Bearer Token</Label>
            <Input
              type="password"
              value={action.auth.token || ""}
              onChange={(e) => onUpdate({ ...action, auth: { type: "bearer", token: e.target.value } })}
              placeholder="Enter your bearer token"
              data-testid={`input-step-auth-token-${stepNumber}`}
            />
          </div>
        )}

        {authType === "api_key" && action.auth?.type === "api_key" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Header/Query Name</Label>
                <Input
                  value={action.auth.key || ""}
                  onChange={(e) => onUpdate({ ...action, auth: { ...action.auth, type: "api_key", key: e.target.value, value: action.auth?.type === "api_key" ? action.auth.value : "", addTo: action.auth?.type === "api_key" ? action.auth.addTo : "header" } })}
                  placeholder="X-API-Key"
                  data-testid={`input-step-auth-key-name-${stepNumber}`}
                />
              </div>
              <div className="space-y-2">
                <Label>API Key Value</Label>
                <Input
                  type="password"
                  value={action.auth.value || ""}
                  onChange={(e) => onUpdate({ ...action, auth: { ...action.auth, type: "api_key", key: action.auth?.type === "api_key" ? action.auth.key : "X-API-Key", value: e.target.value, addTo: action.auth?.type === "api_key" ? action.auth.addTo : "header" } })}
                  placeholder="Your API key"
                  data-testid={`input-step-auth-key-value-${stepNumber}`}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Add To</Label>
              <Select
                value={action.auth.addTo || "header"}
                onValueChange={(value: "header" | "query") => onUpdate({ ...action, auth: { ...action.auth, type: "api_key", key: action.auth?.type === "api_key" ? action.auth.key : "X-API-Key", value: action.auth?.type === "api_key" ? action.auth.value : "", addTo: value } })}
              >
                <SelectTrigger data-testid={`select-step-auth-addto-${stepNumber}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="header">Header</SelectItem>
                  <SelectItem value="query">Query Parameter</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {authType === "oauth2_client_credentials" && action.auth?.type === "oauth2_client_credentials" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Client ID</Label>
                <Input
                  value={action.auth.clientId || ""}
                  onChange={(e) => onUpdate({ ...action, auth: { ...action.auth, type: "oauth2_client_credentials", clientId: e.target.value, clientSecret: action.auth?.type === "oauth2_client_credentials" ? action.auth.clientSecret : "", tokenUrl: action.auth?.type === "oauth2_client_credentials" ? action.auth.tokenUrl : "", scope: action.auth?.type === "oauth2_client_credentials" ? action.auth.scope : "" } })}
                  placeholder="Client ID"
                  data-testid={`input-step-auth-client-id-${stepNumber}`}
                />
              </div>
              <div className="space-y-2">
                <Label>Client Secret</Label>
                <Input
                  type="password"
                  value={action.auth.clientSecret || ""}
                  onChange={(e) => onUpdate({ ...action, auth: { ...action.auth, type: "oauth2_client_credentials", clientId: action.auth?.type === "oauth2_client_credentials" ? action.auth.clientId : "", clientSecret: e.target.value, tokenUrl: action.auth?.type === "oauth2_client_credentials" ? action.auth.tokenUrl : "", scope: action.auth?.type === "oauth2_client_credentials" ? action.auth.scope : "" } })}
                  placeholder="Client Secret"
                  data-testid={`input-step-auth-client-secret-${stepNumber}`}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Token URL</Label>
              <Input
                value={action.auth.tokenUrl || ""}
                onChange={(e) => onUpdate({ ...action, auth: { ...action.auth, type: "oauth2_client_credentials", clientId: action.auth?.type === "oauth2_client_credentials" ? action.auth.clientId : "", clientSecret: action.auth?.type === "oauth2_client_credentials" ? action.auth.clientSecret : "", tokenUrl: e.target.value, scope: action.auth?.type === "oauth2_client_credentials" ? action.auth.scope : "" } })}
                placeholder="https://auth.example.com/oauth/token"
                data-testid={`input-step-auth-token-url-${stepNumber}`}
              />
              <p className="text-xs text-muted-foreground">The OAuth2 token endpoint URL</p>
            </div>
            <div className="space-y-2">
              <Label>Scope (Optional)</Label>
              <Input
                value={action.auth.scope || ""}
                onChange={(e) => onUpdate({ ...action, auth: { ...action.auth, type: "oauth2_client_credentials", clientId: action.auth?.type === "oauth2_client_credentials" ? action.auth.clientId : "", clientSecret: action.auth?.type === "oauth2_client_credentials" ? action.auth.clientSecret : "", tokenUrl: action.auth?.type === "oauth2_client_credentials" ? action.auth.tokenUrl : "", scope: e.target.value } })}
                placeholder="read write"
                data-testid={`input-step-auth-scope-${stepNumber}`}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface WebhookEditorProps {
  action: Extract<JobActionConfig, { type: "webhook" }>;
  onUpdate: (action: Extract<JobActionConfig, { type: "webhook" }>) => void;
  stepNumber: number;
}

function WebhookEditor({ action, onUpdate, stepNumber }: WebhookEditorProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Webhook URL</Label>
        <Input
          value={action.url}
          onChange={(e) => onUpdate({ ...action, url: e.target.value })}
          placeholder="https://hooks.example.com/webhook"
          data-testid={`input-step-webhook-url-${stepNumber}`}
        />
      </div>
      <div className="space-y-2">
        <Label>Payload</Label>
        <Textarea
          value={action.payload || ""}
          onChange={(e) => onUpdate({ ...action, payload: e.target.value })}
          placeholder='{"data": {{_lastResult}}}'
          className="font-mono text-sm min-h-20"
          data-testid={`input-step-webhook-payload-${stepNumber}`}
        />
      </div>
    </div>
  );
}

interface ScriptEditorProps {
  action: Extract<JobActionConfig, { type: "script" }>;
  onUpdate: (action: Extract<JobActionConfig, { type: "script" }>) => void;
  stepNumber: number;
}

function ScriptEditor({ action, onUpdate, stepNumber }: ScriptEditorProps) {
  return (
    <div className="space-y-2">
      <Label>JavaScript Code</Label>
      <Textarea
        value={action.code}
        onChange={(e) => onUpdate({ ...action, code: e.target.value })}
        placeholder={`// Access previous step data via context
const users = context._lastResult;

// Process the data
const activeUsers = users.filter(u => u.active);

// Return data for next step
return activeUsers;`}
        className="font-mono text-sm min-h-40"
        data-testid={`input-step-code-${stepNumber}`}
      />
      <p className="text-xs text-muted-foreground">
        Access data from previous steps using the <code>context</code> object. Return a value to pass to the next step.
      </p>
    </div>
  );
}
