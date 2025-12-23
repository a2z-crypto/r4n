import type { 
  Job, InsertJob, ExecutionLog, Stats,
  DbWorkflow, DbInsertWorkflow, DbWorkflowStep, DbInsertWorkflowStep, 
  DbWorkflowExecution, JobActionConfig,
  User, UpsertUser, DbRole, DbUserRole, Permission, RoleName, UserWithRole,
  DbNotificationTemplate, DbInsertNotificationTemplate,
  DbSmtpConfig, DbInsertSmtpConfig,
  DbNotification, DbInsertNotification,
  DbNotificationAuditLog, DbInsertNotificationAuditLog,
  InsertNotificationTemplate, UpdateNotificationTemplate,
  InsertSmtpConfig, UpdateSmtpConfig,
  DbJobTemplate, InsertJobTemplate,
  Campaign, InsertCampaign, CampaignAudience, InsertCampaignAudience,
  CampaignAudienceMember, InsertCampaignAudienceMember,
  CampaignStep, InsertCampaignStep, CampaignRun, InsertCampaignRun,
  CampaignRecipient, InsertCampaignRecipient,
  Deeplink, InsertDeeplink, DeeplinkDomain, InsertDeeplinkDomain,
  DeeplinkClick, InsertDeeplinkClick,
  EmailTemplate, InsertEmailTemplate
} from "@shared/schema";
import { 
  jobs, executionLogs, workflows, workflowSteps, workflowExecutions,
  users, roles, userRoles, rolePermissions,
  notificationTemplates, smtpConfig, notifications, notificationAuditLogs,
  jobTemplates, campaigns, campaignAudiences, campaignAudienceMembers,
  campaignSteps, campaignRuns, campaignRecipients,
  deeplinks, deeplinkDomains, deeplinkClicks,
  emailTemplates
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, gte, sql, inArray } from "drizzle-orm";
import cron from "node-cron";

export interface IStorage {
  // Users (Local Auth)
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getSuperAdmin(): Promise<User | undefined>;
  createSuperAdmin(data: { email: string; password: string; firstName: string; lastName: string | null }): Promise<User>;
  createUser(data: { email: string; password: string; firstName: string; lastName: string | null }): Promise<User>;
  upsertUser(user: UpsertUser): Promise<User>;
  getUsers(): Promise<UserWithRole[]>;
  updateUser(id: string, data: { email?: string; firstName?: string; lastName?: string | null }): Promise<User | undefined>;
  updateUserPassword(id: string, hashedPassword: string): Promise<boolean>;
  deleteUser(id: string): Promise<boolean>;
  
  // Roles
  getRoles(): Promise<DbRole[]>;
  getUserRoles(userId: string): Promise<DbRole[]>;
  assignRole(userId: string, roleId: number, assignedBy?: string): Promise<DbUserRole>;
  removeRole(userId: string, roleId: number): Promise<boolean>;
  hasPermission(userId: string, permission: Permission): Promise<boolean>;
  getUserPermissions(userId: string): Promise<Permission[]>;
  initializeRoles(): Promise<void>;

  // Jobs
  getJobs(): Promise<Job[]>;
  getJob(id: string): Promise<Job | undefined>;
  createJob(job: InsertJob): Promise<Job>;
  updateJob(id: string, updates: Partial<InsertJob>): Promise<Job | undefined>;
  deleteJob(id: string): Promise<boolean>;
  
  // Executions
  getExecutions(): Promise<ExecutionLog[]>;
  getExecutionsByJob(jobId: string): Promise<ExecutionLog[]>;
  createExecution(execution: Omit<ExecutionLog, "id">): Promise<ExecutionLog>;
  updateExecution(id: string, updates: Partial<ExecutionLog>): Promise<ExecutionLog | undefined>;
  
  // Stats
  getStats(): Promise<Stats>;
  
  // Scheduler
  scheduleJob(job: Job): void;
  unscheduleJob(jobId: string): void;
  runJobNow(jobId: string): Promise<ExecutionLog>;

  // Workflows
  getWorkflows(): Promise<DbWorkflow[]>;
  getWorkflow(id: number): Promise<DbWorkflow | undefined>;
  getWorkflowWithSteps(id: number): Promise<{ workflow: DbWorkflow; steps: DbWorkflowStep[] } | undefined>;
  createWorkflow(data: DbInsertWorkflow, steps: Omit<DbInsertWorkflowStep, "workflowId">[]): Promise<DbWorkflow>;
  updateWorkflow(id: number, data: Partial<DbInsertWorkflow>, steps?: Omit<DbInsertWorkflowStep, "workflowId">[]): Promise<DbWorkflow | undefined>;
  deleteWorkflow(id: number): Promise<boolean>;
  runWorkflow(id: number): Promise<DbWorkflowExecution>;
  getWorkflowExecutions(workflowId?: number): Promise<DbWorkflowExecution[]>;

  // Notification Templates
  getNotificationTemplates(): Promise<DbNotificationTemplate[]>;
  getNotificationTemplate(id: number): Promise<DbNotificationTemplate | undefined>;
  createNotificationTemplate(data: InsertNotificationTemplate, createdBy?: string): Promise<DbNotificationTemplate>;
  updateNotificationTemplate(id: number, data: UpdateNotificationTemplate): Promise<DbNotificationTemplate | undefined>;
  deleteNotificationTemplate(id: number): Promise<boolean>;

  // SMTP Config
  getSmtpConfigs(): Promise<DbSmtpConfig[]>;
  getSmtpConfig(id?: number): Promise<DbSmtpConfig | undefined>;
  getDefaultSmtpConfig(): Promise<DbSmtpConfig | undefined>;
  createSmtpConfig(data: InsertSmtpConfig): Promise<DbSmtpConfig>;
  updateSmtpConfig(id: number, data: Partial<InsertSmtpConfig>): Promise<DbSmtpConfig | undefined>;
  setDefaultSmtpConfig(id: number): Promise<DbSmtpConfig | undefined>;
  updateSmtpTestResult(id: number, success: boolean): Promise<DbSmtpConfig | undefined>;
  deleteSmtpConfig(id: number): Promise<boolean>;

  // Notifications
  getNotifications(recipientId?: string, limit?: number): Promise<DbNotification[]>;
  getNotification(id: number): Promise<DbNotification | undefined>;
  createNotification(data: DbInsertNotification): Promise<DbNotification>;
  updateNotificationStatus(id: number, status: string, error?: string): Promise<DbNotification | undefined>;
  markNotificationRead(id: number): Promise<DbNotification | undefined>;
  getUnreadNotificationCount(recipientId: string): Promise<number>;

  // Notification Audit Logs
  createAuditLog(data: DbInsertNotificationAuditLog): Promise<DbNotificationAuditLog>;
  getAuditLogs(filter?: { notificationId?: number; templateId?: number }): Promise<DbNotificationAuditLog[]>;

  // Job Templates
  getJobTemplates(category?: string): Promise<DbJobTemplate[]>;
  getJobTemplate(id: number): Promise<DbJobTemplate | undefined>;
  createJobTemplate(data: InsertJobTemplate): Promise<DbJobTemplate>;
  updateJobTemplate(id: number, data: Partial<InsertJobTemplate>): Promise<DbJobTemplate | undefined>;
  deleteJobTemplate(id: number): Promise<boolean>;
  incrementTemplateUsage(id: number): Promise<void>;

  // Campaigns
  getCampaigns(status?: string): Promise<Campaign[]>;
  getCampaign(id: number): Promise<Campaign | undefined>;
  getCampaignWithDetails(id: number): Promise<{ campaign: Campaign; audiences: CampaignAudience[]; steps: CampaignStep[]; runs: CampaignRun[] } | undefined>;
  createCampaign(data: InsertCampaign): Promise<Campaign>;
  updateCampaign(id: number, data: Partial<InsertCampaign>): Promise<Campaign | undefined>;
  deleteCampaign(id: number): Promise<boolean>;
  updateCampaignStatus(id: number, status: string): Promise<Campaign | undefined>;

  // Campaign Audiences
  getCampaignAudiences(campaignId: number): Promise<CampaignAudience[]>;
  getCampaignAudience(id: number): Promise<CampaignAudience | undefined>;
  createCampaignAudience(data: InsertCampaignAudience): Promise<CampaignAudience>;
  deleteCampaignAudience(id: number): Promise<boolean>;
  addAudienceMembers(audienceId: number, members: InsertCampaignAudienceMember[]): Promise<CampaignAudienceMember[]>;
  getAudienceMembers(audienceId: number): Promise<CampaignAudienceMember[]>;
  getAudienceMemberCount(audienceId: number): Promise<number>;

  // Campaign Steps
  getCampaignSteps(campaignId: number): Promise<CampaignStep[]>;
  getCampaignStep(id: number): Promise<CampaignStep | undefined>;
  createCampaignStep(data: InsertCampaignStep): Promise<CampaignStep>;
  updateCampaignStep(id: number, data: Partial<InsertCampaignStep>): Promise<CampaignStep | undefined>;
  deleteCampaignStep(id: number): Promise<boolean>;
  reorderCampaignSteps(campaignId: number, stepIds: number[]): Promise<void>;

