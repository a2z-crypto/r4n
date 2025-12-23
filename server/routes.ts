import type { Express, RequestHandler } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertJobSchema, createWorkflowRequestSchema, updateWorkflowRequestSchema, 
  createUserSchema, updateUserSchema, resetPasswordSchema, changePasswordSchema, updateProfileSchema, 
  insertNotificationTemplateSchema, updateNotificationTemplateSchema,
  insertSmtpConfigSchema, updateSmtpConfigSchema,
  sendNotificationSchema, previewTemplateSchema, testEmailSchema,
  insertJobTemplateSchema,
  insertCampaignSchema, insertCampaignAudienceSchema, insertCampaignStepSchema,
  type Permission 
} from "@shared/schema";
import { z } from "zod";
import { isAuthenticated, setupAuth, hashPassword, verifyPassword } from "./auth";
import { notificationService } from "./notifications/notification-service";
import { templateService } from "./notifications/template-service";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";

// Permission middleware factory
function requirePermission(permission: Permission): RequestHandler {
  return async (req, res, next) => {
    const user = req.user;
    if (!user?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    
    // Super admin has all permissions
    if (user.isSuperAdmin) {
      return next();
    }
    
    const hasAccess = await storage.hasPermission(user.id, permission);
    if (!hasAccess) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    next();
  };
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Set up local authentication (login, logout, setup endpoints)
  await setupAuth(app);
  
  // Register object storage routes for file uploads
  registerObjectStorageRoutes(app);
  
  // Initialize roles
  await storage.initializeRoles();
  
  // Initialize default SMTP config for notification service
  const defaultSmtpConfig = await storage.getDefaultSmtpConfig();
  if (defaultSmtpConfig) {
    notificationService.configureSmtp(defaultSmtpConfig);
    console.log(`Loaded default SMTP config: ${defaultSmtpConfig.name}`);
  }

  // ============ AUTH ROUTES ============
  
  // Get current user info (Local Auth)
  app.get("/api/auth/user", isAuthenticated, async (req, res) => {
    try {
      const user = req.user!;
      
      // Super admin has all permissions
      let permissions: Permission[] = [];
      let userRoles: { id: number; name: string; description: string | null }[] = [];
      
      if (user.isSuperAdmin) {
        // Super admin has all permissions
        const allPermissions = await import("@shared/schema").then(m => Object.keys(m.permissions) as Permission[]);
        permissions = allPermissions;
        userRoles = [{ id: 0, name: "super_admin", description: "Super Administrator with full access" }];
      } else {
        permissions = await storage.getUserPermissions(user.id);
        const roles = await storage.getUserRoles(user.id);
        userRoles = roles.map(r => ({ id: r.id, name: r.name, description: r.description }));
      }
      
      res.json({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        profileImageUrl: user.profileImageUrl,
        isSuperAdmin: user.isSuperAdmin,
        permissions,
        roles: userRoles,
      });
    } catch (error) {
      console.error("Get user error:", error);
      res.status(500).json({ error: "Failed to fetch user" });
    }
  });

  // Update own profile (self-service)
  app.patch("/api/auth/profile", isAuthenticated, async (req, res) => {
    try {
      const parsed = updateProfileSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid data", details: parsed.error.errors });
      }
      
      const userId = req.user!.id;
      const { firstName, lastName } = parsed.data;
      
      const updatedUser = await storage.updateUser(userId, {
        firstName,
        lastName: lastName ?? undefined,
      });
      
      res.json({
        id: updatedUser.id,
        email: updatedUser.email,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        profileImageUrl: updatedUser.profileImageUrl,
        isSuperAdmin: updatedUser.isSuperAdmin,
      });
    } catch (error) {
      console.error("Update profile error:", error);
      res.status(500).json({ error: "Failed to update profile" });
    }
  });

  // Change own password (self-service)
  app.post("/api/auth/change-password", isAuthenticated, async (req, res) => {
    try {
      const parsed = changePasswordSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid data", details: parsed.error.errors });
      }
      
      const userId = req.user!.id;
      const { currentPassword, newPassword } = parsed.data;
      
      // Get the full user with password
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Verify current password
      const isValid = await verifyPassword(currentPassword, user.password);
      if (!isValid) {
        return res.status(400).json({ error: "Current password is incorrect" });
      }
      
      // Hash and update new password
      const hashedPassword = await hashPassword(newPassword);
      const success = await storage.updateUserPassword(userId, hashedPassword);
      
      if (!success) {
        return res.status(500).json({ error: "Failed to change password" });
      }
      
      res.json({ message: "Password changed successfully" });
    } catch (error) {
      console.error("Change password error:", error);
      res.status(500).json({ error: "Failed to change password" });
    }
  });

  // ============ USER MANAGEMENT ROUTES ============
  
  // Get all users (admin only)
  app.get("/api/users", isAuthenticated, requirePermission("users:read"), async (req, res) => {
    try {
      const usersList = await storage.getUsers();
      res.json(usersList);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });
  
  // Get all roles
  app.get("/api/roles", isAuthenticated, async (req, res) => {
    try {
      const roles = await storage.getRoles();
      res.json(roles);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch roles" });
    }
  });

  // Assign role to user (admin only)
  app.post("/api/users/:userId/roles/:roleId", isAuthenticated, requirePermission("users:assign_role"), async (req, res) => {
    try {
      const assignedBy = req.user!.id;
      const userRole = await storage.assignRole(req.params.userId, parseInt(req.params.roleId), assignedBy);
      res.status(201).json(userRole);
    } catch (error) {
      res.status(500).json({ error: "Failed to assign role" });
    }
  });
  
  // Create user (super admin or admin only)
  app.post("/api/users", isAuthenticated, requirePermission("users:create"), async (req, res) => {
    try {
      const parsed = createUserSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid user data", details: parsed.error.errors });
      }
      
      const { email, password, firstName, lastName, roleId } = parsed.data;
      
      // Check if email already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ error: "Email already in use" });
      }
      
      // Hash password and create user
      const hashedPassword = await hashPassword(password);
      const user = await storage.createUser({
        email,
        password: hashedPassword,
        firstName,
        lastName: lastName || null,
      });
      
      // Assign role if provided
      if (roleId) {
        await storage.assignRole(user.id, roleId, req.user!.id);
      }
      
      res.status(201).json({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      });
    } catch (error) {
      console.error("Create user error:", error);
      res.status(500).json({ error: "Failed to create user" });
    }
  });

  // Remove role from user (admin only)
  app.delete("/api/users/:userId/roles/:roleId", isAuthenticated, requirePermission("users:assign_role"), async (req, res) => {
    try {
      const success = await storage.removeRole(req.params.userId, parseInt(req.params.roleId));
      if (!success) {
        return res.status(404).json({ error: "Role assignment not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to remove role" });
    }
  });

  // Update user (admin only)
  app.patch("/api/users/:userId", isAuthenticated, requirePermission("users:assign_role"), async (req, res) => {
    try {
      const targetUserId = req.params.userId;
      
      // Check if target user exists
      const targetUser = await storage.getUser(targetUserId);
      if (!targetUser) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Cannot edit super admin unless you are the super admin
      if (targetUser.isSuperAdmin && !req.user!.isSuperAdmin) {
        return res.status(403).json({ error: "Cannot edit super admin" });
      }
      
      const parsed = updateUserSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid data", details: parsed.error.errors });
      }
      
      const { email, firstName, lastName, roleId } = parsed.data;
      
      // Check if new email is already in use
      if (email && email !== targetUser.email) {
        const existingUser = await storage.getUserByEmail(email);
        if (existingUser) {
          return res.status(400).json({ error: "Email already in use" });
        }
      }
      
      // Update user info
      const updatedUser = await storage.updateUser(targetUserId, {
        email,
        firstName,
        lastName: lastName ?? undefined,
      });
      
      // Update role if provided (replace existing roles)
      if (roleId !== undefined) {
        // Remove all existing roles
        const existingRoles = await storage.getUserRoles(targetUserId);
        for (const role of existingRoles) {
          await storage.removeRole(targetUserId, role.id);
        }
        // Assign new role
        if (roleId > 0) {
          await storage.assignRole(targetUserId, roleId, req.user!.id);
        }
      }
      
      res.json(updatedUser);
    } catch (error) {
      console.error("Update user error:", error);
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  // Reset user password (admin only)
  app.post("/api/users/:userId/reset-password", isAuthenticated, requirePermission("users:assign_role"), async (req, res) => {
    try {
      const targetUserId = req.params.userId;
      
      // Check if target user exists
      const targetUser = await storage.getUser(targetUserId);
      if (!targetUser) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Cannot reset super admin password unless you are the super admin
      if (targetUser.isSuperAdmin && !req.user!.isSuperAdmin) {
        return res.status(403).json({ error: "Cannot reset super admin password" });
      }
      
      const parsed = resetPasswordSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid password", details: parsed.error.errors });
      }
      
      const hashedPassword = await hashPassword(parsed.data.password);
      const success = await storage.updateUserPassword(targetUserId, hashedPassword);
      
      if (!success) {
        return res.status(500).json({ error: "Failed to reset password" });
      }
      
      res.json({ message: "Password reset successfully" });
    } catch (error) {
      console.error("Reset password error:", error);
      res.status(500).json({ error: "Failed to reset password" });
    }
  });

  // Delete user (admin only)
  app.delete("/api/users/:userId", isAuthenticated, requirePermission("users:delete"), async (req, res) => {
    try {
      const targetUserId = req.params.userId;
      
      // Cannot delete yourself
      if (targetUserId === req.user!.id) {
        return res.status(400).json({ error: "Cannot delete yourself" });
      }
      
      // Check if target user exists
      const targetUser = await storage.getUser(targetUserId);
      if (!targetUser) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Cannot delete super admin
      if (targetUser.isSuperAdmin) {
        return res.status(403).json({ error: "Cannot delete super admin" });
      }
      
      const success = await storage.deleteUser(targetUserId);
      if (!success) {
        return res.status(404).json({ error: "User not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete user" });
    }
  });

  // ============ JOBS ============
  
  // Get all jobs
  app.get("/api/jobs", isAuthenticated, requirePermission("jobs:read"), async (req, res) => {
    try {
      const jobs = await storage.getJobs();
      res.json(jobs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch jobs" });
    }
  });

  // Get single job
  app.get("/api/jobs/:id", isAuthenticated, requirePermission("jobs:read"), async (req, res) => {
    try {
      const job = await storage.getJob(req.params.id);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      res.json(job);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch job" });
    }
  });

  // Create job
  app.post("/api/jobs", isAuthenticated, requirePermission("jobs:create"), async (req, res) => {
    try {
      const parsed = insertJobSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.message });
      }
      const job = await storage.createJob(parsed.data);
      res.status(201).json(job);
    } catch (error) {
      res.status(500).json({ error: "Failed to create job" });
    }
  });

  // Update job
  app.patch("/api/jobs/:id", isAuthenticated, requirePermission("jobs:edit"), async (req, res) => {
    try {
      const job = await storage.updateJob(req.params.id, req.body);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      res.json(job);
    } catch (error) {
      res.status(500).json({ error: "Failed to update job" });
    }
  });

  // Delete job
  app.delete("/api/jobs/:id", isAuthenticated, requirePermission("jobs:delete"), async (req, res) => {
    try {
      const success = await storage.deleteJob(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Job not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete job" });
    }
  });

  // Run job manually
  app.post("/api/jobs/:id/run", isAuthenticated, requirePermission("jobs:run"), async (req, res) => {
    try {
      const job = await storage.getJob(req.params.id);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      const execution = await storage.runJobNow(req.params.id);
      res.json(execution);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to run job";
      res.status(500).json({ error: message });
    }
  });

  // Get all executions
  app.get("/api/executions", isAuthenticated, requirePermission("history:read"), async (req, res) => {
    try {
      const executions = await storage.getExecutions();
      res.json(executions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch executions" });
    }
  });

  // Get executions for a job
  app.get("/api/jobs/:id/executions", isAuthenticated, requirePermission("history:read"), async (req, res) => {
    try {
      const executions = await storage.getExecutionsByJob(req.params.id);
      res.json(executions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch executions" });
    }
  });

  // Get stats
  app.get("/api/stats", isAuthenticated, requirePermission("jobs:read"), async (req, res) => {
    try {
      const stats = await storage.getStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  // ============ WORKFLOWS ============

  // Get all workflows
  app.get("/api/workflows", isAuthenticated, requirePermission("workflows:read"), async (req, res) => {
    try {
      const workflows = await storage.getWorkflows();
      res.json(workflows);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch workflows" });
    }
  });

  // Get single workflow with steps
  app.get("/api/workflows/:id", isAuthenticated, requirePermission("workflows:read"), async (req, res) => {
    try {
      const data = await storage.getWorkflowWithSteps(parseInt(req.params.id));
      if (!data) {
        return res.status(404).json({ error: "Workflow not found" });
      }
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch workflow" });
    }
  });

  // Create workflow
  app.post("/api/workflows", isAuthenticated, requirePermission("workflows:create"), async (req, res) => {
    try {
      const parsed = createWorkflowRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.message });
      }
      const { name, description, cronExpression, status, triggerType, steps } = parsed.data;
      const workflow = await storage.createWorkflow(
        { name, description, cronExpression, status, triggerType },
        steps
      );
      res.status(201).json(workflow);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create workflow";
      res.status(500).json({ error: message });
    }
  });

  // Update workflow
  app.patch("/api/workflows/:id", isAuthenticated, requirePermission("workflows:edit"), async (req, res) => {
    try {
      const parsed = updateWorkflowRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.message });
      }
      const { steps, ...data } = parsed.data;
      const workflow = await storage.updateWorkflow(parseInt(req.params.id), data, steps);
      if (!workflow) {
        return res.status(404).json({ error: "Workflow not found" });
      }
      res.json(workflow);
    } catch (error) {
      res.status(500).json({ error: "Failed to update workflow" });
    }
  });

  // Delete workflow
  app.delete("/api/workflows/:id", isAuthenticated, requirePermission("workflows:delete"), async (req, res) => {
    try {
      const success = await storage.deleteWorkflow(parseInt(req.params.id));
      if (!success) {
        return res.status(404).json({ error: "Workflow not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete workflow" });
    }
  });

  // Run workflow manually
  app.post("/api/workflows/:id/run", isAuthenticated, requirePermission("workflows:run"), async (req, res) => {
    try {
      const execution = await storage.runWorkflow(parseInt(req.params.id));
      res.json(execution);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to run workflow";
      res.status(500).json({ error: message });
    }
  });

  // Get workflow executions
  app.get("/api/workflows/:id/executions", isAuthenticated, requirePermission("history:read"), async (req, res) => {
    try {
      const executions = await storage.getWorkflowExecutions(parseInt(req.params.id));
      res.json(executions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch workflow executions" });
    }
  });

  // Get all workflow executions
  app.get("/api/workflow-executions", isAuthenticated, requirePermission("history:read"), async (req, res) => {
    try {
      const executions = await storage.getWorkflowExecutions();
      res.json(executions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch workflow executions" });
    }
  });

  // Generate webhook token for a workflow
  app.post("/api/workflows/:id/webhook-token", isAuthenticated, requirePermission("workflows:edit"), async (req, res) => {
    try {
      const workflowId = parseInt(req.params.id);
      const result = await storage.generateWorkflowWebhookToken(workflowId);
      if (!result) {
        return res.status(404).json({ error: "Workflow not found" });
      }
      res.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to generate webhook token";
      res.status(500).json({ error: message });
    }
  });

  // Revoke webhook token for a workflow
  app.delete("/api/workflows/:id/webhook-token", isAuthenticated, requirePermission("workflows:edit"), async (req, res) => {
    try {
      const workflowId = parseInt(req.params.id);
      const success = await storage.revokeWorkflowWebhookToken(workflowId);
      if (!success) {
        return res.status(404).json({ error: "Workflow not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to revoke webhook token" });
    }
  });

  // ============ WEBHOOK TRIGGERS (PUBLIC) ============
  
  // Trigger workflow via webhook (no auth required, uses token)
  app.post("/api/webhooks/:token", async (req, res) => {
    try {
      const { token } = req.params;
      const payload = req.body;
      
      const execution = await storage.runWorkflowByWebhookToken(token, payload);
      if (!execution) {
        return res.status(404).json({ error: "Invalid webhook token or workflow not found" });
      }
      
      res.json({ 
        success: true, 
        executionId: execution.id,
        status: execution.status 
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to trigger workflow";
      res.status(500).json({ error: message });
    }
  });

  // ============ NOTIFICATION TEMPLATES ============

  // Initialize SMTP on startup
  const initSmtp = async () => {
    const config = await storage.getSmtpConfig();
    if (config) {
      notificationService.configureSmtp(config);
    }
  };
  initSmtp().catch(console.error);

  // Get all templates
  app.get("/api/notification-templates", isAuthenticated, requirePermission("templates:read"), async (req, res) => {
    try {
      const templates = await storage.getNotificationTemplates();
      res.json(templates);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch templates" });
    }
  });

  // Get single template
  app.get("/api/notification-templates/:id", isAuthenticated, requirePermission("templates:read"), async (req, res) => {
    try {
      const template = await storage.getNotificationTemplate(parseInt(req.params.id));
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }
      res.json(template);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch template" });
    }
  });

  // Create template
  app.post("/api/notification-templates", isAuthenticated, requirePermission("templates:create"), async (req, res) => {
    try {
      const parsed = insertNotificationTemplateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid template data", details: parsed.error.errors });
      }
      const template = await storage.createNotificationTemplate(parsed.data, req.user!.id);
      await storage.createAuditLog({
        templateId: template.id,
        action: "template_created",
        userId: req.user!.id,
        details: { templateName: template.name },
      });
      res.status(201).json(template);
    } catch (error) {
      res.status(500).json({ error: "Failed to create template" });
    }
  });

  // Update template
  app.patch("/api/notification-templates/:id", isAuthenticated, requirePermission("templates:edit"), async (req, res) => {
    try {
      const parsed = updateNotificationTemplateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid template data", details: parsed.error.errors });
      }
      const template = await storage.updateNotificationTemplate(parseInt(req.params.id), parsed.data);
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }
      await storage.createAuditLog({
        templateId: template.id,
        action: "template_updated",
        userId: req.user!.id,
        details: { changes: Object.keys(parsed.data) },
      });
      res.json(template);
    } catch (error) {
      res.status(500).json({ error: "Failed to update template" });
    }
  });

  // Delete template
  app.delete("/api/notification-templates/:id", isAuthenticated, requirePermission("templates:delete"), async (req, res) => {
    try {
      const success = await storage.deleteNotificationTemplate(parseInt(req.params.id));
      if (!success) {
        return res.status(404).json({ error: "Template not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete template" });
    }
  });

  // Preview template
  app.post("/api/notification-templates/preview", isAuthenticated, requirePermission("templates:read"), async (req, res) => {
    try {
      const parsed = previewTemplateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid preview data", details: parsed.error.errors });
      }
      const result = notificationService.previewTemplate(
        parsed.data.content,
        parsed.data.subject,
        parsed.data.variables
      );
      res.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Template rendering failed";
      res.status(400).json({ error: message });
    }
  });

  // Extract variables from template
  app.post("/api/notification-templates/extract-variables", isAuthenticated, requirePermission("templates:read"), async (req, res) => {
    try {
      const { content } = req.body;
      if (!content || typeof content !== "string") {
        return res.status(400).json({ error: "Content is required" });
      }
      const variables = notificationService.extractTemplateVariables(content);
      res.json({ variables });
    } catch (error) {
      res.status(500).json({ error: "Failed to extract variables" });
    }
  });

  // Send test email with rendered template
  app.post("/api/notification-templates/send-test", isAuthenticated, requirePermission("notifications:send"), async (req, res) => {
    try {
      const { smtpConfigId, to, subject, content } = req.body;
      
      if (!smtpConfigId || !to || !subject || !content) {
        return res.status(400).json({ error: "Missing required fields: smtpConfigId, to, subject, content" });
      }
      
      // Get the SMTP config
      const smtpConfig = await storage.getSmtpConfig(smtpConfigId);
      if (!smtpConfig) {
        return res.status(404).json({ error: "SMTP configuration not found" });
      }
      
      // Send the email using the specific SMTP config
      const result = await notificationService.sendEmailWithConfig(smtpConfig, {
        to,
        subject,
        html: content,
      });
      
      if (result.success) {
        await storage.createAuditLog({
          action: "template_test_email_sent",
          userId: req.user!.id,
          details: { to, subject: subject.substring(0, 50) },
        });
        res.json({ success: true });
      } else {
        res.status(500).json({ success: false, error: result.error });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to send test email";
      res.status(500).json({ success: false, error: message });
    }
  });

  // Seed example notification templates
  app.post("/api/notification-templates/seed", isAuthenticated, requirePermission("templates:create"), async (req, res) => {
    try {
      const existingTemplates = await storage.getNotificationTemplates();
      if (existingTemplates.length > 0) {
        return res.status(400).json({ error: "Templates already exist. Delete existing templates first to seed examples." });
      }

      const exampleTemplates = [
        {
          name: "Job Success Notification",
          description: "Sent when a scheduled job completes successfully",
          channel: "email" as const,
          subject: "Job Completed: {{jobName}}",
          content: `<h2>Job Execution Successful</h2>
<p>Your scheduled job <strong>{{jobName}}</strong> has completed successfully.</p>
<ul>
  <li><strong>Execution Time:</strong> {{executionTime}}</li>
  <li><strong>Duration:</strong> {{duration}}ms</li>
  <li><strong>Status:</strong> Success</li>
</ul>
<p>View the full execution log in your dashboard.</p>`,
          variables: [{ name: "jobName", required: true }, { name: "executionTime", required: true }, { name: "duration", required: true }],
          status: "active" as const,
        },
        {
          name: "Job Failure Alert",
          description: "Urgent notification when a job fails",
          channel: "email" as const,
          subject: "ALERT: Job Failed - {{jobName}}",
          content: `<h2 style="color: #dc2626;">Job Execution Failed</h2>
<p>Your scheduled job <strong>{{jobName}}</strong> has failed to execute.</p>
<ul>
  <li><strong>Execution Time:</strong> {{executionTime}}</li>
  <li><strong>Error:</strong> {{errorMessage}}</li>
  <li><strong>Retry Attempts:</strong> {{retryCount}}</li>
</ul>
<p>Please check the execution logs and take appropriate action.</p>`,
          variables: [{ name: "jobName", required: true }, { name: "executionTime", required: true }, { name: "errorMessage", required: true }, { name: "retryCount", required: false }],
          status: "active" as const,
        },
        {
          name: "Welcome Email",
          description: "Sent to new users when they are added to the system",
          channel: "email" as const,
          subject: "Welcome to r4n - {{userName}}",
          content: `<h2>Welcome to r4n!</h2>
<p>Hello {{userName}},</p>
<p>Your account has been created successfully. You can now log in and start managing your scheduled jobs.</p>
<p><strong>Your Role:</strong> {{userRole}}</p>
<p>If you have any questions, please contact your administrator.</p>
<p>Best regards,<br>The r4n Team</p>`,
          variables: [{ name: "userName", required: true }, { name: "userRole", required: true }],
          status: "active" as const,
        },
        {
          name: "Daily Summary",
          description: "Daily digest of job execution statistics",
          channel: "email" as const,
          subject: "Daily Summary - {{date}}",
          content: `<h2>Daily Job Summary</h2>
<p>Here's your daily summary for {{date}}:</p>
<table style="border-collapse: collapse; width: 100%;">
  <tr>
    <td style="padding: 8px; border: 1px solid #ddd;"><strong>Total Jobs Run</strong></td>
    <td style="padding: 8px; border: 1px solid #ddd;">{{totalJobs}}</td>
  </tr>
  <tr>
    <td style="padding: 8px; border: 1px solid #ddd;"><strong>Successful</strong></td>
    <td style="padding: 8px; border: 1px solid #ddd; color: #16a34a;">{{successCount}}</td>
  </tr>
  <tr>
    <td style="padding: 8px; border: 1px solid #ddd;"><strong>Failed</strong></td>
    <td style="padding: 8px; border: 1px solid #ddd; color: #dc2626;">{{failureCount}}</td>
  </tr>
  <tr>
    <td style="padding: 8px; border: 1px solid #ddd;"><strong>Success Rate</strong></td>
    <td style="padding: 8px; border: 1px solid #ddd;">{{successRate}}%</td>
  </tr>
</table>`,
          variables: [{ name: "date", required: true }, { name: "totalJobs", required: true }, { name: "successCount", required: true }, { name: "failureCount", required: true }, { name: "successRate", required: true }],
          status: "active" as const,
        },
        {
          name: "In-App Job Alert",
          description: "In-app notification for job status changes",
          channel: "in_app" as const,
          subject: null,
          content: `Job "{{jobName}}" {{status}} at {{time}}. {{#if errorMessage}}Error: {{errorMessage}}{{/if}}`,
          variables: [{ name: "jobName", required: true }, { name: "status", required: true }, { name: "time", required: true }, { name: "errorMessage", required: false }],
          status: "active" as const,
        },
      ];

      const createdTemplates = [];
      for (const template of exampleTemplates) {
        // Use user.id (not email) for createdBy as it references users.id
        const created = await storage.createNotificationTemplate(template, req.user?.id);
        createdTemplates.push(created);
      }

      res.json({ message: `Created ${createdTemplates.length} example templates`, templates: createdTemplates });
    } catch (error: any) {
      console.error("Failed to seed templates:", error);
      res.status(500).json({ error: "Failed to seed templates", details: error?.message || String(error) });
    }
  });

  // ============ JOB TEMPLATES ============

  // Get all job templates (optionally filter by category)
  app.get("/api/job-templates", isAuthenticated, requirePermission("jobs:read"), async (req, res) => {
    try {
      const category = req.query.category as string | undefined;
      const templates = await storage.getJobTemplates(category);
      res.json(templates);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch job templates" });
    }
  });

  // Get single job template
  app.get("/api/job-templates/:id", isAuthenticated, requirePermission("jobs:read"), async (req, res) => {
    try {
      const template = await storage.getJobTemplate(parseInt(req.params.id));
      if (!template) {
        return res.status(404).json({ error: "Job template not found" });
      }
      res.json(template);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch job template" });
    }
  });

  // Create job template
  app.post("/api/job-templates", isAuthenticated, requirePermission("jobs:create"), async (req, res) => {
    try {
      // Strip protected fields that only the seed route can set
      const { isBuiltIn, usageCount, createdBy, ...userFields } = req.body;
      const data = { 
        ...userFields, 
        createdBy: req.user!.id,
        isBuiltIn: false, // User-created templates are never built-in
      };
      const parsed = insertJobTemplateSchema.safeParse(data);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid job template data", details: parsed.error.errors });
      }
      const template = await storage.createJobTemplate(parsed.data);
      res.json(template);
    } catch (error) {
      res.status(500).json({ error: "Failed to create job template" });
    }
  });

  // Update job template
  app.patch("/api/job-templates/:id", isAuthenticated, requirePermission("jobs:edit"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await storage.getJobTemplate(id);
      if (!existing) {
        return res.status(404).json({ error: "Job template not found" });
      }
      // Prevent editing built-in templates (users can create copies instead)
      if (existing.isBuiltIn) {
        return res.status(403).json({ error: "Built-in templates cannot be modified. Create a copy instead." });
      }
      // Strip protected fields that users cannot modify
      const { isBuiltIn, usageCount, createdBy, id: bodyId, createdAt, updatedAt, ...updateFields } = req.body;
      const template = await storage.updateJobTemplate(id, updateFields);
      res.json(template);
    } catch (error) {
      res.status(500).json({ error: "Failed to update job template" });
    }
  });

  // Delete job template
  app.delete("/api/job-templates/:id", isAuthenticated, requirePermission("jobs:delete"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await storage.getJobTemplate(id);
      if (!existing) {
        return res.status(404).json({ error: "Job template not found" });
      }
      // Prevent deleting built-in templates
      if (existing.isBuiltIn) {
        return res.status(403).json({ error: "Built-in templates cannot be deleted." });
      }
      await storage.deleteJobTemplate(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete job template" });
    }
  });

  // Create job from template
  app.post("/api/job-templates/:id/use", isAuthenticated, requirePermission("jobs:create"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const template = await storage.getJobTemplate(id);
      if (!template) {
        return res.status(404).json({ error: "Job template not found" });
      }
      
      // Create job from template with optional name override
      const { name } = req.body;
      const job = await storage.createJob({
        name: name || template.name,
        description: template.description || "",
        cronExpression: template.cronExpression,
        action: template.action as any,
        status: "active",
      });
      
      // Increment usage count
      await storage.incrementTemplateUsage(id);
      
      res.json(job);
    } catch (error) {
      res.status(500).json({ error: "Failed to create job from template" });
    }
  });

  // Seed built-in job templates
  app.post("/api/job-templates/seed", isAuthenticated, requirePermission("jobs:create"), async (req, res) => {
    try {
      const existingTemplates = await storage.getJobTemplates();
      const builtInExists = existingTemplates.some(t => t.isBuiltIn);
      if (builtInExists) {
        return res.status(400).json({ error: "Built-in templates already exist." });
      }

      const builtInTemplates = [
        {
          name: "Daily Health Check",
          description: "Performs a daily HTTP health check on your service endpoint",
          category: "monitoring",
          cronExpression: "0 9 * * *",
          action: { type: "http", url: "https://example.com/health", method: "GET" },
          icon: "activity",
          tags: ["health", "monitoring", "daily"],
          isBuiltIn: true,
        },
        {
          name: "Weekly Database Backup Trigger",
          description: "Triggers a weekly database backup via webhook",
          category: "backup",
          cronExpression: "0 2 * * 0",
          action: { type: "webhook", url: "https://example.com/backup/trigger", payload: { action: "backup", type: "full" } },
          icon: "database",
          tags: ["backup", "database", "weekly"],
          isBuiltIn: true,
        },
        {
          name: "Hourly Metrics Collection",
          description: "Collects system metrics every hour for monitoring",
          category: "monitoring",
          cronExpression: "0 * * * *",
          action: { type: "http", url: "https://example.com/metrics/collect", method: "POST" },
          icon: "bar-chart-2",
          tags: ["metrics", "monitoring", "hourly"],
          isBuiltIn: true,
        },
        {
          name: "Daily Report Generator",
          description: "Generates and sends daily reports at 8 AM",
          category: "reporting",
          cronExpression: "0 8 * * *",
          action: { type: "http", url: "https://example.com/reports/daily", method: "POST" },
          icon: "file-text",
          tags: ["reports", "daily", "automation"],
          isBuiltIn: true,
        },
        {
          name: "Cache Cleanup",
          description: "Clears expired cache entries every 6 hours",
          category: "maintenance",
          cronExpression: "0 */6 * * *",
          action: { type: "http", url: "https://example.com/cache/cleanup", method: "DELETE" },
          icon: "trash-2",
          tags: ["cache", "cleanup", "maintenance"],
          isBuiltIn: true,
        },
        {
          name: "API Heartbeat",
          description: "Pings API endpoint every 5 minutes to ensure uptime",
          category: "monitoring",
          cronExpression: "*/5 * * * *",
          action: { type: "http", url: "https://example.com/api/ping", method: "GET" },
          icon: "heart",
          tags: ["uptime", "heartbeat", "frequent"],
          isBuiltIn: true,
        },
        {
          name: "Monthly Cleanup",
          description: "Runs monthly maintenance tasks on the 1st at midnight",
          category: "maintenance",
          cronExpression: "0 0 1 * *",
          action: { type: "http", url: "https://example.com/maintenance/monthly", method: "POST" },
          icon: "calendar",
          tags: ["monthly", "cleanup", "maintenance"],
          isBuiltIn: true,
        },
        {
          name: "Slack Notification",
          description: "Sends a daily standup reminder to Slack",
          category: "notifications",
          cronExpression: "0 9 * * 1-5",
          action: { type: "webhook", url: "https://hooks.slack.com/services/xxx", payload: { text: "Daily standup reminder!" } },
          icon: "message-circle",
          tags: ["slack", "notifications", "reminder"],
          isBuiltIn: true,
        },
      ];

      const createdTemplates = [];
      for (const template of builtInTemplates) {
        const created = await storage.createJobTemplate(template);
        createdTemplates.push(created);
      }

      res.json({ message: `Created ${createdTemplates.length} built-in templates`, templates: createdTemplates });
    } catch (error: any) {
      console.error("Failed to seed job templates:", error);
      res.status(500).json({ error: "Failed to seed job templates", details: error?.message || String(error) });
    }
  });

  // ============ SMTP CONFIGURATION ============

  // Helper to mask password in SMTP config
  const maskSmtpPassword = (config: any) => {
    const { password, ...rest } = config;
    return { ...rest, password: password ? "********" : null };
  };

  // Get all SMTP configs
  app.get("/api/settings/smtp", isAuthenticated, requirePermission("smtp:read"), async (req, res) => {
    try {
      const configs = await storage.getSmtpConfigs();
      const safeConfigs = configs.map(maskSmtpPassword);
      res.json(safeConfigs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch SMTP configs" });
    }
  });

  // Get single SMTP config by ID
  app.get("/api/settings/smtp/:id", isAuthenticated, requirePermission("smtp:read"), async (req, res) => {
    try {
      const config = await storage.getSmtpConfig(parseInt(req.params.id));
      if (!config) {
        return res.status(404).json({ error: "SMTP configuration not found" });
      }
      res.json(maskSmtpPassword(config));
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch SMTP config" });
    }
  });

  // Create new SMTP config
  app.post("/api/settings/smtp", isAuthenticated, requirePermission("smtp:manage"), async (req, res) => {
    try {
      const { password, ...otherFields } = req.body;
      
      // New config requires a real password (not placeholder)
      const isPlaceholder = password === "********";
      const isEmptyOrMissing = !password || password.trim() === "";
      if (isEmptyOrMissing || isPlaceholder) {
        return res.status(400).json({ error: "A valid password is required for new SMTP configuration" });
      }
      
      const finalData = { ...otherFields, password };
      const parsed = insertSmtpConfigSchema.safeParse(finalData);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid SMTP config", details: parsed.error.errors });
      }
      
      const config = await storage.createSmtpConfig(parsed.data);
      
      // If this is set as default, configure it
      if (config.isDefault) {
        notificationService.configureSmtp(config);
      }
      
      await storage.createAuditLog({
        action: "smtp_created",
        userId: req.user!.id,
        details: { name: config.name, host: config.host, port: config.port },
      });
      
      res.json(maskSmtpPassword(config));
    } catch (error) {
      res.status(500).json({ error: "Failed to create SMTP config" });
    }
  });

  // Update SMTP config
  app.patch("/api/settings/smtp/:id", isAuthenticated, requirePermission("smtp:manage"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const existingConfig = await storage.getSmtpConfig(id);
      if (!existingConfig) {
        return res.status(404).json({ error: "SMTP configuration not found" });
      }
      
      const { password, ...otherFields } = req.body;
      let finalData = { ...otherFields };
      
      // Only include password if it's a new non-empty value
      const hasNewPassword = password && password !== "********" && password.trim() !== "";
      if (hasNewPassword) {
        finalData.password = password;
      }
      // Otherwise, password is not included in update, keeping existing
      
      const config = await storage.updateSmtpConfig(id, finalData);
      if (!config) {
        return res.status(404).json({ error: "SMTP configuration not found" });
      }
      
      // If this is default, reconfigure the notification service
      if (config.isDefault) {
        notificationService.configureSmtp(config);
      }
      
      await storage.createAuditLog({
        action: "smtp_updated",
        userId: req.user!.id,
        details: { name: config.name, host: config.host, port: config.port },
      });
      
      res.json(maskSmtpPassword(config));
    } catch (error) {
      res.status(500).json({ error: "Failed to update SMTP config" });
    }
  });

  // Set SMTP config as default
  app.post("/api/settings/smtp/:id/set-default", isAuthenticated, requirePermission("smtp:manage"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const config = await storage.setDefaultSmtpConfig(id);
      if (!config) {
        return res.status(404).json({ error: "SMTP configuration not found" });
      }
      
      // Configure notification service with new default
      notificationService.configureSmtp(config);
      
      await storage.createAuditLog({
        action: "smtp_set_default",
        userId: req.user!.id,
        details: { name: config.name, id: config.id },
      });
      
      res.json(maskSmtpPassword(config));
    } catch (error) {
      res.status(500).json({ error: "Failed to set default SMTP config" });
    }
  });

  // Delete SMTP config
  app.delete("/api/settings/smtp/:id", isAuthenticated, requirePermission("smtp:manage"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const config = await storage.getSmtpConfig(id);
      if (!config) {
        return res.status(404).json({ error: "SMTP configuration not found" });
      }
      
      const wasDefault = config.isDefault;
      const deleted = await storage.deleteSmtpConfig(id);
      if (!deleted) {
        return res.status(500).json({ error: "Failed to delete SMTP config" });
      }
      
      // If we deleted the default config, reconfigure with new default or clear
      if (wasDefault) {
        const newDefault = await storage.getDefaultSmtpConfig();
        if (newDefault) {
          notificationService.configureSmtp(newDefault);
        } else {
          // No configs left, clear SMTP configuration
          notificationService.clearSmtp();
        }
      }
      
      await storage.createAuditLog({
        action: "smtp_deleted",
        userId: req.user!.id,
        details: { name: config.name, host: config.host },
      });
      
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete SMTP config" });
    }
  });

  // Test SMTP connection (uses stored credentials for specific config)
  app.post("/api/settings/smtp/:id/test", isAuthenticated, requirePermission("smtp:manage"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const storedConfig = await storage.getSmtpConfig(id);
      if (!storedConfig) {
        return res.status(404).json({ success: false, error: "SMTP configuration not found" });
      }
      
      // Configure and test
      notificationService.configureSmtp(storedConfig);
      const result = await notificationService.testSmtpConnection();
      
      // Update test result in database
      await storage.updateSmtpTestResult(id, result.success);
      
      res.json(result);
    } catch (error) {
      res.status(500).json({ success: false, error: "SMTP test failed" });
    }
  });

  // Send test email (uses specific config)
  app.post("/api/settings/smtp/:id/send-test", isAuthenticated, requirePermission("smtp:manage"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const storedConfig = await storage.getSmtpConfig(id);
      if (!storedConfig) {
        return res.status(404).json({ success: false, error: "SMTP configuration not found" });
      }
      
      notificationService.configureSmtp(storedConfig);

      const { email } = req.body;
      if (!email || typeof email !== "string") {
        return res.status(400).json({ error: "Email address is required" });
      }

      const notification = await storage.createNotification({
        channel: "email",
        recipientEmail: email,
        subject: `Test Email from r4n (${storedConfig.name})`,
        content: `<h2>Test Email</h2><p>This is a test email from your SMTP configuration: <strong>${storedConfig.name}</strong>.</p><p>If you received this, your email settings are working correctly!</p>`,
        status: "pending",
      });

      const result = await notificationService.deliverNotification(notification);
      await storage.updateNotificationStatus(notification.id, result.status, result.error);
      
      // Return error status if delivery failed
      if (!result.success) {
        return res.status(400).json(result);
      }
      res.json(result);
    } catch (error) {
      res.status(500).json({ success: false, error: "Failed to send test email" });
    }
  });

  // ============ NOTIFICATIONS ============

  // Get notifications for current user
  app.get("/api/notifications", isAuthenticated, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const notifications = await storage.getNotifications(req.user!.id, limit);
      res.json(notifications);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch notifications" });
    }
  });

  // Get unread notification count
  app.get("/api/notifications/unread-count", isAuthenticated, async (req, res) => {
    try {
      const count = await storage.getUnreadNotificationCount(req.user!.id);
      res.json({ count });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch notification count" });
    }
  });

  // Mark notification as read
  app.post("/api/notifications/:id/read", isAuthenticated, async (req, res) => {
    try {
      const notification = await storage.getNotification(parseInt(req.params.id));
      if (!notification) {
        return res.status(404).json({ error: "Notification not found" });
      }
      if (notification.recipientId !== req.user!.id) {
        return res.status(403).json({ error: "Access denied" });
      }
      const updated = await storage.markNotificationRead(notification.id);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to mark notification as read" });
    }
  });

  // Send notification
  app.post("/api/notifications/send", isAuthenticated, requirePermission("notifications:send"), async (req, res) => {
    try {
      const parsed = sendNotificationSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid notification data", details: parsed.error.errors });
      }

      const { templateId, channel, recipientId, recipientEmail, subject, content, variables, scheduledFor } = parsed.data;

      let finalSubject = subject;
      let finalContent = content || "";
      let finalChannel = channel;

      if (templateId) {
        const template = await storage.getNotificationTemplate(templateId);
        if (!template) {
          return res.status(404).json({ error: "Template not found" });
        }
        const rendered = notificationService.renderTemplate(template, variables || {});
        finalSubject = rendered.subject || subject;
        finalContent = rendered.content;
        finalChannel = template.channel as typeof channel;
      }

      if (!finalChannel) {
        return res.status(400).json({ error: "Channel is required" });
      }
      if (!finalContent) {
        return res.status(400).json({ error: "Content is required" });
      }

      const notification = await storage.createNotification({
        templateId: templateId || null,
        channel: finalChannel,
        recipientId: recipientId || null,
        recipientEmail: recipientEmail || null,
        subject: finalSubject || null,
        content: finalContent,
        variables: variables || {},
        status: scheduledFor ? "pending" : "pending",
        scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
      });

      await storage.createAuditLog({
        notificationId: notification.id,
        templateId: templateId || null,
        action: "notification_created",
        userId: req.user!.id,
        details: { channel: finalChannel, recipientEmail, recipientId },
      });

      if (!scheduledFor) {
        const result = await notificationService.deliverNotification(notification);
        await storage.updateNotificationStatus(notification.id, result.status, result.error);
        
        await storage.createAuditLog({
          notificationId: notification.id,
          action: result.success ? "notification_sent" : "notification_failed",
          userId: req.user!.id,
          details: { error: result.error },
        });

        res.json({ notification, delivery: result });
      } else {
        res.json({ notification, delivery: { status: "scheduled" } });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to send notification";
      res.status(500).json({ error: message });
    }
  });

  // Get all notifications (admin)
  app.get("/api/notifications/all", isAuthenticated, requirePermission("notifications:manage"), async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const notifications = await storage.getNotifications(undefined, limit);
      res.json(notifications);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch notifications" });
    }
  });

  // Get notification audit logs
  app.get("/api/notification-audit-logs", isAuthenticated, requirePermission("notifications:manage"), async (req, res) => {
    try {
      const notificationId = req.query.notificationId ? parseInt(req.query.notificationId as string) : undefined;
      const templateId = req.query.templateId ? parseInt(req.query.templateId as string) : undefined;
      const logs = await storage.getAuditLogs({ notificationId, templateId });
      res.json(logs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch audit logs" });
    }
  });

  // ============ CAMPAIGN ROUTES ============

  // Get all campaigns
  app.get("/api/campaigns", isAuthenticated, requirePermission("campaigns:read"), async (req, res) => {
    try {
      const status = req.query.status as string | undefined;
      const campaignsList = await storage.getCampaigns(status);
      res.json(campaignsList);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch campaigns" });
    }
  });

  // Get single campaign with details
  app.get("/api/campaigns/:id", isAuthenticated, requirePermission("campaigns:read"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const details = await storage.getCampaignWithDetails(id);
      if (!details) {
        return res.status(404).json({ error: "Campaign not found" });
      }
      const stats = await storage.getCampaignStats(id);
      res.json({ ...details, stats });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch campaign" });
    }
  });

  // Create campaign
  app.post("/api/campaigns", isAuthenticated, requirePermission("campaigns:create"), async (req, res) => {
    try {
      const parsed = insertCampaignSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid campaign data", details: parsed.error.errors });
      }
      const campaign = await storage.createCampaign({
        ...parsed.data,
        createdBy: req.user!.id,
      });
      res.status(201).json(campaign);
    } catch (error) {
      res.status(500).json({ error: "Failed to create campaign" });
    }
  });

  // Update campaign
  app.patch("/api/campaigns/:id", isAuthenticated, requirePermission("campaigns:edit"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await storage.getCampaign(id);
      if (!existing) {
        return res.status(404).json({ error: "Campaign not found" });
      }
      if (existing.status === "running") {
        return res.status(400).json({ error: "Cannot edit a running campaign" });
      }
      const updated = await storage.updateCampaign(id, req.body);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update campaign" });
    }
  });

  // Delete campaign
  app.delete("/api/campaigns/:id", isAuthenticated, requirePermission("campaigns:delete"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await storage.getCampaign(id);
      if (!existing) {
        return res.status(404).json({ error: "Campaign not found" });
      }
      if (existing.status === "running") {
        return res.status(400).json({ error: "Cannot delete a running campaign" });
      }
      await storage.deleteCampaign(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete campaign" });
    }
  });

  // Launch campaign
  app.post("/api/campaigns/:id/launch", isAuthenticated, requirePermission("campaigns:send"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const campaign = await storage.getCampaign(id);
      if (!campaign) {
        return res.status(404).json({ error: "Campaign not found" });
      }
      if (campaign.status === "running") {
        return res.status(400).json({ error: "Campaign is already running" });
      }
      const updated = await storage.updateCampaignStatus(id, "running");
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to launch campaign" });
    }
  });

  // Pause campaign
  app.post("/api/campaigns/:id/pause", isAuthenticated, requirePermission("campaigns:send"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const campaign = await storage.getCampaign(id);
      if (!campaign) {
        return res.status(404).json({ error: "Campaign not found" });
      }
      if (campaign.status !== "running") {
        return res.status(400).json({ error: "Campaign is not running" });
      }
      const updated = await storage.updateCampaignStatus(id, "paused");
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to pause campaign" });
    }
  });

  // Cancel campaign
  app.post("/api/campaigns/:id/cancel", isAuthenticated, requirePermission("campaigns:send"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const campaign = await storage.getCampaign(id);
      if (!campaign) {
        return res.status(404).json({ error: "Campaign not found" });
      }
      const updated = await storage.updateCampaignStatus(id, "cancelled");
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to cancel campaign" });
    }
  });

  // ============ CAMPAIGN AUDIENCE ROUTES ============

  // Get campaign audiences
  app.get("/api/campaigns/:id/audiences", isAuthenticated, requirePermission("campaigns:read"), async (req, res) => {
    try {
      const campaignId = parseInt(req.params.id);
      const audiences = await storage.getCampaignAudiences(campaignId);
      res.json(audiences);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch audiences" });
    }
  });

  // Add audience to campaign
  app.post("/api/campaigns/:id/audiences", isAuthenticated, requirePermission("campaigns:edit"), async (req, res) => {
    try {
      const campaignId = parseInt(req.params.id);
      const parsed = insertCampaignAudienceSchema.safeParse({ ...req.body, campaignId });
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid audience data", details: parsed.error.errors });
      }
      const audience = await storage.createCampaignAudience(parsed.data);
      res.status(201).json(audience);
    } catch (error) {
      res.status(500).json({ error: "Failed to add audience" });
    }
  });

  // Delete audience
  app.delete("/api/campaign-audiences/:id", isAuthenticated, requirePermission("campaigns:edit"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteCampaignAudience(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete audience" });
    }
  });

  // Add members to audience
  app.post("/api/campaign-audiences/:id/members", isAuthenticated, requirePermission("campaigns:edit"), async (req, res) => {
    try {
      const audienceId = parseInt(req.params.id);
      const members = req.body.members || [];
      const added = await storage.addAudienceMembers(audienceId, members);
      res.status(201).json(added);
    } catch (error) {
      res.status(500).json({ error: "Failed to add members" });
    }
  });

  // Get audience members
  app.get("/api/campaign-audiences/:id/members", isAuthenticated, requirePermission("campaigns:read"), async (req, res) => {
    try {
      const audienceId = parseInt(req.params.id);
      const members = await storage.getAudienceMembers(audienceId);
      res.json(members);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch members" });
    }
  });

  // ============ CAMPAIGN STEP ROUTES ============

  // Get campaign steps
  app.get("/api/campaigns/:id/steps", isAuthenticated, requirePermission("campaigns:read"), async (req, res) => {
    try {
      const campaignId = parseInt(req.params.id);
      const steps = await storage.getCampaignSteps(campaignId);
      res.json(steps);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch steps" });
    }
  });

  // Add step to campaign
  app.post("/api/campaigns/:id/steps", isAuthenticated, requirePermission("campaigns:edit"), async (req, res) => {
    try {
      const campaignId = parseInt(req.params.id);
      const parsed = insertCampaignStepSchema.safeParse({ ...req.body, campaignId });
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid step data", details: parsed.error.errors });
      }
      const step = await storage.createCampaignStep(parsed.data);
      res.status(201).json(step);
    } catch (error) {
      res.status(500).json({ error: "Failed to add step" });
    }
  });

  // Update step
  app.patch("/api/campaign-steps/:id", isAuthenticated, requirePermission("campaigns:edit"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updated = await storage.updateCampaignStep(id, req.body);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update step" });
    }
  });

  // Delete step
  app.delete("/api/campaign-steps/:id", isAuthenticated, requirePermission("campaigns:edit"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteCampaignStep(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete step" });
    }
  });

  // Reorder steps
  app.post("/api/campaigns/:id/steps/reorder", isAuthenticated, requirePermission("campaigns:edit"), async (req, res) => {
    try {
      const campaignId = parseInt(req.params.id);
      const { stepIds } = req.body;
      await storage.reorderCampaignSteps(campaignId, stepIds);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to reorder steps" });
    }
  });

  // ============ CAMPAIGN RUN ROUTES ============

  // Get campaign runs
  app.get("/api/campaigns/:id/runs", isAuthenticated, requirePermission("campaigns:read"), async (req, res) => {
    try {
      const campaignId = parseInt(req.params.id);
      const runs = await storage.getCampaignRuns(campaignId);
      res.json(runs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch runs" });
    }
  });

  // Get run details
  app.get("/api/campaign-runs/:id", isAuthenticated, requirePermission("campaigns:read"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const run = await storage.getCampaignRun(id);
      if (!run) {
        return res.status(404).json({ error: "Run not found" });
      }
      const recipients = await storage.getCampaignRecipients(id);
      res.json({ run, recipients });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch run details" });
    }
  });

  // Get campaign stats
  app.get("/api/campaigns/:id/stats", isAuthenticated, requirePermission("campaigns:read"), async (req, res) => {
    try {
      const campaignId = parseInt(req.params.id);
      const stats = await storage.getCampaignStats(campaignId);
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  // Seed sample campaigns
  app.post("/api/campaigns/seed", isAuthenticated, requirePermission("campaigns:create"), async (req, res) => {
    try {
      const existingCampaigns = await storage.getCampaigns();
      if (existingCampaigns.length > 0) {
        return res.status(400).json({ error: "Campaigns already exist. Delete existing campaigns first to seed samples." });
      }

      const sampleCampaigns = [
        {
          name: "Welcome Series",
          description: "Onboarding email sequence for new users",
          scheduleType: "manual" as const,
          status: "draft" as const,
          throttleLimit: 100,
          throttleInterval: 3600,
        },
        {
          name: "Weekly Newsletter",
          description: "Weekly product updates and tips",
          scheduleType: "recurring" as const,
          cronExpression: "0 9 * * 1",
          status: "draft" as const,
          throttleLimit: 500,
          throttleInterval: 3600,
        },
        {
          name: "Holiday Promo",
          description: "Special holiday promotional campaign",
          scheduleType: "one_time" as const,
          scheduledAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          status: "draft" as const,
          throttleLimit: 1000,
          throttleInterval: 3600,
        },
      ];

      const createdCampaigns = [];
      for (const campaignData of sampleCampaigns) {
        const campaign = await storage.createCampaign({
          ...campaignData,
          createdBy: req.user!.id,
        });

        await storage.createCampaignAudience({
          campaignId: campaign.id,
          name: "All Users",
          type: "all_users",
        });

        await storage.createCampaignStep({
          campaignId: campaign.id,
          stepOrder: 1,
          name: "Initial Email",
          channel: "email",
          customSubject: `${campaign.name} - Welcome`,
          customContent: `<h2>Welcome to ${campaign.name}</h2><p>Thank you for joining us!</p>`,
          delayMinutes: 0,
          isActive: true,
        });

        createdCampaigns.push(campaign);
      }

      res.json({ message: `Created ${createdCampaigns.length} sample campaigns`, campaigns: createdCampaigns });
    } catch (error: any) {
      console.error("Failed to seed campaigns:", error);
      res.status(500).json({ error: "Failed to seed campaigns", details: error?.message || String(error) });
    }
  });

  // ============ DEEPLINK DOMAIN ROUTES ============

  // Get all deeplink domains
  app.get("/api/deeplink-domains", isAuthenticated, requirePermission("jobs:read"), async (req, res) => {
    try {
      const domains = await storage.getDeeplinkDomains();
      res.json(domains);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch domains" });
    }
  });

  // Get single domain
  app.get("/api/deeplink-domains/:id", isAuthenticated, requirePermission("jobs:read"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const domain = await storage.getDeeplinkDomain(id);
      if (!domain) {
        return res.status(404).json({ error: "Domain not found" });
      }
      res.json(domain);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch domain" });
    }
  });

  // Create domain
  app.post("/api/deeplink-domains", isAuthenticated, requirePermission("jobs:create"), async (req, res) => {
    try {
      const domain = await storage.createDeeplinkDomain({
        ...req.body,
        createdBy: req.user!.id,
      });
      res.status(201).json(domain);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to create domain", details: error?.message });
    }
  });

  // Update domain
  app.patch("/api/deeplink-domains/:id", isAuthenticated, requirePermission("jobs:edit"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const domain = await storage.updateDeeplinkDomain(id, req.body);
      if (!domain) {
        return res.status(404).json({ error: "Domain not found" });
      }
      res.json(domain);
    } catch (error) {
      res.status(500).json({ error: "Failed to update domain" });
    }
  });

  // Delete domain
  app.delete("/api/deeplink-domains/:id", isAuthenticated, requirePermission("jobs:delete"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteDeeplinkDomain(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete domain" });
    }
  });

  // Verify domain with DNS TXT record check
  app.post("/api/deeplink-domains/:id/verify", isAuthenticated, requirePermission("jobs:edit"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Get the domain record first
      const domainRecord = await storage.getDeeplinkDomain(id);
      if (!domainRecord) {
        return res.status(404).json({ error: "Domain not found" });
      }
      
      if (domainRecord.isVerified) {
        return res.json(domainRecord);
      }
      
      if (!domainRecord.verificationToken) {
        return res.status(400).json({ error: "No verification token found for this domain" });
      }
      
      // Perform DNS TXT record lookup
      const dns = await import("dns").then(m => m.promises);
      const verifyHost = `_verify.${domainRecord.domain}`;
      
      try {
        const txtRecords = await dns.resolveTxt(verifyHost);
        // txtRecords is a 2D array where each inner array contains chunks of a single TXT record
        // Join each record's chunks together to reconstruct the full value
        const allTxtValues = txtRecords.map(chunks => chunks.join("").trim());
        
        // Check if any TXT record matches the verification token
        const tokenMatches = allTxtValues.some(val => val === domainRecord.verificationToken);
        
        if (!tokenMatches) {
          return res.status(400).json({ 
            error: "Verification failed", 
            message: `TXT record found but doesn't match the expected verification token. Please ensure the exact token value is set.`,
            recordCount: allTxtValues.length
          });
        }
        
        // Mark domain as verified
        const verifiedDomain = await storage.verifyDeeplinkDomain(id);
        res.json(verifiedDomain);
        
      } catch (dnsError: any) {
        if (dnsError.code === "ENOTFOUND" || dnsError.code === "ENODATA") {
          return res.status(400).json({ 
            error: "Verification failed", 
            message: `No TXT record found at ${verifyHost}. Please add the DNS TXT record and wait for propagation (may take up to 48 hours).`,
            expectedRecord: `${verifyHost} = ${domainRecord.verificationToken}`
          });
        }
        throw dnsError;
      }
      
    } catch (error: any) {
      console.error("Domain verification error:", error);
      res.status(500).json({ error: "Failed to verify domain", details: error?.message });
    }
  });

  // Set primary domain
  app.post("/api/deeplink-domains/:id/set-primary", isAuthenticated, requirePermission("jobs:edit"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const domain = await storage.setPrimaryDeeplinkDomain(id);
      if (!domain) {
        return res.status(404).json({ error: "Domain not found" });
      }
      res.json(domain);
    } catch (error) {
      res.status(500).json({ error: "Failed to set primary domain" });
    }
  });

  // ============ DEEPLINK ROUTES ============

  // Get all deeplinks
  app.get("/api/deeplinks", isAuthenticated, requirePermission("jobs:read"), async (req, res) => {
    try {
      const campaignId = req.query.campaignId ? parseInt(req.query.campaignId as string) : undefined;
      const links = await storage.getDeeplinks(campaignId);
      res.json(links);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch deeplinks" });
    }
  });

  // Get single deeplink
  app.get("/api/deeplinks/:id", isAuthenticated, requirePermission("jobs:read"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const link = await storage.getDeeplink(id);
      if (!link) {
        return res.status(404).json({ error: "Deeplink not found" });
      }
      res.json(link);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch deeplink" });
    }
  });

  // Create deeplink
  app.post("/api/deeplinks", isAuthenticated, requirePermission("jobs:create"), async (req, res) => {
    try {
      const link = await storage.createDeeplink({
        ...req.body,
        createdBy: req.user!.id,
      });
      res.status(201).json(link);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to create deeplink", details: error?.message });
    }
  });

  // Update deeplink
  app.patch("/api/deeplinks/:id", isAuthenticated, requirePermission("jobs:edit"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const link = await storage.updateDeeplink(id, req.body);
      if (!link) {
        return res.status(404).json({ error: "Deeplink not found" });
      }
      res.json(link);
    } catch (error) {
      res.status(500).json({ error: "Failed to update deeplink" });
    }
  });

  // Delete deeplink
  app.delete("/api/deeplinks/:id", isAuthenticated, requirePermission("jobs:delete"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteDeeplink(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete deeplink" });
    }
  });

  // Get deeplink stats
  app.get("/api/deeplinks/:id/stats", isAuthenticated, requirePermission("jobs:read"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const stats = await storage.getDeeplinkStats(id);
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  // Get deeplink clicks
  app.get("/api/deeplinks/:id/clicks", isAuthenticated, requirePermission("jobs:read"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const clicks = await storage.getDeeplinkClicks(id, limit);
      res.json(clicks);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch clicks" });
    }
  });

  // ============ EMAIL TEMPLATES (Dynamic Templates) ============

  // Get all email templates
  app.get("/api/email-templates", isAuthenticated, requirePermission("email_templates:read"), async (req, res) => {
    try {
      const templates = await storage.getEmailTemplates();
      res.json(templates);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch email templates" });
    }
  });

  // Get single email template
  app.get("/api/email-templates/:id", isAuthenticated, requirePermission("email_templates:read"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const template = await storage.getEmailTemplate(id);
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }
      res.json(template);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch email template" });
    }
  });

  // Create email template
  app.post("/api/email-templates", isAuthenticated, requirePermission("email_templates:create"), async (req, res) => {
    try {
      const userId = (req.user as any)?.id;
      const template = await storage.createEmailTemplate({
        ...req.body,
        createdBy: userId,
      });
      res.status(201).json(template);
    } catch (error) {
      console.error("Error creating email template:", error);
      res.status(500).json({ error: "Failed to create email template" });
    }
  });

  // Update email template
  app.patch("/api/email-templates/:id", isAuthenticated, requirePermission("email_templates:edit"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const template = await storage.updateEmailTemplate(id, req.body);
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }
      res.json(template);
    } catch (error) {
      res.status(500).json({ error: "Failed to update email template" });
    }
  });

  // Delete email template
  app.delete("/api/email-templates/:id", isAuthenticated, requirePermission("email_templates:delete"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteEmailTemplate(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete email template" });
    }
  });

  // ============ DEEPLINK REDIRECT (PUBLIC) ============

  // Handle deeplink redirect - no auth required
  app.get("/l/:shortCode", async (req, res) => {
    try {
      const { shortCode } = req.params;
      const link = await storage.getDeeplinkByShortCode(shortCode);
      
      if (!link) {
        return res.status(404).send("Link not found");
      }

      if (!link.isActive) {
        return res.status(410).send("This link is no longer active");
      }

      if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
        return res.status(410).send("This link has expired");
      }

      // Check for password protection
      if (link.password) {
        const providedPassword = req.query.p as string;
        if (!providedPassword || providedPassword !== link.password) {
          return res.status(401).send("Password required or incorrect");
        }
      }

      // Track click
      const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress || '';
      const userAgent = req.headers['user-agent'] || '';
      const referer = req.headers['referer'] || '';

      // Simple device detection
      let device = 'desktop';
      if (/mobile/i.test(userAgent)) device = 'mobile';
      else if (/tablet/i.test(userAgent)) device = 'tablet';

      // Simple browser detection
      let browser = 'unknown';
      if (/chrome/i.test(userAgent)) browser = 'chrome';
      else if (/firefox/i.test(userAgent)) browser = 'firefox';
      else if (/safari/i.test(userAgent)) browser = 'safari';
      else if (/edge/i.test(userAgent)) browser = 'edge';

      // Simple OS detection
      let os = 'unknown';
      if (/windows/i.test(userAgent)) os = 'windows';
      else if (/mac/i.test(userAgent)) os = 'macos';
      else if (/linux/i.test(userAgent)) os = 'linux';
      else if (/android/i.test(userAgent)) os = 'android';
      else if (/ios|iphone|ipad/i.test(userAgent)) os = 'ios';

      // Check if unique click (simple check based on IP within last 24h)
      const recentClicks = await storage.getDeeplinkClicks(link.id, 1000);
      const isUnique = !recentClicks.some(c => 
        c.ipAddress === ipAddress && 
        new Date(c.clickedAt).getTime() > Date.now() - 24 * 60 * 60 * 1000
      );

      await storage.createDeeplinkClick({
        deeplinkId: link.id,
        ipAddress,
        userAgent,
        referer,
        device,
        browser,
        os,
        isUnique,
      });

      await storage.incrementDeeplinkClick(link.id, isUnique);

      // Redirect
      res.redirect(302, link.destinationUrl);
    } catch (error) {
      console.error("Deeplink redirect error:", error);
      res.status(500).send("Server error");
    }
  });

  return httpServer;
}
