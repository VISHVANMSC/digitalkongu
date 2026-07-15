'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from '@tanstack/react-table';
import {
  Plus,
  Search,
  Pencil,
  MoreHorizontal,
  ArrowUpDown,
  KeyRound,
  UserCheck,
  UserX,
  Mail,
  Phone,
  Building2,
  Trash2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'COORDINATOR' | 'EVALUATOR';
  isActive: boolean;
  canEdit: boolean;
  phone: string | null;
  organization: string | null;
  createdAt: string;
  _count?: {
    coordinatorAssignments: number;
    evaluatorAssignments: number;
    evaluations: number;
  };
}

const roleColors: Record<string, string> = {
  ADMIN: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  COORDINATOR: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  EVALUATOR: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400',
};

export function UserManager() {
  const token = useAuthStore((s) => s.token);
  const currentUser = useAuthStore((s) => s.user);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [resettingUser, setResettingUser] = useState<UserRow | null>(null);
  const [deletingUser, setDeletingUser] = useState<UserRow | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Create form
  const [createForm, setCreateForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'EVALUATOR' as 'ADMIN' | 'COORDINATOR' | 'EVALUATOR',
    phone: '',
    organization: '',
    canEdit: false,
  });

  // Edit form
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    role: 'EVALUATOR' as 'ADMIN' | 'COORDINATOR' | 'EVALUATOR',
    phone: '',
    organization: '',
    isActive: true,
    canEdit: false,
  });

  // Reset password form
  const [newPassword, setNewPassword] = useState('');

  const fetchUsers = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await fetch('/api/users', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) setUsers(data.data);
    } catch {
      toast.error('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) fetchUsers();
  }, [token, fetchUsers]);

  const resetCreateForm = () => {
    setCreateForm({
      name: '',
      email: '',
      password: '',
      role: 'EVALUATOR',
      phone: '',
      organization: '',
      canEdit: false,
    });
  };

  const openEditDialog = (user: UserRow) => {
    setEditingUser(user);
    setEditForm({
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone || '',
      organization: user.organization || '',
      isActive: user.isActive,
      canEdit: user.canEdit || false,
    });
    setEditDialogOpen(true);
  };

  const handleCreate = async () => {
    if (!createForm.name.trim() || !createForm.email.trim() || !createForm.password.trim()) {
      toast.error('Name, email, and password are required');
      return;
    }
    try {
      setSubmitting(true);
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: createForm.name.trim(),
          email: createForm.email.trim(),
          password: createForm.password,
          role: createForm.role,
          phone: createForm.phone.trim() || undefined,
          organization: createForm.organization.trim() || undefined,
          canEdit: createForm.canEdit,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('User created');
        setCreateDialogOpen(false);
        resetCreateForm();
        fetchUsers(true);
      } else {
        toast.error(data.error || 'Creation failed');
      }
    } catch {
      toast.error('An error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if (!editingUser) return;
    if (!editForm.name.trim() || !editForm.email.trim()) {
      toast.error('Name and email are required');
      return;
    }
    try {
      setSubmitting(true);
      const isSelf = currentUser?.id === editingUser.id;
      const body: Record<string, unknown> = {
        name: editForm.name.trim(),
        email: editForm.email.trim(),
        phone: editForm.phone.trim() || null,
        organization: editForm.organization.trim() || null,
        canEdit: editForm.canEdit,
      };
      // Only admin can change role (but not for self)
      if (!isSelf) {
        body.role = editForm.role;
      }

      const res = await fetch(`/api/users/${editingUser.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('User updated');
        setEditDialogOpen(false);
        setEditingUser(null);
        fetchUsers(true);
      } else {
        toast.error(data.error || 'Update failed');
      }
    } catch {
      toast.error('An error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (user: UserRow) => {
    if (user.id === currentUser?.id) {
      toast.error('Cannot disable your own account');
      return;
    }
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ isActive: !user.isActive }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(user.isActive ? 'User disabled' : 'User enabled');
        fetchUsers(true);
      } else {
        toast.error(data.error || 'Operation failed');
      }
    } catch {
      toast.error('An error occurred');
    }
  };

  const handleResetPassword = async () => {
    if (!resettingUser || !newPassword.trim()) {
      toast.error('New password is required');
      return;
    }
    try {
      setSubmitting(true);
      const res = await fetch(`/api/users/${resettingUser.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ password: newPassword }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Password reset successfully');
        setResetDialogOpen(false);
        setResettingUser(null);
        setNewPassword('');
      } else {
        toast.error(data.error || 'Reset failed');
      }
    } catch {
      toast.error('An error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredUsers = useMemo(() => {
    if (roleFilter === 'all') return users;
    return users.filter((u) => u.role === roleFilter);
  }, [users, roleFilter]);

  const handleBulkStatusChange = async (isActive: boolean) => {
    const selectedIds = Object.keys(rowSelection).filter((key) => rowSelection[key]);
    const selectedUsers = users.filter((u) => selectedIds.includes(u.id));
    if (selectedUsers.length === 0) return;

    try {
      setSubmitting(true);
      const promises = selectedUsers.map((user) =>
        fetch(`/api/users/${user.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ isActive }),
        })
      );

      const results = await Promise.all(promises);
      let successCount = 0;
      for (const res of results) {
        const data = await res.json();
        if (data.success) successCount++;
      }

      toast.success(`Successfully updated ${successCount} user(s)`);
      setRowSelection({});
      fetchUsers(true);
    } catch {
      toast.error('An error occurred during bulk update');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deletingUser) return;
    try {
      setSubmitting(true);
      const res = await fetch(`/api/users/${deletingUser.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`User ${deletingUser.name} permanently deleted`);
        fetchUsers(true);
      } else {
        toast.error(data.error || 'Delete failed');
      }
    } catch {
      toast.error('An error occurred');
    } finally {
      setSubmitting(false);
      setDeleteDialogOpen(false);
      setDeletingUser(null);
    }
  };

  const handleBulkDeleteUsers = async () => {
    if (selectedUsers.length === 0) return;
    try {
      setSubmitting(true);
      const promises = selectedUsers.map((user) =>
        fetch(`/api/users/${user.id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        })
      );

      const results = await Promise.all(promises);
      let successCount = 0;
      for (const res of results) {
        const data = await res.json();
        if (data.success) successCount++;
      }

      toast.success(`Successfully deleted ${successCount} user(s)`);
      setRowSelection({});
      setBulkDeleteDialogOpen(false);
      fetchUsers(true);
    } catch {
      toast.error('An error occurred during bulk deletion');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedIds = useMemo(() => {
    return Object.keys(rowSelection).filter((key) => rowSelection[key]);
  }, [rowSelection]);

  const selectedUsers = useMemo(() => {
    return users.filter((u) => selectedIds.includes(u.id));
  }, [users, selectedIds]);

  const columns: ColumnDef<UserRow>[] = useMemo(
    () => [
      {
        id: 'select',
        header: ({ table }) => (
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() && 'indeterminate')
            }
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
            aria-label="Select all"
          />
        ),
        cell: ({ row }) => {
          const user = row.original;
          const isSelf = currentUser?.id === user.id;
          return (
            <Checkbox
              checked={row.getIsSelected()}
              onCheckedChange={(value) => row.toggleSelected(!!value)}
              disabled={isSelf}
              aria-label="Select row"
            />
          );
        },
        enableSorting: false,
        enableHiding: false,
      },
      {
        accessorKey: 'name',
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="-ml-4"
          >
            Name
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => {
          const user = row.original;
          return (
            <div className="flex items-center gap-2">
              <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold ${
                user.isActive
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                  : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
              }`}>
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-medium text-sm">{user.name}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  {user.email}
                </p>
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: 'role',
        header: 'Role',
        cell: ({ row }) => {
          const role = row.getValue('role') as string;
          return (
            <Badge className={roleColors[role] || ''} variant="secondary">
              {role}
            </Badge>
          );
        },
      },
      {
        accessorKey: 'phone',
        header: 'Phone',
        cell: ({ row }) => {
          const phone = row.getValue('phone') as string | null;
          return phone ? (
            <span className="text-sm flex items-center gap-1">
              <Phone className="h-3 w-3 text-muted-foreground" />
              {phone}
            </span>
          ) : (
            <span className="text-muted-foreground text-sm">—</span>
          );
        },
      },
      {
        accessorKey: 'organization',
        header: 'Organization',
        cell: ({ row }) => {
          const org = row.getValue('organization') as string | null;
          return org ? (
            <span className="text-sm flex items-center gap-1">
              <Building2 className="h-3 w-3 text-muted-foreground" />
              {org}
            </span>
          ) : (
            <span className="text-muted-foreground text-sm">—</span>
          );
        },
      },
      {
        accessorKey: 'isActive',
        header: 'Status',
        cell: ({ row }) => {
          const isActive = row.getValue('isActive') as boolean;
          return (
            <Badge
              variant="secondary"
              className={
                isActive
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
                  : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
              }
            >
              {isActive ? 'Active' : 'Disabled'}
            </Badge>
          );
        },
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          const user = row.original;
          const isSelf = currentUser?.id === user.id;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => openEditDialog(user)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleToggleActive(user)}
                  disabled={isSelf}
                >
                  {user.isActive ? (
                    <>
                      <UserX className="mr-2 h-4 w-4" />
                      Disable
                    </>
                  ) : (
                    <>
                      <UserCheck className="mr-2 h-4 w-4" />
                      Enable
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => {
                    setResettingUser(user);
                    setNewPassword('');
                    setResetDialogOpen(true);
                  }}
                >
                  <KeyRound className="mr-2 h-4 w-4" />
                  Reset Password
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => {
                    setDeletingUser(user);
                    setDeleteDialogOpen(true);
                  }}
                  disabled={isSelf}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete User
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    [currentUser]
  );

  const table = useReactTable({
    data: filteredUsers,
    columns,
    state: { sorting, globalFilter, rowSelection },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onRowSelectionChange: setRowSelection,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Card className="shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-xl">Users</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Manage users and role assignments
              </p>
            </div>
            <Button
              onClick={() => { resetCreateForm(); setCreateDialogOpen(true); }}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <Plus className="mr-2 h-4 w-4" />
              New User
            </Button>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 mt-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                className="pl-9"
              />
            </div>
            <Tabs value={roleFilter} onValueChange={setRoleFilter}>
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="ADMIN">Admin</TabsTrigger>
                <TabsTrigger value="COORDINATOR">Coord.</TabsTrigger>
                <TabsTrigger value="EVALUATOR">Eval.</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent>
          <AnimatePresence>
            {selectedUsers.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex flex-col sm:flex-row items-center justify-between gap-4 p-3 mb-4 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 rounded-xl overflow-hidden"
              >
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800/30 font-medium">
                    {selectedUsers.length} selected
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    Perform action on selected users:
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-emerald-200 text-emerald-800 hover:bg-emerald-50 dark:border-emerald-900/50 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
                    onClick={() => handleBulkStatusChange(true)}
                    disabled={submitting}
                  >
                    Enable Selected
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-red-200 text-red-800 hover:bg-red-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/30"
                    onClick={() => handleBulkStatusChange(false)}
                    disabled={submitting}
                  >
                    Disable Selected
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-red-300 bg-red-50/50 text-red-950 hover:bg-red-100 dark:border-red-950 dark:bg-red-950/20 dark:text-red-400 dark:hover:bg-red-950/40"
                    onClick={() => setBulkDeleteDialogOpen(true)}
                    disabled={submitting}
                  >
                    Delete Selected
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setRowSelection({})}
                    disabled={submitting}
                  >
                    Cancel
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          {loading && users.length === 0 ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <TableHead key={header.id}>
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
                        </TableHead>
                      ))}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows.length ? (
                    table.getRowModel().rows.map((row) => (
                      <TableRow key={row.id}>
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id}>
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext()
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={columns.length}
                        className="h-24 text-center text-muted-foreground"
                      >
                        No users found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              <div className="flex items-center justify-between py-4">
                <p className="text-sm text-muted-foreground">
                  {table.getFilteredRowModel().rows.length} user(s) total
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => table.previousPage()}
                    disabled={!table.getCanPreviousPage()}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => table.nextPage()}
                    disabled={!table.getCanNextPage()}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create User Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={(open) => { if (!open) resetCreateForm(); setCreateDialogOpen(open); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create User</DialogTitle>
            <DialogDescription>
              Add a new user to the platform.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="createName">Name *</Label>
              <Input
                id="createName"
                value={createForm.name}
                onChange={(e) =>
                  setCreateForm({ ...createForm, name: e.target.value })
                }
                placeholder="Full name"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="createEmail">Email *</Label>
              <Input
                id="createEmail"
                type="email"
                value={createForm.email}
                onChange={(e) =>
                  setCreateForm({ ...createForm, email: e.target.value })
                }
                placeholder="email@example.com"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="createPassword">Password *</Label>
              <Input
                id="createPassword"
                type="password"
                value={createForm.password}
                onChange={(e) =>
                  setCreateForm({ ...createForm, password: e.target.value })
                }
                placeholder="Minimum 8 characters"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="createRole">Role</Label>
              <Select
                value={createForm.role}
                onValueChange={(v) =>
                  setCreateForm({
                    ...createForm,
                    role: v as 'ADMIN' | 'COORDINATOR' | 'EVALUATOR',
                  })
                }
              >
                <SelectTrigger id="createRole">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                  <SelectItem value="COORDINATOR">Coordinator</SelectItem>
                  <SelectItem value="EVALUATOR">Evaluator</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="createPhone">Phone</Label>
                <Input
                  id="createPhone"
                  value={createForm.phone}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, phone: e.target.value })
                  }
                  placeholder="Phone number"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="createOrg">Organization</Label>
                <Input
                  id="createOrg"
                  value={createForm.organization}
                  onChange={(e) =>
                    setCreateForm({
                      ...createForm,
                      organization: e.target.value,
                    })
                  }
                  placeholder="Organization"
                />
              </div>
            </div>
            {createForm.role === 'COORDINATOR' && (
              <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
                <div>
                  <Label className="text-sm font-medium">Participant Editing Rights</Label>
                  <p className="text-xs text-muted-foreground">
                    Allow coordinator to view and edit entire team & participant details.
                  </p>
                </div>
                <Switch
                  checked={createForm.canEdit}
                  onCheckedChange={(checked) =>
                    setCreateForm({ ...createForm, canEdit: checked })
                  }
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setCreateDialogOpen(false); resetCreateForm(); }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={submitting}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {submitting ? 'Creating...' : 'Create User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update user details.
              {editingUser && currentUser?.id === editingUser.id && (
                <span className="block mt-1 text-amber-600 dark:text-amber-400">
                  You cannot change your own role.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="editName">Name *</Label>
              <Input
                id="editName"
                value={editForm.name}
                onChange={(e) =>
                  setEditForm({ ...editForm, name: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="editEmail">Email *</Label>
              <Input
                id="editEmail"
                type="email"
                value={editForm.email}
                onChange={(e) =>
                  setEditForm({ ...editForm, email: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="editRole">Role</Label>
              <Select
                value={editForm.role}
                onValueChange={(v) =>
                  setEditForm({
                    ...editForm,
                    role: v as 'ADMIN' | 'COORDINATOR' | 'EVALUATOR',
                  })
                }
                disabled={editingUser?.id === currentUser?.id}
              >
                <SelectTrigger id="editRole">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                  <SelectItem value="COORDINATOR">Coordinator</SelectItem>
                  <SelectItem value="EVALUATOR">Evaluator</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="editPhone">Phone</Label>
                <Input
                  id="editPhone"
                  value={editForm.phone}
                  onChange={(e) =>
                    setEditForm({ ...editForm, phone: e.target.value })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="editOrg">Organization</Label>
                <Input
                  id="editOrg"
                  value={editForm.organization}
                  onChange={(e) =>
                    setEditForm({ ...editForm, organization: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div>
                <Label className="text-sm font-medium">Account Status</Label>
                <p className="text-xs text-muted-foreground">
                  {editForm.isActive ? 'User is currently active' : 'User is currently disabled'}
                </p>
              </div>
              <Switch
                checked={editForm.isActive}
                onCheckedChange={(checked) =>
                  setEditForm({ ...editForm, isActive: checked })
                }
                disabled={editingUser?.id === currentUser?.id}
              />
            </div>
            {editForm.role === 'COORDINATOR' && (
              <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
                <div>
                  <Label className="text-sm font-medium">Participant Editing Rights</Label>
                  <p className="text-xs text-muted-foreground">
                    Allow coordinator to view and edit entire team & participant details.
                  </p>
                </div>
                <Switch
                  checked={editForm.canEdit}
                  onCheckedChange={(checked) =>
                    setEditForm({ ...editForm, canEdit: checked })
                  }
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleEdit}
              disabled={submitting}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {submitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Set a new password for {resettingUser?.name}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="newPassword">New Password *</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimum 8 characters"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setResetDialogOpen(false); setResettingUser(null); setNewPassword(''); }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleResetPassword}
              disabled={submitting}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {submitting ? 'Resetting...' : 'Reset Password'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600 dark:text-red-400">Delete User Account</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete the user account for <strong>{deletingUser?.name} ({deletingUser?.email})</strong>?
              <span className="block mt-2 text-xs text-red-700 dark:text-red-400 border-l-2 border-red-500 pl-3 bg-red-50/50 dark:bg-red-950/20 py-2 rounded">
                <strong>WARNING:</strong> This is a permanent action. Deleting this user will automatically delete all of their coordinator/evaluator assignments and evaluations. This cannot be undone.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
            <Button
              disabled={submitting}
              onClick={handleDeleteUser}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {submitting ? 'Deleting...' : 'Permanently Delete'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Confirmation */}
      <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600 dark:text-red-400">Delete Multiple Accounts</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete the <strong>{selectedUsers.length}</strong> selected user accounts?
              <span className="block mt-2 text-xs text-red-700 dark:text-red-400 border-l-2 border-red-500 pl-3 bg-red-50/50 dark:bg-red-950/20 py-2 rounded">
                <strong>WARNING:</strong> This is a permanent action. Deleting these users will automatically delete all of their coordinator/evaluator assignments and evaluations. This cannot be undone.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
            <Button
              disabled={submitting}
              onClick={handleBulkDeleteUsers}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {submitting ? 'Deleting...' : 'Permanently Delete Selected'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}
