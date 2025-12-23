import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import Dashboard from "@/pages/dashboard";
import Jobs from "@/pages/jobs";
import JobFormPage from "@/pages/job-form-page";
import History from "@/pages/history";
import Templates from "@/pages/templates";
import Workflows from "@/pages/workflows";
import Settings from "@/pages/settings";
import Users from "@/pages/users";
import Profile from "@/pages/profile";
import Setup from "@/pages/setup";
import Login from "@/pages/login";
import NotificationTemplates from "@/pages/notification-templates";
import SmtpSettings from "@/pages/smtp-settings";
import JobTemplates from "@/pages/job-templates";
import Campaigns from "@/pages/campaigns";
import CampaignFormPage from "@/pages/campaign-form-page";
import CampaignDetail from "@/pages/campaign-detail";
import Deeplinks from "@/pages/deeplinks";
import DynamicTemplates from "@/pages/dynamic-templates";
import EmailTemplateEditor from "@/pages/email-template-editor";
import NotFound from "@/pages/not-found";
import { useAuth, useSetupStatus } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/jobs" component={Jobs} />
      <Route path="/jobs/new" component={JobFormPage} />
      <Route path="/jobs/:id/edit" component={JobFormPage} />
      <Route path="/job-templates" component={JobTemplates} />
      <Route path="/history" component={History} />
      <Route path="/templates" component={Templates} />
      <Route path="/notification-templates" component={NotificationTemplates} />
      <Route path="/smtp-settings" component={SmtpSettings} />
      <Route path="/workflows" component={Workflows} />
      <Route path="/campaigns" component={Campaigns} />
      <Route path="/campaigns/new" component={CampaignFormPage} />
      <Route path="/campaigns/:id" component={CampaignDetail} />
      <Route path="/campaigns/:id/edit" component={CampaignFormPage} />
      <Route path="/deeplinks" component={Deeplinks} />
      <Route path="/dynamic-templates" component={DynamicTemplates} />
      <Route path="/dynamic-templates/:id" component={EmailTemplateEditor} />
      <Route path="/settings" component={Settings} />
      <Route path="/users" component={Users} />
      <Route path="/profile" component={Profile} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AuthenticatedApp() {
  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={sidebarStyle as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex h-14 items-center justify-between gap-4 border-b px-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <ThemeToggle />
          </header>
          <main className="flex-1 overflow-auto">
            <Router />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function AppContent() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { data: setupStatus, isLoading: setupLoading } = useSetupStatus();

  if (authLoading || setupLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // If no super admin exists, show setup page
  if (setupStatus?.needsSetup) {
    return <Setup />;
  }

  // If not authenticated but setup is done, show login page
  if (!isAuthenticated) {
    return <Login />;
  }

  // Authenticated user - show the app
  return <AuthenticatedApp />;
}

function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="cronmaster-theme">
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AppContent />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
