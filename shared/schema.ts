import { z } from "zod";
import { pgTable, text, integer, boolean, timestamp, jsonb, serial, varchar, index } from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";

// ============ RBAC & AUTH TABLES ============

// Session storage table
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// App settings table (for tracking setup completion)
export const appSettings = pgTable("app_settings", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 100 }).notNull().unique(),
  value: text("value"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type AppSetting = typeof appSettings.$inferSelect;

// Users table for local email/password authentication
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").notNull().unique(),
  password: varchar("password").notNull(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  isSuperAdmin: boolean("is_super_admin").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type User = typeof users.$inferSelect;
export type UpsertUser = typeof users.$inferInsert;

// Role definitions
export const roleNames = ["admin", "editor", "viewer"] as const;
export type RoleName = typeof roleNames[number];

// Roles table
export const roles = pgTable("roles", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 50 }).notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type DbRole = typeof roles.$inferSelect;

// User roles junction table
export const userRoles = pgTable("user_roles", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  roleId: integer("role_id").references(() => roles.id, { onDelete: "cascade" }).notNull(),
  assignedAt: timestamp("assigned_at").defaultNow().notNull(),
  assignedBy: varchar("assigned_by").references(() => users.id),
});

export type DbUserRole = typeof userRoles.$inferSelect;

// User relations
export const usersRelations = relations(users, ({ many }) => ({
  userRoles: many(userRoles),
}));

// Role relations
export const rolesRelations = relations(roles, ({ many }) => ({
  userRoles: many(userRoles),
}));

// UserRoles relations
export const userRolesRelations = relations(userRoles, ({ one }) => ({
  user: one(users, {
    fields: [userRoles.userId],
    references: [users.id],
  }),
  role: one(roles, {
    fields: [userRoles.roleId],
    references: [roles.id],
  }),
}));

// Permission definitions (static, enforced in code)
export const permissions = {
  // User management
  "users:read": "View users list",
  "users:create": "Add new users",
  "users:delete": "Delete users",
  "users:assign_role": "Assign roles to users",
  // Job management
  "jobs:read": "View jobs",
  "jobs:create": "Create jobs",
  "jobs:edit": "Edit jobs",
  "jobs:delete": "Delete jobs",
  "jobs:run": "Run jobs manually",
  // Workflow management
  "workflows:read": "View workflows",
  "workflows:create": "Create workflows",
  "workflows:edit": "Edit workflows",
  "workflows:delete": "Delete workflows",
  "workflows:run": "Run workflows manually",
  // History
  "history:read": "View execution history",
  // Settings
  "settings:read": "View settings",
  "settings:edit": "Edit settings",
  // Notification templates
  "templates:read": "View notification templates",
  "templates:create": "Create notification templates",
  "templates:edit": "Edit notification templates",
  "templates:delete": "Delete notification templates",
  // Notifications
  "notifications:read": "View notifications",
  "notifications:send": "Send notifications",
  "notifications:manage": "Manage notification settings",
  // SMTP
  "smtp:read": "View SMTP configuration",
  "smtp:manage": "Manage SMTP configuration",
  // Campaigns
  "campaigns:read": "View campaigns",
  "campaigns:create": "Create campaigns",
  "campaigns:edit": "Edit campaigns",
  "campaigns:delete": "Delete campaigns",
  "campaigns:send": "Launch and send campaigns",
  // Email Templates (Dynamic Templates)
  "email_templates:read": "View email templates",
  "email_templates:create": "Create email templates",
  "email_templates:edit": "Edit email templates",
  "email_templates:delete": "Delete email templates",
} as const;

export type Permission = keyof typeof permissions;

// Role-permission mapping (admin has all, editor can manage jobs/workflows, viewer can only read)
export const rolePermissions: Record<RoleName, Permission[]> = {
  admin: Object.keys(permissions) as Permission[],
  editor: [
    "users:read",
    "jobs:read", "jobs:create", "jobs:edit", "jobs:delete", "jobs:run",
    "workflows:read", "workflows:create", "workflows:edit", "workflows:delete", "workflows:run",
    "history:read",
    "settings:read",
    "templates:read", "templates:create", "templates:edit",
    "notifications:read", "notifications:send",
    "smtp:read",
    "campaigns:read", "campaigns:create", "campaigns:edit", "campaigns:send",
    "email_templates:read", "email_templates:create", "email_templates:edit",
  ],
  viewer: [
    "jobs:read",
    "workflows:read",
    "history:read",
    "settings:read",
    "templates:read",
    "notifications:read",
    "campaigns:read",
    "email_templates:read",
  ],
};

// Zod schemas for user validation (local auth)
export const userSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  profileImageUrl: z.string().nullable(),
  isSuperAdmin: z.boolean(),
  createdAt: z.date().nullable(),
  updatedAt: z.date().nullable(),
});

export const userWithRoleSchema = userSchema.extend({
  roles: z.array(z.object({
    id: z.number(),
    name: z.string(),
    description: z.string().nullable(),
  })),
});

export type UserWithRole = z.infer<typeof userWithRoleSchema>;

// Setup schema (for initial admin creation)
export const setupSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().optional(),
});

export type SetupData = z.infer<typeof setupSchema>;

// Login schema
export const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export type LoginData = z.infer<typeof loginSchema>;

// Create user schema (for admin creating users)
export const createUserSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().optional(),
  roleId: z.number().optional(),
});

export type CreateUserData = z.infer<typeof createUserSchema>;

