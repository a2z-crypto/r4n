import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Clock,
  History,
  Settings,
  FileCode,
  Plus,
  GitBranch,
  Users,
  LogOut,
  Mail,
  BookTemplate,
  Megaphone,
  Link2,
} from "lucide-react";
import r4nLogo from "@assets/generated_images/r4n_automation_platform_logo.png";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/use-auth";
import type { Permission } from "@shared/schema";

interface NavItem {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: Permission;
}

const navItems: NavItem[] = [
  {
    title: "Dashboard",
    url: "/",
    icon: LayoutDashboard,
    permission: "jobs:read",
  },
  {
    title: "Active Jobs",
    url: "/jobs",
    icon: Clock,
    permission: "jobs:read",
  },
  {
    title: "History",
    url: "/history",
    icon: History,
    permission: "history:read",
  },
  {
    title: "Job Templates",
    url: "/job-templates",
    icon: BookTemplate,
    permission: "jobs:read",
  },
  {
    title: "Notifications",
    url: "/notification-templates",
    icon: Mail,
    permission: "templates:read",
  },
  {
    title: "Dynamic Templates",
    url: "/dynamic-templates",
    icon: FileCode,
    permission: "email_templates:read",
  },
  {
    title: "Email Settings",
    url: "/smtp-settings",
    icon: Settings,
    permission: "smtp:read",
  },
  {
    title: "Workflows",
    url: "/workflows",
    icon: GitBranch,
    permission: "workflows:read",
  },
  {
    title: "Campaigns",
    url: "/campaigns",
    icon: Megaphone,
    permission: "campaigns:read",
  },
  {
    title: "Deeplinks",
    url: "/deeplinks",
    icon: Link2,
    permission: "jobs:read",
  },
  {
    title: "Users",
    url: "/users",
    icon: Users,
    permission: "users:read",
  },
  {
    title: "Settings",
    url: "/settings",
    icon: Settings,
    permission: "settings:read",
  },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { user, hasPermission, logout } = useAuth();

  const getInitials = (firstName?: string | null, lastName?: string | null, email?: string | null) => {
    if (firstName && lastName) {
      return `${firstName[0]}${lastName[0]}`.toUpperCase();
    }
    if (email) {
      return email[0].toUpperCase();
    }
    return "U";
  };

  const filteredNavItems = navItems.filter(item => {
    if (!item.permission) return true;
    return hasPermission(item.permission);
  });

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <Link href="/">
          <div className="flex items-center gap-2" data-testid="link-logo">
            <img src={r4nLogo} alt="r4n logo" className="h-8 w-8 rounded-md" />
            <span className="text-xl font-bold">r4n</span>
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url}
                  >
                    <Link href={item.url} data-testid={`link-nav-${item.title.toLowerCase().replace(/\s/g, "-")}`}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4 space-y-3">
        {hasPermission("jobs:create") && (
          <Link href="/jobs/new">
            <Button className="w-full gap-2" data-testid="button-create-job">
              <Plus className="h-4 w-4" />
              Create Job
            </Button>
          </Link>
        )}
        
        {user && (
          <div className="flex items-center justify-between gap-2 pt-2 border-t">
            <Link href="/profile" className="flex items-center gap-2 min-w-0 hover-elevate rounded-md p-1 -m-1 flex-1" data-testid="link-profile">
              <Avatar className="h-8 w-8">
                <AvatarImage src={user.profileImageUrl || undefined} />
                <AvatarFallback className="text-xs">
                  {getInitials(user.firstName, user.lastName, user.email)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="text-sm font-medium truncate" data-testid="text-user-display-name">
                  {user.firstName && user.lastName 
                    ? `${user.firstName} ${user.lastName}` 
                    : user.email || "User"}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {user.isSuperAdmin ? "super_admin" : (user.roles?.[0]?.name || "No role")}
                </div>
              </div>
            </Link>
            <Button
              size="icon"
              variant="ghost"
              onClick={logout}
              data-testid="button-logout"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
