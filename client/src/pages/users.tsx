import { useAuth, useUsers, useRoles, useAssignRole, useRemoveRole, useCreateUser, useUpdateUser, useResetPassword, useDeleteUser } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Users as UsersIcon, Shield, UserPlus, X, Pencil, Key, Trash2 } from "lucide-react";
import { useState } from "react";

interface UserRole {
  id: number;
  name: string;
  description?: string | null;
}

interface UserData {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  isSuperAdmin: boolean;
  roles: UserRole[];
}

export default function Users() {
  const { user: currentUser, hasPermission } = useAuth();
  const { data: users, isLoading: usersLoading } = useUsers();
  const { data: roles, isLoading: rolesLoading } = useRoles();
  const assignRole = useAssignRole();
  const removeRole = useRemoveRole();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const resetPassword = useResetPassword();
  const deleteUser = useDeleteUser();
  const { toast } = useToast();
  
  const [selectedRoles, setSelectedRoles] = useState<Record<string, string>>({});
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [resetPasswordDialogOpen, setResetPasswordDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  
  const [addForm, setAddForm] = useState({ email: "", password: "", confirmPassword: "", firstName: "", lastName: "", roleId: "" });
  const [editForm, setEditForm] = useState({ email: "", firstName: "", lastName: "", roleId: "" });
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  const canCreate = hasPermission("users:create");
  const canAssignRoles = hasPermission("users:assign_role");
  const canDelete = hasPermission("users:delete");

  const handleAssignRole = async (userId: string) => {
    const roleId = selectedRoles[userId];
    if (!roleId) return;

    try {
      await assignRole.mutateAsync({ userId, roleId: parseInt(roleId) });
      toast({ title: "Role assigned successfully" });
      setSelectedRoles(prev => ({ ...prev, [userId]: "" }));
    } catch {
      toast({ title: "Failed to assign role", variant: "destructive" });
    }
  };

  const handleRemoveRole = async (userId: string, roleId: number) => {
    try {
      await removeRole.mutateAsync({ userId, roleId });
      toast({ title: "Role removed successfully" });
    } catch {
      toast({ title: "Failed to remove role", variant: "destructive" });
    }
  };

  const handleAddUser = async () => {
    if (addForm.password !== addForm.confirmPassword) {
      toast({ title: "Passwords do not match", variant: "destructive" });
      return;
    }
    if (addForm.password.length < 8) {
      toast({ title: "Password must be at least 8 characters", variant: "destructive" });
      return;
    }

    try {
      await createUser.mutateAsync({
        email: addForm.email,
        password: addForm.password,
        firstName: addForm.firstName,
        lastName: addForm.lastName || undefined,
        roleId: addForm.roleId ? parseInt(addForm.roleId) : undefined,
      });
      toast({ title: "User created successfully" });
      setAddDialogOpen(false);
      setAddForm({ email: "", password: "", confirmPassword: "", firstName: "", lastName: "", roleId: "" });
    } catch (error) {
      toast({ title: error instanceof Error ? error.message : "Failed to create user", variant: "destructive" });
    }
  };

  const handleEditUser = async () => {
    if (!selectedUser) return;

    try {
      await updateUser.mutateAsync({
        userId: selectedUser.id,
        data: {
          email: editForm.email || undefined,
          firstName: editForm.firstName || undefined,
          lastName: editForm.lastName || undefined,
          roleId: editForm.roleId ? parseInt(editForm.roleId) : undefined,
        },
      });
      toast({ title: "User updated successfully" });
      setEditDialogOpen(false);
      setSelectedUser(null);
    } catch (error) {
      toast({ title: error instanceof Error ? error.message : "Failed to update user", variant: "destructive" });
    }
  };

  const handleResetPassword = async () => {
    if (!selectedUser) return;

    if (newPassword !== confirmNewPassword) {
      toast({ title: "Passwords do not match", variant: "destructive" });
      return;
    }
    if (newPassword.length < 8) {
      toast({ title: "Password must be at least 8 characters", variant: "destructive" });
      return;
    }

    try {
      await resetPassword.mutateAsync({ userId: selectedUser.id, password: newPassword });
      toast({ title: "Password reset successfully" });
      setResetPasswordDialogOpen(false);
      setSelectedUser(null);
      setNewPassword("");
      setConfirmNewPassword("");
    } catch (error) {
      toast({ title: error instanceof Error ? error.message : "Failed to reset password", variant: "destructive" });
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      await deleteUser.mutateAsync(userId);
      toast({ title: "User deleted successfully" });
    } catch (error) {
      toast({ title: error instanceof Error ? error.message : "Failed to delete user", variant: "destructive" });
    }
  };

  const openEditDialog = (user: UserData) => {
    setSelectedUser(user);
    setEditForm({
      email: user.email,
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      roleId: user.roles?.[0]?.id?.toString() || "",
    });
    setEditDialogOpen(true);
  };

  const openResetPasswordDialog = (user: UserData) => {
    setSelectedUser(user);
    setNewPassword("");
    setConfirmNewPassword("");
    setResetPasswordDialogOpen(true);
  };

  const getInitials = (firstName?: string | null, lastName?: string | null, email?: string | null) => {
    if (firstName && lastName) {
      return `${firstName[0]}${lastName[0]}`.toUpperCase();
    }
    if (email) {
      return email[0].toUpperCase();
    }
    return "U";
  };

  const canManageUser = (user: UserData) => {
    if (currentUser?.id === user.id) return false;
    if (user.isSuperAdmin && !currentUser?.isSuperAdmin) return false;
    return true;
  };

  if (usersLoading || rolesLoading) {
    return (
      <div className="flex-1 p-6 space-y-6 overflow-auto">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Skeleton className="h-8 w-32 mb-2" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        <div className="grid gap-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 space-y-6 overflow-auto">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2" data-testid="text-page-title">
            <UsersIcon className="w-6 h-6" />
            Users
          </h1>
          <p className="text-muted-foreground">
            Manage users and their role assignments
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canCreate && (
            <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-add-user">
                  <UserPlus className="w-4 h-4 mr-2" />
                  Add User
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New User</DialogTitle>
                  <DialogDescription>Create a new user account with email and password.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="add-email">Email</Label>
                    <Input
                      id="add-email"
                      type="email"
                      value={addForm.email}
                      onChange={e => setAddForm(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="user@example.com"
                      data-testid="input-add-email"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="add-firstName">First Name</Label>
                      <Input
                        id="add-firstName"
                        value={addForm.firstName}
                        onChange={e => setAddForm(prev => ({ ...prev, firstName: e.target.value }))}
                        placeholder="John"
                        data-testid="input-add-first-name"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="add-lastName">Last Name</Label>
                      <Input
                        id="add-lastName"
                        value={addForm.lastName}
                        onChange={e => setAddForm(prev => ({ ...prev, lastName: e.target.value }))}
                        placeholder="Doe"
                        data-testid="input-add-last-name"
                      />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="add-password">Password</Label>
                    <Input
                      id="add-password"
                      type="password"
                      value={addForm.password}
                      onChange={e => setAddForm(prev => ({ ...prev, password: e.target.value }))}
                      placeholder="Min 8 characters"
                      data-testid="input-add-password"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="add-confirm-password">Confirm Password</Label>
                    <Input
                      id="add-confirm-password"
                      type="password"
                      value={addForm.confirmPassword}
                      onChange={e => setAddForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                      placeholder="Confirm password"
                      data-testid="input-add-confirm-password"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="add-role">Role</Label>
                    <Select value={addForm.roleId} onValueChange={value => setAddForm(prev => ({ ...prev, roleId: value }))}>
                      <SelectTrigger data-testid="select-add-role">
                        <SelectValue placeholder="Select a role" />
                      </SelectTrigger>
                      <SelectContent>
                        {roles?.map(role => (
                          <SelectItem key={role.id} value={role.id.toString()}>{role.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Cancel</Button>
                  <Button onClick={handleAddUser} disabled={createUser.isPending} data-testid="button-confirm-add-user">
                    {createUser.isPending ? "Creating..." : "Create User"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
          <Badge variant="secondary" className="gap-1">
            <Shield className="w-3 h-3" />
            {users?.length || 0} users
          </Badge>
        </div>
      </div>

      <div className="grid gap-4">
        {(users as UserData[])?.map((user) => (
          <Card key={user.id} data-testid={`card-user-${user.id}`}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarImage src={user.profileImageUrl || undefined} />
                    <AvatarFallback>
                      {getInitials(user.firstName, user.lastName, user.email)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium text-foreground flex items-center gap-2" data-testid={`text-user-name-${user.id}`}>
                      {user.firstName && user.lastName 
                        ? `${user.firstName} ${user.lastName}` 
                        : user.email || "Unknown User"}
                      {user.isSuperAdmin && (
                        <Badge variant="default" className="text-xs">Super Admin</Badge>
                      )}
                    </div>
                    {user.email && (
                      <div className="text-sm text-muted-foreground">
                        {user.email}
                      </div>
                    )}
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      {user.roles?.map((role) => (
                        <Badge key={role.id} variant="outline" className="gap-1">
                          {role.name}
                          {canAssignRoles && canManageUser(user) && (
                            <button
                              onClick={() => handleRemoveRole(user.id, role.id)}
                              className="ml-1 hover-elevate rounded-full"
                              data-testid={`button-remove-role-${user.id}-${role.id}`}
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </Badge>
                      ))}
                      {(!user.roles || user.roles.length === 0) && !user.isSuperAdmin && (
                        <span className="text-sm text-muted-foreground">No roles assigned</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {canAssignRoles && canManageUser(user) && (
                    <>
                      <Select
                        value={selectedRoles[user.id] || ""}
                        onValueChange={(value) => setSelectedRoles(prev => ({ ...prev, [user.id]: value }))}
                      >
                        <SelectTrigger className="w-32" data-testid={`select-role-${user.id}`}>
                          <SelectValue placeholder="Add role" />
                        </SelectTrigger>
                        <SelectContent>
                          {roles?.filter(role => 
                            !user.roles?.some((r) => r.id === role.id)
                          ).map(role => (
                            <SelectItem key={role.id} value={role.id.toString()}>
                              {role.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleAssignRole(user.id)}
                        disabled={!selectedRoles[user.id] || assignRole.isPending}
                        data-testid={`button-assign-role-${user.id}`}
                      >
                        Assign
                      </Button>
                    </>
                  )}
                  
                  {canManageUser(user) && (
                    <>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => openEditDialog(user)}
                        data-testid={`button-edit-user-${user.id}`}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => openResetPasswordDialog(user)}
                        data-testid={`button-reset-password-${user.id}`}
                      >
                        <Key className="w-4 h-4" />
                      </Button>
                      {canDelete && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              data-testid={`button-delete-user-${user.id}`}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete User</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete {user.firstName ? `${user.firstName} ${user.lastName}` : user.email}? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteUser(user.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                data-testid={`button-confirm-delete-${user.id}`}
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </>
                  )}

                  {currentUser?.id === user.id && (
                    <Badge variant="secondary">You</Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {(!users || users.length === 0) && (
          <Card>
            <CardContent className="p-8 text-center">
              <UsersIcon className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No users found</p>
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Available Roles</CardTitle>
          <CardDescription>
            Overview of roles and their permissions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {roles?.map(role => (
              <div key={role.id} className="border rounded-md p-4">
                <div className="font-medium capitalize mb-1">{role.name}</div>
                <p className="text-sm text-muted-foreground">{role.description}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>Update user information and role.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={editForm.email}
                onChange={e => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                data-testid="input-edit-email"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-firstName">First Name</Label>
                <Input
                  id="edit-firstName"
                  value={editForm.firstName}
                  onChange={e => setEditForm(prev => ({ ...prev, firstName: e.target.value }))}
                  data-testid="input-edit-first-name"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-lastName">Last Name</Label>
                <Input
                  id="edit-lastName"
                  value={editForm.lastName}
                  onChange={e => setEditForm(prev => ({ ...prev, lastName: e.target.value }))}
                  data-testid="input-edit-last-name"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-role">Role</Label>
              <Select value={editForm.roleId} onValueChange={value => setEditForm(prev => ({ ...prev, roleId: value }))}>
                <SelectTrigger data-testid="select-edit-role">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">No role</SelectItem>
                  {roles?.map(role => (
                    <SelectItem key={role.id} value={role.id.toString()}>{role.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleEditUser} disabled={updateUser.isPending} data-testid="button-confirm-edit-user">
              {updateUser.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={resetPasswordDialogOpen} onOpenChange={setResetPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Set a new password for {selectedUser?.firstName ? `${selectedUser.firstName} ${selectedUser.lastName}` : selectedUser?.email}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Min 8 characters"
                data-testid="input-new-password"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="confirm-new-password">Confirm Password</Label>
              <Input
                id="confirm-new-password"
                type="password"
                value={confirmNewPassword}
                onChange={e => setConfirmNewPassword(e.target.value)}
                placeholder="Confirm new password"
                data-testid="input-confirm-new-password"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetPasswordDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleResetPassword} disabled={resetPassword.isPending} data-testid="button-confirm-reset-password">
              {resetPassword.isPending ? "Resetting..." : "Reset Password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