// Update user schema (for admin editing users)
export const updateUserSchema = z.object({
  email: z.string().email("Please enter a valid email address").optional(),
  firstName: z.string().min(1, "First name is required").optional(),
  lastName: z.string().optional(),
  roleId: z.number().optional(),
});

export type UpdateUserData = z.infer<typeof updateUserSchema>;

// Reset password schema
export const resetPasswordSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters"),
});

// Change password schema (for self-service)
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
});

export type ChangePasswordData = z.infer<typeof changePasswordSchema>;

// Update profile schema (for self-service)
export const updateProfileSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().optional(),
}).partial();

export type UpdateProfileData = z.infer<typeof updateProfileSchema>;

export type ResetPasswordData = z.infer<typeof resetPasswordSchema>;

// Job action types
export const jobActionTypes = ["http_request", "webhook", "script"] as const;
export type JobActionType = typeof jobActionTypes[number];

// Job status types
export const jobStatuses = ["active", "paused", "running"] as const;
export type JobStatus = typeof jobStatuses[number];

// Execution status types
export const executionStatuses = ["success", "failure", "running"] as const;
export type ExecutionStatus = typeof executionStatuses[number];

// HTTP methods for HTTP request actions
export const httpMethods = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
export type HttpMethod = typeof httpMethods[number];

// Authentication types for HTTP requests
export const authTypes = ["none", "basic", "bearer", "api_key", "oauth2_client_credentials"] as const;
export type AuthType = typeof authTypes[number];

// Authentication configuration schema
export const authConfigSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("none"),
  }),
  z.object({
    type: z.literal("basic"),
    username: z.string(),
    password: z.string(),
  }),
  z.object({
    type: z.literal("bearer"),
    token: z.string(),
  }),
  z.object({
    type: z.literal("api_key"),
    key: z.string(),
    value: z.string(),
    addTo: z.enum(["header", "query"]),
  }),
  z.object({
    type: z.literal("oauth2_client_credentials"),
    clientId: z.string(),
    clientSecret: z.string(),
    tokenUrl: z.string().url(),
    scope: z.string().optional(),
  }),
]);

export type AuthConfig = z.infer<typeof authConfigSchema>;

// Job action configuration based on type
export const httpRequestConfigSchema = z.object({
  type: z.literal("http_request"),
  url: z.string().url(),
  method: z.enum(httpMethods),
  headers: z.record(z.string()).optional(),
  body: z.string().optional(),
  auth: authConfigSchema.optional(),
});

export const webhookConfigSchema = z.object({
  type: z.literal("webhook"),
  url: z.string().url(),
  payload: z.string().optional(),
});

export const scriptConfigSchema = z.object({
  type: z.literal("script"),
  code: z.string(),
  language: z.enum(["javascript"]),
});

export const jobActionConfigSchema = z.discriminatedUnion("type", [
  httpRequestConfigSchema,
  webhookConfigSchema,
  scriptConfigSchema,
]);

export type JobActionConfig = z.infer<typeof jobActionConfigSchema>;

// Job schema
export const jobSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Job name is required"),
  description: z.string().optional(),
  cronExpression: z.string().min(1, "Cron expression is required"),
  status: z.enum(jobStatuses),
  action: jobActionConfigSchema,
  lastRun: z.string().nullable(),
  nextRun: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  // For job chaining
  dependsOn: z.string().nullable().optional(),
  // For versioning
  version: z.number().default(1),
  // For notifications
  notifyOnFailure: z.boolean().default(false),
  notificationWebhook: z.string().url().optional().nullable(),
});

export type Job = z.infer<typeof jobSchema>;

export const insertJobSchema = jobSchema.omit({
  id: true,
  lastRun: true,
  nextRun: true,
  createdAt: true,
  updatedAt: true,
  version: true,
}).extend({
  dependsOn: z.string().nullable().optional(),
  notifyOnFailure: z.boolean().optional(),
  notificationWebhook: z.string().url().optional().nullable(),
});

export type InsertJob = z.infer<typeof insertJobSchema>;

// Execution log schema
export const executionLogSchema = z.object({
  id: z.string(),
  jobId: z.string(),
  jobName: z.string(),
  status: z.enum(executionStatuses),
  startTime: z.string(),
  endTime: z.string().nullable(),
  duration: z.number().nullable(), // in milliseconds
  output: z.string().nullable(),
  error: z.string().nullable(),
});

export type ExecutionLog = z.infer<typeof executionLogSchema>;

// Job version schema for versioning
export const jobVersionSchema = z.object({
  id: z.string(),
  jobId: z.string(),
  version: z.number(),
  snapshot: jobSchema,
  createdAt: z.string(),
});

export type JobVersion = z.infer<typeof jobVersionSchema>;

// Job template schema
export const jobTemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  category: z.string(),
  cronExpression: z.string(),
  action: jobActionConfigSchema,
  icon: z.string(),
});

export type JobTemplate = z.infer<typeof jobTemplateSchema>;

// Stats schema for dashboard
export const statsSchema = z.object({
  totalJobs: z.number(),
  activeJobs: z.number(),
  failedLast24h: z.number(),
  nextExecution: z.string().nullable(),
});

export type Stats = z.infer<typeof statsSchema>;

// ============ DRIZZLE ORM TABLES ============

