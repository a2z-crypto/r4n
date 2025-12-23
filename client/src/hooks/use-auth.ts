import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, getQueryFn, apiRequest } from "@/lib/queryClient";
import type { Permission } from "@shared/schema";

export interface AuthUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  isSuperAdmin: boolean;
  permissions: Permission[];
  roles: { id: number; name: string; description: string | null }[];
}

export interface SetupStatus {
  needsSetup: boolean;
}

export function useAuth() {
  const { data: user, isLoading, error, refetch } = useQuery<AuthUser | null>({
    queryKey: ["/api/auth/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: false,
    staleTime: Infinity,
    refetchInterval: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });

  const isAuthenticated = !!user && !error;
  const isSuperAdmin = user?.isSuperAdmin ?? false;

  const hasPermission = (permission: Permission): boolean => {
    if (!user) return false;
    if (user.isSuperAdmin) return true;
    return user.permissions.includes(permission);
  };

  const hasRole = (roleName: string): boolean => {
    if (!user) return false;
    if (user.isSuperAdmin && roleName === "admin") return true;
    return user.roles.some(r => r.name === roleName);
  };

  const hasAnyPermission = (permissions: Permission[]): boolean => {
    if (!user) return false;
    if (user.isSuperAdmin) return true;
    return permissions.some(p => user.permissions.includes(p));
  };

  const hasAllPermissions = (permissions: Permission[]): boolean => {
    if (!user) return false;
    if (user.isSuperAdmin) return true;
    return permissions.every(p => user.permissions.includes(p));
  };

  const logout = async () => {
    try {
      await fetch("/api/logout", { method: "POST", credentials: "include" });
    } catch (error) {
      console.error("Logout request failed:", error);
    } finally {
      // Always clear cache and redirect, even if request fails
      queryClient.setQueryData(["/api/auth/user"], null);
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/setup/status"] });
    }
  };

  return {
    user,
    isLoading,
    isAuthenticated,
    isSuperAdmin,
    error,
    hasPermission,
    hasRole,
    hasAnyPermission,
    hasAllPermissions,
    logout,
    refetch,
  };
}

export function useSetupStatus() {
  return useQuery<SetupStatus>({
    queryKey: ["/api/setup/status"],
    staleTime: 0,
  });
}

export function useLogin() {
  return useMutation({
    mutationFn: async (data: { email: string; password: string }) => {
      const res = await apiRequest("POST", "/api/login", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    },
  });
}

export function useLogout() {
  return useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/logout");
      return res.json();
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/auth/user"], null);
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    },
  });
}

export function useSetup() {
  return useMutation({
    mutationFn: async (data: { email: string; password: string; firstName: string; lastName?: string }) => {
      const res = await apiRequest("POST", "/api/setup", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/setup/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    },
  });
}

export function useUsers() {
  return useQuery<any[]>({
    queryKey: ["/api/users"],
  });
}

export function useRoles() {
  return useQuery<{ id: number; name: string; description: string | null }[]>({
    queryKey: ["/api/roles"],
  });
}

export function useAssignRole() {
  return useMutation({
    mutationFn: async ({ userId, roleId }: { userId: string; roleId: number }) => {
      const res = await fetch(`/api/users/${userId}/roles/${roleId}`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to assign role");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
    },
  });
}

export function useRemoveRole() {
  return useMutation({
    mutationFn: async ({ userId, roleId }: { userId: string; roleId: number }) => {
      const res = await fetch(`/api/users/${userId}/roles/${roleId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to remove role");
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
    },
  });
}

export function useCreateUser() {
  return useMutation({
    mutationFn: async (data: { email: string; password: string; firstName: string; lastName?: string; roleId?: number }) => {
      const res = await apiRequest("POST", "/api/users", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
    },
  });
}

export function useUpdateUser() {
  return useMutation({
    mutationFn: async ({ userId, data }: { userId: string; data: { email?: string; firstName?: string; lastName?: string; roleId?: number } }) => {
      const res = await apiRequest("PATCH", `/api/users/${userId}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
    },
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: async ({ userId, password }: { userId: string; password: string }) => {
      const res = await apiRequest("POST", `/api/users/${userId}/reset-password`, { password });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
    },
  });
}

export function useDeleteUser() {
  return useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch(`/api/users/${userId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: "Failed to delete user" }));
        throw new Error(errorData.error || "Failed to delete user");
      }
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
    },
  });
}

export function useUpdateProfile() {
  return useMutation({
    mutationFn: async (data: { firstName?: string; lastName?: string }) => {
      const res = await apiRequest("PATCH", "/api/auth/profile", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    },
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: async (data: { currentPassword: string; newPassword: string }) => {
      const res = await apiRequest("POST", "/api/auth/change-password", data);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: "Failed to change password" }));
        throw new Error(errorData.error || "Failed to change password");
      }
      return res.json();
    },
  });
}