  // Campaign Runs
  getCampaignRuns(campaignId: number): Promise<CampaignRun[]>;
  getCampaignRun(id: number): Promise<CampaignRun | undefined>;
  createCampaignRun(data: InsertCampaignRun): Promise<CampaignRun>;
  updateCampaignRun(id: number, data: Partial<CampaignRun>): Promise<CampaignRun | undefined>;

  // Campaign Recipients
  getCampaignRecipients(runId: number, stepId?: number): Promise<CampaignRecipient[]>;
  createCampaignRecipient(data: InsertCampaignRecipient): Promise<CampaignRecipient>;
  updateCampaignRecipient(id: number, data: Partial<CampaignRecipient>): Promise<CampaignRecipient | undefined>;
  getCampaignStats(campaignId: number): Promise<{ totalSent: number; delivered: number; failed: number; opened: number; clicked: number }>;

  // Deeplink Domains
  getDeeplinkDomains(): Promise<DeeplinkDomain[]>;
  getDeeplinkDomain(id: number): Promise<DeeplinkDomain | undefined>;
  getDeeplinkDomainByDomain(domain: string): Promise<DeeplinkDomain | undefined>;
  getPrimaryDeeplinkDomain(): Promise<DeeplinkDomain | undefined>;
  createDeeplinkDomain(data: InsertDeeplinkDomain): Promise<DeeplinkDomain>;
  updateDeeplinkDomain(id: number, data: Partial<InsertDeeplinkDomain>): Promise<DeeplinkDomain | undefined>;
  deleteDeeplinkDomain(id: number): Promise<boolean>;
  verifyDeeplinkDomain(id: number): Promise<DeeplinkDomain | undefined>;
  setPrimaryDeeplinkDomain(id: number): Promise<DeeplinkDomain | undefined>;

  // Deeplinks
  getDeeplinks(campaignId?: number): Promise<Deeplink[]>;
  getDeeplink(id: number): Promise<Deeplink | undefined>;
  getDeeplinkByShortCode(shortCode: string): Promise<Deeplink | undefined>;
  createDeeplink(data: InsertDeeplink): Promise<Deeplink>;
  updateDeeplink(id: number, data: Partial<InsertDeeplink>): Promise<Deeplink | undefined>;
  deleteDeeplink(id: number): Promise<boolean>;
  incrementDeeplinkClick(id: number, isUnique: boolean): Promise<void>;

  // Deeplink Clicks
  createDeeplinkClick(data: InsertDeeplinkClick): Promise<DeeplinkClick>;
  getDeeplinkClicks(deeplinkId: number, limit?: number): Promise<DeeplinkClick[]>;
  getDeeplinkStats(deeplinkId: number): Promise<{ totalClicks: number; uniqueClicks: number; countries: Record<string, number>; devices: Record<string, number> }>;

  // Email Templates (Dynamic Templates)
  getEmailTemplates(): Promise<EmailTemplate[]>;
  getEmailTemplate(id: number): Promise<EmailTemplate | undefined>;
  createEmailTemplate(data: Omit<InsertEmailTemplate, "id" | "createdAt" | "updatedAt">): Promise<EmailTemplate>;
  updateEmailTemplate(id: number, data: Partial<InsertEmailTemplate>): Promise<EmailTemplate | undefined>;
  deleteEmailTemplate(id: number): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  private scheduledTasks: Map<string, cron.ScheduledTask> = new Map();
  private scheduledWorkflows: Map<number, cron.ScheduledTask> = new Map();

  constructor() {
    this.initScheduler();
  }

  private async initScheduler() {
    const allJobs = await this.getJobs();
    for (const job of allJobs) {
      if (job.status === "active") {
        this.scheduleJob(job);
      }
    }
    
    const allWorkflows = await this.getWorkflows();
    for (const workflow of allWorkflows) {
      if (workflow.status === "active" && workflow.cronExpression) {
        this.scheduleWorkflow(workflow);
      }
    }
  }