// Jobs table
export const jobs = pgTable("jobs", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  cronExpression: text("cron_expression").notNull(),
  status: text("status").notNull().default("active"),
  action: jsonb("action").notNull(),
  lastRun: timestamp("last_run"),
  nextRun: timestamp("next_run"),
  dependsOn: integer("depends_on"),
  version: integer("version").notNull().default(1),
  notifyOnFailure: boolean("notify_on_failure").default(false),
  notificationWebhook: text("notification_webhook"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type DbJob = typeof jobs.$inferSelect;
export type DbInsertJob = typeof jobs.$inferInsert;

// Job templates table - reusable automation patterns
export const jobTemplates = pgTable("job_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull().default("general"),
  cronExpression: text("cron_expression").notNull(),
  action: jsonb("action").notNull(),
  icon: text("icon"),
  tags: text("tags").array(),
  isBuiltIn: boolean("is_built_in").default(false).notNull(),
  usageCount: integer("usage_count").default(0).notNull(),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type DbJobTemplate = typeof jobTemplates.$inferSelect;
export type DbInsertJobTemplate = typeof jobTemplates.$inferInsert;

export const insertJobTemplateSchema = createInsertSchema(jobTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  usageCount: true,
});

export type InsertJobTemplate = z.infer<typeof insertJobTemplateSchema>;

// Execution logs table
export const executionLogs = pgTable("execution_logs", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").references(() => jobs.id),
  workflowExecutionId: integer("workflow_execution_id"),
  jobName: text("job_name").notNull(),
  status: text("status").notNull(),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time"),
  duration: integer("duration"),
  output: text("output"),
  error: text("error"),
});

export type DbExecutionLog = typeof executionLogs.$inferSelect;

// Workflow trigger types
export const workflowTriggerTypes = ["manual", "cron", "webhook"] as const;
export type WorkflowTriggerType = typeof workflowTriggerTypes[number];

// Workflow step types
export const workflowStepTypes = ["action", "condition"] as const;
export type WorkflowStepType = typeof workflowStepTypes[number];

// Condition operators
export const conditionOperators = ["equals", "not_equals", "contains", "not_contains", "greater_than", "less_than", "is_empty", "is_not_empty"] as const;
export type ConditionOperator = typeof conditionOperators[number];

// Workflows table
export const workflows = pgTable("workflows", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status").notNull().default("active"),
  triggerType: text("trigger_type").notNull().default("manual"),
  cronExpression: text("cron_expression"),
  webhookToken: text("webhook_token"),
  webhookSecret: text("webhook_secret"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type DbWorkflow = typeof workflows.$inferSelect;
export type DbInsertWorkflow = typeof workflows.$inferInsert;

// Workflow steps table
export const workflowSteps = pgTable("workflow_steps", {
  id: serial("id").primaryKey(),
  workflowId: integer("workflow_id").references(() => workflows.id).notNull(),
  stepOrder: integer("step_order").notNull(),
  name: text("name").notNull(),
  stepType: text("step_type").notNull().default("action"),
  action: jsonb("action"),
  inputMapping: jsonb("input_mapping"),
  outputVariable: text("output_variable"),
  condition: jsonb("condition"),
  onTrueStep: integer("on_true_step"),
  onFalseStep: integer("on_false_step"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type DbWorkflowStep = typeof workflowSteps.$inferSelect;
export type DbInsertWorkflowStep = typeof workflowSteps.$inferInsert;

// Workflow executions table
export const workflowExecutions = pgTable("workflow_executions", {
  id: serial("id").primaryKey(),
  workflowId: integer("workflow_id").references(() => workflows.id).notNull(),
  status: text("status").notNull().default("running"),
  currentStep: integer("current_step").default(0),
  context: jsonb("context").default({}),
  startTime: timestamp("start_time").defaultNow().notNull(),
  endTime: timestamp("end_time"),
  error: text("error"),
});

export type DbWorkflowExecution = typeof workflowExecutions.$inferSelect;

// Relations
export const workflowsRelations = relations(workflows, ({ many }) => ({
  steps: many(workflowSteps),
  executions: many(workflowExecutions),
}));

export const workflowStepsRelations = relations(workflowSteps, ({ one }) => ({
  workflow: one(workflows, {
    fields: [workflowSteps.workflowId],
    references: [workflows.id],
  }),
}));

export const workflowExecutionsRelations = relations(workflowExecutions, ({ one }) => ({
  workflow: one(workflows, {
    fields: [workflowExecutions.workflowId],
    references: [workflows.id],
  }),
}));

// Condition schema for workflow branching
export const workflowConditionSchema = z.object({
  field: z.string(),
  operator: z.enum(["equals", "not_equals", "contains", "not_contains", "greater_than", "less_than", "is_empty", "is_not_empty"]),
  value: z.union([z.string(), z.number(), z.boolean()]).optional(),
});

export type WorkflowCondition = z.infer<typeof workflowConditionSchema>;

// Zod schemas for validation
export const workflowSchema = z.object({
  id: z.number(),
  name: z.string().min(1, "Workflow name is required"),
  description: z.string().optional().nullable(),
  status: z.enum(["active", "paused"]),
  triggerType: z.enum(["manual", "cron", "webhook"]),
  cronExpression: z.string().optional().nullable(),
  webhookToken: z.string().optional().nullable(),
  webhookSecret: z.string().optional().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Workflow = z.infer<typeof workflowSchema>;

export const insertWorkflowSchema = createInsertSchema(workflows).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertWorkflow = z.infer<typeof insertWorkflowSchema>;

export const workflowStepSchema = z.object({
  id: z.number(),
  workflowId: z.number(),
  stepOrder: z.number(),
  name: z.string(),
  stepType: z.enum(["action", "condition"]),
  action: jobActionConfigSchema.optional().nullable(),
  inputMapping: z.record(z.string()).optional().nullable(),
  outputVariable: z.string().optional().nullable(),
  condition: workflowConditionSchema.optional().nullable(),
  onTrueStep: z.number().optional().nullable(),
  onFalseStep: z.number().optional().nullable(),
  createdAt: z.date(),
});

export type WorkflowStep = z.infer<typeof workflowStepSchema>;

export const insertWorkflowStepSchema = createInsertSchema(workflowSteps).omit({
  id: true,
  createdAt: true,
});

export type InsertWorkflowStep = z.infer<typeof insertWorkflowStepSchema>;

export const workflowExecutionSchema = z.object({
  id: z.number(),
  workflowId: z.number(),
  status: z.enum(["running", "completed", "failed"]),
  currentStep: z.number(),
  context: z.record(z.any()),
  startTime: z.date(),
  endTime: z.date().optional().nullable(),
  error: z.string().optional().nullable(),
});

export type WorkflowExecution = z.infer<typeof workflowExecutionSchema>;

// Create workflow step request schema
export const createWorkflowStepRequestSchema = z.object({
  name: z.string().min(1, "Step name is required"),
  stepType: z.enum(["action", "condition"]).default("action"),
  action: jobActionConfigSchema.optional().nullable(),
  inputMapping: z.record(z.string()).optional().nullable(),
  outputVariable: z.string().optional().nullable(),
  condition: workflowConditionSchema.optional().nullable(),
  onTrueStep: z.number().optional().nullable(),
  onFalseStep: z.number().optional().nullable(),
  stepOrder: z.number().optional(),
});

export type CreateWorkflowStepRequest = z.infer<typeof createWorkflowStepRequestSchema>;

// Create workflow request schema (for API validation)
export const createWorkflowRequestSchema = z.object({
  name: z.string().min(1, "Workflow name is required"),
  description: z.string().optional().nullable(),
  triggerType: z.enum(["manual", "cron", "webhook"]).default("manual"),
  cronExpression: z.string().optional().nullable(),
  status: z.enum(["active", "paused"]).optional(),
  steps: z.array(createWorkflowStepRequestSchema).optional().default([]),
});

export type CreateWorkflowRequest = z.infer<typeof createWorkflowRequestSchema>;

// Update workflow request schema
export const updateWorkflowRequestSchema = createWorkflowRequestSchema.partial();

// ============ NOTIFICATION SYSTEM ============

// Notification template types
export const notificationChannels = ["in_app", "email", "push", "sms"] as const;
export type NotificationChannel = typeof notificationChannels[number];

// Template statuses
export const templateStatuses = ["draft", "active", "archived"] as const;
export type TemplateStatus = typeof templateStatuses[number];

// Notification delivery statuses
export const deliveryStatuses = ["pending", "sent", "delivered", "failed", "read"] as const;
export type DeliveryStatus = typeof deliveryStatuses[number];

// Notification templates table
export const notificationTemplates = pgTable("notification_templates", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  channel: varchar("channel", { length: 50 }).notNull(),
  subject: varchar("subject", { length: 500 }),
  content: text("content").notNull(),
  variables: jsonb("variables").default([]),
  status: varchar("status", { length: 50 }).notNull().default("draft"),
  imageUrl: text("image_url"),
  iconUrl: text("icon_url"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type DbNotificationTemplate = typeof notificationTemplates.$inferSelect;
export type DbInsertNotificationTemplate = typeof notificationTemplates.$inferInsert;

// SMTP configuration table
export const smtpConfig = pgTable("smtp_config", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull().default("Default"),
  host: varchar("host", { length: 255 }).notNull(),
  port: integer("port").notNull().default(587),
  secure: boolean("secure").default(false),
  username: varchar("username", { length: 255 }),
  password: varchar("password", { length: 500 }),
  fromEmail: varchar("from_email", { length: 255 }).notNull(),
  fromName: varchar("from_name", { length: 255 }),
  isActive: boolean("is_active").default(true),
  isDefault: boolean("is_default").default(false),
  lastTestResult: boolean("last_test_result"),
  lastTestAt: timestamp("last_test_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type DbSmtpConfig = typeof smtpConfig.$inferSelect;
export type DbInsertSmtpConfig = typeof smtpConfig.$inferInsert;

// Notifications table (sent notifications)
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  templateId: integer("template_id").references(() => notificationTemplates.id),
  channel: varchar("channel", { length: 50 }).notNull(),
  recipientId: varchar("recipient_id").references(() => users.id),
  recipientEmail: varchar("recipient_email", { length: 255 }),
  subject: varchar("subject", { length: 500 }),
  content: text("content").notNull(),
  variables: jsonb("variables").default({}),
  status: varchar("status", { length: 50 }).notNull().default("pending"),
  scheduledFor: timestamp("scheduled_for"),
  sentAt: timestamp("sent_at"),
  deliveredAt: timestamp("delivered_at"),
  readAt: timestamp("read_at"),
  error: text("error"),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type DbNotification = typeof notifications.$inferSelect;
export type DbInsertNotification = typeof notifications.$inferInsert;

// Notification audit logs table
export const notificationAuditLogs = pgTable("notification_audit_logs", {
  id: serial("id").primaryKey(),
  notificationId: integer("notification_id").references(() => notifications.id),
  templateId: integer("template_id").references(() => notificationTemplates.id),
  action: varchar("action", { length: 100 }).notNull(),
  userId: varchar("user_id").references(() => users.id),
  details: jsonb("details").default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type DbNotificationAuditLog = typeof notificationAuditLogs.$inferSelect;
export type DbInsertNotificationAuditLog = typeof notificationAuditLogs.$inferInsert;

// Relations
export const notificationTemplatesRelations = relations(notificationTemplates, ({ one, many }) => ({
  createdByUser: one(users, {
    fields: [notificationTemplates.createdBy],
    references: [users.id],
  }),
  notifications: many(notifications),
  auditLogs: many(notificationAuditLogs),
}));

export const notificationsRelations = relations(notifications, ({ one, many }) => ({
  template: one(notificationTemplates, {
    fields: [notifications.templateId],
    references: [notificationTemplates.id],
  }),
  recipient: one(users, {
    fields: [notifications.recipientId],
    references: [users.id],
  }),
  auditLogs: many(notificationAuditLogs),
}));

export const notificationAuditLogsRelations = relations(notificationAuditLogs, ({ one }) => ({
  notification: one(notifications, {
    fields: [notificationAuditLogs.notificationId],
    references: [notifications.id],
  }),
  template: one(notificationTemplates, {
    fields: [notificationAuditLogs.templateId],
    references: [notificationTemplates.id],
  }),
  user: one(users, {
    fields: [notificationAuditLogs.userId],
    references: [users.id],
  }),
}));

// Zod schemas for notification templates
export const notificationTemplateSchema = z.object({
  id: z.number(),
  name: z.string().min(1, "Template name is required"),
  description: z.string().optional().nullable(),
  channel: z.enum(notificationChannels),
  subject: z.string().optional().nullable(),
  content: z.string().min(1, "Content is required"),
  variables: z.array(z.object({
    name: z.string(),
    description: z.string().optional(),
    defaultValue: z.string().optional(),
    required: z.boolean().optional(),
  })).optional().default([]),
  status: z.enum(templateStatuses),
  createdBy: z.string().optional().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type NotificationTemplate = z.infer<typeof notificationTemplateSchema>;

export const insertNotificationTemplateSchema = z.object({
  name: z.string().min(1, "Template name is required"),
  description: z.string().optional().nullable(),
  channel: z.enum(notificationChannels),
  subject: z.string().optional().nullable(),
  content: z.string().min(1, "Content is required"),
  variables: z.array(z.object({
    name: z.string(),
    description: z.string().optional(),
    defaultValue: z.string().optional(),
    required: z.boolean().optional(),
  })).optional().default([]),
  status: z.enum(templateStatuses).optional().default("draft"),
});

export type InsertNotificationTemplate = z.infer<typeof insertNotificationTemplateSchema>;

export const updateNotificationTemplateSchema = insertNotificationTemplateSchema.partial();

export type UpdateNotificationTemplate = z.infer<typeof updateNotificationTemplateSchema>;

// SMTP config schema
export const smtpConfigSchema = z.object({
  id: z.number(),
  host: z.string().min(1, "SMTP host is required"),
  port: z.number().min(1).max(65535),
  secure: z.boolean().default(false),
  username: z.string().optional().nullable(),
  password: z.string().optional().nullable(),
  fromEmail: z.string().email("Valid email required"),
  fromName: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type SmtpConfig = z.infer<typeof smtpConfigSchema>;

export const insertSmtpConfigSchema = z.object({
  name: z.string().min(1, "Configuration name is required").default("Default"),
  host: z.string().min(1, "SMTP host is required"),
  port: z.number().min(1).max(65535).default(587),
  secure: z.boolean().optional().default(false),
  username: z.string().optional().nullable(),
  password: z.string().optional().nullable(),
  fromEmail: z.string().email("Valid email required"),
  fromName: z.string().optional().nullable(),
  isActive: z.boolean().optional().default(true),
  isDefault: z.boolean().optional().default(false),
});

export type InsertSmtpConfig = z.infer<typeof insertSmtpConfigSchema>;

export const updateSmtpConfigSchema = insertSmtpConfigSchema.partial();

export type UpdateSmtpConfig = z.infer<typeof updateSmtpConfigSchema>;

// Notification schema
export const notificationSchema = z.object({
  id: z.number(),
  templateId: z.number().optional().nullable(),
  channel: z.enum(notificationChannels),
  recipientId: z.string().optional().nullable(),
  recipientEmail: z.string().email().optional().nullable(),
  subject: z.string().optional().nullable(),
  content: z.string(),
  variables: z.record(z.any()).optional().default({}),
  status: z.enum(deliveryStatuses),
  scheduledFor: z.date().optional().nullable(),
  sentAt: z.date().optional().nullable(),
  deliveredAt: z.date().optional().nullable(),
  readAt: z.date().optional().nullable(),
  error: z.string().optional().nullable(),
  metadata: z.record(z.any()).optional().default({}),
  createdAt: z.date(),
});

export type Notification = z.infer<typeof notificationSchema>;

export const sendNotificationSchema = z.object({
  templateId: z.number().optional(),
  channel: z.enum(notificationChannels).optional(),
  recipientId: z.string().optional(),
  recipientEmail: z.string().email().optional(),
  subject: z.string().optional(),
  content: z.string().optional(),
  variables: z.record(z.any()).optional().default({}),
  scheduledFor: z.string().datetime().optional(),
});

export type SendNotificationRequest = z.infer<typeof sendNotificationSchema>;

// Preview template schema
export const previewTemplateSchema = z.object({
  content: z.string(),
  subject: z.string().optional(),
  variables: z.record(z.any()).optional().default({}),
});

export type PreviewTemplateRequest = z.infer<typeof previewTemplateSchema>;

// Test email schema
export const testEmailSchema = z.object({
  toEmail: z.string().email(),
  subject: z.string().min(1, "Subject is required"),
  content: z.string().min(1, "Content is required"),
});

export type TestEmailRequest = z.infer<typeof testEmailSchema>;

// ============ CAMPAIGN MANAGEMENT ============

// Campaign status values
export const campaignStatuses = ["draft", "scheduled", "running", "paused", "completed", "cancelled"] as const;
export type CampaignStatus = typeof campaignStatuses[number];

// Campaign schedule types
export const scheduleTypes = ["one_time", "recurring", "manual"] as const;
export type ScheduleType = typeof scheduleTypes[number];

// Audience types
export const audienceTypes = ["static", "filter", "all_users"] as const;
export type AudienceType = typeof audienceTypes[number];

// Step channel types (reuse notification channels)
export const stepChannels = ["email", "in_app"] as const;
export type StepChannel = typeof stepChannels[number];

// Campaigns table
export const campaigns = pgTable("campaigns", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  status: varchar("status", { length: 50 }).notNull().default("draft"),
  scheduleType: varchar("schedule_type", { length: 50 }).notNull().default("one_time"),
  cronExpression: varchar("cron_expression", { length: 100 }),
  scheduledAt: timestamp("scheduled_at"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  smtpConfigId: integer("smtp_config_id").references(() => smtpConfig.id),
  throttleLimit: integer("throttle_limit").default(100),
  throttleInterval: integer("throttle_interval").default(3600),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Campaign = typeof campaigns.$inferSelect;
export type InsertCampaign = typeof campaigns.$inferInsert;

export const insertCampaignSchema = createInsertSchema(campaigns).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Campaign audiences table
export const campaignAudiences = pgTable("campaign_audiences", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").references(() => campaigns.id, { onDelete: "cascade" }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  type: varchar("type", { length: 50 }).notNull().default("static"),
  filterCriteria: jsonb("filter_criteria"),
  estimatedCount: integer("estimated_count").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type CampaignAudience = typeof campaignAudiences.$inferSelect;
export type InsertCampaignAudience = typeof campaignAudiences.$inferInsert;

export const insertCampaignAudienceSchema = createInsertSchema(campaignAudiences).omit({
  id: true,
  createdAt: true,
});

// Campaign audience members table (for static lists)
export const campaignAudienceMembers = pgTable("campaign_audience_members", {
  id: serial("id").primaryKey(),
  audienceId: integer("audience_id").references(() => campaignAudiences.id, { onDelete: "cascade" }).notNull(),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }),
  email: varchar("email", { length: 255 }),
  metadata: jsonb("metadata"),
  addedAt: timestamp("added_at").defaultNow().notNull(),
});

export type CampaignAudienceMember = typeof campaignAudienceMembers.$inferSelect;
export type InsertCampaignAudienceMember = typeof campaignAudienceMembers.$inferInsert;

// Campaign steps table (sequence of waves)
export const campaignSteps = pgTable("campaign_steps", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").references(() => campaigns.id, { onDelete: "cascade" }).notNull(),
  stepOrder: integer("step_order").notNull().default(1),
  name: varchar("name", { length: 255 }).notNull(),
  channel: varchar("channel", { length: 50 }).notNull().default("email"),
  templateId: integer("template_id").references(() => notificationTemplates.id),
  customSubject: varchar("custom_subject", { length: 500 }),
  customContent: text("custom_content"),
  delayMinutes: integer("delay_minutes").default(0),
  workflowId: integer("workflow_id").references(() => workflows.id),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type CampaignStep = typeof campaignSteps.$inferSelect;
export type InsertCampaignStep = typeof campaignSteps.$inferInsert;

export const insertCampaignStepSchema = createInsertSchema(campaignSteps).omit({
  id: true,
  createdAt: true,
});

// Campaign runs table (each execution instance)
export const campaignRuns = pgTable("campaign_runs", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").references(() => campaigns.id, { onDelete: "cascade" }).notNull(),
  status: varchar("status", { length: 50 }).notNull().default("pending"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  totalRecipients: integer("total_recipients").default(0),
  sentCount: integer("sent_count").default(0),
  deliveredCount: integer("delivered_count").default(0),
  failedCount: integer("failed_count").default(0),
  openedCount: integer("opened_count").default(0),
  clickedCount: integer("clicked_count").default(0),
  error: text("error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type CampaignRun = typeof campaignRuns.$inferSelect;
export type InsertCampaignRun = typeof campaignRuns.$inferInsert;

// Campaign recipients table (per-recipient tracking)
export const campaignRecipients = pgTable("campaign_recipients", {
  id: serial("id").primaryKey(),
  runId: integer("run_id").references(() => campaignRuns.id, { onDelete: "cascade" }).notNull(),
  stepId: integer("step_id").references(() => campaignSteps.id, { onDelete: "cascade" }).notNull(),
  userId: varchar("user_id").references(() => users.id),
  email: varchar("email", { length: 255 }).notNull(),
  status: varchar("status", { length: 50 }).notNull().default("pending"),
  sentAt: timestamp("sent_at"),
  deliveredAt: timestamp("delivered_at"),
  openedAt: timestamp("opened_at"),
  clickedAt: timestamp("clicked_at"),
  error: text("error"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type CampaignRecipient = typeof campaignRecipients.$inferSelect;
export type InsertCampaignRecipient = typeof campaignRecipients.$inferInsert;

// Campaign relations
export const campaignsRelations = relations(campaigns, ({ one, many }) => ({
  smtp: one(smtpConfig, {
    fields: [campaigns.smtpConfigId],
    references: [smtpConfig.id],
  }),
  creator: one(users, {
    fields: [campaigns.createdBy],
    references: [users.id],
  }),
  audiences: many(campaignAudiences),
  steps: many(campaignSteps),
  runs: many(campaignRuns),
}));

export const campaignAudiencesRelations = relations(campaignAudiences, ({ one, many }) => ({
  campaign: one(campaigns, {
    fields: [campaignAudiences.campaignId],
    references: [campaigns.id],
  }),
  members: many(campaignAudienceMembers),
}));

export const campaignStepsRelations = relations(campaignSteps, ({ one }) => ({
  campaign: one(campaigns, {
    fields: [campaignSteps.campaignId],
    references: [campaigns.id],
  }),
  template: one(notificationTemplates, {
    fields: [campaignSteps.templateId],
    references: [notificationTemplates.id],
  }),
  workflow: one(workflows, {
    fields: [campaignSteps.workflowId],
    references: [workflows.id],
  }),
}));

export const campaignRunsRelations = relations(campaignRuns, ({ one, many }) => ({
  campaign: one(campaigns, {
    fields: [campaignRuns.campaignId],
    references: [campaigns.id],
  }),
  recipients: many(campaignRecipients),
}));

// Campaign Zod schemas for validation
export const campaignSchema = z.object({
  id: z.number(),
  name: z.string().min(1, "Campaign name is required"),
  description: z.string().optional().nullable(),
  status: z.enum(campaignStatuses),
  scheduleType: z.enum(scheduleTypes),
  cronExpression: z.string().optional().nullable(),
  scheduledAt: z.date().optional().nullable(),
  startedAt: z.date().optional().nullable(),
  completedAt: z.date().optional().nullable(),
  smtpConfigId: z.number().optional().nullable(),
  throttleLimit: z.number().optional().default(100),
  throttleInterval: z.number().optional().default(3600),
  createdBy: z.string().optional().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const createCampaignSchema = z.object({
  name: z.string().min(1, "Campaign name is required"),
  description: z.string().optional(),
  scheduleType: z.enum(scheduleTypes).optional().default("one_time"),
  cronExpression: z.string().optional(),
  scheduledAt: z.string().datetime().optional(),
  smtpConfigId: z.number().optional(),
  throttleLimit: z.number().optional().default(100),
  throttleInterval: z.number().optional().default(3600),
});

export type CreateCampaignRequest = z.infer<typeof createCampaignSchema>;

export const updateCampaignSchema = createCampaignSchema.partial().extend({
  status: z.enum(campaignStatuses).optional(),
});

export type UpdateCampaignRequest = z.infer<typeof updateCampaignSchema>;

// Campaign step schemas
export const createCampaignStepSchema = z.object({
  campaignId: z.number(),
  stepOrder: z.number().optional().default(1),
  name: z.string().min(1, "Step name is required"),
  channel: z.enum(stepChannels).optional().default("email"),
  templateId: z.number().optional(),
  customSubject: z.string().optional(),
  customContent: z.string().optional(),
  delayMinutes: z.number().optional().default(0),
  workflowId: z.number().optional(),
  isActive: z.boolean().optional().default(true),
});

export type CreateCampaignStepRequest = z.infer<typeof createCampaignStepSchema>;

// Campaign audience schemas
export const createCampaignAudienceSchema = z.object({
  campaignId: z.number(),
  name: z.string().min(1, "Audience name is required"),
  type: z.enum(audienceTypes).optional().default("static"),
  filterCriteria: z.record(z.any()).optional(),
});

export type CreateCampaignAudienceRequest = z.infer<typeof createCampaignAudienceSchema>;

// Add audience members schema
export const addAudienceMembersSchema = z.object({
  audienceId: z.number(),
  members: z.array(z.object({
    userId: z.string().optional(),
    email: z.string().email(),
    metadata: z.record(z.any()).optional(),
  })),
});

export type AddAudienceMembersRequest = z.infer<typeof addAudienceMembersSchema>;

// ============ DEEPLINKS ============

// Custom domains for deeplinks
export const deeplinkDomains = pgTable("deeplink_domains", {
  id: serial("id").primaryKey(),
  domain: varchar("domain", { length: 255 }).notNull().unique(),
  isVerified: boolean("is_verified").default(false).notNull(),
  verificationToken: varchar("verification_token", { length: 255 }),
  isPrimary: boolean("is_primary").default(false).notNull(),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type DeeplinkDomain = typeof deeplinkDomains.$inferSelect;
export type InsertDeeplinkDomain = typeof deeplinkDomains.$inferInsert;

export const insertDeeplinkDomainSchema = createInsertSchema(deeplinkDomains).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Deeplinks table
export const deeplinks = pgTable("deeplinks", {
  id: serial("id").primaryKey(),
  shortCode: varchar("short_code", { length: 50 }).notNull().unique(),
  destinationUrl: text("destination_url").notNull(),
  title: varchar("title", { length: 255 }),
  description: text("description"),
  domainId: integer("domain_id").references(() => deeplinkDomains.id),
  campaignId: integer("campaign_id").references(() => campaigns.id),
  isActive: boolean("is_active").default(true).notNull(),
  expiresAt: timestamp("expires_at"),
  password: varchar("password", { length: 255 }),
  clickCount: integer("click_count").default(0).notNull(),
  uniqueClickCount: integer("unique_click_count").default(0).notNull(),
  lastClickedAt: timestamp("last_clicked_at"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  metadata: jsonb("metadata"),
});

export type Deeplink = typeof deeplinks.$inferSelect;
export type InsertDeeplink = typeof deeplinks.$inferInsert;

export const insertDeeplinkSchema = createInsertSchema(deeplinks).omit({
  id: true,
  clickCount: true,
  uniqueClickCount: true,
  lastClickedAt: true,
  createdAt: true,
  updatedAt: true,
});

// Deeplink clicks tracking
export const deeplinkClicks = pgTable("deeplink_clicks", {
  id: serial("id").primaryKey(),
  deeplinkId: integer("deeplink_id").references(() => deeplinks.id, { onDelete: "cascade" }).notNull(),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  referer: text("referer"),
  country: varchar("country", { length: 100 }),
  city: varchar("city", { length: 100 }),
  device: varchar("device", { length: 50 }),
  browser: varchar("browser", { length: 50 }),
  os: varchar("os", { length: 50 }),
  isUnique: boolean("is_unique").default(true).notNull(),
  clickedAt: timestamp("clicked_at").defaultNow().notNull(),
  metadata: jsonb("metadata"),
});

export type DeeplinkClick = typeof deeplinkClicks.$inferSelect;
export type InsertDeeplinkClick = typeof deeplinkClicks.$inferInsert;

// Deeplink relations
export const deeplinksRelations = relations(deeplinks, ({ one, many }) => ({
  domain: one(deeplinkDomains, {
    fields: [deeplinks.domainId],
    references: [deeplinkDomains.id],
  }),
  campaign: one(campaigns, {
    fields: [deeplinks.campaignId],
    references: [campaigns.id],
  }),
  creator: one(users, {
    fields: [deeplinks.createdBy],
    references: [users.id],
  }),
  clicks: many(deeplinkClicks),
}));

export const deeplinkClicksRelations = relations(deeplinkClicks, ({ one }) => ({
  deeplink: one(deeplinks, {
    fields: [deeplinkClicks.deeplinkId],
    references: [deeplinks.id],
  }),
}));

export const deeplinkDomainsRelations = relations(deeplinkDomains, ({ one, many }) => ({
  creator: one(users, {
    fields: [deeplinkDomains.createdBy],
    references: [users.id],
  }),
  deeplinks: many(deeplinks),
}));

// Deeplink Zod schemas
export const createDeeplinkSchema = z.object({
  shortCode: z.string().min(1).max(50).optional(),
  destinationUrl: z.string().url("Invalid destination URL"),
  title: z.string().max(255).optional(),
  description: z.string().optional(),
  domainId: z.number().optional(),
  campaignId: z.number().optional(),
  isActive: z.boolean().optional().default(true),
  expiresAt: z.string().datetime().optional(),
  password: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

export type CreateDeeplinkRequest = z.infer<typeof createDeeplinkSchema>;

export const updateDeeplinkSchema = createDeeplinkSchema.partial();
export type UpdateDeeplinkRequest = z.infer<typeof updateDeeplinkSchema>;

export const createDeeplinkDomainSchema = z.object({
  domain: z.string().min(1, "Domain is required").max(255),
  isPrimary: z.boolean().optional().default(false),
});

export type CreateDeeplinkDomainRequest = z.infer<typeof createDeeplinkDomainSchema>;

// ============ EMAIL TEMPLATES (Dynamic Templates) ============

export const emailTemplates = pgTable("email_templates", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  subject: varchar("subject", { length: 500 }),
  htmlContent: text("html_content").notNull(),
  plainTextContent: text("plain_text_content"),
  testData: jsonb("test_data").default({}),
  variables: jsonb("variables").default([]),
  status: varchar("status", { length: 50 }).notNull().default("draft"),
  version: integer("version").default(1).notNull(),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type EmailTemplate = typeof emailTemplates.$inferSelect;
export type InsertEmailTemplate = typeof emailTemplates.$inferInsert;

export const insertEmailTemplateSchema = createInsertSchema(emailTemplates).omit({
  id: true,
  version: true,
  createdAt: true,
  updatedAt: true,
});

export const createEmailTemplateSchema = z.object({
  name: z.string().min(1, "Template name is required").max(255),
  description: z.string().optional(),
  subject: z.string().max(500).optional(),
  htmlContent: z.string().min(1, "HTML content is required"),
  plainTextContent: z.string().optional(),
  testData: z.record(z.any()).optional(),
  variables: z.array(z.object({
    name: z.string(),
    defaultValue: z.string().optional(),
    description: z.string().optional(),
  })).optional(),
  status: z.enum(["draft", "active", "archived"]).optional().default("draft"),
});

export type CreateEmailTemplateRequest = z.infer<typeof createEmailTemplateSchema>;

export const updateEmailTemplateSchema = createEmailTemplateSchema.partial();
export type UpdateEmailTemplateRequest = z.infer<typeof updateEmailTemplateSchema>;

export const emailTemplatesRelations = relations(emailTemplates, ({ one }) => ({
  creator: one(users, {
    fields: [emailTemplates.createdBy],
    references: [users.id],
  }),
}));
