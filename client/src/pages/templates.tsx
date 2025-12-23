import { useLocation } from "wouter";
import { Globe, Webhook, Code, Clock, Database, Mail, Bell, FileJson } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const templates = [
  {
    id: "health-check",
    name: "Health Check",
    description: "Monitor endpoint availability with periodic HTTP requests",
    category: "Monitoring",
    icon: Globe,
    cronExpression: "*/5 * * * *",
    action: {
      type: "http_request" as const,
      url: "https://api.example.com/health",
      method: "GET" as const,
    },
  },
  {
    id: "daily-backup",
    name: "Daily Backup Trigger",
    description: "Trigger a backup webhook every day at midnight",
    category: "Data",
    icon: Database,
    cronExpression: "0 0 * * *",
    action: {
      type: "webhook" as const,
      url: "https://backup.example.com/trigger",
      payload: '{"type": "full"}',
    },
  },
  {
    id: "weekly-report",
    name: "Weekly Report",
    description: "Generate and send weekly analytics report",
    category: "Reports",
    icon: Mail,
    cronExpression: "0 9 * * 1",
    action: {
      type: "http_request" as const,
      url: "https://api.example.com/reports/weekly",
      method: "POST" as const,
    },
  },
  {
    id: "cache-clear",
    name: "Cache Cleaner",
    description: "Clear application cache every hour",
    category: "Maintenance",
    icon: Clock,
    cronExpression: "0 * * * *",
    action: {
      type: "http_request" as const,
      url: "https://api.example.com/cache/clear",
      method: "POST" as const,
    },
  },
  {
    id: "slack-reminder",
    name: "Team Reminder",
    description: "Send daily standup reminder to Slack",
    category: "Notifications",
    icon: Bell,
    cronExpression: "0 9 * * 1-5",
    action: {
      type: "webhook" as const,
      url: "https://hooks.slack.com/services/xxx",
      payload: '{"text": "Time for standup!"}',
    },
  },
  {
    id: "data-sync",
    name: "Data Synchronization",
    description: "Sync data between systems every 15 minutes",
    category: "Data",
    icon: FileJson,
    cronExpression: "*/15 * * * *",
    action: {
      type: "http_request" as const,
      url: "https://api.example.com/sync",
      method: "POST" as const,
    },
  },
  {
    id: "log-cleanup",
    name: "Log Cleanup Script",
    description: "Run cleanup script to archive old logs",
    category: "Maintenance",
    icon: Code,
    cronExpression: "0 2 * * 0",
    action: {
      type: "script" as const,
      code: 'console.log("Cleaning up logs...");',
      language: "javascript" as const,
    },
  },
  {
    id: "api-ping",
    name: "API Keepalive",
    description: "Ping API to prevent cold starts",
    category: "Monitoring",
    icon: Webhook,
    cronExpression: "*/10 * * * *",
    action: {
      type: "http_request" as const,
      url: "https://api.example.com/ping",
      method: "GET" as const,
    },
  },
];

const categoryColors: Record<string, string> = {
  Monitoring: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  Data: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
  Reports: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
  Maintenance: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20",
  Notifications: "bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20",
};

export default function Templates() {
  const [, navigate] = useLocation();

  const handleUseTemplate = (template: typeof templates[0]) => {
    const params = new URLSearchParams({
      template: JSON.stringify({
        name: template.name,
        description: template.description,
        cronExpression: template.cronExpression,
        action: template.action,
      }),
    });
    navigate(`/jobs/new?${params.toString()}`);
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Job Templates</h1>
        <p className="text-muted-foreground">
          Quick-start templates for common automation patterns
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {templates.map((template) => {
          const IconComponent = template.icon;
          return (
            <Card key={template.id} className="overflow-visible" data-testid={`template-${template.id}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="rounded-md bg-muted p-2">
                    <IconComponent className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <Badge variant="outline" className={categoryColors[template.category]}>
                    {template.category}
                  </Badge>
                </div>
                <CardTitle className="text-base mt-3">{template.name}</CardTitle>
                <CardDescription className="text-sm">
                  {template.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
                  <Clock className="h-3 w-3" />
                  <code className="font-mono bg-muted px-1.5 py-0.5 rounded">
                    {template.cronExpression}
                  </code>
                </div>
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={() => handleUseTemplate(template)}
                  data-testid={`button-use-template-${template.id}`}
                >
                  Use Template
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