  // ============ USERS (Local Auth) ============

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getSuperAdmin(): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.isSuperAdmin, true));
    return user;
  }

  async createSuperAdmin(data: { email: string; password: string; firstName: string; lastName: string | null }): Promise<User> {
    // Ensure only one super admin can exist
    const existing = await this.getSuperAdmin();
    if (existing) {
      throw new Error("Super admin already exists");
    }

    const [user] = await db.insert(users).values({
      email: data.email,
      password: data.password,
      firstName: data.firstName,
      lastName: data.lastName,
      isSuperAdmin: true,
    }).returning();

    // Automatically assign admin role to super admin
    const adminRole = await db.select().from(roles).where(eq(roles.name, "admin"));
    if (adminRole.length > 0) {
      await this.assignRole(user.id, adminRole[0].id);
    }

    return user;
  }

  async createUser(data: { email: string; password: string; firstName: string; lastName: string | null }): Promise<User> {
    const [user] = await db.insert(users).values({
      email: data.email,
      password: data.password,
      firstName: data.firstName,
      lastName: data.lastName,
      isSuperAdmin: false,
    }).returning();
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async getUsers(): Promise<UserWithRole[]> {
    const allUsers = await db.select().from(users).orderBy(desc(users.createdAt));
    const result: UserWithRole[] = [];
    
    for (const user of allUsers) {
      const userRolesList = await this.getUserRoles(user.id);
      result.push({
        ...user,
        roles: userRolesList.map(r => ({
          id: r.id,
          name: r.name,
          description: r.description,
        })),
      });
    }
    
    return result;
  }

  async updateUser(id: string, data: { email?: string; firstName?: string; lastName?: string | null }): Promise<User | undefined> {
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (data.email !== undefined) updateData.email = data.email;
    if (data.firstName !== undefined) updateData.firstName = data.firstName;
    if (data.lastName !== undefined) updateData.lastName = data.lastName;

    const [user] = await db.update(users).set(updateData).where(eq(users.id, id)).returning();
    return user;
  }

  async updateUserPassword(id: string, hashedPassword: string): Promise<boolean> {
    const result = await db.update(users).set({ 
      password: hashedPassword,
      updatedAt: new Date(),
    }).where(eq(users.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async deleteUser(id: string): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // ============ ROLES ============

  async getRoles(): Promise<DbRole[]> {
    return await db.select().from(roles).orderBy(roles.id);
  }

  async getUserRoles(userId: string): Promise<DbRole[]> {
    const userRoleRecords = await db
      .select()
      .from(userRoles)
      .where(eq(userRoles.userId, userId));
    
    if (userRoleRecords.length === 0) return [];
    
    const roleIds = userRoleRecords.map(ur => ur.roleId);
    const rolesList = await db
      .select()
      .from(roles)
      .where(inArray(roles.id, roleIds));
    
    return rolesList;
  }

  async assignRole(userId: string, roleId: number, assignedBy?: string): Promise<DbUserRole> {
    // Check if already assigned
    const existing = await db
      .select()
      .from(userRoles)
      .where(and(eq(userRoles.userId, userId), eq(userRoles.roleId, roleId)));
    
    if (existing.length > 0) {
      return existing[0];
    }
    
    const [userRole] = await db.insert(userRoles).values({
      userId,
      roleId,
      assignedBy: assignedBy || null,
    }).returning();
    
    return userRole;
  }

  async removeRole(userId: string, roleId: number): Promise<boolean> {
    const result = await db
      .delete(userRoles)
      .where(and(eq(userRoles.userId, userId), eq(userRoles.roleId, roleId)));
    return (result.rowCount ?? 0) > 0;
  }

  async hasPermission(userId: string, permission: Permission): Promise<boolean> {
    const permissions = await this.getUserPermissions(userId);
    return permissions.includes(permission);
  }

  async getUserPermissions(userId: string): Promise<Permission[]> {
    const userRolesList = await this.getUserRoles(userId);
    const allPermissions = new Set<Permission>();
    
    for (const role of userRolesList) {
      const perms = rolePermissions[role.name as RoleName];
      if (perms) {
        perms.forEach(p => allPermissions.add(p));
      }
    }
    
    return Array.from(allPermissions);
  }

  async initializeRoles(): Promise<void> {
    // Create default roles if they don't exist
    const existingRoles = await this.getRoles();
    const roleNames: { name: RoleName; description: string }[] = [
      { name: "admin", description: "Full access to all features including user management" },
      { name: "editor", description: "Can create, edit, and run jobs and workflows" },
      { name: "viewer", description: "Read-only access to jobs and workflows" },
    ];
    
    for (const roleData of roleNames) {
      const exists = existingRoles.find(r => r.name === roleData.name);
      if (!exists) {
        await db.insert(roles).values(roleData);
      }
    }
  }

  // ============ JOBS ============
  
  async getJobs(): Promise<Job[]> {
    const rows = await db.select().from(jobs).orderBy(desc(jobs.createdAt));
    return rows.map(this.dbJobToJob);
  }

  async getJob(id: string): Promise<Job | undefined> {
    const [row] = await db.select().from(jobs).where(eq(jobs.id, parseInt(id)));
    return row ? this.dbJobToJob(row) : undefined;
  }

  async createJob(insertJob: InsertJob): Promise<Job> {
    const nextRun = insertJob.status === "active" ? this.getNextRunTime(insertJob.cronExpression) : null;
    
    const [row] = await db.insert(jobs).values({
      name: insertJob.name,
      description: insertJob.description || null,
      cronExpression: insertJob.cronExpression,
      status: insertJob.status,
      action: insertJob.action,
      nextRun: nextRun ? new Date(nextRun) : null,
      dependsOn: insertJob.dependsOn ? parseInt(insertJob.dependsOn) : null,
      notifyOnFailure: insertJob.notifyOnFailure || false,
      notificationWebhook: insertJob.notificationWebhook || null,
    }).returning();

    const job = this.dbJobToJob(row);
    
    if (job.status === "active") {
      this.scheduleJob(job);
    }

    return job;
  }

  async updateJob(id: string, updates: Partial<InsertJob>): Promise<Job | undefined> {
    const existing = await this.getJob(id);
    if (!existing) return undefined;

    const wasActive = existing.status === "active";
    
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
      version: existing.version + 1,
    };
    
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.cronExpression !== undefined) updateData.cronExpression = updates.cronExpression;
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.action !== undefined) updateData.action = updates.action;
    if (updates.notifyOnFailure !== undefined) updateData.notifyOnFailure = updates.notifyOnFailure;
    if (updates.notificationWebhook !== undefined) updateData.notificationWebhook = updates.notificationWebhook;

    const newStatus = updates.status || existing.status;
    const newCron = updates.cronExpression || existing.cronExpression;
    
    if (newStatus === "active") {
      updateData.nextRun = new Date(this.getNextRunTime(newCron) || Date.now());
    } else {
      updateData.nextRun = null;
    }

    const [row] = await db.update(jobs)
      .set(updateData)
      .where(eq(jobs.id, parseInt(id)))
      .returning();

    const job = this.dbJobToJob(row);

    if (wasActive) {
      this.unscheduleJob(id);
    }
    if (job.status === "active") {
      this.scheduleJob(job);
    }

    return job;
  }

  async deleteJob(id: string): Promise<boolean> {
    this.unscheduleJob(id);
    const result = await db.delete(jobs).where(eq(jobs.id, parseInt(id)));
    return (result.rowCount ?? 0) > 0;
  }

  // ============ EXECUTIONS ============

  async getExecutions(): Promise<ExecutionLog[]> {
    const rows = await db.select().from(executionLogs).orderBy(desc(executionLogs.startTime)).limit(100);
    return rows.map(this.dbExecutionToExecution);
  }

  async getExecutionsByJob(jobId: string): Promise<ExecutionLog[]> {
    const rows = await db.select()
      .from(executionLogs)
      .where(eq(executionLogs.jobId, parseInt(jobId)))
      .orderBy(desc(executionLogs.startTime));
    return rows.map(this.dbExecutionToExecution);
  }

  async createExecution(execution: Omit<ExecutionLog, "id">): Promise<ExecutionLog> {
    const [row] = await db.insert(executionLogs).values({
      jobId: execution.jobId ? parseInt(execution.jobId) : null,
      jobName: execution.jobName,
      status: execution.status,
      startTime: new Date(execution.startTime),
      endTime: execution.endTime ? new Date(execution.endTime) : null,
      duration: execution.duration,
      output: execution.output,
      error: execution.error,
    }).returning();

    return this.dbExecutionToExecution(row);
  }

  async updateExecution(id: string, updates: Partial<ExecutionLog>): Promise<ExecutionLog | undefined> {
    const updateData: Record<string, unknown> = {};
    
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.endTime !== undefined) updateData.endTime = new Date(updates.endTime);
    if (updates.duration !== undefined) updateData.duration = updates.duration;
    if (updates.output !== undefined) updateData.output = updates.output;
    if (updates.error !== undefined) updateData.error = updates.error;

    const [row] = await db.update(executionLogs)
      .set(updateData)
      .where(eq(executionLogs.id, parseInt(id)))
      .returning();

    return row ? this.dbExecutionToExecution(row) : undefined;
  }

  // ============ STATS ============

  async getStats(): Promise<Stats> {
    const allJobs = await this.getJobs();
    const activeJobs = allJobs.filter(j => j.status === "active");
    
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [failedCount] = await db.select({ count: sql<number>`count(*)` })
      .from(executionLogs)
      .where(and(
        eq(executionLogs.status, "failure"),
        gte(executionLogs.startTime, twentyFourHoursAgo)
      ));

    const nextExecutionTimes = activeJobs
      .filter(j => j.nextRun)
      .map(j => new Date(j.nextRun!).getTime())
      .sort((a, b) => a - b);

    return {
      totalJobs: allJobs.length,
      activeJobs: activeJobs.length,
      failedLast24h: Number(failedCount?.count || 0),
      nextExecution: nextExecutionTimes.length > 0 
        ? new Date(nextExecutionTimes[0]).toISOString() 
        : null,
    };
  }

  // ============ SCHEDULER ============

  scheduleJob(job: Job): void {
    if (this.scheduledTasks.has(job.id)) {
      this.unscheduleJob(job.id);
    }

    try {
      const task = cron.schedule(job.cronExpression, async () => {
        await this.executeJob(job.id);
      });
      
      this.scheduledTasks.set(job.id, task);
    } catch (error) {
      console.error(`Failed to schedule job ${job.id}:`, error);
    }
  }

  unscheduleJob(jobId: string): void {
    const task = this.scheduledTasks.get(jobId);
    if (task) {
      task.stop();
      this.scheduledTasks.delete(jobId);
    }
  }

  async runJobNow(jobId: string): Promise<ExecutionLog> {
    return this.executeJob(jobId);
  }

  private async executeJob(jobId: string): Promise<ExecutionLog> {
    const job = await this.getJob(jobId);
    if (!job) {
      throw new Error("Job not found");
    }

    const startTime = new Date().toISOString();
    const execution = await this.createExecution({
      jobId: job.id,
      jobName: job.name,
      status: "running",
      startTime,
      endTime: null,
      duration: null,
      output: null,
      error: null,
    });

    try {
      const result = await this.runAction(job.action);
      
      const endTime = new Date();
      const duration = endTime.getTime() - new Date(startTime).getTime();

      await this.updateExecution(execution.id, {
        status: "success",
        endTime: endTime.toISOString(),
        duration,
        output: result,
      });

      await db.update(jobs).set({
        lastRun: endTime,
        nextRun: new Date(this.getNextRunTime(job.cronExpression) || Date.now()),
      }).where(eq(jobs.id, parseInt(jobId)));

      return (await this.getExecutionById(execution.id))!;
    } catch (error) {
      const endTime = new Date();
      const duration = endTime.getTime() - new Date(startTime).getTime();
      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      await this.updateExecution(execution.id, {
        status: "failure",
        endTime: endTime.toISOString(),
        duration,
        error: errorMessage,
      });

      await db.update(jobs).set({
        lastRun: endTime,
        nextRun: new Date(this.getNextRunTime(job.cronExpression) || Date.now()),
      }).where(eq(jobs.id, parseInt(jobId)));

      if (job.notifyOnFailure && job.notificationWebhook) {
        this.sendFailureNotification(job, errorMessage);
      }

      return (await this.getExecutionById(execution.id))!;
    }
  }

  private async getExecutionById(id: string): Promise<ExecutionLog | undefined> {
    const [row] = await db.select().from(executionLogs).where(eq(executionLogs.id, parseInt(id)));
    return row ? this.dbExecutionToExecution(row) : undefined;
  }

  async runAction(action: JobActionConfig, context?: Record<string, unknown>): Promise<string> {
    switch (action.type) {
      case "http_request": {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          ...action.headers,
        };
        
        let url = this.interpolateString(action.url, context || {});
        let body = action.body ? this.interpolateString(action.body, context || {}) : undefined;
        
        if (action.auth) {
          switch (action.auth.type) {
            case "basic": {
              const credentials = Buffer.from(`${action.auth.username}:${action.auth.password}`).toString("base64");
              headers["Authorization"] = `Basic ${credentials}`;
              break;
            }
            case "bearer": {
              headers["Authorization"] = `Bearer ${action.auth.token}`;
              break;
            }
            case "api_key": {
              if (action.auth.addTo === "header") {
                headers[action.auth.key] = action.auth.value;
              } else {
                const separator = url.includes("?") ? "&" : "?";
                url = `${url}${separator}${encodeURIComponent(action.auth.key)}=${encodeURIComponent(action.auth.value)}`;
              }
              break;
            }
            case "oauth2_client_credentials": {
              const token = await this.getOAuth2Token(action.auth);
              headers["Authorization"] = `Bearer ${token}`;
              break;
            }
          }
        }

        const response = await fetch(url, {
          method: action.method,
          headers,
          body: action.method !== "GET" && body ? body : undefined,
        });
        
        const text = await response.text();
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${text}`);
        }
        return text;
      }

      case "webhook": {
        const payload = action.payload ? this.interpolateString(action.payload, context || {}) : "{}";
        const response = await fetch(action.url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
        });
        
        if (!response.ok) {
          throw new Error(`Webhook failed with status ${response.status}`);
        }
        return `Webhook sent successfully (${response.status})`;
      }

      case "script": {
        const logs: string[] = [];
        const mockConsole = {
          log: (...args: unknown[]) => logs.push(args.map(String).join(" ")),
          error: (...args: unknown[]) => logs.push(`ERROR: ${args.map(String).join(" ")}`),
          warn: (...args: unknown[]) => logs.push(`WARN: ${args.map(String).join(" ")}`),
        };
        
        const code = this.interpolateString(action.code, context || {});
        const fn = new Function("console", "context", code);
        const result = fn(mockConsole, context || {});
        
        if (result !== undefined) {
          return JSON.stringify(result);
        }
        return logs.join("\n") || "Script executed successfully (no output)";
      }

      default:
        throw new Error("Unknown action type");
    }
  }

  private interpolateString(str: string, context: Record<string, unknown>): string {
    return str.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (match, path) => {
      const value = path.split('.').reduce((obj: unknown, key: string) => {
        if (obj && typeof obj === 'object') {
          return (obj as Record<string, unknown>)[key];
        }
        return undefined;
      }, context);
      return value !== undefined ? String(value) : match;
    });
  }

  private async sendFailureNotification(job: Job, error: string): Promise<void> {
    if (!job.notificationWebhook) return;

    try {
      await fetch(job.notificationWebhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: `Job "${job.name}" failed: ${error}`,
          job: { id: job.id, name: job.name },
          error,
          timestamp: new Date().toISOString(),
        }),
      });
    } catch (e) {
      console.error("Failed to send failure notification:", e);
    }
  }

  private async getOAuth2Token(auth: { clientId: string; clientSecret: string; tokenUrl: string; scope?: string }): Promise<string> {
    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: auth.clientId,
      client_secret: auth.clientSecret,
    });
    
    if (auth.scope) {
      body.append("scope", auth.scope);
    }

    const response = await fetch(auth.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`OAuth2 token request failed: ${response.status} - ${text}`);
    }

    const data = await response.json() as { access_token: string };
    return data.access_token;
  }

  private getNextRunTime(cronExpression: string): string | null {
    try {
      const next = new Date(Date.now() + 60000);
      return next.toISOString();
    } catch {
      return null;
    }
  }

  // ============ WORKFLOWS ============

  async getWorkflows(): Promise<DbWorkflow[]> {
    return db.select().from(workflows).orderBy(desc(workflows.createdAt));
  }

  async getWorkflow(id: number): Promise<DbWorkflow | undefined> {
    const [row] = await db.select().from(workflows).where(eq(workflows.id, id));
    return row;
  }

  async getWorkflowWithSteps(id: number): Promise<{ workflow: DbWorkflow; steps: DbWorkflowStep[] } | undefined> {
    const workflow = await this.getWorkflow(id);
    if (!workflow) return undefined;

    const steps = await db.select()
      .from(workflowSteps)
      .where(eq(workflowSteps.workflowId, id))
      .orderBy(workflowSteps.stepOrder);

    return { workflow, steps };
  }

  async createWorkflow(data: DbInsertWorkflow, steps: Omit<DbInsertWorkflowStep, "workflowId">[]): Promise<DbWorkflow> {
    const [workflow] = await db.insert(workflows).values({
      name: data.name,
      description: data.description,
      status: data.status || "active",
      cronExpression: data.cronExpression,
    }).returning();

    if (steps.length > 0) {
      await db.insert(workflowSteps).values(
        steps.map((step, index) => ({
          workflowId: workflow.id,
          stepOrder: step.stepOrder ?? index,
          name: step.name,
          action: step.action,
          inputMapping: step.inputMapping,
          outputVariable: step.outputVariable,
        }))
      );
    }

    if (workflow.status === "active" && workflow.cronExpression) {
      this.scheduleWorkflow(workflow);
    }

    return workflow;
  }

  async updateWorkflow(id: number, data: Partial<DbInsertWorkflow>, steps?: Omit<DbInsertWorkflowStep, "workflowId">[]): Promise<DbWorkflow | undefined> {
    const existing = await this.getWorkflow(id);
    if (!existing) return undefined;

    const wasActive = existing.status === "active";

    const [workflow] = await db.update(workflows)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(workflows.id, id))
      .returning();

    if (steps !== undefined) {
      await db.delete(workflowSteps).where(eq(workflowSteps.workflowId, id));
      
      if (steps.length > 0) {
        await db.insert(workflowSteps).values(
          steps.map((step, index) => ({
            workflowId: id,
            stepOrder: step.stepOrder ?? index,
            name: step.name,
            action: step.action,
            inputMapping: step.inputMapping,
            outputVariable: step.outputVariable,
          }))
        );
      }
    }

    if (wasActive && existing.cronExpression) {
      this.unscheduleWorkflow(id);
    }
    if (workflow.status === "active" && workflow.cronExpression) {
      this.scheduleWorkflow(workflow);
    }

    return workflow;
  }

  async deleteWorkflow(id: number): Promise<boolean> {
    this.unscheduleWorkflow(id);
    await db.delete(workflowSteps).where(eq(workflowSteps.workflowId, id));
    await db.delete(workflowExecutions).where(eq(workflowExecutions.workflowId, id));
    const result = await db.delete(workflows).where(eq(workflows.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  private scheduleWorkflow(workflow: DbWorkflow): void {
    if (!workflow.cronExpression) return;
    
    if (this.scheduledWorkflows.has(workflow.id)) {
      this.unscheduleWorkflow(workflow.id);
    }

    try {
      const task = cron.schedule(workflow.cronExpression, async () => {
        await this.runWorkflow(workflow.id);
      });
      
      this.scheduledWorkflows.set(workflow.id, task);
    } catch (error) {
      console.error(`Failed to schedule workflow ${workflow.id}:`, error);
    }
  }

  private unscheduleWorkflow(workflowId: number): void {
    const task = this.scheduledWorkflows.get(workflowId);
    if (task) {
      task.stop();
      this.scheduledWorkflows.delete(workflowId);
    }
  }

  async runWorkflow(id: number): Promise<DbWorkflowExecution> {
    const workflowData = await this.getWorkflowWithSteps(id);
    if (!workflowData) {
      throw new Error("Workflow not found");
    }

    const { workflow, steps } = workflowData;

    // Check if workflow is already running
    const runningExecution = await db.select()
      .from(workflowExecutions)
      .where(and(
        eq(workflowExecutions.workflowId, id),
        eq(workflowExecutions.status, "running")
      ))
      .limit(1);

    if (runningExecution.length > 0) {
      throw new Error("Workflow is already running. Please wait for the current execution to complete.");
    }

    const [execution] = await db.insert(workflowExecutions).values({
      workflowId: id,
      status: "running",
      currentStep: 0,
      context: {},
    }).returning();

    let context: Record<string, unknown> = {};
    let currentStep = 0;

    try {
      for (const step of steps) {
        currentStep = step.stepOrder;
        const stepStartTime = new Date();
        
        await db.update(workflowExecutions)
          .set({ currentStep, context })
          .where(eq(workflowExecutions.id, execution.id));

        const stepExecution = await this.createExecutionForWorkflowStep(
          `${workflow.name} > ${step.name}`,
          stepStartTime.toISOString()
        );

        try {
          const action = step.action as JobActionConfig;
          const result = await this.runAction(action, context);

          const stepEndTime = new Date();
          const duration = stepEndTime.getTime() - stepStartTime.getTime();

          await this.updateExecution(stepExecution.id, {
            status: "success",
            endTime: stepEndTime.toISOString(),
            duration,
            output: result,
          });

          let parsedResult: unknown = result;
          try {
            parsedResult = JSON.parse(result);
          } catch {
            parsedResult = result;
          }

          if (step.outputVariable) {
            context[step.outputVariable] = parsedResult;
          }
          
          context._lastResult = parsedResult;
          context._stepResults = context._stepResults || {};
          (context._stepResults as Record<string, unknown>)[step.name] = parsedResult;
        } catch (stepError) {
          const stepEndTime = new Date();
          const duration = stepEndTime.getTime() - stepStartTime.getTime();
          const stepErrorMessage = stepError instanceof Error ? stepError.message : "Unknown error";

          await this.updateExecution(stepExecution.id, {
            status: "failure",
            endTime: stepEndTime.toISOString(),
            duration,
            error: stepErrorMessage,
          });

          throw stepError;
        }
      }

      const [updated] = await db.update(workflowExecutions)
        .set({
          status: "completed",
          currentStep,
          context,
          endTime: new Date(),
        })
        .where(eq(workflowExecutions.id, execution.id))
        .returning();

      return updated;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      
      const [updated] = await db.update(workflowExecutions)
        .set({
          status: "failed",
          currentStep,
          context,
          endTime: new Date(),
          error: errorMessage,
        })
        .where(eq(workflowExecutions.id, execution.id))
        .returning();

      return updated;
    }
  }

  private async createExecutionForWorkflowStep(jobName: string, startTime: string): Promise<ExecutionLog> {
    const [row] = await db.insert(executionLogs).values({
      jobId: null,
      jobName,
      status: "running",
      startTime: new Date(startTime),
      endTime: null,
      duration: null,
      output: null,
      error: null,
    }).returning();

    return this.dbExecutionToExecution(row);
  }

  async getWorkflowExecutions(workflowId?: number): Promise<DbWorkflowExecution[]> {
    if (workflowId) {
      return db.select()
        .from(workflowExecutions)
        .where(eq(workflowExecutions.workflowId, workflowId))
        .orderBy(desc(workflowExecutions.startTime));
    }
    return db.select()
      .from(workflowExecutions)
      .orderBy(desc(workflowExecutions.startTime))
      .limit(50);
  }

  // Generate a webhook token for a workflow
  async generateWorkflowWebhookToken(workflowId: number): Promise<{ webhookToken: string; webhookUrl: string } | null> {
    const workflow = await this.getWorkflow(workflowId);
    if (!workflow) return null;

    // Generate a secure random token
    const crypto = await import("crypto");
    const token = crypto.randomBytes(32).toString("hex");
    
    // Update workflow with the new token
    await db.update(workflows)
      .set({ 
        webhookToken: token,
        triggerType: "webhook",
        updatedAt: new Date()
      })
      .where(eq(workflows.id, workflowId));

    return {
      webhookToken: token,
      webhookUrl: `/api/webhooks/${token}`
    };
  }

  // Revoke webhook token for a workflow
  async revokeWorkflowWebhookToken(workflowId: number): Promise<boolean> {
    const workflow = await this.getWorkflow(workflowId);
    if (!workflow) return false;

    await db.update(workflows)
      .set({ 
        webhookToken: null,
        webhookSecret: null,
        triggerType: "manual",
        updatedAt: new Date()
      })
      .where(eq(workflows.id, workflowId));

    return true;
  }

  // Run workflow by webhook token
  async runWorkflowByWebhookToken(token: string, payload?: Record<string, unknown>): Promise<DbWorkflowExecution | null> {
    // Find workflow by token
    const [workflow] = await db.select()
      .from(workflows)
      .where(and(
        eq(workflows.webhookToken, token),
        eq(workflows.status, "active")
      ))
      .limit(1);

    if (!workflow) return null;

    // Run the workflow with the webhook payload as initial context
    return this.runWorkflowWithContext(workflow.id, payload || {});
  }

  // Run workflow with initial context (for webhook triggers)
  async runWorkflowWithContext(id: number, initialContext: Record<string, unknown> = {}): Promise<DbWorkflowExecution> {
    const workflowData = await this.getWorkflowWithSteps(id);
    if (!workflowData) {
      throw new Error("Workflow not found");
    }

    const { workflow, steps } = workflowData;

    // Check if workflow is already running
    const runningExecution = await db.select()
      .from(workflowExecutions)
      .where(and(
        eq(workflowExecutions.workflowId, id),
        eq(workflowExecutions.status, "running")
      ))
      .limit(1);

    if (runningExecution.length > 0) {
      throw new Error("Workflow is already running. Please wait for the current execution to complete.");
    }

    const [execution] = await db.insert(workflowExecutions).values({
      workflowId: id,
      status: "running",
      currentStep: 0,
      context: initialContext,
    }).returning();

    let context: Record<string, unknown> = { ...initialContext, _webhookPayload: initialContext };
    let currentStep = 0;

    try {
      // Build step map for conditional branching
      const stepMap = new Map<number, typeof steps[0]>();
      steps.forEach(step => stepMap.set(step.stepOrder, step));

      // Execute steps with conditional branching support
      let stepQueue = [...steps.sort((a, b) => a.stepOrder - b.stepOrder)];
      let currentStepIndex = 0;

      while (currentStepIndex < stepQueue.length) {
        const step = stepQueue[currentStepIndex];
        currentStep = step.stepOrder;
        const stepStartTime = new Date();
        
        await db.update(workflowExecutions)
          .set({ currentStep, context })
          .where(eq(workflowExecutions.id, execution.id));

        const stepExecution = await this.createExecutionForWorkflowStep(
          `${workflow.name} > ${step.name}`,
          stepStartTime.toISOString()
        );

        try {
          // Check step type
          const stepType = (step.stepType as string) || "action";

          if (stepType === "condition") {
            // Evaluate condition
            const conditionResult = this.evaluateCondition(step.condition as { field: string; operator: string; value?: unknown } | null, context);
            
            const stepEndTime = new Date();
            const duration = stepEndTime.getTime() - stepStartTime.getTime();

            await this.updateExecution(stepExecution.id, {
              status: "success",
              endTime: stepEndTime.toISOString(),
              duration,
              output: JSON.stringify({ conditionResult, evaluatedField: (step.condition as { field: string })?.field }),
            });

            // Store condition result
            if (step.outputVariable) {
              context[step.outputVariable] = conditionResult;
            }
            context._lastConditionResult = conditionResult;

            // Determine next step based on condition
            const nextStepOrder = conditionResult 
              ? (step.onTrueStep as number | null) 
              : (step.onFalseStep as number | null);

            if (nextStepOrder !== null && nextStepOrder !== undefined) {
              // Find the step with the matching order and jump to it
              const targetIndex = stepQueue.findIndex(s => s.stepOrder === nextStepOrder);
              if (targetIndex !== -1) {
                currentStepIndex = targetIndex;
                continue;
              }
            }
          } else {
            // Execute action step
            const action = step.action as JobActionConfig;
            if (action) {
              const result = await this.runAction(action, context);

              const stepEndTime = new Date();
              const duration = stepEndTime.getTime() - stepStartTime.getTime();

              await this.updateExecution(stepExecution.id, {
                status: "success",
                endTime: stepEndTime.toISOString(),
                duration,
                output: result,
              });

              let parsedResult: unknown = result;
              try {
                parsedResult = JSON.parse(result);
              } catch {
                parsedResult = result;
              }

              if (step.outputVariable) {
                context[step.outputVariable] = parsedResult;
              }
              
              context._lastResult = parsedResult;
              context._stepResults = context._stepResults || {};
              (context._stepResults as Record<string, unknown>)[step.name] = parsedResult;
            }
          }
        } catch (stepError) {
          const stepEndTime = new Date();
          const duration = stepEndTime.getTime() - stepStartTime.getTime();
          const stepErrorMessage = stepError instanceof Error ? stepError.message : "Unknown error";

          await this.updateExecution(stepExecution.id, {
            status: "failure",
            endTime: stepEndTime.toISOString(),
            duration,
            error: stepErrorMessage,
          });

          throw stepError;
        }

        currentStepIndex++;
      }

      const [updated] = await db.update(workflowExecutions)
        .set({
          status: "completed",
          currentStep,
          context,
          endTime: new Date(),
        })
        .where(eq(workflowExecutions.id, execution.id))
        .returning();

      return updated;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      
      const [updated] = await db.update(workflowExecutions)
        .set({
          status: "failed",
          currentStep,
          context,
          endTime: new Date(),
          error: errorMessage,
        })
        .where(eq(workflowExecutions.id, execution.id))
        .returning();

      return updated;
    }
  }

  // Evaluate a condition against the current context
  private evaluateCondition(condition: { field: string; operator: string; value?: unknown } | null, context: Record<string, unknown>): boolean {
    if (!condition) return true;

    const { field, operator, value } = condition;
    
    // Get the field value from context (supports dot notation)
    const fieldValue = this.getNestedValue(context, field);

    switch (operator) {
      case "equals":
        return fieldValue === value;
      case "not_equals":
        return fieldValue !== value;
      case "contains":
        return typeof fieldValue === "string" && typeof value === "string" 
          ? fieldValue.includes(value) 
          : false;
      case "not_contains":
        return typeof fieldValue === "string" && typeof value === "string" 
          ? !fieldValue.includes(value) 
          : true;
      case "greater_than":
        return typeof fieldValue === "number" && typeof value === "number" 
          ? fieldValue > value 
          : false;
      case "less_than":
        return typeof fieldValue === "number" && typeof value === "number" 
          ? fieldValue < value 
          : false;
      case "is_empty":
        return fieldValue === null || fieldValue === undefined || fieldValue === "" || 
          (Array.isArray(fieldValue) && fieldValue.length === 0);
      case "is_not_empty":
        return fieldValue !== null && fieldValue !== undefined && fieldValue !== "" && 
          !(Array.isArray(fieldValue) && fieldValue.length === 0);
      default:
        return true;
    }
  }

  // Get nested value from object using dot notation
  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    const keys = path.split(".");
    let current: unknown = obj;

    for (const key of keys) {
      if (current === null || current === undefined) return undefined;
      if (typeof current !== "object") return undefined;
      current = (current as Record<string, unknown>)[key];
    }

    return current;
  }

  // ============ NOTIFICATION TEMPLATES ============

  async getNotificationTemplates(): Promise<DbNotificationTemplate[]> {
    return db.select().from(notificationTemplates).orderBy(desc(notificationTemplates.createdAt));
  }

  async getNotificationTemplate(id: number): Promise<DbNotificationTemplate | undefined> {
    const [row] = await db.select().from(notificationTemplates).where(eq(notificationTemplates.id, id));
    return row;
  }

  async createNotificationTemplate(data: InsertNotificationTemplate, createdBy?: string): Promise<DbNotificationTemplate> {
    const [row] = await db.insert(notificationTemplates).values({
      name: data.name,
      description: data.description || null,
      channel: data.channel,
      subject: data.subject || null,
      content: data.content,
      variables: data.variables || [],
      status: data.status || "draft",
      createdBy: createdBy || null,
    }).returning();
    return row;
  }

  async updateNotificationTemplate(id: number, data: UpdateNotificationTemplate): Promise<DbNotificationTemplate | undefined> {
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.channel !== undefined) updateData.channel = data.channel;
    if (data.subject !== undefined) updateData.subject = data.subject;
    if (data.content !== undefined) updateData.content = data.content;
    if (data.variables !== undefined) updateData.variables = data.variables;
    if (data.status !== undefined) updateData.status = data.status;

    const [row] = await db.update(notificationTemplates)
      .set(updateData)
      .where(eq(notificationTemplates.id, id))
      .returning();
    return row;
  }

  async deleteNotificationTemplate(id: number): Promise<boolean> {
    const result = await db.delete(notificationTemplates).where(eq(notificationTemplates.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // ============ SMTP CONFIG ============

  async getSmtpConfigs(): Promise<DbSmtpConfig[]> {
    return db.select().from(smtpConfig).orderBy(desc(smtpConfig.createdAt));
  }

  async getSmtpConfig(id?: number): Promise<DbSmtpConfig | undefined> {
    if (id) {
      const [row] = await db.select().from(smtpConfig).where(eq(smtpConfig.id, id));
      return row;
    }
    // Get default config if no ID specified
    return this.getDefaultSmtpConfig();
  }

  async getDefaultSmtpConfig(): Promise<DbSmtpConfig | undefined> {
    // First try to get the default config
    const [defaultRow] = await db.select().from(smtpConfig)
      .where(and(eq(smtpConfig.isDefault, true), eq(smtpConfig.isActive, true)))
      .limit(1);
    if (defaultRow) return defaultRow;
    
    // Fall back to first active config
    const [firstRow] = await db.select().from(smtpConfig)
      .where(eq(smtpConfig.isActive, true))
      .orderBy(smtpConfig.createdAt)
      .limit(1);
    return firstRow;
  }

  async createSmtpConfig(data: InsertSmtpConfig): Promise<DbSmtpConfig> {
    // If this is the first config or marked as default, make it default
    const existing = await this.getSmtpConfigs();
    const isFirst = existing.length === 0;
    const shouldBeDefault = isFirst || data.isDefault;
    
    // If setting as default, unset other defaults
    if (shouldBeDefault) {
      await db.update(smtpConfig).set({ isDefault: false }).where(eq(smtpConfig.isDefault, true));
    }

    const [row] = await db.insert(smtpConfig).values({
      name: data.name || "Default",
      host: data.host,
      port: data.port,
      secure: data.secure ?? false,
      username: data.username || null,
      password: data.password || null,
      fromEmail: data.fromEmail,
      fromName: data.fromName || null,
      isActive: data.isActive ?? true,
      isDefault: shouldBeDefault,
    }).returning();
    return row;
  }

  async updateSmtpConfig(id: number, data: Partial<InsertSmtpConfig>): Promise<DbSmtpConfig | undefined> {
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (data.name !== undefined) updateData.name = data.name;
    if (data.host !== undefined) updateData.host = data.host;
    if (data.port !== undefined) updateData.port = data.port;
    if (data.secure !== undefined) updateData.secure = data.secure;
    if (data.username !== undefined) updateData.username = data.username;
    if (data.password !== undefined) updateData.password = data.password;
    if (data.fromEmail !== undefined) updateData.fromEmail = data.fromEmail;
    if (data.fromName !== undefined) updateData.fromName = data.fromName;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    
    // Only allow setting isDefault to true through this method (use setDefaultSmtpConfig for changing default)
    // Ignore isDefault=false to prevent zero-default state
    if (data.isDefault === true) {
      await db.update(smtpConfig).set({ isDefault: false }).where(eq(smtpConfig.isDefault, true));
      updateData.isDefault = true;
    }
    // Note: isDefault=false is intentionally ignored to maintain at least one default

    const [row] = await db.update(smtpConfig)
      .set(updateData)
      .where(eq(smtpConfig.id, id))
      .returning();
    return row;
  }

  async setDefaultSmtpConfig(id: number): Promise<DbSmtpConfig | undefined> {
    // Unset all other defaults
    await db.update(smtpConfig).set({ isDefault: false }).where(eq(smtpConfig.isDefault, true));
    // Set this one as default
    const [row] = await db.update(smtpConfig)
      .set({ isDefault: true, updatedAt: new Date() })
      .where(eq(smtpConfig.id, id))
      .returning();
    return row;
  }

  async updateSmtpTestResult(id: number, success: boolean): Promise<DbSmtpConfig | undefined> {
    const [row] = await db.update(smtpConfig)
      .set({ lastTestResult: success, lastTestAt: new Date(), updatedAt: new Date() })
      .where(eq(smtpConfig.id, id))
      .returning();
    return row;
  }

  async deleteSmtpConfig(id: number): Promise<boolean> {
    // Check if this is the default config
    const configToDelete = await this.getSmtpConfig(id);
    const wasDefault = configToDelete?.isDefault === true;
    
    const result = await db.delete(smtpConfig).where(eq(smtpConfig.id, id));
    const deleted = (result.rowCount ?? 0) > 0;
    
    // If we deleted the default, assign a new default to the first remaining config
    if (deleted && wasDefault) {
      const remaining = await this.getSmtpConfigs();
      if (remaining.length > 0) {
        await db.update(smtpConfig)
          .set({ isDefault: true, updatedAt: new Date() })
          .where(eq(smtpConfig.id, remaining[0].id));
      }
    }
    
    return deleted;
  }

  // ============ NOTIFICATIONS ============

  async getNotifications(recipientId?: string, limit: number = 50): Promise<DbNotification[]> {
    if (recipientId) {
      return db.select().from(notifications)
        .where(eq(notifications.recipientId, recipientId))
        .orderBy(desc(notifications.createdAt))
        .limit(limit);
    }
    return db.select().from(notifications)
      .orderBy(desc(notifications.createdAt))
      .limit(limit);
  }

  async getNotification(id: number): Promise<DbNotification | undefined> {
    const [row] = await db.select().from(notifications).where(eq(notifications.id, id));
    return row;
  }

  async createNotification(data: DbInsertNotification): Promise<DbNotification> {
    const [row] = await db.insert(notifications).values(data).returning();
    return row;
  }

  async updateNotificationStatus(id: number, status: string, error?: string): Promise<DbNotification | undefined> {
    const updateData: Record<string, unknown> = { status };
    if (status === "sent") updateData.sentAt = new Date();
    if (status === "delivered") updateData.deliveredAt = new Date();
    if (status === "failed" && error) updateData.error = error;

    const [row] = await db.update(notifications)
      .set(updateData)
      .where(eq(notifications.id, id))
      .returning();
    return row;
  }

  async markNotificationRead(id: number): Promise<DbNotification | undefined> {
    const [row] = await db.update(notifications)
      .set({ status: "read", readAt: new Date() })
      .where(eq(notifications.id, id))
      .returning();
    return row;
  }

  async getUnreadNotificationCount(recipientId: string): Promise<number> {
    const [result] = await db.select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(and(
        eq(notifications.recipientId, recipientId),
        eq(notifications.channel, "in_app"),
        sql`${notifications.status} != 'read'`
      ));
    return Number(result?.count || 0);
  }

  // ============ NOTIFICATION AUDIT LOGS ============

  async createAuditLog(data: DbInsertNotificationAuditLog): Promise<DbNotificationAuditLog> {
    const [row] = await db.insert(notificationAuditLogs).values(data).returning();
    return row;
  }

  async getAuditLogs(filter?: { notificationId?: number; templateId?: number }): Promise<DbNotificationAuditLog[]> {
    if (filter?.notificationId) {
      return db.select().from(notificationAuditLogs)
        .where(eq(notificationAuditLogs.notificationId, filter.notificationId))
        .orderBy(desc(notificationAuditLogs.createdAt));
    }
    if (filter?.templateId) {
      return db.select().from(notificationAuditLogs)
        .where(eq(notificationAuditLogs.templateId, filter.templateId))
        .orderBy(desc(notificationAuditLogs.createdAt));
    }
    return db.select().from(notificationAuditLogs)
      .orderBy(desc(notificationAuditLogs.createdAt))
      .limit(100);
  }

  // ============ JOB TEMPLATES ============

  async getJobTemplates(category?: string): Promise<DbJobTemplate[]> {
    if (category) {
      return db.select().from(jobTemplates)
        .where(eq(jobTemplates.category, category))
        .orderBy(desc(jobTemplates.usageCount));
    }
    return db.select().from(jobTemplates)
      .orderBy(desc(jobTemplates.usageCount));
  }

  async getJobTemplate(id: number): Promise<DbJobTemplate | undefined> {
    const [row] = await db.select().from(jobTemplates).where(eq(jobTemplates.id, id));
    return row;
  }

  async createJobTemplate(data: InsertJobTemplate): Promise<DbJobTemplate> {
    const [row] = await db.insert(jobTemplates).values(data).returning();
    return row;
  }

  async updateJobTemplate(id: number, data: Partial<InsertJobTemplate>): Promise<DbJobTemplate | undefined> {
    const [row] = await db.update(jobTemplates)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(jobTemplates.id, id))
      .returning();
    return row;
  }

  async deleteJobTemplate(id: number): Promise<boolean> {
    const result = await db.delete(jobTemplates).where(eq(jobTemplates.id, id));
    return (result.rowCount || 0) > 0;
  }

  async incrementTemplateUsage(id: number): Promise<void> {
    await db.update(jobTemplates)
      .set({ usageCount: sql`${jobTemplates.usageCount} + 1` })
      .where(eq(jobTemplates.id, id));
  }

  // ============ CAMPAIGNS ============

  async getCampaigns(status?: string): Promise<Campaign[]> {
    if (status) {
      return db.select().from(campaigns)
        .where(eq(campaigns.status, status))
        .orderBy(desc(campaigns.createdAt));
    }
    return db.select().from(campaigns).orderBy(desc(campaigns.createdAt));
  }

  async getCampaign(id: number): Promise<Campaign | undefined> {
    const [row] = await db.select().from(campaigns).where(eq(campaigns.id, id));
    return row;
  }

  async getCampaignWithDetails(id: number): Promise<{ campaign: Campaign; audiences: CampaignAudience[]; steps: CampaignStep[]; runs: CampaignRun[] } | undefined> {
    const campaign = await this.getCampaign(id);
    if (!campaign) return undefined;

    const [audiences, steps, runs] = await Promise.all([
      this.getCampaignAudiences(id),
      this.getCampaignSteps(id),
      this.getCampaignRuns(id),
    ]);

    return { campaign, audiences, steps, runs };
  }

  async createCampaign(data: InsertCampaign): Promise<Campaign> {
    const [row] = await db.insert(campaigns).values(data).returning();
    return row;
  }

  async updateCampaign(id: number, data: Partial<InsertCampaign>): Promise<Campaign | undefined> {
    const [row] = await db.update(campaigns)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(campaigns.id, id))
      .returning();
    return row;
  }

  async deleteCampaign(id: number): Promise<boolean> {
    const result = await db.delete(campaigns).where(eq(campaigns.id, id));
    return (result.rowCount || 0) > 0;
  }

  async updateCampaignStatus(id: number, status: string): Promise<Campaign | undefined> {
    const updates: Partial<Campaign> = { status, updatedAt: new Date() };
    if (status === "running") {
      updates.startedAt = new Date();
    } else if (status === "completed" || status === "cancelled") {
      updates.completedAt = new Date();
    }
    const [row] = await db.update(campaigns)
      .set(updates)
      .where(eq(campaigns.id, id))
      .returning();
    return row;
  }

  // ============ CAMPAIGN AUDIENCES ============

  async getCampaignAudiences(campaignId: number): Promise<CampaignAudience[]> {
    return db.select().from(campaignAudiences)
      .where(eq(campaignAudiences.campaignId, campaignId))
      .orderBy(campaignAudiences.createdAt);
  }

  async getCampaignAudience(id: number): Promise<CampaignAudience | undefined> {
    const [row] = await db.select().from(campaignAudiences).where(eq(campaignAudiences.id, id));
    return row;
  }

  async createCampaignAudience(data: InsertCampaignAudience): Promise<CampaignAudience> {
    const [row] = await db.insert(campaignAudiences).values(data).returning();
    return row;
  }

  async deleteCampaignAudience(id: number): Promise<boolean> {
    const result = await db.delete(campaignAudiences).where(eq(campaignAudiences.id, id));
    return (result.rowCount || 0) > 0;
  }

  async addAudienceMembers(audienceId: number, members: InsertCampaignAudienceMember[]): Promise<CampaignAudienceMember[]> {
    if (members.length === 0) return [];
    const membersWithAudienceId = members.map(m => ({ ...m, audienceId }));
    const rows = await db.insert(campaignAudienceMembers).values(membersWithAudienceId).returning();
    // Update estimated count
    const count = await this.getAudienceMemberCount(audienceId);
    await db.update(campaignAudiences)
      .set({ estimatedCount: count })
      .where(eq(campaignAudiences.id, audienceId));
    return rows;
  }

  async getAudienceMembers(audienceId: number): Promise<CampaignAudienceMember[]> {
    return db.select().from(campaignAudienceMembers)
      .where(eq(campaignAudienceMembers.audienceId, audienceId));
  }

  async getAudienceMemberCount(audienceId: number): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)` })
      .from(campaignAudienceMembers)
      .where(eq(campaignAudienceMembers.audienceId, audienceId));
    return result[0]?.count || 0;
  }

  // ============ CAMPAIGN STEPS ============

  async getCampaignSteps(campaignId: number): Promise<CampaignStep[]> {
    return db.select().from(campaignSteps)
      .where(eq(campaignSteps.campaignId, campaignId))
      .orderBy(campaignSteps.stepOrder);
  }

  async getCampaignStep(id: number): Promise<CampaignStep | undefined> {
    const [row] = await db.select().from(campaignSteps).where(eq(campaignSteps.id, id));
    return row;
  }

  async createCampaignStep(data: InsertCampaignStep): Promise<CampaignStep> {
    const [row] = await db.insert(campaignSteps).values(data).returning();
    return row;
  }

  async updateCampaignStep(id: number, data: Partial<InsertCampaignStep>): Promise<CampaignStep | undefined> {
    const [row] = await db.update(campaignSteps)
      .set(data)
      .where(eq(campaignSteps.id, id))
      .returning();
    return row;
  }

  async deleteCampaignStep(id: number): Promise<boolean> {
    const result = await db.delete(campaignSteps).where(eq(campaignSteps.id, id));
    return (result.rowCount || 0) > 0;
  }

  async reorderCampaignSteps(campaignId: number, stepIds: number[]): Promise<void> {
    for (let i = 0; i < stepIds.length; i++) {
      await db.update(campaignSteps)
        .set({ stepOrder: i + 1 })
        .where(and(eq(campaignSteps.id, stepIds[i]), eq(campaignSteps.campaignId, campaignId)));
    }
  }

  // ============ CAMPAIGN RUNS ============

  async getCampaignRuns(campaignId: number): Promise<CampaignRun[]> {
    return db.select().from(campaignRuns)
      .where(eq(campaignRuns.campaignId, campaignId))
      .orderBy(desc(campaignRuns.createdAt));
  }

  async getCampaignRun(id: number): Promise<CampaignRun | undefined> {
    const [row] = await db.select().from(campaignRuns).where(eq(campaignRuns.id, id));
    return row;
  }

  async createCampaignRun(data: InsertCampaignRun): Promise<CampaignRun> {
    const [row] = await db.insert(campaignRuns).values(data).returning();
    return row;
  }

  async updateCampaignRun(id: number, data: Partial<CampaignRun>): Promise<CampaignRun | undefined> {
    const [row] = await db.update(campaignRuns)
      .set(data)
      .where(eq(campaignRuns.id, id))
      .returning();
    return row;
  }

  // ============ CAMPAIGN RECIPIENTS ============

  async getCampaignRecipients(runId: number, stepId?: number): Promise<CampaignRecipient[]> {
    if (stepId) {
      return db.select().from(campaignRecipients)
        .where(and(eq(campaignRecipients.runId, runId), eq(campaignRecipients.stepId, stepId)));
    }
    return db.select().from(campaignRecipients)
      .where(eq(campaignRecipients.runId, runId));
  }

  async createCampaignRecipient(data: InsertCampaignRecipient): Promise<CampaignRecipient> {
    const [row] = await db.insert(campaignRecipients).values(data).returning();
    return row;
  }

  async updateCampaignRecipient(id: number, data: Partial<CampaignRecipient>): Promise<CampaignRecipient | undefined> {
    const [row] = await db.update(campaignRecipients)
      .set(data)
      .where(eq(campaignRecipients.id, id))
      .returning();
    return row;
  }

  async getCampaignStats(campaignId: number): Promise<{ totalSent: number; delivered: number; failed: number; opened: number; clicked: number }> {
    const runs = await this.getCampaignRuns(campaignId);
    return runs.reduce((acc, run) => ({
      totalSent: acc.totalSent + (run.sentCount || 0),
      delivered: acc.delivered + (run.deliveredCount || 0),
      failed: acc.failed + (run.failedCount || 0),
      opened: acc.opened + (run.openedCount || 0),
      clicked: acc.clicked + (run.clickedCount || 0),
    }), { totalSent: 0, delivered: 0, failed: 0, opened: 0, clicked: 0 });
  }

  // ============ DEEPLINK DOMAINS ============

  async getDeeplinkDomains(): Promise<DeeplinkDomain[]> {
    return db.select().from(deeplinkDomains).orderBy(desc(deeplinkDomains.createdAt));
  }

  async getDeeplinkDomain(id: number): Promise<DeeplinkDomain | undefined> {
    const [row] = await db.select().from(deeplinkDomains).where(eq(deeplinkDomains.id, id));
    return row;
  }

  async getDeeplinkDomainByDomain(domain: string): Promise<DeeplinkDomain | undefined> {
    const [row] = await db.select().from(deeplinkDomains).where(eq(deeplinkDomains.domain, domain));
    return row;
  }

  async getPrimaryDeeplinkDomain(): Promise<DeeplinkDomain | undefined> {
    const [row] = await db.select().from(deeplinkDomains).where(eq(deeplinkDomains.isPrimary, true));
    return row;
  }

  async createDeeplinkDomain(data: InsertDeeplinkDomain): Promise<DeeplinkDomain> {
    const verificationToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const [row] = await db.insert(deeplinkDomains).values({
      ...data,
      verificationToken,
    }).returning();
    return row;
  }

  async updateDeeplinkDomain(id: number, data: Partial<InsertDeeplinkDomain>): Promise<DeeplinkDomain | undefined> {
    const [row] = await db.update(deeplinkDomains)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(deeplinkDomains.id, id))
      .returning();
    return row;
  }

  async deleteDeeplinkDomain(id: number): Promise<boolean> {
    const result = await db.delete(deeplinkDomains).where(eq(deeplinkDomains.id, id));
    return true;
  }

  async verifyDeeplinkDomain(id: number): Promise<DeeplinkDomain | undefined> {
    const [row] = await db.update(deeplinkDomains)
      .set({ isVerified: true, updatedAt: new Date() })
      .where(eq(deeplinkDomains.id, id))
      .returning();
    return row;
  }

  async setPrimaryDeeplinkDomain(id: number): Promise<DeeplinkDomain | undefined> {
    await db.update(deeplinkDomains).set({ isPrimary: false }).where(eq(deeplinkDomains.isPrimary, true));
    const [row] = await db.update(deeplinkDomains)
      .set({ isPrimary: true, updatedAt: new Date() })
      .where(eq(deeplinkDomains.id, id))
      .returning();
    return row;
  }

  // ============ DEEPLINKS ============

  async getDeeplinks(campaignId?: number): Promise<Deeplink[]> {
    if (campaignId) {
      return db.select().from(deeplinks)
        .where(eq(deeplinks.campaignId, campaignId))
        .orderBy(desc(deeplinks.createdAt));
    }
    return db.select().from(deeplinks).orderBy(desc(deeplinks.createdAt));
  }

  async getDeeplink(id: number): Promise<Deeplink | undefined> {
    const [row] = await db.select().from(deeplinks).where(eq(deeplinks.id, id));
    return row;
  }

  async getDeeplinkByShortCode(shortCode: string): Promise<Deeplink | undefined> {
    const [row] = await db.select().from(deeplinks).where(eq(deeplinks.shortCode, shortCode));
    return row;
  }

  async createDeeplink(data: InsertDeeplink): Promise<Deeplink> {
    const shortCode = data.shortCode || this.generateShortCode();
    const [row] = await db.insert(deeplinks).values({
      ...data,
      shortCode,
    }).returning();
    return row;
  }

  async updateDeeplink(id: number, data: Partial<InsertDeeplink>): Promise<Deeplink | undefined> {
    const [row] = await db.update(deeplinks)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(deeplinks.id, id))
      .returning();
    return row;
  }

  async deleteDeeplink(id: number): Promise<boolean> {
    await db.delete(deeplinks).where(eq(deeplinks.id, id));
    return true;
  }

  async incrementDeeplinkClick(id: number, isUnique: boolean): Promise<void> {
    if (isUnique) {
      await db.update(deeplinks)
        .set({
          clickCount: sql`${deeplinks.clickCount} + 1`,
          uniqueClickCount: sql`${deeplinks.uniqueClickCount} + 1`,
          lastClickedAt: new Date(),
        })
        .where(eq(deeplinks.id, id));
    } else {
      await db.update(deeplinks)
        .set({
          clickCount: sql`${deeplinks.clickCount} + 1`,
          lastClickedAt: new Date(),
        })
        .where(eq(deeplinks.id, id));
    }
  }

  private generateShortCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 7; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  // ============ DEEPLINK CLICKS ============

  async createDeeplinkClick(data: InsertDeeplinkClick): Promise<DeeplinkClick> {
    const [row] = await db.insert(deeplinkClicks).values(data).returning();
    return row;
  }

  async getDeeplinkClicks(deeplinkId: number, limit: number = 100): Promise<DeeplinkClick[]> {
    return db.select().from(deeplinkClicks)
      .where(eq(deeplinkClicks.deeplinkId, deeplinkId))
      .orderBy(desc(deeplinkClicks.clickedAt))
      .limit(limit);
  }

  async getDeeplinkStats(deeplinkId: number): Promise<{ totalClicks: number; uniqueClicks: number; countries: Record<string, number>; devices: Record<string, number> }> {
    const clicks = await db.select().from(deeplinkClicks).where(eq(deeplinkClicks.deeplinkId, deeplinkId));
    
    const countries: Record<string, number> = {};
    const devices: Record<string, number> = {};
    let uniqueClicks = 0;

    for (const click of clicks) {
      if (click.country) {
        countries[click.country] = (countries[click.country] || 0) + 1;
      }
      if (click.device) {
        devices[click.device] = (devices[click.device] || 0) + 1;
      }
      if (click.isUnique) {
        uniqueClicks++;
      }
    }

    return {
      totalClicks: clicks.length,
      uniqueClicks,
      countries,
      devices,
    };
  }

  // ============ EMAIL TEMPLATES (Dynamic Templates) ============

  async getEmailTemplates(): Promise<EmailTemplate[]> {
    return await db.select().from(emailTemplates).orderBy(desc(emailTemplates.updatedAt));
  }

  async getEmailTemplate(id: number): Promise<EmailTemplate | undefined> {
    const [template] = await db.select().from(emailTemplates).where(eq(emailTemplates.id, id));
    return template;
  }

  async createEmailTemplate(data: Omit<InsertEmailTemplate, "id" | "createdAt" | "updatedAt">): Promise<EmailTemplate> {
    const [template] = await db.insert(emailTemplates).values({
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    return template;
  }

  async updateEmailTemplate(id: number, data: Partial<InsertEmailTemplate>): Promise<EmailTemplate | undefined> {
    const [template] = await db.update(emailTemplates)
      .set({
        ...data,
        updatedAt: new Date(),
        version: sql`${emailTemplates.version} + 1`,
      })
      .where(eq(emailTemplates.id, id))
      .returning();
    return template;
  }

  async deleteEmailTemplate(id: number): Promise<boolean> {
    const result = await db.delete(emailTemplates).where(eq(emailTemplates.id, id)).returning();
    return result.length > 0;
  }

  // ============ HELPERS ============

  private dbJobToJob(row: typeof jobs.$inferSelect): Job {
    return {
      id: String(row.id),
      name: row.name,
      description: row.description || "",
      cronExpression: row.cronExpression,
      status: row.status as Job["status"],
      action: row.action as Job["action"],
      lastRun: row.lastRun?.toISOString() || null,
      nextRun: row.nextRun?.toISOString() || null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      dependsOn: row.dependsOn ? String(row.dependsOn) : null,
      version: row.version,
      notifyOnFailure: row.notifyOnFailure || false,
      notificationWebhook: row.notificationWebhook,
    };
  }

  private dbExecutionToExecution(row: typeof executionLogs.$inferSelect): ExecutionLog {
    return {
      id: String(row.id),
      jobId: row.jobId ? String(row.jobId) : "",
      jobName: row.jobName,
      status: row.status as ExecutionLog["status"],
      startTime: row.startTime.toISOString(),
      endTime: row.endTime?.toISOString() || null,
      duration: row.duration,
      output: row.output,
      error: row.error,
    };
  }
}

export const storage = new DatabaseStorage();
